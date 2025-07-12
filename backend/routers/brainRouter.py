from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db.sqlite_handler import SQLiteHandler
from neo4j_db.Neo4jHandler import Neo4jHandler
import logging
import sqlite3
from datetime import date

sqlite_handler = SQLiteHandler()
neo4j_handler = Neo4jHandler()

router = APIRouter(
    prefix="/brains",
    tags=["brains"],
    responses={404: {"description": "Not found"}}
)

# ───────── Pydantic 모델 ───────── #
class BrainCreate(BaseModel):
    brain_name : str = Field(..., min_length=1, max_length=50)
    created_at : Optional[str]  = None        # "2025-05-06" 등

class BrainUpdate(BaseModel):
    brain_name : Optional[str]  = None
    created_at : Optional[str]  = None

class BrainResponse(BaseModel):
    brain_id: int = Field(..., description="브레인 ID", example=1)
    brain_name: str = Field(..., description="브레인 이름", example="파이썬 학습")
    created_at: str | None = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "brain_id": 1,
                "brain_name": "파이썬 학습"
            }
        }

# ───────── 새 엔드포인트: 제목(이름)만 수정 ───────── #
class BrainRename(BaseModel):
    brain_name: str = Field(..., min_length=1, max_length=50)

# ───────── 엔드포인트 ───────── #
@router.post(
    "/", status_code=status.HTTP_201_CREATED,
    response_model=BrainResponse,
    summary="브레인 생성", description="새로운 브레인을 생성합니다."
)
async def create_brain(brain: BrainCreate):
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
    summary="모든 브레인 조회", description="전체 브레인 목록을 반환합니다."
)
async def get_all_brains():
    return sqlite_handler.get_all_brains()

@router.get(
    "/{brain_id}", response_model=BrainResponse,
    summary="특정 브레인 조회"
)
async def get_brain(brain_id: int):
    rec = sqlite_handler.get_brain(brain_id)
    if not rec:
        raise HTTPException(404, "브레인을 찾을 수 없습니다")
    return rec

@router.put(
    "/{brain_id}", response_model=BrainResponse,
    summary="브레인 수정", description="이름·아이콘·파일트리·생성일 중 필요한 필드만 갱신"
)
async def update_brain(brain_id: int, data: BrainUpdate):
    origin = sqlite_handler.get_brain(brain_id)
    if not origin:
        raise HTTPException(404, "브레인을 찾을 수 없습니다")

    payload = {k: v for k, v in data.dict().items() if v is not None}
    if not payload:
        return origin  # 변경 사항 없음

    try:
        # 이름만 바꿀 때 기존 메서드 활용
        if 'brain_name' in payload:
            sqlite_handler.update_brain_name(brain_id, payload['brain_name'])
        # 나머지 필드는 범용 update_brain(가변) 메서드로 처리
        sqlite_handler.update_brain(brain_id, **payload)
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

@router.delete(
    "/{brain_id}/deleteDB/{source_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="특정 source_id의 descriptions 삭제 및 임베딩 삭제"
)
async def delete_descriptions_by_source_id(brain_id: str, source_id: str):
    """
    특정 source_id를 가진 description들을 삭제합니다.
    - Neo4j에서 해당 source_id를 가진 description들을 삭제하고, description이 비어있는 노드는 삭제합니다.
    - 벡터 DB에서 해당 source_id를 가진 임베딩값들을 삭제합니다.
    """
    try:
        # 1. Neo4j에서 description 삭제
        neo4j_handler.delete_descriptions_by_source_id(source_id, brain_id)
        
        # 2. 벡터 DB에서 임베딩 삭제
        from services.embedding_service import delete_node
        delete_node(source_id, brain_id)
        
    except Exception as e:
        raise HTTPException(500, str(e))
