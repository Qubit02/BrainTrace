from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db import SQLiteHandler
import logging
import re

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
    is_deleted: Optional[bool] = False

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
    memo = sqlite_handler.get_memo_with_deleted(memo_id)
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

    # 파일명 제한 검증
    if memo_data.memo_title is not None:
        name = memo_data.memo_title
        # 1. 길이 제한
        if not (1 <= len(name) <= 100):
            raise HTTPException(status_code=400, detail="파일명은 1~100자여야 합니다.")
        # 2. 공백만 입력 금지
        if name.strip() == "":
            raise HTTPException(status_code=400, detail="파일명에 공백만 입력할 수 없습니다.")
        # 3. 특수문자 제한
        if re.search(r'[\\/:*?"<>|]', name):
            raise HTTPException(status_code=400, detail="파일명에 / \\ : * ? \" < > | 문자를 사용할 수 없습니다.")
        # 4. 점(.)으로 시작/끝 금지
        if name.startswith('.') or name.endswith('.'):
            raise HTTPException(status_code=400, detail="파일명은 .(점)으로 시작하거나 끝날 수 없습니다.")

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

# 메모 완전 삭제 (소프트 삭제된 메모를 실제로 삭제)
@router.delete("/{memo_id}/hard", status_code=204)
async def hard_delete_memo(memo_id: int):
    if not sqlite_handler.get_memo_with_deleted(memo_id):
        raise HTTPException(status_code=404, detail="삭제할 메모를 찾을 수 없습니다")
    try:
        if not sqlite_handler.hard_delete_memo(memo_id):
            raise HTTPException(status_code=400, detail="메모 완전 삭제 실패")
    except Exception as e:
        logging.error(f"메모 완전 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

# 삭제된 메모 복구
@router.put("/{memo_id}/restore", response_model=MemoResponse)
async def restore_memo(memo_id: int):
    if not sqlite_handler.get_memo_with_deleted(memo_id):
        raise HTTPException(status_code=404, detail="복구할 메모를 찾을 수 없습니다")
    try:
        if not sqlite_handler.restore_memo(memo_id):
            raise HTTPException(status_code=400, detail="메모 복구 실패")
        return sqlite_handler.get_memo(memo_id)
    except Exception as e:
        logging.error(f"메모 복구 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

# 메모를 소스로 설정
@router.put("/{memo_id}/isSource", response_model=MemoResponse)
async def set_memo_as_source(memo_id: int):
    memo = sqlite_handler.get_memo_with_deleted(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    try:
        updated = sqlite_handler.update_memo(
            memo_id=memo_id,                    # 메모 ID
            memo_title=None,                    # 제목 변경 없음
            memo_text=None,                     # 내용 변경 없음
            is_source=True,                     # is_source → True로 설정
            type=None,                          # 파일 형식 변경 없음
            brain_id=memo.get("brain_id")       # 기존 brain_id 유지
        )
        if not updated:
            raise HTTPException(status_code=400, detail="메모 업데이트 실패")
        return sqlite_handler.get_memo_with_deleted(memo_id)
    except Exception as e:
        logging.error(f"소스 설정 오류: {e}")
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# 메모를 비소스로 설정 (완전 삭제)
@router.put("/{memo_id}/isNotSource", status_code=204)
async def set_memo_as_not_source(memo_id: int):
    memo = sqlite_handler.get_memo_with_deleted(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    try:
        # 메모를 완전히 삭제
        if not sqlite_handler.hard_delete_memo(memo_id):
            raise HTTPException(status_code=400, detail="메모 삭제 실패")
        logging.info(f"소스 메모 완전 삭제 완료: memo_id={memo_id}")
    except Exception as e:
        logging.error(f"소스 메모 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# 브레인 내 모든 메모 조회
@router.get("/brain/{brain_id}", response_model=List[MemoResponse])
async def get_memos_by_brain(brain_id: int, include_deleted: bool = False):
    try:
        return sqlite_handler.get_memos_by_brain(brain_id, include_deleted=include_deleted)
    except Exception as e:
        logging.error(f"메모 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

# 브레인 내 소스 메모만 조회
@router.get("/source/brain/{brain_id}", response_model=List[MemoResponse])
async def get_source_memos_by_brain(brain_id: int):
    try:
        return sqlite_handler.get_memos_by_brain(brain_id, is_source=True, include_deleted=True)
    except Exception as e:
        logging.error(f"소스 메모 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

# 메모를 소스로 변환
@router.post("/{memo_id}/convertToSource", response_model=MemoResponse, status_code=status.HTTP_201_CREATED)
async def convert_memo_to_source(memo_id: int):
    # 원본 메모 조회
    original_memo = sqlite_handler.get_memo_with_deleted(memo_id)
    if not original_memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    
    try:
        # 새로운 소스 메모 생성
        new_source_memo = sqlite_handler.create_memo(
            memo_title=original_memo.get("memo_title", ""),
            memo_text=original_memo.get("memo_text", ""),
            is_source=True,
            type=original_memo.get("type"),
            brain_id=original_memo.get("brain_id")
        )
        
        logging.info(f"메모를 소스로 변환 완료: memo_id={memo_id} -> new_source_id={new_source_memo['memo_id']}")
        return new_source_memo
    except Exception as e:
        logging.error(f"메모 소스 변환 오류: {e}")
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# 휴지통 비우기 (삭제된 메모 모두 완전 삭제)
@router.delete("/trash/{brain_id}", status_code=204)
async def empty_trash(brain_id: int):
    try:
        # 브레인 내 삭제된 메모들을 모두 완전 삭제
        deleted_count = sqlite_handler.empty_trash(brain_id)
        logging.info(f"휴지통 비우기 완료: brain_id={brain_id}, 삭제된 메모 수={deleted_count}")
        return {"deleted_count": deleted_count}
    except Exception as e:
        logging.error(f"휴지통 비우기 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")
