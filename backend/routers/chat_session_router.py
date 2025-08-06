"""
chat_session_router.py

채팅 세션 관련 API 엔드포인트를 관리하는 라우터 모듈입니다.

주요 기능:
- 채팅 세션 생성, 조회, 수정, 삭제 (CRUD 작업)
- 브레인별 채팅 세션 관리
- 세션 이름 변경 및 관리
- 전체 세션 목록 조회

지원하는 엔드포인트:
- POST /chatsession/ : 채팅 세션 생성
- GET /chatsession/ : 모든 채팅 세션 리스트 조회
- GET /chatsession/brain/{brain_id} : 특정 브레인의 채팅 세션 리스트 조회
- GET /chatsession/{session_id} : 특정 채팅 세션 단일 조회
- PATCH /chatsession/{session_id}/rename : 채팅 세션 이름 수정
- DELETE /chatsession/{session_id} : 채팅 세션 삭제

데이터베이스:
- SQLite: 채팅 세션 정보 저장 (session_id, session_name, brain_id, created_at)

의존성:
- FastAPI: 웹 프레임워크
- Pydantic: 데이터 검증 및 직렬화
- ChatSessionHandler: SQLite 데이터베이스 작업
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlite_db.chatsession_handler import ChatSessionHandler

# ───────── FastAPI 라우터 설정 ───────── #
router = APIRouter(prefix="/chatsession", tags=["chatsession"])

# ───────── Pydantic 모델 정의 ───────── #

class ChatSessionCreateRequest(BaseModel):
    """
    채팅 세션 생성 요청 모델
    
    새로운 채팅 세션을 생성할 때 사용되는 데이터 모델입니다.
    
    Attributes:
        session_name (str): 세션 이름 (필수)
        brain_id (int | None): 연결할 브레인 ID (선택, 기본값: None)
    """
    session_name: str
    brain_id: int | None = None

class ChatSessionRenameRequest(BaseModel):
    """
    채팅 세션 이름 변경 요청 모델
    
    기존 채팅 세션의 이름을 변경할 때 사용되는 데이터 모델입니다.
    
    Attributes:
        session_name (str): 새로운 세션 이름 (1-100자 제한)
    """
    session_name: str = Field(..., min_length=1, max_length=100, description="새로운 세션 이름")

# ───────── API 엔드포인트 ───────── #

@router.post("/", summary="채팅 세션 생성")
async def create_session(req: ChatSessionCreateRequest):
    """
    새로운 채팅 세션을 생성합니다.
    
    처리 과정:
    1. 세션 이름과 브레인 ID를 받아서 데이터베이스에 저장
    2. 생성 성공 시 session_id 반환, 실패 시 오류 처리
    
    Args:
        req (ChatSessionCreateRequest): 세션 생성 정보
            - session_name: 세션 이름 (필수)
            - brain_id: 연결할 브레인 ID (선택)
        
    Returns:
        dict: 생성된 세션 ID
            - session_id: 생성된 채팅 세션의 고유 ID
        
    Raises:
        HTTPException: 500 - 채팅 세션 생성 실패
    """
    db = ChatSessionHandler()
    session_id = db.create_session(req.session_name, req.brain_id)
    if session_id == -1:
        raise HTTPException(500, "채팅 세션 생성 실패")
    return {"session_id": session_id}

@router.delete("/{session_id}", summary="채팅 세션 삭제")
async def delete_session(session_id: int):
    """
    특정 채팅 세션을 삭제합니다.
    
    처리 과정:
    1. session_id로 해당 세션 존재 여부 확인
    2. 세션이 존재하면 삭제, 없으면 404 오류 반환
    3. 삭제 성공 시 성공 메시지 반환
    
    주의사항:
    - 이 작업은 되돌릴 수 없습니다
    - 세션과 관련된 모든 채팅 메시지도 함께 삭제됩니다
    
    Args:
        session_id (int): 삭제할 세션 ID
        
    Returns:
        dict: 삭제 성공 여부
            - success: 삭제 성공 여부 (True)
        
    Raises:
        HTTPException: 404 - 삭제할 세션이 없음
    """
    db = ChatSessionHandler()
    result = db.delete_session(session_id)
    if not result:
        raise HTTPException(404, "삭제할 세션이 없습니다.")
    return {"success": True}

@router.patch("/{session_id}/rename", summary="채팅 세션 이름 수정")
async def rename_session(session_id: int, req: ChatSessionRenameRequest):
    """
    채팅 세션의 이름을 수정합니다.
    
    처리 과정:
    1. session_id로 기존 세션 존재 여부 확인
    2. 새로운 이름으로 세션 이름 업데이트
    3. 수정된 세션 정보 반환
    
    Args:
        session_id (int): 수정할 세션 ID
        req (ChatSessionRenameRequest): 새로운 세션 이름
            - session_name: 새로운 세션 이름 (1-100자)
        
    Returns:
        dict: 수정된 세션 정보
            - session_id, session_name, brain_id, created_at 포함
        
    Raises:
        HTTPException: 
            - 404: 수정할 세션이 없음
            - 500: 세션 이름 수정 실패
    """
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
    """
    모든 채팅 세션 목록을 조회합니다.
    
    처리 과정:
    1. 데이터베이스에서 모든 채팅 세션 정보 조회
    2. 세션 목록을 시간순으로 정렬하여 반환
    
    Returns:
        list: 모든 채팅 세션 목록
            - 각 세션의 session_id, session_name, brain_id, created_at 포함
    """
    db = ChatSessionHandler()
    sessions = db.get_all_sessions()
    return sessions

@router.get("/brain/{brain_id}", summary="특정 브레인의 채팅 세션 리스트 조회")
async def get_sessions_by_brain(brain_id: int):
    """
    특정 브레인에 속한 모든 채팅 세션을 조회합니다.
    
    처리 과정:
    1. brain_id로 해당 브레인에 연결된 모든 세션 조회
    2. 브레인별로 그룹화된 세션 목록 반환
    
    Args:
        brain_id (int): 조회할 브레인 ID
        
    Returns:
        list: 해당 브레인의 채팅 세션 목록
            - 각 세션의 session_id, session_name, brain_id, created_at 포함
    """
    db = ChatSessionHandler()
    sessions = db.get_sessions_by_brain(brain_id)
    return sessions

@router.get("/{session_id}", summary="특정 채팅 세션 단일 조회")
async def get_session(session_id: int):
    """
    특정 채팅 세션의 상세 정보를 조회합니다.
    
    처리 과정:
    1. session_id로 해당 세션 정보 조회
    2. 세션이 존재하면 정보 반환, 없으면 404 오류
    
    Args:
        session_id (int): 조회할 세션 ID
        
    Returns:
        dict: 세션 상세 정보
            - session_id, session_name, brain_id, created_at 포함
        
    Raises:
        HTTPException: 404 - 해당 세션이 없음
    """
    db = ChatSessionHandler()
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(404, "해당 세션이 없습니다.")
    return session 