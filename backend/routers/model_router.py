'''
src/routers/model_router.py

Ollama에서 사용할 모델 관련 정보들을 return하고, 다운로드 하는 api를 제공하는는 router입니다.
'''
from fastapi import APIRouter, HTTPException
from typing import List, Dict
import os
from pathlib import Path
import subprocess
import json

from ollama import pull  # Ollama Python SDK로 모델 풀링(다운로드)

# ────────────────────────────────────────────────────────────────
# 모델 파일 저장 디렉터리 설정
#    - 기본: Ollama 기본 경로 (~/.ollama/models 또는 %USERPROFILE%\.ollama\models)
#    - 환경변수 OLLAMA_MODELS 로 override 가능
DEFAULT_MODELS_DIR = os.getenv("OLLAMA_MODELS", str(Path.home() / ".ollama" / "models"))
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
    "deepseek-r1:7b"
]

router = APIRouter(prefix="/models", tags=["models"])

def get_installed_models() -> List[str]:
    """
    Ollama에서 설치된 모델 목록을 반환합니다.
    """
    try:
        # ollama list 명령어 실행
        result = subprocess.run(['ollama', 'list'], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return []
        
        # 출력 파싱 (첫 번째 줄은 헤더이므로 제외)
        lines = result.stdout.strip().split('\n')[1:]
        installed_models = []
        
        for line in lines:
            if line.strip():
                # 모델명은 첫 번째 컬럼
                model_name = line.split()[0]
                installed_models.append(model_name)
        
        return installed_models
    except Exception as e:
        print(f"설치된 모델 목록 조회 실패: {e}")
        return []

@router.get("/", response_model=List[Dict])
def list_models():
    """
    설치 가능한 모델과 설치된 모델 정보를 반환합니다.
    """
    installed_models = get_installed_models()
    
    models_info = []
    for model in AVAILABLE_MODELS:
        is_installed = model in installed_models
        models_info.append({
            "name": model,
            "installed": is_installed
        })
    
    return models_info

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
