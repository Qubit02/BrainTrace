# neo4j_db/utils.py

import os
import sys
import subprocess
import logging
from pathlib import Path

def run_neo4j():
    """
    Neo4j 실행 파일을 찾아 백그라운드로 구동합니다.

    1) 실행 기준 디렉터리 결정
       - PyInstaller --onedir 번들(exe) 환경: sys.frozen == True → sys.executable 부모 폴더
       - 개발 모드(py main.py): 현재 작업 디렉터리(Path.cwd())

    2) neo4j 폴더 경로 생성
       backend/neo4j 가 존재해야 함.

    3) 플랫폼별 실행 스크립트 선택
       - Windows: neo4j/bin/neo4j.bat → ['neo4j.bat', 'console'], shell=True
       - 그 외  : neo4j/bin/neo4j(.sh) → ['neo4j', 'console'], shell=False

    4) 파일 존재 검사 후 subprocess.Popen 으로 프로세스 반환
    """
    # 1) exe(또는 스크립트) 가 실행된 디렉토리
    base_dir = Path(sys.executable).parent if getattr(sys, "frozen", False) \
               else Path.cwd()

    neo4j_dir = base_dir / "neo4j"
    if not neo4j_dir.exists():
        raise FileNotFoundError(f"neo4j 폴더를 찾을 수 없습니다: {neo4j_dir}")

    # 2) 플랫폼별 실행 스크립트 선택
    if os.name == "nt":
        script = neo4j_dir / "bin" / "neo4j.bat"
        cmd = [str(script), "console"]
        shell = True
    else:
        script = neo4j_dir / "bin" / "neo4j"
        if not script.exists():
            script = script.with_suffix(".sh")
        cmd = [str(script), "console"]
        shell = False

    if not script.exists():
        raise FileNotFoundError(f"Neo4j 실행 파일을 찾을 수 없습니다: {script}")

    logging.info(f"▶️ Neo4j 시작: {script}")
    return subprocess.Popen(cmd, shell=shell)
