"""
model_router.py

Ollama AI 모델 관리 API 라우터 모듈입니다.

주요 기능:
- 설치 가능한 AI 모델 목록 조회
- AI 모델 설치 (다운로드)
- 설치된 모델 상태 확인
- 모델 관리 및 상태 모니터링

지원하는 모델:
- gemma3:4b: Google의 Gemma 3 4B 모델
- phi4-mini:3.8b: Microsoft의 Phi-4 Mini 3.8B 모델
- exaone3.5:2.4b: ExaOne 3.5 2.4B 모델
- mistral:7b: Mistral AI의 7B 모델
- qwen3:4b: Alibaba의 Qwen 3 4B 모델
- deepseek-r1:7b: DeepSeek의 R1 7B 모델

지원하는 엔드포인트:
- GET /models/ : 설치 가능한 모델 목록 및 설치 상태 조회
- POST /models/{model_name}/install : 특정 모델 설치

모델 저장 위치:
- 기본: ~/.ollama/models (Ollama 기본 경로)
- 환경변수 OLLAMA_MODELS로 경로 변경 가능

의존성:
- FastAPI: 웹 프레임워크
- requests: Ollama HTTP API 호출
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict
import os
from pathlib import Path
import logging
import requests

# ───────── 모델 파일 저장 디렉터리 설정 ───────── #
# 기본: 로컬 홈 디렉터리 (Ollama 기본 경로 사용)
# 환경변수 OLLAMA_MODELS로 override 가능
DEFAULT_MODELS_DIR = os.getenv(
    "OLLAMA_MODELS",
    str(Path.home() / ".ollama" / "models")
)
os.makedirs(DEFAULT_MODELS_DIR, exist_ok=True)

# ───────── 설치 가능 모델 리스트 ───────── #
# 허용된 모델만 풀링하도록 제한
AVAILABLE_MODELS = [
    "gemma3:4b",
    "phi4-mini:3.8b",
    "exaone3.5:2.4b",
    "mistral:7b",
    "qwen3:4b",
    "deepseek-r1:7b"
]

# ───────── FastAPI 라우터 설정 ───────── #
router = APIRouter(prefix="/models", tags=["models"])

# Ollama 서버 기본 URL (서비스명:포트)
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://ollama:11434")


def get_installed_models() -> List[str]:
    """
    Ollama HTTP API(GET /v1/models)로 설치된 모델 목록을 조회합니다.

    처리 과정:
    1. GET {OLLAMA_API_URL}/v1/models 호출 (10초 타임아웃)
    2. 응답 JSON의 `data` 필드에서 모델 ID 목록 추출
    3. 모델명 리스트 반환

    Returns:
        List[str]: 설치된 모델 이름들의 리스트

    Raises:
        Exception: API 호출 또는 파싱 중 오류 발생 시
    """
    try:
        resp = requests.get(f"{OLLAMA_API_URL}/v1/models", timeout=10)
        resp.raise_for_status()
        payload = resp.json()
        data = payload.get("data") or []
        installed = []
        for entry in data:
            # entry가 dict 형태로 {'id': 'gemma3:4b', ...}
            if isinstance(entry, dict) and entry.get("id"):
                installed.append(entry["id"])
        return installed
    except Exception as e:
        logging.error(f"설치된 모델 목록 조회 실패: {e}")
        return []


@router.get("/", response_model=List[Dict])
def list_models():
    """
    설치 가능한 모델 목록과 각 모델의 설치 상태를 반환합니다.

    처리 과정:
    1. 현재 설치된 모델 목록 조회
    2. AVAILABLE_MODELS에 정의된 모든 모델에 대해 설치 여부 확인
    3. 각 모델의 정보를 리스트로 반환
    """
    installed = set(get_installed_models())
    return [
        {"name": model, "installed": (model in installed)}
        for model in AVAILABLE_MODELS
    ]


@router.post("/{model_name}/install")
def install_model(model_name: str):
    """
    지정된 AI 모델을 Ollama registry에서 다운로드하여 로컬에 설치합니다.
    """
    if model_name not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail="Model not found")

    installed = get_installed_models()
    if model_name in installed:
        return {"message": f"Model '{model_name}' is already installed"}

    try:
        logging.info(f"모델 '{model_name}' 다운로드 시작...")
        # HTTP API를 통한 모델 풀 요청
        resp = requests.post(
            f"{OLLAMA_API_URL}/api/pull",
            json={"model": model_name},
            timeout=60
        )
        resp.raise_for_status()
        logging.info(f"모델 '{model_name}' 다운로드 완료")
    except Exception as e:
        logging.error(f"모델 '{model_name}' 다운로드 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to pull model '{model_name}': {e}"
        )

    return {"message": f"Model '{model_name}' has been downloaded successfully"}
