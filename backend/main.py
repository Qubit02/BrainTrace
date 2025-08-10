# src/main.py
import os
import sys
import faulthandler
import multiprocessing
import logging
import traceback
import uvicorn

def global_except_hook(exc_type, exc_value, exc_tb):
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
    multiprocessing.freeze_support()
    uvicorn.run(app, host="0.0.0.0", port=8000)