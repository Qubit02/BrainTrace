"""
brain_router.py

브레인(Brain) 관련 API 엔드포인트를 관리하는 라우터 모듈입니다.

주요 기능:
- 브레인 생성, 조회, 수정, 삭제 (CRUD 작업)
- 브레인 이름 변경 및 중요도 토글
- 특정 소스의 지식 그래프 데이터 삭제
- 브레인별 데이터 관리 (SQLite + Neo4j + 벡터 DB)

지원하는 엔드포인트:
- POST /brains/ : 브레인 생성
- GET /brains/ : 모든 브레인 조회
- GET /brains/{brain_id} : 특정 브레인 조회
- PUT /brains/{brain_id} : 브레인 수정
- PATCH /brains/{brain_id}/rename : 브레인 이름만 변경
- DELETE /brains/{brain_id} : 브레인 삭제
- PATCH /brains/{brain_id}/toggle-importance : 브레인 중요도 토글
- DELETE /brains/{brain_id}/deleteDB/{source_id} : 특정 소스의 지식 그래프 데이터 삭제

데이터베이스 구조:
- SQLite: 브레인 기본 정보 저장 (brain_id, brain_name, created_at, is_important)
- Neo4j: 지식 그래프 데이터 관리 (노드, 관계, description)
- 벡터 DB: 임베딩 데이터 저장 (Qdrant 사용)

의존성:
- FastAPI: 웹 프레임워크
- Pydantic: 데이터 검증 및 직렬화
- SQLiteHandler: SQLite 데이터베이스 작업
- Neo4jHandler: Neo4j 그래프 데이터베이스 작업
- embedding_service: 벡터 데이터베이스 작업

"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db import SQLiteHandler
from neo4j_db.Neo4jHandler import Neo4jHandler
import logging
import sqlite3
from datetime import date

# ───────── 데이터베이스 핸들러 초기화 ───────── #
# SQLite: 브레인 기본 정보 저장용
sqlite_handler = SQLiteHandler()
# Neo4j: 지식 그래프 데이터 관리용
neo4j_handler = Neo4jHandler()

# ───────── FastAPI 라우터 설정 ───────── #
router = APIRouter(
    prefix="/brains",
    tags=["brains"],
    responses={404: {"description": "Not found"}}
)

# ───────── Pydantic 모델 정의 ───────── #

class BrainCreate(BaseModel):
    """
    브레인 생성 요청 모델
    
    브레인을 새로 생성할 때 사용되는 데이터 모델입니다.
    
    Attributes:
        brain_name (str): 브레인 이름 (1-50자 제한)
        created_at (Optional[str]): 생성 날짜 (ISO 형식, 예: "2025-05-06")
                                 None인 경우 현재 날짜로 자동 설정
    """
    brain_name : str = Field(..., min_length=1, max_length=50)
    created_at : Optional[str]  = None        # "2025-05-06" 등

class BrainUpdate(BaseModel):
    """
    브레인 수정 요청 모델
    
    기존 브레인의 정보를 수정할 때 사용되는 데이터 모델입니다.
    Optional 필드들로 구성되어 있어 필요한 필드만 수정 가능합니다.
    
    Attributes:
        brain_name (Optional[str]): 수정할 브레인 이름
        created_at (Optional[str]): 수정할 생성 날짜
    """
    brain_name : Optional[str]  = None
    created_at : Optional[str]  = None

class BrainResponse(BaseModel):
    """
    브레인 응답 모델
    
    API 응답으로 사용되는 브레인 정보 모델입니다.
    
    Attributes:
        brain_id (int): 브레인 고유 ID (자동 생성)
        brain_name (str): 브레인 이름
        created_at (str | None): 생성 날짜 (ISO 형식)
        is_important (bool): 중요도 여부 (기본값: False)
    """
    brain_id: int = Field(..., description="브레인 ID", example=1)
    brain_name: str = Field(..., description="브레인 이름", example="파이썬 학습")
    created_at: str | None = None
    is_important: bool = Field(False, description="중요도 여부", example=False)
    
    class Config:
        json_schema_extra = {
            "example": {
                "brain_id": 1,
                "brain_name": "파이썬 학습",
                "is_important": False
            }
        }

class BrainRename(BaseModel):
    """
    브레인 이름 변경 요청 모델
    
    브레인의 이름만 변경할 때 사용되는 간단한 모델입니다.
    
    Attributes:
        brain_name (str): 새로운 브레인 이름 (1-50자 제한)
    """
    brain_name: str = Field(..., min_length=1, max_length=50)

# ───────── API 엔드포인트 ───────── #

@router.post(
    "/", status_code=status.HTTP_201_CREATED,
    response_model=BrainResponse,
    summary="브레인 생성", 
    description="새로운 브레인을 생성합니다."
)
async def create_brain(brain: BrainCreate):
    """
    새로운 브레인을 생성합니다.
    
    처리 과정:
    1. 요청 데이터 검증 (brain_name 길이 등)
    2. SQLite에 브레인 정보 저장
    3. 생성된 브레인 정보 반환
    
    Args:
        brain (BrainCreate): 브레인 생성 정보
            - brain_name: 브레인 이름 (필수)
            - created_at: 생성 날짜 (선택, 없으면 현재 날짜 사용)
        
    Returns:
        BrainResponse: 생성된 브레인 정보
            - brain_id: 자동 생성된 고유 ID
            - brain_name: 브레인 이름
            - created_at: 생성 날짜
            - is_important: 중요도 여부 (기본값: False)
        
    Raises:
        HTTPException: 
            - 400: 잘못된 요청 (예: 중복된 이름)
            - 500: 서버 내부 오류
    """
    try:
        return sqlite_handler.create_brain(
            brain_name = brain.brain_name,
            created_at = date.today().isoformat()   # ← 오늘 날짜 자동 입력
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error("브레인 생성 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.get(
    "/", response_model=List[BrainResponse],
    summary="모든 브레인 조회", 
    description="전체 브레인 목록을 반환합니다."
)
async def get_all_brains():
    """
    모든 브레인 목록을 조회합니다.
    
    처리 과정:
    1. SQLite에서 모든 브레인 정보 조회
    2. 브레인 목록을 리스트 형태로 반환
    
    Returns:
        List[BrainResponse]: 브레인 목록
            - 각 브레인의 brain_id, brain_name, created_at, is_important 포함
    """
    return sqlite_handler.get_all_brains()

@router.get(
    "/{brain_id}", response_model=BrainResponse,
    summary="특정 브레인 조회"
)
async def get_brain(brain_id: int):
    """
    특정 브레인을 조회합니다.
    
    처리 과정:
    1. brain_id로 SQLite에서 브레인 정보 조회
    2. 브레인이 존재하면 정보 반환, 없으면 404 오류
    
    Args:
        brain_id (int): 조회할 브레인 ID
        
    Returns:
        BrainResponse: 브레인 정보
            - brain_id, brain_name, created_at, is_important 포함
        
    Raises:
        HTTPException: 404 - 브레인을 찾을 수 없음
    """
    rec = sqlite_handler.get_brain(brain_id)
    if not rec:
        raise HTTPException(404, "브레인을 찾을 수 없습니다")
    return rec

@router.put(
    "/{brain_id}", response_model=BrainResponse,
    summary="브레인 수정", 
    description="이름·아이콘·파일트리·생성일 중 필요한 필드만 갱신"
)
async def update_brain(brain_id: int, data: BrainUpdate):
    """
    브레인 정보를 수정합니다.
    
    처리 과정:
    1. brain_id로 기존 브레인 존재 여부 확인
    2. 요청된 필드만 업데이트 (None이 아닌 필드만)
    3. 수정된 브레인 정보 반환
    
    Args:
        brain_id (int): 수정할 브레인 ID
        data (BrainUpdate): 수정할 데이터
            - brain_name: 새로운 브레인 이름 (선택)
            - created_at: 새로운 생성 날짜 (선택)
        
    Returns:
        BrainResponse: 수정된 브레인 정보
        
    Raises:
        HTTPException: 404 - 브레인을 찾을 수 없음
    """
    origin = sqlite_handler.get_brain(brain_id)
    if not origin:
        raise HTTPException(404, "브레인을 찾을 수 없습니다")

    payload = {k: v for k, v in data.dict().items() if v is not None}
    if not payload:
        return origin  # 변경 사항 없음

    try:
        # brain_name만 업데이트하는 경우
        if 'brain_name' in payload:
            sqlite_handler.update_brain_name(brain_id, payload['brain_name'])
            origin.update(payload)
        return origin
    except Exception as e:
        logging.error("브레인 업데이트 오류: %s", e)
        raise HTTPException(500, "내부 서버 오류")
    
@router.patch(
    "/{brain_id}/rename",
    response_model=BrainResponse,
    summary="브레인 제목(이름)만 수정",
    description="brain_name 필드만 변경합니다."
)
async def rename_brain(brain_id: int, data: BrainRename):
    """
    브레인의 이름만 변경합니다.
    
    처리 과정:
    1. brain_id로 기존 브레인 존재 여부 확인
    2. 새로운 이름으로 브레인 이름 업데이트
    3. 중복 이름 체크 및 오류 처리
    4. 수정된 브레인 정보 반환
    
    Args:
        brain_id (int): 변경할 브레인 ID
        data (BrainRename): 새로운 브레인 이름
            - brain_name: 새로운 브레인 이름 (1-50자)
        
    Returns:
        BrainResponse: 이름이 변경된 브레인 정보
        
    Raises:
        HTTPException: 
            - 404: 브레인을 찾을 수 없음
            - 400: 중복된 이름
            - 500: 서버 내부 오류
    """
    # 1) 기존 레코드 확인
    origin = sqlite_handler.get_brain(brain_id)
    if not origin:
        raise HTTPException(status_code=404, detail="브레인을 찾을 수 없습니다")

    # 2) DB 업데이트
    try:
        sqlite_handler.update_brain_name(brain_id, data.brain_name)
        origin["brain_name"] = data.brain_name
        return origin
    except sqlite3.IntegrityError:
        raise HTTPException(400, "이미 존재하는 이름입니다")
    except Exception as e:
        logging.error("브레인 제목 수정 오류: %s", e)
        raise HTTPException(500, "내부 서버 오류")

@router.delete(
    "/{brain_id}", status_code=status.HTTP_204_NO_CONTENT,
    summary="브레인 삭제"
)
async def delete_brain(brain_id: int):
    """
    브레인을 완전히 삭제합니다.
    
    처리 과정:
    1. Neo4j에서 brain_id에 해당하는 모든 description 삭제
    2. 벡터 DB에서 brain_id에 해당하는 컬렉션 전체 삭제
    3. SQLite에서 brain 삭제
    
    주의사항:
    - 이 작업은 되돌릴 수 없습니다
    - 관련된 모든 데이터(지식 그래프, 임베딩)가 함께 삭제됩니다
    
    Args:
        brain_id (int): 삭제할 브레인 ID
        
    Raises:
        HTTPException: 
            - 404: 브레인을 찾을 수 없음
            - 500: 서버 내부 오류
    """
    try:
        # 1. Neo4j에서 brain_id에 해당하는 모든 description 삭제
        neo4j_handler.delete_descriptions_by_brain_id(str(brain_id))
        
        # 2. 벡터 DB에서 brain_id에 해당하는 컬렉션 전체 삭제
        from services.embedding_service import delete_collection
        delete_collection(str(brain_id))
        
        # 3. SQLite에서 brain 삭제
        if not sqlite_handler.delete_brain(brain_id):
            raise HTTPException(404, "브레인을 찾을 수 없습니다")
            
    except Exception as e:
        raise HTTPException(500, str(e))

@router.patch(
    "/{brain_id}/toggle-importance",
    response_model=BrainResponse,
    summary="브레인 중요도 토글",
    description="브레인의 중요도 상태를 토글합니다."
)
async def toggle_brain_importance(brain_id: int):
    """
    브레인의 중요도 상태를 토글합니다.
    
    처리 과정:
    1. brain_id로 브레인 존재 여부 확인
    2. 현재 중요도 상태를 반전 (True ↔ False)
    3. 업데이트된 브레인 정보 반환
    
    Args:
        brain_id (int): 토글할 브레인 ID
        
    Returns:
        BrainResponse: 중요도가 토글된 브레인 정보
            - is_important: 토글된 중요도 상태
        
    Raises:
        HTTPException: 
            - 404: 브레인을 찾을 수 없음
            - 500: 서버 내부 오류
    """
    try:
        # 중요도 토글
        if not sqlite_handler.toggle_importance(brain_id):
            raise HTTPException(404, "브레인을 찾을 수 없습니다")
        
        # 업데이트된 브레인 정보 반환
        updated_brain = sqlite_handler.get_brain(brain_id)
        if not updated_brain:
            raise HTTPException(404, "브레인을 찾을 수 없습니다")
        
        return updated_brain
    except Exception as e:
        logging.error("브레인 중요도 토글 오류: %s", e)
        raise HTTPException(500, "내부 서버 오류")

@router.delete(
    "/{brain_id}/deleteDB/{source_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="특정 source_id의 descriptions 삭제 및 임베딩 삭제"
)
async def delete_descriptions_by_source_id(brain_id: str, source_id: str):
    """
    특정 source_id를 가진 description들을 삭제합니다.
    
    처리 과정:
    1. Neo4j에서 해당 source_id를 가진 description들을 삭제하고, 
       description이 비어있는 노드는 삭제합니다.
    2. 벡터 DB에서 해당 source_id를 가진 임베딩값들을 삭제합니다.
    
    주의사항:
    - 이 작업은 되돌릴 수 없습니다
    - 특정 소스의 지식 그래프 데이터만 삭제됩니다
    - 브레인 자체는 삭제되지 않습니다
    
    Args:
        brain_id (str): 브레인 ID
        source_id (str): 삭제할 소스 ID
        
    Raises:
        HTTPException: 500 - 서버 내부 오류
    """
    try:
        # 1. Neo4j에서 description 삭제
        neo4j_handler.delete_descriptions_by_source_id(source_id, brain_id)
        
        # 2. 벡터 DB에서 임베딩 삭제
        from services.embedding_service import delete_node
        delete_node(source_id, brain_id)
        
    except Exception as e:
        raise HTTPException(500, str(e))
