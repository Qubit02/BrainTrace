'''
BrainTrace 앱 초기화 모듈 (app_factory)

- FastAPI 애플리케이션 인스턴스 생성 및 수명주기(lifespan) 관리
- 실행 환경 감지(Docker/로컬) 후 Neo4j/Ollama 준비 및 종료 제어
- SQLite 초기화, CORS/예외 처리, 정적 파일 서빙 설정
- 주요 라우터 등록(brain_graph, brain, memo 등)
- run_neo4j로 Neo4j 기동, ensure_ollama_ready로 Ollama 준비

주의:
- Docker 환경: 외부 컨테이너(neo4j, ollama)는 기동되어 있다고 가정 → ensure_ollama_ready 로 HTTP 준비 대기
'''


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
    """도커 환경 여부를 판단합니다.

    규칙:
      1) 환경변수 IN_DOCKER=true|1|yes
      2) 파일 /.dockerenv 존재
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

def create_uploaded_files_directory():
    # Define the paths for the uploaded_files directory and its subdirectories
    base_path = os.path.join(os.path.dirname(__file__), 'uploaded_files')
    subdirectories = ['uploaded_txts', 'uploaded_pdfs', 'uploaded_docx', 'uploaded_mds']

    # Create the base directory if it doesn't exist
    if not os.path.exists(base_path):
        os.makedirs(base_path)
        logging.info(f"Created directory: {base_path}")

    # Create each subdirectory if it doesn't exist
    for subdirectory in subdirectories:
        sub_path = os.path.join(base_path, subdirectory)
        if not os.path.exists(sub_path):
            os.makedirs(sub_path)
            logging.info(f"Created subdirectory: {sub_path}")

# Call the function to ensure the directories are created
create_uploaded_files_directory()


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

# ── Lifespan: 앱 기동/종료 시 초기화/정리 ─────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global neo4j_process, ollama_process
    """앱 수명주기 동안 필요한 리소스를 준비/정리합니다.

    시작 시:
      - SQLite 초기화
      - Docker 여부에 따라 Neo4j/Ollama 준비 로직 분기
        • Docker: 외부 컨테이너 준비 대기만
        • 로컬/EXE: Neo4j 내장 실행, Ollama 준비(필요 시 spawn)

    종료 시:
      - 보유한 프로세스(Neo4j/Ollama) 정상 종료 시도
    """

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

# ── 전역 예외 처리 ─────────────────────────────────
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """도메인 예외(AppException)를 표준 에러 응답으로 변환합니다."""
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
app.mount("/uploaded_pdfs", StaticFiles(directory="uploaded_files/uploaded_pdfs"), name="uploaded_pdfs")
app.mount("/uploaded_txts", StaticFiles(directory="uploaded_files/uploaded_txts"), name="uploaded_txts")
app.mount("/uploaded_mds", StaticFiles(directory="uploaded_files/uploaded_mds"), name="uploaded_mds")
app.mount("/uploaded_docx", StaticFiles(directory="uploaded_files/uploaded_docx"), name="uploaded_docx")
