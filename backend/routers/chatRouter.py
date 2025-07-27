# src/routers/chatRouter.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from dependencies import get_ai_service_GPT
from dependencies import get_ai_service_Ollama
from sqlite_db import SQLiteHandler

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    question: str = Field(..., description="질문 내용")
    model: str = Field("ollama", description="사용할 모델 (gpt 또는 ollama)")

class ChatResponse(BaseModel):
    answer: str = Field(..., description="AI가 생성한 답변")

# === 기존 채팅 생성 (AI 답변) ===
@router.post("/", 
    response_model=ChatResponse,
    summary="AI 챗봇 응답 생성",
    description="""
        사용자의 질문에 대해 GPT 또는 Ollama 모델을 사용하여 AI 답변을 생성합니다.
        <br>Ollama 사용 → (model: "ollama")
        <br>GPT 사용 → (model: "gpt")
        """,
    response_description="AI가 생성한 답변을 반환합니다.")
async def chat_endpoint(
    req: ChatRequest
):
    if req.model == "gpt":
        ai_service = get_ai_service_GPT()
    elif req.model == "ollama":
        ai_service = get_ai_service_Ollama()
    if not req.question:
        raise HTTPException(400, "question을 입력해주세요.")
    answer = ai_service.chat(req.question)  
    return ChatResponse(answer=answer)

# === 채팅 내역 저장 (질문/답변 모두) ===
class ChatSaveRequest(BaseModel):
    is_ai: int
    message: str
    referenced_nodes: list[str] = []

@router.post("/session/{session_id}")
async def save_chat_to_session(session_id: int, req: ChatSaveRequest):
    """
    특정 session_id에 채팅(질문/답변)을 저장합니다.
    """
    from sqlite_db.chat_handler import ChatHandler
    db = ChatHandler()
    chat_id = db.save_chat(
        session_id=session_id,
        is_ai=bool(req.is_ai),
        message=req.message,
        referenced_nodes=req.referenced_nodes
    )
    if chat_id == -1:
        raise HTTPException(500, "채팅 저장 실패")
    return {"chat_id": chat_id}

@router.get("/session/{session_id}")
async def get_chat_list_by_session(session_id: int):
    """
    특정 session_id에 해당하는 모든 채팅 내역을 반환합니다.
    - chat_id, is_ai, message, referenced_nodes 포함
    """
    from sqlite_db.chat_handler import ChatHandler
    db = ChatHandler()
    chat_list = db.get_chat_list(session_id)
    if chat_list is None:
        raise HTTPException(404, "채팅 내역이 없습니다.")
    return chat_list

@router.delete("/session/{session_id}")
async def delete_chat_list_by_session(session_id: int):
    """
    특정 session_id에 해당하는 모든 채팅 내역을 삭제합니다.
    """
    from sqlite_db.chat_handler import ChatHandler
    db = ChatHandler()
    try:
        result = db.delete_all_chats_by_session(session_id)
        if not result:
            raise HTTPException(404, "삭제할 채팅 내역이 없습니다.")
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"삭제 중 오류: {str(e)}")

@router.get("/{chat_id}/referenced_nodes")
async def get_referenced_nodes_by_chat(chat_id: int):
    """
    특정 chat_id에 해당하는 referenced_nodes(참고 노드 목록)를 반환합니다.
    """
    db = SQLiteHandler()
    chat = db.get_chat_by_id(chat_id)
    if not chat:
        raise HTTPException(404, "해당 chat_id의 채팅이 없습니다.")
    referenced_nodes = chat.get("referenced_nodes", [])
    # 만약 referenced_nodes가 문자열(예: JSON)로 저장되어 있다면 파싱
    if isinstance(referenced_nodes, str):
        import json
        try:
            referenced_nodes = json.loads(referenced_nodes)
        except Exception:
            referenced_nodes = []
    return {"referenced_nodes": referenced_nodes}

@router.get("/{chat_id}/message")
async def get_chat_message_by_id(chat_id: int):
    """
    특정 chat_id에 해당하는 채팅의 message(본문)만 반환합니다.
    참고된 노드 목록이 message에 포함되어 있다면 잘라서 반환합니다.
    """
    from sqlite_db.chat_handler import ChatHandler
    db = ChatHandler()
    chat = db.get_chat_by_id(chat_id)
    if not chat:
        raise HTTPException(404, "해당 chat_id의 채팅이 없습니다.")
    message = chat.get("message", "")
    # '[참고된 노드 목록]'이 있으면 그 앞까지만 반환
    if "[참고된 노드 목록]" in message:
        message = message.split("[참고된 노드 목록]")[0].strip()
    return {"message": message}

@router.get("/{chat_id}/node_sources")
async def get_node_sources_by_chat(chat_id: int, node_name: str):
    """
    특정 chat_id와 node_name에 해당하는 노드의 소스 title 리스트, id 리스트를 반환합니다.
    반환 예시: { "titles": ["테스트1.txt", "테스트2.pdf"], "ids": ["67", "69"] }
    """
    from sqlite_db.chat_handler import ChatHandler
    db = ChatHandler()
    chat = db.get_chat_by_id(chat_id)
    if not chat:
        raise HTTPException(404, "해당 chat_id의 채팅이 없습니다.")
    referenced_nodes = chat.get("referenced_nodes", [])
    # node_name에 해당하는 노드 찾기
    node = next((n for n in referenced_nodes if n.get("name") == node_name), None)
    if not node:
        return {"titles": [], "ids": []}
    titles = [s.get("title", f"소스 {s.get('id')}") for s in node.get("source_ids", [])]
    ids = [str(s.get("id")) if s.get("id") is not None else None for s in node.get("source_ids", [])]
    return {"titles": titles, "ids": ids}