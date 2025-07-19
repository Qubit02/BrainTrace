# src/routers/chatRouter.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from services.ai_service import BaseAIService
from dependencies import get_ai_service
from sqlite_db import SQLiteHandler

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    question: str

class ChatResponse(BaseModel):
    answer: str

# === 기존 채팅 생성 (AI 답변) ===
@router.post("/", response_model=ChatResponse)
async def chat_endpoint(
    req: ChatRequest,
    ai_service: BaseAIService = Depends(get_ai_service),
):
    if not req.question:
        raise HTTPException(400, "question을 입력해주세요.")
    answer = ai_service.chat(req.question)  
    return ChatResponse(answer=answer)

# === 채팅 내역 저장 (질문/답변 모두) ===
class ChatSaveRequest(BaseModel):
    is_ai: int
    message: str
    referenced_nodes: list[str] = []

@router.post("/brain/{brain_id}")
async def save_chat_to_brain(brain_id: int, req: ChatSaveRequest):
    """
    특정 brain_id에 채팅(질문/답변)을 저장합니다.
    """
    db = SQLiteHandler()
    chat_id = db.save_chat(
        is_ai=bool(req.is_ai),
        message=req.message,
        brain_id=brain_id,
        referenced_nodes=req.referenced_nodes
    )
    if chat_id == -1:
        raise HTTPException(500, "채팅 저장 실패")
    return {"chat_id": chat_id}

@router.get("/brain/{brain_id}")
async def get_chat_list_by_brain(brain_id: int):
    """
    특정 brain_id에 해당하는 모든 채팅 내역을 반환합니다.
    - chat_id, is_ai, message, referenced_nodes 포함
    """
    db = SQLiteHandler()
    chat_list = db.get_chat_list(brain_id)
    if chat_list is None:
        raise HTTPException(404, "채팅 내역이 없습니다.")
    return chat_list

@router.delete("/brain/{brain_id}")
async def delete_chat_list_by_brain(brain_id: int):
    """
    특정 brain_id에 해당하는 모든 채팅 내역을 삭제합니다.
    """
    db = SQLiteHandler()
    # chat_handler에 delete_all_chats_by_brain이 없으면 구현 필요
    try:
        result = db.delete_all_chats_by_brain(brain_id)
        if not result:
            raise HTTPException(404, "삭제할 채팅 내역이 없습니다.")
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"삭제 중 오류: {str(e)}")
