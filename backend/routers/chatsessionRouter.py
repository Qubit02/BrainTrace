from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlite_db.chatsession_handler import ChatSessionHandler

router = APIRouter(prefix="/chatsession", tags=["chatsession"])

class ChatSessionCreateRequest(BaseModel):
    session_name: str
    brain_id: int | None = None

class ChatSessionRenameRequest(BaseModel):
    session_name: str = Field(..., min_length=1, max_length=100, description="새로운 세션 이름")

@router.post("/", summary="채팅 세션 생성")
async def create_session(req: ChatSessionCreateRequest):
    db = ChatSessionHandler()
    session_id = db.create_session(req.session_name, req.brain_id)
    if session_id == -1:
        raise HTTPException(500, "채팅 세션 생성 실패")
    return {"session_id": session_id}

@router.delete("/{session_id}", summary="채팅 세션 삭제")
async def delete_session(session_id: int):
    db = ChatSessionHandler()
    result = db.delete_session(session_id)
    if not result:
        raise HTTPException(404, "삭제할 세션이 없습니다.")
    return {"success": True}

@router.patch("/{session_id}/rename", summary="채팅 세션 이름 수정")
async def rename_session(session_id: int, req: ChatSessionRenameRequest):
    """채팅 세션의 이름을 수정합니다."""
    db = ChatSessionHandler()
    
    # 세션 존재 여부 확인
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(404, "수정할 세션이 없습니다.")
    
    # 이름 수정
    result = db.update_session_name(session_id, req.session_name)
    if not result:
        raise HTTPException(500, "세션 이름 수정에 실패했습니다.")
    
    # 수정된 세션 정보 반환
    updated_session = db.get_session(session_id)
    return updated_session

@router.get("/", summary="모든 채팅 세션 리스트 조회")
async def get_all_sessions():
    db = ChatSessionHandler()
    sessions = db.get_all_sessions()
    return sessions

@router.get("/brain/{brain_id}", summary="특정 브레인의 채팅 세션 리스트 조회")
async def get_sessions_by_brain(brain_id: int):
    """특정 브레인에 속한 모든 채팅 세션을 조회합니다."""
    db = ChatSessionHandler()
    sessions = db.get_sessions_by_brain(brain_id)
    return sessions

@router.get("/{session_id}", summary="특정 채팅 세션 단일 조회")
async def get_session(session_id: int):
    db = ChatSessionHandler()
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(404, "해당 세션이 없습니다.")
    return session 