"""
애플리케이션 엔트리포인트
-----------------------

이 모듈은 FastAPI 앱을 Uvicorn으로 구동하는 실행 진입점입니다.

핵심 동작:
- 전역 예외 후킹(`sys.excepthook`)으로 처리되지 않은 예외를 콘솔과 `error.log`에 기록
- Windows/빌드 환경(PyInstaller 등) 호환을 위해 `multiprocessing.freeze_support()` 호출
- `app_factory.app`을 임포트하여 Uvicorn 서버 실행

주의:
- 전역 예외 훅은 콘솔 창이 즉시 닫히는 환경에서 디버깅 편의를 위해 입력 대기(`input`)를 수행합니다.
  서비스 환경(데몬/서비스)에서는 이 대기가 원치 않을 수 있으므로 배포 환경에 맞춰 조정하세요.
"""

# src/main.py
import os
import sys
import faulthandler
import multiprocessing
import logging
import traceback
import uvicorn


def global_except_hook(exc_type, exc_value, exc_tb):
    """처리되지 않은 예외를 콘솔과 파일로 기록하고 안전 종료합니다.

    동작:
      - 콘솔에 스택 트레이스를 즉시 출력
      - 현재 작업 디렉터리의 `error.log` 파일에 동일한 정보를 기록
      - 콘솔 창이 바로 닫히는 것을 방지하기 위해 Enter 입력 대기 후 종료
    """
    # 콘솔에 즉시 출력
    traceback.print_exception(exc_type, exc_value, exc_tb)
    # 로그 파일에도 기록
    with open("error.log", "w", encoding="utf-8") as f:
        traceback.print_exception(exc_type, exc_value, exc_tb, file=f)
    # 일시 정지해서 콘솔창이 바로 닫히지 않게
    input("에러 발생 – 콘솔에 표시된 내용을 확인하고 Enter 키를 누르세요…")
    sys.exit(1)

sys.excepthook = global_except_hook

from app_factory import app

if __name__ == "__main__":
    # PyInstaller 등으로 빌드된 환경에서 멀티프로세싱 이슈 방지
    multiprocessing.freeze_support()
    # Uvicorn 개발 서버 실행(리로드 비활성화, 0.0.0.0:8000)
    uvicorn.run(app, host="0.0.0.0", reload=False, port=8000)