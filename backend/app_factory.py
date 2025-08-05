# src/app_factory.py
import os, signal, logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from exceptions.custom_exceptions import AppException
from schemas.error_response import ErrorResponse
from neo4j_db.utils import run_neo4j
from sqlite_db import SQLiteHandler
from run_ollama import run_ollama, wait_for_port
from routers import (
    brainGraph, brainRouter, memoRouter, pdfRouter, textFileRouter,
    chatRouter, chatsessionRouter, searchRouter, voiceRouter,
    mdRouter, docxRouter, model_router
)

# ── Docker 감지 유틸 ────────────────────────────────
def is_running_in_docker() -> bool:
    # (1) env var
    env_val = os.getenv("IN_DOCKER", "").lower()
    # (2) /.dockerenv 파일 존재 여부
    dockerenv_exists = os.path.exists("/.dockerenv")
    # (3) /proc/1/cgroup 검사
    cgroup_flag = False
    try:
        with open("/proc/1/cgroup", "rt") as f:
            content = f.read()
        if "docker" in content or "kubepods" in content:
            cgroup_flag = True
    except:
        pass

    # 디버그 로그
    logging.info(
        f"[DEBUG] is_running_in_docker → "
        f"env_IN_DOCKER={env_val!r}, "
        f"/.dockerenv={dockerenv_exists}, "
        f"/proc/1/cgroup docker_flag={cgroup_flag}"
    )

# ── 로깅 기본 설정 ───────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    force=True
)
logging.getLogger("uvicorn").setLevel(logging.INFO)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)

# ── 전역 상태 ─────────────────────────────────────
sqlite_handler = SQLiteHandler()
neo4j_process = None
ollama_process = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global neo4j_process, ollama_process

    # 1. SQLite 초기화
    sqlite_handler._init_db()

    # 2. 도커 환경이면 임베디드 실행 모두 스킵
    in_docker = os.getenv("IN_DOCKER", "false").lower() in ("1", "true", "yes")
    logging.info(f"[LIFESPAN] IN_DOCKER={in_docker!r}")
    if in_docker:
        logging.info("도커 환경 감지됨 → 내장 Neo4j·Ollama 실행 스킵")
    else:
        # 3. Neo4j 기동
        try:
            neo4j_process = run_neo4j()
            logging.info("✅ Neo4j 실행됨")
        except Exception as e:
            logging.error("❌ Neo4j 실행 실패: %s", e)
            raise

        # 4. Ollama 기동
        try:
            ollama_process = run_ollama()
            logging.info("⏳ Ollama 기동 중…")
            await wait_for_port("localhost", 11434, timeout=60)
            logging.info("✅ Ollama 준비 완료")
        except Exception as e:
            logging.error("❌ Ollama 실행 실패: %s", e)
            raise

    # 5. 서비스 시작
    yield
    
    if neo4j_process:
        logging.info("🛑 Neo4j 종료 중…")
        try:
            if os.name == "nt":
                neo4j_process.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                neo4j_process.terminate()
            neo4j_process.wait(timeout=10)
            logging.info("✅ Neo4j 정상 종료")
        except Exception as e:
            logging.error("❌ Neo4j 종료 오류: %s", e)

    # 5. Ollama 종료
    if ollama_process:
        logging.info("🛑 Ollama 종료 중…")
        try:
            ollama_process.terminate()
            logging.info("✅ Ollama 정상 종료")
        except Exception as e:
            logging.error("❌ Ollama 종료 오류: %s", e)

# ── FastAPI 인스턴스 ──────────────────────────────
app = FastAPI(
    title="BrainTrace API",
    description="지식 그래프 기반 질의응답 시스템 API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# ── 공통 미들웨어·라우터·정적 파일 ───────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            code=exc.code,
            message=exc.message,
            detail=str(request.url)
        ).model_dump()
    )

# 라우터
for r in (
    brainGraph.router, brainRouter.router, memoRouter.router, pdfRouter.router,
    textFileRouter.router, mdRouter.router, chatRouter.router,
    chatsessionRouter.router, searchRouter.router, voiceRouter.router,
    docxRouter.router, model_router.router
):
    app.include_router(r)

# 정적 파일
app.mount("/uploaded_pdfs", StaticFiles(directory="uploaded_pdfs"), name="uploaded_pdfs")
app.mount("/uploaded_txts", StaticFiles(directory="uploaded_txts"), name="uploaded_txts")
app.mount("/uploaded_mds", StaticFiles(directory="uploaded_mds"), name="uploaded_mds")
app.mount("/uploaded_docx", StaticFiles(directory="uploaded_docx"), name="uploaded_docx")
