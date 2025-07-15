# src/routers/chatRouter.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from services.ai_service import BaseAIService
from dependencies import get_ai_service

router = APIRouter(prefix="", tags=["chat"])

class ChatRequest(BaseModel):
    question: str

class ChatResponse(BaseModel):
    answer: str

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    req: ChatRequest,
    ai_service: BaseAIService = Depends(get_ai_service),
):
    if not req.question:
        raise HTTPException(400, "question을 입력해주세요.")
    # 여기서는 ai_service.chat() 또는 적절한 메서드를 호출
    answer = ai_service.chat(req.question)  
    return ChatResponse(answer=answer)
