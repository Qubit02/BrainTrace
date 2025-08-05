'''
src/routers/model_router.py

Ollama AI 모델 관리 API 라우터

이 파일은 Ollama에서 사용할 AI 모델들을 관리하는 API를 제공합니다.

주요 기능:
- 설치 가능한 AI 모델 목록 조회
- AI 모델 설치 (다운로드)
- 설치된 모델 상태 확인

지원하는 모델:
- gemma3:4b: Google의 Gemma 3 4B 모델
- phi4-mini:3.8b: Microsoft의 Phi-4 Mini 3.8B 모델
- exaone3.5:2.4b: ExaOne 3.5 2.4B 모델
- mistral:7b: Mistral AI의 7B 모델
- qwen3:4b: Alibaba의 Qwen 3 4B 모델
- deepseek-r1:7b: DeepSeek의 R1 7B 모델

저장 위치:
- 기본: ~/.ollama/models (Ollama 기본 경로)
- 환경변수 OLLAMA_MODELS로 경로 변경 가능

@fileoverview Ollama AI 모델 관리 API 서비스
'''
from fastapi import APIRouter, HTTPException
from typing import List, Dict
import os
from pathlib import Path
import subprocess
import json
import logging

from ollama import pull  # Ollama Python SDK로 모델 풀링(다운로드)

# ────────────────────────────────────────────────────────────────
# 모델 파일 저장 디렉터리 설정
#    - 기본: 로컬 홈 디렉터리 (Ollama 기본 경로 사용)
#    - 환경변수 OLLAMA_MODELS 로 override 가능
DEFAULT_MODELS_DIR = os.getenv("OLLAMA_MODELS", str(Path.home() / ".ollama" / "models"))
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
    Ollama에서 현재 설치된 모델 목록을 조회합니다.
    
    이 함수는 'ollama list' 명령어를 실행하여 시스템에 설치된
    모든 모델의 목록을 가져옵니다.
    
    Returns:
        List[str]: 설치된 모델 이름들의 리스트
        
    Raises:
        subprocess.TimeoutExpired: 명령어 실행 시간 초과 시
        FileNotFoundError: ollama 명령어를 찾을 수 없을 때
        Exception: 기타 예외 상황
        
    Example:
        >>> get_installed_models()
        ['gemma3:4b', 'mistral:7b', 'qwen3:4b']
    """
    try:
        # ollama list 명령어 실행 (10초 타임아웃)
        result = subprocess.run(['ollama', 'list'], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            logging.warning(f"Ollama list 명령어 실패: {result.stderr}")
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
        logging.error(f"설치된 모델 목록 조회 실패: {e}")
        return []

@router.get("/", response_model=List[Dict])
def list_models():
    """
    설치 가능한 모델 목록과 각 모델의 설치 상태를 반환합니다.
    
    이 엔드포인트는 AVAILABLE_MODELS에 정의된 모든 모델에 대해
    설치 여부를 확인하고, 각 모델의 정보를 반환합니다.
    
    Returns:
        List[Dict]: 모델 정보 리스트
            - name (str): 모델 이름
            - installed (bool): 설치 여부
            
    Example Response:
        [
            {"name": "gemma3:4b", "installed": True},
            {"name": "mistral:7b", "installed": False},
            {"name": "qwen3:4b", "installed": True}
        ]
        
    API Endpoint:
        GET /models/
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
    지정된 AI 모델을 Ollama registry에서 다운로드하여 로컬에 설치합니다.
    
    이 엔드포인트는 요청된 모델이 AVAILABLE_MODELS에 포함되어 있는지 확인하고,
    이미 설치되어 있지 않은 경우에만 다운로드를 진행합니다.
    
    Args:
        model_name (str): 설치할 모델의 이름 (예: "gemma3:4b")
        
    Returns:
        Dict: 설치 결과 메시지
            - message (str): 성공 또는 이미 설치된 경우의 메시지
            
    Raises:
        HTTPException (404): 모델이 AVAILABLE_MODELS에 없을 때
        HTTPException (500): 다운로드 중 오류 발생 시
        
    Example Request:
        POST /models/gemma3:4b/install
        
    Example Response:
        {"message": "Model 'gemma3:4b' has been downloaded successfully"}
        
    API Endpoint:
        POST /models/{model_name}/install
    """
    if model_name not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail="Model not found")

    try:
        # 이미 설치되어 있는지 확인
        installed_models = get_installed_models()
        if model_name in installed_models:
            return {
                "message": f"Model '{model_name}' is already installed"
            }
        
        # 모델 다운로드
        logging.info(f"모델 '{model_name}' 다운로드 시작...")
        pull(model_name)
        logging.info(f"모델 '{model_name}' 다운로드 완료")
                
    except Exception as e:
        logging.error(f"모델 '{model_name}' 다운로드 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to pull model '{model_name}': {e}"
        )

    return {
        "message": f"Model '{model_name}' has been downloaded successfully"
    }
