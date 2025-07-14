from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db import SQLiteHandler
import logging

sqlite_handler = SQLiteHandler()

router = APIRouter(
    prefix="/memos",
    tags=["memos"],
    responses={404: {"description": "Not found"}}
)

# 메모 생성 요청 모델
class MemoCreate(BaseModel):
    memo_title: Optional[str] = Field(None, max_length=100)
    memo_text: str
    is_source: Optional[bool] = False
    type: Optional[str] = None
    brain_id: Optional[int] = None

# 메모 수정 요청 모델
class MemoUpdate(BaseModel):
    memo_title: Optional[str] = Field(None, min_length=1, max_length=100)
    memo_text: Optional[str] = None
    is_source: Optional[bool] = None
    type: Optional[str] = None
    brain_id: Optional[int] = None

# 메모 응답 모델
class MemoResponse(BaseModel):
    memo_id: int
    memo_title: str
    memo_text: str
    memo_date: str
    is_source: bool
    type: Optional[str]
    brain_id: Optional[int]

# 메모 생성
@router.post("/", response_model=MemoResponse, status_code=status.HTTP_201_CREATED)
async def create_memo(memo_data: MemoCreate):
    try:
        if memo_data.brain_id:
            if not sqlite_handler.get_brain(memo_data.brain_id):
                raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")
        memo = sqlite_handler.create_memo(
            memo_data.memo_title,
            memo_data.memo_text,
            memo_data.is_source,
            memo_data.type,
            memo_data.brain_id
        )
        return memo
    except Exception as e:
        logging.error(f"메모 생성 오류: {e}")
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# 메모 조회
@router.get("/{memo_id}", response_model=MemoResponse)
async def get_memo(memo_id: int):
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return memo

# 메모 수정
@router.put("/{memo_id}", response_model=MemoResponse)
async def update_memo(memo_id: int, memo_data: MemoUpdate):
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    if memo_data.brain_id:
        if not sqlite_handler.get_brain(memo_data.brain_id):
            raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")
    try:
        updated = sqlite_handler.update_memo(
            memo_id,
            memo_data.memo_title,
            memo_data.memo_text,
            memo_data.is_source,
            memo_data.type,
            memo_data.brain_id
        )
        if not updated:
            raise HTTPException(status_code=400, detail="업데이트할 정보가 없습니다")
        return sqlite_handler.get_memo(memo_id)
    except Exception as e:
        logging.error(f"메모 수정 오류: {e}")
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# 메모 삭제
@router.delete("/{memo_id}", status_code=204)
async def delete_memo(memo_id: int):
    if not sqlite_handler.get_memo(memo_id):
        raise HTTPException(status_code=404, detail="삭제할 메모를 찾을 수 없습니다")
    try:
        if not sqlite_handler.delete_memo(memo_id):
            raise HTTPException(status_code=400, detail="메모 삭제 실패")
    except Exception as e:
        logging.error(f"메모 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

# 메모를 소스로 설정
@router.put("/{memo_id}/isSource", response_model=MemoResponse)
async def set_memo_as_source(memo_id: int):
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    try:
        updated = sqlite_handler.update_memo(
            memo_id=memo_id,                    # 메모 ID
            memo_title=None,                    # 제목 변경 없음
            memo_text=None,                     # 내용 변경 없음
            is_source=True,                     # is_source → False로 설정
            type=None,                          # 파일 형식 변경 없음
            brain_id=memo.get("brain_id")       # 기존 brain_id 유지
        )
        if not updated:
            raise HTTPException(status_code=400, detail="메모 업데이트 실패")
        return sqlite_handler.get_memo(memo_id)
    except Exception as e:
        logging.error(f"소스 설정 오류: {e}")
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# 메모를 비소스로 설정
@router.put("/{memo_id}/isNotSource", response_model=MemoResponse)
async def set_memo_as_not_source(memo_id: int):
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    try:
        updated = sqlite_handler.update_memo(
            memo_id=memo_id,                    # 메모 ID
            memo_title=None,                    # 제목 변경 없음
            memo_text=None,                     # 내용 변경 없음
            is_source=False,                    # is_source → False로 설정
            type=None,                          # 파일 형식 변경 없음
            brain_id=memo.get("brain_id")       # 기존 brain_id 유지
        )
        if not updated:
            raise HTTPException(status_code=400, detail="메모 업데이트 실패")
        return sqlite_handler.get_memo(memo_id)
    except Exception as e:
        logging.error(f"비소스 설정 오류: {e}")
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# 브레인 내 모든 메모 조회
@router.get("/brain/{brain_id}", response_model=List[MemoResponse])
async def get_memos_by_brain(brain_id: int):
    try:
        return sqlite_handler.get_memos_by_brain(brain_id)
    except Exception as e:
        logging.error(f"메모 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

# 브레인 내 소스 메모만 조회
@router.get("/source/brain/{brain_id}", response_model=List[MemoResponse])
async def get_source_memos_by_brain(brain_id: int):
    try:
        return sqlite_handler.get_memos_by_brain(brain_id, is_source=True)
    except Exception as e:
        logging.error(f"소스 메모 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")
