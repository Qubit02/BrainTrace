'''
src/routers/model_router.py

Ollama에서 사용할 모델 관련 정보들을 return하고, 다운로드 하는 api를 제공하는는 router입니다.
'''
from fastapi import APIRouter, HTTPException
from typing import List
import os

from ollama import pull  # Ollama Python SDK로 모델 풀링(다운로드)

# ────────────────────────────────────────────────────────────────
# 모델 파일 저장 디렉터리 설정
#    - 기본: 앱 루트/models
#    - 환경변수 OLLAMA_MODELS 로 override 가능
os.environ["OLLAMA_MODELS"] = DEFAULT_MODELS_DIR
os.makedirs(DEFAULT_MODELS_DIR, exist_ok=True)

# ────────────────────────────────────────────────────────────────
# 2) 설치 가능 모델 리스트 (허용된 모델만 풀링하도록 제한)
AVAILABLE_MODELS = [
    "gemma3:4b",
    "phi4-mini:3.8b",
    "exaone3.5:2.4b",
    "mistral:7b",
    "qwen3:4b",
]

router = APIRouter(prefix="/models", tags=["models"])

@router.get("/", response_model=List[str])
def list_models():
    """
    설치 가능한 Ollama 모델 리스트를 반환합니다.
    """
    return AVAILABLE_MODELS

@router.post("/{model_name}/install")
def install_model(model_name: str):
    """
    요청된 모델을 Ollama registry에서 pull 하여
    로컬에 다운로드합니다.
    """
    if model_name not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail="Model not found")

    try:
        pull(model_name)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to pull model '{model_name}': {e}"
        )

    return {
        "message": f"Model '{model_name}' is being downloaded to '{DEFAULT_MODELS_DIR}'"
    }
