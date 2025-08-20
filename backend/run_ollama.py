"""
Ollama 런타임 관리 유틸리티
-------------------------

실행 환경에 따라 Ollama 서버를 준비(ready)시키기 위한 헬퍼를 제공합니다.

동작 개요:
- Docker 환경(`IN_DOCKER=true`): 이미 띄워진 Ollama 컨테이너의 HTTP 상태(`/api/tags`)만 폴링하여 대기
- 로컬/EXE: 우선 HTTP로 연결 시도 → 준비 안 되어 있으면 `ollama serve`를 백그라운드로 스폰하고 readiness 대기

주요 함수:
- `ensure_ollama_ready`: 위 로직을 캡슐화하여 Ollama가 준비될 때까지 대기. 필요 시 프로세스 스폰
- `spawn_ollama`: 로컬에서 `ollama serve`를 백그라운드로 실행
- `find_ollama_executable`: 플랫폼/배포 형태별 ollama 바이너리 탐색
- `wait_for_http`: HTTP ready 상태를 폴링
- `pull_model`: Ollama HTTP API로 모델 다운로드(`/api/pull`)

환경 변수:
- `OLLAMA_API_URL` (기본 `http://localhost:11434`)
- `IN_DOCKER` ("1"/"true"/"yes" → Docker 모드)
- `OLLAMA_EMBEDDED` (현재 로직에서 직접 사용하지 않지만, 배포 정책에 따라 내장 실행 여부에 활용 가능)
"""

import os
import sys
import time
import json
import logging
import requests
import subprocess
import shutil
from pathlib import Path
import contextlib
from typing import Optional

__all__ = ("ensure_ollama_ready", "pull_model", "spawn_ollama")

# --- 공통 환경설정 ---
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434").rstrip("/")
IN_DOCKER = os.getenv("IN_DOCKER", "").lower() in ("1", "true", "yes")
# EXE 모드에서 자동으로 내부 ollama를 띄우고 싶으면 true로 (기본 False: 먼저 외부 실행 인스턴스에 붙어봄)
OLLAMA_EMBEDDED = os.getenv("OLLAMA_EMBEDDED", "").lower() in ("1", "true", "yes")


def _api(url: str, path: str) -> str:
    """API 엔드포인트를 조합합니다.

    Args:
        url: 베이스 URL (예: http://localhost:11434)
        path: 엔드포인트 경로 (예: /api/tags)
    """
    return f"{url.rstrip('/')}{path}"


def _is_ready(url: str, timeout: float = 3.0) -> bool:
    try:
        r = requests.get(_api(url, "/api/tags"), timeout=timeout)
        return r.ok
    except Exception:
        return False


def wait_for_http(url: str, timeout: int = 120, interval: float = 1.5) -> None:
    """Ollama HTTP(/api/tags)가 응답할 때까지 대기.

    Args:
        url: Ollama 베이스 URL
        timeout: 최대 대기 시간(초)
        interval: 폴링 간격(초)

    Raises:
        TimeoutError: 지정 시간 내 준비되지 않은 경우
    """
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            r = requests.get(_api(url, "/api/tags"), timeout=3)
            if r.ok:
                logging.info("✅ Ollama ready at %s", url)
                return
        except Exception as e:
            last_err = e
        time.sleep(interval)
    raise TimeoutError(f"Ollama not ready at {url}: {last_err}")


def find_ollama_executable() -> Path:
    """
    Ollama 실행 파일 후보 경로:
      1) PyInstaller onedir: <exe>/ollama/ollama(.exe)
      2) Windows: %LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe
      3) PATH: shutil.which('ollama' / 'ollama.exe')
    """
    exe_name = "ollama.exe" if os.name == "nt" else "ollama"

    # 1) 패키징(onedev/onedir)된 exe 옆 경로
    if getattr(sys, "frozen", False):
        local = Path(sys.executable).parent / "ollama" / exe_name
        if local.exists():
            return local

    # 2) Windows 전역 설치 경로
    if os.name == "nt":
        localapp = os.getenv("LOCALAPPDATA", "")
        prog = Path(localapp) / "Programs" / "Ollama" / exe_name
        if prog.exists():
            return prog

    # 3) PATH
    which_path = shutil.which(exe_name)
    if which_path:
        return Path(which_path)

    raise FileNotFoundError(
        "Ollama 실행 파일을 찾을 수 없습니다.\n"
        " - (EXE 배포 시) 앱 폴더의 ollama/ 내부에 바이너리가 있는지\n"
        " - (Windows) %LOCALAPPDATA%\\Programs\\Ollama 경로에 설치됐는지\n"
        " - PATH에 ollama(.exe)가 잡히는지 확인하세요."
    )


def spawn_ollama() -> subprocess.Popen:
    """EXE/로컬에서 `ollama serve`를 백그라운드 실행합니다.

    Returns:
        subprocess.Popen: 실행 중인 ollama 프로세스 핸들
    """
    path = find_ollama_executable()
    cmd = [str(path), "serve"]
    logging.info("▶️ spawn ollama: %s", " ".join(cmd))

    # Windows: 종료 신호 분리를 위해 새 프로세스 그룹으로 실행
    creationflags = 0
    if os.name == "nt":
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)

    return subprocess.Popen(cmd, shell=False, creationflags=creationflags)


def ensure_ollama_ready(timeout: int = 120) -> Optional[subprocess.Popen]:
    """
    Ollama가 준비될 때까지 대기하고, 필요 시 백그라운드로 `ollama serve`를 기동합니다.

    - Docker: spawn 금지, HTTP 준비 대기만 수행
    - 로컬/EXE: 준비 안 되어 있으면 `serve` 프로세스를 스폰 후 readiness 대기

    Returns:
        Optional[subprocess.Popen]: 스폰한 프로세스 핸들(도커/이미 실행 중이면 None)

    Raises:
        RuntimeError: 스폰했지만 준비에 실패한 경우(리소스 정리 후 예외)
    """
    if IN_DOCKER:
        logging.info("Docker mode detected (IN_DOCKER=true). Not spawning ollama; waiting for %s", OLLAMA_API_URL)
        wait_for_http(OLLAMA_API_URL, timeout=timeout)
        return None

    # 로컬/EXE: 이미 떠 있으면 그대로 사용
    if _is_ready(OLLAMA_API_URL, timeout=2):
        logging.info("Ollama already running at %s", OLLAMA_API_URL)
        return None

    # 준비 안 되어 있으면 serve 스폰 → readiness 대기
    proc = spawn_ollama()
    try:
        wait_for_http(OLLAMA_API_URL, timeout=timeout)
        logging.info("✅ Embedded Ollama started and ready at %s", OLLAMA_API_URL)
        return proc
    except Exception as e:
        # 준비 실패 시 프로세스 정리 후 에러 전파
        with contextlib.suppress(Exception):
            proc.terminate()
        raise RuntimeError(
            f"Failed to start embedded Ollama at {OLLAMA_API_URL}: {e}\n"
            f"Check that Ollama is installed, or point OLLAMA_API_URL to a reachable instance."
        ) from e


def pull_model(name: str, read_timeout: int = 1800) -> bool:
    """
    Ollama HTTP API로 모델을 다운로드(/api/pull)합니다.

    Notes:
        - 스트리밍 응답을 순회하며 "status": "success" 메시지를 확인합니다.
        - HTTP API만 사용(CLI 금지)하여 일관된 배포 환경을 유지합니다.
    """
    with requests.post(
        _api(OLLAMA_API_URL, "/api/pull"),
        json={"name": name},  # ← key는 반드시 name
        stream=True,
        timeout=(5, read_timeout),
    ) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            try:
                msg = json.loads(line.decode("utf-8"))
                if msg.get("status") == "success":
                    logging.info("✅ model '%s' ready", name)
                    return True
            except Exception:
                pass
    return False
