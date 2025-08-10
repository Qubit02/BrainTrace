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

# ✅ 기존: run_ollama, wait_for_port  →  변경: ensure_ollama_ready
from run_ollama import ensure_ollama_ready  # 도커=대기, 로컬/EXE=필요시 스폰

from routers import (
    brain_graph, brain_router, memo_router, pdf_router, text_file_router,
    chat_router, chat_session_router, search_router, voice_router,
    md_router, docx_router, model_router
)

# ── Docker 감지 유틸 ────────────────────────────────
def is_running_in_docker() -> bool:
    """
    도커 환경 여부 감지:
      1) IN_DOCKER=true|1|yes
      2) /.dockerenv 존재
      3) /proc/1/cgroup 내 'docker' 또는 'kubepods' 문자열
    """
    env_val = os.getenv("IN_DOCKER", "").lower() in ("1", "true", "yes")
    dockerenv_exists = os.path.exists("/.dockerenv")
    cgroup_flag = False
    try:
        with open("/proc/1/cgroup", "rt") as f:
            content = f.read()
        if "docker" in content or "kubepods" in content:
            cgroup_flag = True
    except Exception:
        pass

    result = bool(env_val or dockerenv_exists or cgroup_flag)
    logging.info(
        f"[DEBUG] is_running_in_docker → {result} "
        f"(env={env_val}, /.dockerenv={dockerenv_exists}, cgroup={cgroup_flag})"
    )
    return result

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
ollama_process = None  # ensure_ollama_ready가 프로세스를 리턴할 수 있음(로컬/EXE)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global neo4j_process, ollama_process

    # 1) SQLite 초기화
    sqlite_handler._init_db()

    # 2) 환경 감지
    in_docker = is_running_in_docker()
    logging.info(f"[LIFESPAN] IN_DOCKER={in_docker}")

    if in_docker:
        # 도커에서는 외부 컨테이너(services: neo4j, ollama)가 이미 뜸
        logging.info("도커 환경 → 내장 Neo4j/Ollama 기동 스킵, Ollama HTTP 준비 대기만")
        # Ollama API ready 대기(미준비면 예외)
        try:
            ensure_ollama_ready(timeout=120)  # 도커 모드에선 spawn 안 함
        except Exception as e:
            logging.error("❌ Ollama 준비 실패: %s", e)
            # 필요 시 앱 기동 중단:
            # raise
    else:
        # 로컬/EXE 실행 경로: Neo4j 내장 실행, Ollama는 필요 시 스폰
        try:
            neo4j_process = run_neo4j()
            logging.info("✅ Neo4j 실행됨")
        except Exception as e:
            logging.error("❌ Neo4j 실행 실패: %s", e)
            raise

        try:
            # ensure_ollama_ready: 이미 떠 있으면 붙고, 안 떠 있고 OLLAMA_EMBEDDED=true면 spawn
            ollama_process = ensure_ollama_ready(timeout=120)
            logging.info("✅ Ollama 준비 완료")
        except Exception as e:
            logging.error("❌ Ollama 초기화 실패: %s", e)
            raise

    # 3) 서비스 시작
    yield

    # 4) 종료 처리(로컬/EXE에서만 프로세스 보유)
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

# ── 공통 미들웨어 ────────────────────────────────
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

# ── 라우터 등록 ─────────────────────────────────
for r in (
    brain_graph.router, brain_router.router, memo_router.router, pdf_router.router,
    text_file_router.router, md_router.router, chat_router.router,
    chat_session_router.router, search_router.router, voice_router.router,
    docx_router.router, model_router.router
):
    app.include_router(r)

# ── 정적 파일 ───────────────────────────────────
app.mount("/uploaded_pdfs", StaticFiles(directory="uploaded_pdfs"), name="uploaded_pdfs")
app.mount("/uploaded_txts", StaticFiles(directory="uploaded_txts"), name="uploaded_txts")
app.mount("/uploaded_mds", StaticFiles(directory="uploaded_mds"), name="uploaded_mds")
app.mount("/uploaded_docx", StaticFiles(directory="uploaded_docx"), name="uploaded_docx")
