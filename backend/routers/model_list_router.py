"""
model_list_router.py

Ollama 전용 Router로, 사용 가능한 모델 이름의 리스트를 반환하거나,

특정 모델을 로컬에 내려받습니다..

"""


from fastapi import APIRouter
from backend.dependencies import ALLOWED_MODELS

router = APIRouter(tags=["models"])

ALLOWED_MODELS = [
    "gemma3:4b",
    "phi4-mini:3.8b",
    "exaone3.5:2.4b",
    "mistral:7b",
    "qwen3:4b",
]

@router.get("/models", response_model=list[str])
def list_models():
    """
    사용 가능한 Ollama 모델 리스트를 반환합니다.

    Parameters:
        없음

    Returns:
        list[str]: 사용 가능한 Ollama 모델 이름 목록
    """
    return ALLOWED_MODELS

@router.post(
    "/models/pull/{model_name}",
    status_code=status.HTTP_202_ACCEPTED,
    summary="선택한 Ollama 모델을 다운로드(pull) 합니다.",
)
def pull_model(model_name: str):
    """
    지정한 모델을 Ollama 레지스트리에서 로컬로 pull 합니다.
    
    Parameters:
        model_name: 다운로드할 모델 명. ALLOWED_MODELS에 정의된 모델명만 허용됩니다.

    Returns:
        list[str]: download status, 다운로드중인 모델명명
    """
    if model_name not in ALLOWED_MODELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 모델입니다: {model_name}"
        )
    try:
        pull(model_name)
    except Exception as e:
        # pull 실패 시 500 에러로 반환
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"모델 다운로드 오류: {e}"
        )

    return {"status": "downloading", "model": model_name}