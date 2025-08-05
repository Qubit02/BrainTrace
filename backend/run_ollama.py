'''
src/ollama_db/run_ollama.py

앱 실행 시 ollama 서버 기동하는 파이썬 모듈입니다.
'''

# backend/run_ollama.py

import os
import sys
import subprocess
import logging
import asyncio
import shutil
from pathlib import Path

__all__ = ("run_ollama", "wait_for_port")

def find_ollama_executable() -> Path:
    """
    Ollama 바이너리를 다음 위치에서 순차 검색:
      1) onedir 패키징된 앱 옆의 ollama/ollama(.exe)
      2) Windows 전역 설치 경로 (%LOCALAPPDATA%\\Programs\\Ollama)
      3) PATH 환경변수 (shutil.which)
    """
    exe_name = "ollama.exe" if os.name == "nt" else "ollama"

    # 1) onedir 모드: exe와 같은 폴더 안의 ollama/
    if getattr(sys, "frozen", False):
        local = Path(sys.executable).parent / "ollama" / exe_name
        if local.exists():
            return local  # 패키징 번들 사용

    # 2) 윈도우 전역 설치 위치 (%LOCALAPPDATA%\Programs\Ollama)
    if os.name == "nt":
        localapp = os.getenv("LOCALAPPDATA", "")
        prog_path = Path(localapp) / "Programs" / "Ollama" / exe_name
        if prog_path.exists():
            return prog_path  # 공식 설치 프로그램 경로 :contentReference[oaicite:0]{index=0}

    # 3) PATH 검색
    which_path = shutil.which(exe_name)
    if which_path:
        return Path(which_path)  # 환경 변수에 설정된 Ollama

    raise FileNotFoundError(
        "Ollama 실행 파일을 찾을 수 없습니다.\n"
        "– 로컬 ollama/ 폴더에 있는지 확인\n"
        "– %LOCALAPPDATA%\\Programs\\Ollama 경로에 설치됐는지 확인\n"
        "– PATH 환경변수에 ollama.exe 가 추가됐는지 확인"
    )

def run_ollama() -> subprocess.Popen:
    """
    Ollama API 서버(serve)를 백그라운드에서 실행합니다.
    """
    ollama_path = find_ollama_executable()
    cmd = [str(ollama_path), "serve"]
    logging.info(f"▶️ Ollama 서버 기동: {' '.join(cmd)}")
    return subprocess.Popen(cmd, shell=False)

async def wait_for_port(host: str, port: int, timeout: int = 60) -> None:
    """
    지정된 호스트와 포트가 열릴 때까지 비동기로 대기합니다.
    """
    loop = asyncio.get_event_loop()
    deadline = loop.time() + timeout
    while True:
        try:
            reader, writer = await asyncio.open_connection(host, port)
            writer.close()
            await writer.wait_closed()
            logging.info(f"✅ {host}:{port} 연결 확인됨")
            return
        except Exception:
            if loop.time() >= deadline:
                raise TimeoutError(f"{host}:{port} 대기 시간 초과 ({timeout}s)")
            await asyncio.sleep(1)
