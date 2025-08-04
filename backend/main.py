# src/main.py
import os
import sys
import faulthandler
import multiprocessing
import logging
import traceback
import uvicorn

from app_factory import app

if __name__ == "__main__":
    multiprocessing.freeze_support()
    print(">> simple 진입!")
    uvicorn.run(app, host="0.0.0.0", port=8000)