"""
chat_router.py

채팅 관련 API 엔드포인트를 관리하는 라우터 모듈입니다.

주요 기능:
- AI 챗봇 응답 생성 (GPT/Ollama 모델 지원)
- 채팅 내역 저장 및 관리
- 채팅 세션별 메시지 조회
- 참조 노드 정보 조회
- 채팅 메시지별 소스 정보 관리

지원하는 엔드포인트:
- POST /chat/ : AI 챗봇 응답 생성
- POST /chat/session/{session_id} : 채팅 내역 저장
- GET /chat/session/{session_id} : 세션별 채팅 내역 조회
- DELETE /chat/session/{session_id} : 세션별 채팅 내역 삭제
- GET /chat/{chat_id}/referenced_nodes : 참조 노드 조회
- GET /chat/{chat_id}/message : 특정 채팅 메시지 조회
- GET /chat/{chat_id}/node_sources : 노드 소스 정보 조회

AI 모델:
- GPT: OpenAI GPT 모델 사용 (외부 API)
- Ollama: 로컬 Ollama 모델 사용 (로컬 서버)

데이터베이스:
- SQLite: 채팅 메시지 및 세션 정보 저장
- Neo4j: 참조 노드 정보 관리

의존성:
- FastAPI: 웹 프레임워크
- Pydantic: 데이터 검증 및 직렬화
- SQLiteHandler: SQLite 데이터베이스 작업
- AI 서비스: GPT/Ollama 모델 연동
"""

# src/routers/chatRouter.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from dependencies import get_ai_service_GPT
from dependencies import get_ai_service_Ollama
from sqlite_db import SQLiteHandler

# ───────── FastAPI 라우터 설정 ───────── #
router = APIRouter(prefix="/chat", tags=["chat"])

# ───────── Pydantic 모델 정의 ───────── #

class ChatRequest(BaseModel):
    """
    AI 챗봇 요청 모델
    
    사용자가 AI 챗봇에게 질문할 때 사용되는 데이터 모델입니다.
    
    Attributes:
        question (str): 질문 내용 (필수)
        model (str): 사용할 모델 ("gpt" 또는 "ollama", 기본값: "ollama")
    """
    question: str = Field(..., description="질문 내용")
    model: str = Field("ollama", description="사용할 모델 (gpt 또는 ollama)")

class ChatResponse(BaseModel):
    """
    AI 챗봇 응답 모델
    
    AI가 생성한 답변을 반환할 때 사용되는 데이터 모델입니다.
    
    Attributes:
        answer (str): AI가 생성한 답변 내용
    """
    answer: str = Field(..., description="AI가 생성한 답변")

# ───────── AI 챗봇 관련 엔드포인트 ───────── #

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
    """
    AI 챗봇 응답을 생성합니다.
    
    처리 과정:
    1. 요청된 모델 타입 확인 (GPT 또는 Ollama)
    2. 질문 내용 유효성 검사
    3. 선택된 AI 서비스로 답변 생성
    4. 생성된 답변 반환
    
    Args:
        req (ChatRequest): 챗봇 요청 정보
            - question: 질문 내용 (필수)
            - model: 사용할 모델 ("gpt" 또는 "ollama")
        
    Returns:
        ChatResponse: AI가 생성한 답변
            - answer: 생성된 답변 내용
        
    Raises:
        HTTPException: 400 - 질문이 비어있음
    """
    # 모델 선택
    if req.model == "gpt":
        ai_service = get_ai_service_GPT()
    elif req.model == "ollama":
        ai_service = get_ai_service_Ollama()
    
    # 질문 유효성 검사
    if not req.question:
        raise HTTPException(400, "question을 입력해주세요.")
    
    # AI 응답 생성
    answer = ai_service.chat(req.question)  
    return ChatResponse(answer=answer)

# ───────── 채팅 내역 관리 엔드포인트 ───────── #

class ChatSaveRequest(BaseModel):
    """
    채팅 내역 저장 요청 모델
    
    채팅 메시지를 데이터베이스에 저장할 때 사용되는 데이터 모델입니다.
    
    Attributes:
        is_ai (int): AI 응답 여부 (0: 사용자, 1: AI)
        message (str): 메시지 내용
        referenced_nodes (list[str]): 참조된 노드 목록 (기본값: 빈 리스트)
        accuracy (float): 정확도 점수 (기본값: None)
    """
    is_ai: int
    message: str
    referenced_nodes: list[str] = []
    accuracy: float = None

@router.post("/session/{session_id}")
async def save_chat_to_session(session_id: int, req: ChatSaveRequest):
    """
    특정 session_id에 채팅(질문/답변)을 저장합니다.
    
    처리 과정:
    1. session_id와 채팅 정보를 받아서 데이터베이스에 저장
    2. 저장 성공 시 chat_id 반환, 실패 시 오류 처리
    
    Args:
        session_id (int): 채팅 세션 ID
        req (ChatSaveRequest): 저장할 채팅 정보
            - is_ai: AI 응답 여부 (0: 사용자, 1: AI)
            - message: 메시지 내용
            - referenced_nodes: 참조된 노드 목록
            - accuracy: 정확도 점수
        
    Returns:
        dict: 저장된 채팅 ID
            - chat_id: 생성된 채팅 메시지의 고유 ID
        
    Raises:
        HTTPException: 500 - 채팅 저장 실패
    """
    from sqlite_db.chat_handler import ChatHandler
    db = ChatHandler()
    chat_id = db.save_chat(
        session_id=session_id,
        is_ai=bool(req.is_ai),
        message=req.message,
        referenced_nodes=req.referenced_nodes,
        accuracy=req.accuracy
    )
    if chat_id == -1:
        raise HTTPException(500, "채팅 저장 실패")
    return {"chat_id": chat_id}

@router.get("/session/{session_id}")
async def get_chat_list_by_session(session_id: int):
    """
    특정 session_id에 해당하는 모든 채팅 내역을 반환합니다.
    
    처리 과정:
    1. session_id로 해당 세션의 모든 채팅 메시지 조회
    2. 채팅 내역이 없으면 404 오류 반환
    3. 채팅 내역을 시간순으로 정렬하여 반환
    
    Args:
        session_id (int): 조회할 세션 ID
        
    Returns:
        list: 채팅 내역 목록
            - 각 채팅의 chat_id, is_ai, message, referenced_nodes 포함
        
    Raises:
        HTTPException: 404 - 채팅 내역이 없음
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
    
    처리 과정:
    1. session_id로 해당 세션의 모든 채팅 메시지 삭제
    2. 삭제할 채팅이 없으면 404 오류 반환
    3. 삭제 성공 시 성공 메시지 반환
    
    주의사항:
    - 이 작업은 되돌릴 수 없습니다
    - 세션의 모든 채팅 메시지가 영구적으로 삭제됩니다
    
    Args:
        session_id (int): 삭제할 세션 ID
        
    Returns:
        dict: 삭제 성공 여부
            - success: 삭제 성공 여부 (True)
        
    Raises:
        HTTPException: 
            - 404: 삭제할 채팅 내역이 없음
            - 500: 삭제 중 오류
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

# ───────── 채팅 메시지 상세 정보 엔드포인트 ───────── #

@router.get("/{chat_id}/referenced_nodes")
async def get_referenced_nodes_by_chat(chat_id: int):
    """
    특정 chat_id에 해당하는 referenced_nodes(참고 노드 목록)를 반환합니다.
    
    처리 과정:
    1. chat_id로 채팅 메시지 조회
    2. 해당 채팅의 referenced_nodes 정보 추출
    3. JSON 문자열인 경우 파싱하여 반환
    
    Args:
        chat_id (int): 조회할 채팅 ID
        
    Returns:
        dict: 참조된 노드 목록
            - referenced_nodes: 참조된 노드들의 목록
        
    Raises:
        HTTPException: 404 - 채팅을 찾을 수 없음
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
    
    처리 과정:
    1. chat_id로 채팅 메시지 조회
    2. 메시지 내용에서 '[참고된 노드 목록]' 부분 제거
    3. 순수한 메시지 내용만 반환
    
    참고된 노드 목록이 message에 포함되어 있다면 잘라서 반환합니다.
    
    Args:
        chat_id (int): 조회할 채팅 ID
        
    Returns:
        dict: 메시지 내용
            - message: 참고된 노드 목록이 제거된 순수한 메시지 내용
        
    Raises:
        HTTPException: 404 - 채팅을 찾을 수 없음
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
    
    처리 과정:
    1. chat_id로 채팅 메시지 조회
    2. referenced_nodes에서 node_name에 해당하는 노드 찾기
    3. 해당 노드의 source_ids에서 title과 id 정보 추출
    4. titles와 ids 리스트로 반환
    
    반환 예시: { "titles": ["테스트1.txt", "테스트2.pdf"], "ids": ["67", "69"] }
    
    Args:
        chat_id (int): 조회할 채팅 ID
        node_name (str): 조회할 노드 이름
        
    Returns:
        dict: 노드 소스 정보
            - titles: 소스 파일들의 제목 목록
            - ids: 소스 파일들의 ID 목록
        
    Raises:
        HTTPException: 404 - 채팅을 찾을 수 없음
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