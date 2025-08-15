"""
Neo4j 유틸리티 모듈
-------------------

이 모듈은 애플리케이션 실행 시 로컬 번들에 포함된 Neo4j 서버를 간편하게 구동하기 위한 헬퍼 함수를 제공합니다.

핵심 동작 요약:
- 실행 컨텍스트를 감지하여 Neo4j가 위치한 기준 폴더를 결정합니다.
  - PyInstaller로 빌드된 실행 파일(onedir) 환경: `sys.frozen == True` → `sys.executable`의 부모 폴더
  - 개발 환경(예: `python backend/main.py`): 현재 작업 디렉터리(`Path.cwd()`)
- 기준 폴더 하위의 `neo4j` 디렉터리를 찾아 플랫폼에 맞는 실행 스크립트를 선택합니다.
  - Windows: `neo4j/bin/neo4j.bat`
  - Unix 계열: `neo4j/bin/neo4j` 또는 대체로 `neo4j/bin/neo4j.sh`
- 스크립트 존재 여부를 확인하고 `subprocess.Popen`으로 Neo4j를 콘솔 모드로 백그라운드 실행합니다.

주의사항:
- 이 함수는 Neo4j가 애플리케이션 번들과 함께 `backend/neo4j` 경로(또는 빌드 산출물 옆 폴더)에 존재한다는 전제하에 동작합니다.
- 실행 권한이 필요한 Unix 계열 OS에서는 `neo4j/bin/neo4j(혹은 neo4j.sh)`에 실행 권한(+x)이 설정되어 있어야 합니다.
- Windows에서는 배치 파일 실행을 위해 `shell=True`를 사용합니다. 신뢰된 로컬 경로만 실행하도록 해주세요.
"""

import os
import sys
import subprocess
import logging
from pathlib import Path

def run_neo4j():
    """
    로컬 번들 내 Neo4j 실행 파일을 찾아 콘솔 모드로 기동하고, 프로세스 핸들을 반환합니다.

    동작 단계:
      1) 실행 기준 디렉터리 결정
         - PyInstaller onedir 번들: `sys.frozen == True` → `Path(sys.executable).parent`
         - 개발 환경: `Path.cwd()`
      2) 기준 디렉터리 하위의 `neo4j` 폴더를 찾고 존재 여부를 확인
      3) 플랫폼별 실행 스크립트 선택 및 명령 인자 구성
         - Windows: `neo4j/bin/neo4j.bat` → `[<경로>, 'console']`, `shell=True`
         - Unix 계열: `neo4j/bin/neo4j` 또는 없으면 `.sh` → `[<경로>, 'console']`, `shell=False`
      4) 실행 파일 존재 검증 후 `subprocess.Popen`으로 실행

    Returns:
        subprocess.Popen: 백그라운드로 실행 중인 Neo4j 프로세스 핸들

    Raises:
        FileNotFoundError: `neo4j` 폴더 또는 실행 스크립트를 찾지 못한 경우

    Notes:
        - 반환된 프로세스는 호출 측에서 생명주기를 관리해야 합니다(종료 시 `proc.terminate()`/`proc.kill()`).
        - Unix 계열에서는 실행 권한이 필요합니다. 필요 시 `chmod +x neo4j/bin/neo4j`를 적용하세요.
    """
    # 1) exe(또는 스크립트) 가 실행된 디렉토리
    # - 배포(빌드) 환경에서는 실행 파일이 위치한 폴더를 기준으로 삼아 번들된 neo4j 폴더를 찾습니다.
    # - 개발 환경에서는 현재 작업 디렉터리를 기준으로 합니다.
    base_dir = Path(sys.executable).parent if getattr(sys, "frozen", False) else Path.cwd()

    # 2) 기준 폴더 하위의 neo4j 디렉터리 경로
    neo4j_dir = base_dir / "neo4j"
    if not neo4j_dir.exists():
        raise FileNotFoundError(f"neo4j 폴더를 찾을 수 없습니다: {neo4j_dir}")

    # 3) 플랫폼별 실행 스크립트 선택
    if os.name == "nt":
        # Windows: 배치 파일(.bat) 실행을 위해 shell=True 사용
        script = neo4j_dir / "bin" / "neo4j.bat"
        cmd = [str(script), "console"]
        shell = True
    else:
        # Unix 계열: 기본 실행 파일을 우선 사용, 없으면 .sh 스크립트를 대체 사용
        script = neo4j_dir / "bin" / "neo4j"
        if not script.exists():
            script = script.with_suffix(".sh")
        cmd = [str(script), "console"]
        shell = False

    if not script.exists():
        raise FileNotFoundError(f"Neo4j 실행 파일을 찾을 수 없습니다: {script}")

    # 콘솔 모드로 Neo4j 기동
    logging.info(f"▶️ Neo4j 시작: {script}")
    return subprocess.Popen(cmd, shell=shell)
