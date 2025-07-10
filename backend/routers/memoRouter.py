from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db.sqlite_handler import SQLiteHandler
import logging
from datetime import datetime,timedelta

# SQLite 핸들러 인스턴스 생성
sqlite_handler = SQLiteHandler()

# 라우터 정의
router = APIRouter(
    prefix="/memos",
    tags=["memos"],
    responses={404: {"description": "Not found"}}
)

# Pydantic 모델 정의
class MemoCreate(BaseModel):
    memo_title: str = Field(..., description="메모 제목", min_length=1, max_length=100, example="파이썬 문법 정리")
    memo_text: str = Field(..., description="메모 내용", example="파이썬은 들여쓰기가 중요한 언어입니다.")
    folder_id: Optional[int] = Field(None, description="메모가 속한 폴더 ID", example=1)
    is_source: Optional[bool] = Field(False, description="소스 메모 여부", example=False)
    type: Optional[str] = Field(None, description="파일 확장자명", example="txt")
    brain_id: Optional[int] = Field(None, description="연결할 Brain ID")

class MemoUpdate(BaseModel):
    memo_title: Optional[str] = Field(None, description="새 메모 제목", min_length=1, max_length=100, example="파이썬 고급 문법")
    memo_text: Optional[str] = Field(None, description="새 메모 내용", example="파이썬의 고급 기능에는 제너레이터와 데코레이터가 있습니다.")
    is_source: Optional[bool] = Field(None, description="소스 메모 여부", example=True)
    type: Optional[str] = Field(None, description="파일 확장자명", example="txt")
    brain_id: Optional[int] = Field(None, description="새로운 Brain ID")

class MemoResponse(BaseModel):
    memo_id: int = Field(..., description="메모 ID", example=1)
    memo_title: str = Field(..., description="메모 제목", example="파이썬 문법 정리")
    memo_text: str = Field(..., description="메모 내용", example="파이썬은 들여쓰기가 중요한 언어입니다.")
    memo_date: str = Field(..., description="메모 작성/수정일", example="2023-06-15 14:30:45")
    is_source: bool = Field(..., description="소스 메모 여부", example=False)
    type: Optional[str] = Field(None, description="파일 확장자명", example="txt")
    folder_id: Optional[int] = Field(None, description="메모가 속한 폴더 ID", example=1)
    brain_id: Optional[int] = Field(None, description="연결된 Brain ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "memo_id": 1,
                "memo_title": "파이썬 문법 정리",
                "memo_text": "파이썬은 들여쓰기가 중요한 언어입니다.",
                "memo_date": "2023-06-15 14:30:45",
                "is_source": False,
                "type": "txt",
                "folder_id": 1,
                "brain_id": 1
            }
        }

# API 엔드포인트 정의
@router.post("/", response_model=MemoResponse, status_code=status.HTTP_201_CREATED,
            summary="메모 생성",
            description="새로운 메모를 생성합니다. folder_id가 주어지면 해당 폴더에 메모가 생성되고, 주어지지 않으면 폴더 없이 생성됩니다.")
async def create_memo(memo_data: MemoCreate):
    print("🧠 받은 brain_id:", memo_data.brain_id)
    """
    새 메모를 생성합니다:
    
    - **memo_title**: 메모 제목
    - **memo_text**: 메모 내용
    - **folder_id**: (선택) 메모를 생성할 폴더 ID. 지정하지 않으면 폴더 없이 생성됩니다.
    - **is_source**: (선택) 소스 메모 여부
    - **type**: (선택) 파일 확장자명
    - **brain_id**: (선택) 연결할 Brain ID
    """
    try:
        # folder_id가 주어진 경우 폴더 존재 여부 확인
        if memo_data.folder_id is not None:
            folder = sqlite_handler.get_folder(memo_data.folder_id)
            if not folder:
                raise HTTPException(status_code=404, detail="폴더를 찾을 수 없습니다")

        # brain_id가 주어진 경우 브레인 존재 여부 확인
        if memo_data.brain_id is not None:
            brain = sqlite_handler.get_brain(memo_data.brain_id)
            if not brain:
                raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")

        memo = sqlite_handler.create_memo(
            memo_data.memo_title,
            memo_data.memo_text,
            memo_data.folder_id,
            memo_data.is_source,
            memo_data.type,
            memo_data.brain_id
        )
        return memo
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error("메모 생성 오류: %s", str(e))
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.get("/{memo_id}", response_model=MemoResponse,
           summary="특정 메모 조회",
           description="지정된 ID의 메모 정보를 반환합니다. 휴지통에 있는 메모도 조회가능")
async def get_memo(memo_id: int):
    """
    지정된 메모 정보를 반환합니다:
    
    - **memo_id**: 조회할 메모의 ID
    """
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    # if memo.get("is_delete"):
    #     raise HTTPException(status_code=404, detail="휴지통에 있는 메모입니다")
    return memo

@router.put("/{memo_id}", response_model=MemoResponse,
           summary="메모 정보 수정",
           description="메모의 제목, 내용, 소스 여부 또는 파일 확장자명을 업데이트합니다.")
async def update_memo(memo_id: int, memo_data: MemoUpdate):
    """
    메모 정보를 업데이트합니다:
    
    - **memo_id**: 수정할 메모의 ID
    - **memo_title**: (선택) 새 메모 제목
    - **memo_text**: (선택) 새 메모 내용
    - **is_source**: (선택) 소스 메모 여부
    - **type**: (선택) 파일 확장자명
    - **brain_id**: (선택) 새로운 Brain ID
    """
    # 메모 존재 여부 확인
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    
    # Brain 유효성 검사
    if memo_data.brain_id is not None:
        if not sqlite_handler.get_brain(memo_data.brain_id):
            raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")
    
    # 업데이트 수행
    try:
        updated = sqlite_handler.update_memo(
            memo_id,
            memo_data.memo_title,
            memo_data.memo_text,
            memo_data.is_source,
            memo.get("folder_id"),  # 기존 folder_id 유지
            memo_data.type,
            None,  # is_delete는 변경하지 않음
            memo_data.brain_id
        )
        
        if not updated:
            raise HTTPException(status_code=400, detail="업데이트할 정보가 없습니다")
            
        # 업데이트된 정보 반영
        updated_memo = sqlite_handler.get_memo(memo_id)
        return updated_memo
    except Exception as e:
        logging.error("메모 업데이트 오류: %s", str(e))
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.put("/{memo_id}/goToTrashBin", response_model=MemoResponse,
           summary="메모를 휴지통으로 이동",
           description="메모를 휴지통으로 이동시킵니다. is_delete가 true로 설정됩니다.")
async def go_to_trash_bin(memo_id: int):
    """
    메모를 휴지통으로 이동시킵니다:
    
    - **memo_id**: 휴지통으로 이동할 메모의 ID
    """
    # 메모 존재 여부 확인
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    
    try:
        # 기존 메모의 folder_id와 brain_id를 가져옴
        folder_id = memo.get("folder_id")
        brain_id = memo.get("brain_id")
        deleted_at = datetime.now().isoformat()
        updated = sqlite_handler.update_memo(
            memo_id,
            memo_title=None,
            memo_text=None,
            is_source=None,
            folder_id=folder_id,  # 기존 folder_id 사용
            type=None,
            is_delete=True,
            brain_id=brain_id,  # 기존 brain_id 사용
            deleted_at=deleted_at

        )
        
        if not updated:
            raise HTTPException(status_code=400, detail="메모 휴지통 이동 실패")
            
        updated_memo = sqlite_handler.get_memo(memo_id)
        return updated_memo
    except Exception as e:
        logging.error("메모 휴지통 이동 오류: %s", str(e))
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.delete("/{memo_id}/inTrashBin", status_code=status.HTTP_204_NO_CONTENT,
              summary="메모 삭제",
              description="특정 메모를 휴지통통에서 영구적으로 삭제합니다.")
async def delete_memo(memo_id: int):
    """
    메모를 휴지통에서 영구적으로 삭제합니다:
    
    - **memo_id**: 삭제할 메모의 ID
    """
    deleted = sqlite_handler.delete_memo(memo_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")

@router.put("/{memo_id}/isSource", response_model=MemoResponse,
           summary="메모를 소스로 설정",
           description="메모의 is_source 상태를 true로 설정합니다.")
async def set_memo_as_source(memo_id: int):
    """
    메모를 소스 메모로 설정합니다:
    
    - **memo_id**: 소스로 설정할 메모의 ID
    """
    # 메모 존재 여부 확인
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    
    try:
         # 기존 메모의 folder_id와 brain_id를 가져옴
        folder_id = memo.get("folder_id")
        brain_id = memo.get("brain_id")
        updated = sqlite_handler.update_memo(
            memo_id,
            memo_title=None,
            memo_text=None,
            is_source=True,
            folder_id=folder_id,
            type=None,
            is_delete=False,
            brain_id=brain_id
        )
        
        if not updated:
            raise HTTPException(status_code=400, detail="메모 업데이트 실패")
            
        updated_memo = sqlite_handler.get_memo(memo_id)
        return updated_memo
    except Exception as e:
        logging.error("메모 소스 설정 오류: %s", str(e))
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.put("/{memo_id}/isNotSource", response_model=MemoResponse,
           summary="메모의 is_source를 false로로 설정",
           description="메모의 is_source 상태를 false로 설정합니다.")
async def set_memo_as_not_source(memo_id: int):
    """
    메모를 비소스 메모로 설정합니다:
    
    - **memo_id**: 비소스로 설정할 메모의 ID
    """
    # 메모 존재 여부 확인
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    
    try:
         # 기존 메모의 folder_id와 brain_id를 가져옴
        folder_id = memo.get("folder_id")
        brain_id = memo.get("brain_id")
        updated = sqlite_handler.update_memo(
            memo_id,
            memo_title=None,
            memo_text=None,
            is_source=False,
            folder_id=folder_id,
            type=None,
            is_delete=False,
            brain_id=brain_id
        )
        
        if not updated:
            raise HTTPException(status_code=400, detail="메모 업데이트 실패")
            
        updated_memo = sqlite_handler.get_memo(memo_id)
        return updated_memo
    except Exception as e:
        logging.error("메모 비소스 설정 오류: %s", str(e))
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.put("/changeFolder/{target_folder_id}/{memo_id}", response_model=MemoResponse,
           summary="메모의 폴더 변경",
           description="메모를 다른 폴더로 이동합니다.")
async def change_memo_folder(target_folder_id: int, memo_id: int):
    """
    메모를 다른 폴더로 이동합니다:
    
    - **target_folder_id**: 이동할 대상 폴더의 ID
    - **memo_id**: 이동할 메모의 ID
    """
    # 메모 존재 여부 확인
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    
    # 대상 폴더 존재 여부 확인
    if target_folder_id is not None:  # None인 경우는 폴더에서 제거하는 경우
        folder = sqlite_handler.get_folder(target_folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="대상 폴더를 찾을 수 없습니다")
    
    try:
         # 기존 메모의 folder_id와 brain_id를 가져옴
        folder_id = memo.get("folder_id")
        brain_id = memo.get("brain_id")
        # 메모의 folder_id 업데이트
        updated = sqlite_handler.update_memo(
            memo_id,
            memo_title=None,  # 기존 값 유지
            memo_text=None,   # 기존 값 유지
            is_source=None,   # 기존 값 유지
            folder_id=target_folder_id,
            type=None,
            is_delete=False,
            brain_id=brain_id
        )
        
        if not updated:
            raise HTTPException(status_code=400, detail="폴더 변경 실패")
            
        updated_memo = sqlite_handler.get_memo(memo_id)
        return updated_memo
    except Exception as e:
        logging.error("메모 폴더 변경 오류: %s", str(e))
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.put("/MoveOutFolder/{memo_id}", response_model=MemoResponse,
           summary="메모를 폴더에서 제거",
           description="메모를 모든 폴더에서 제거하여 독립적인 메모로 만듭니다.")
async def move_memo_out_of_folder(memo_id: int):
    """
    메모를 폴더에서 제거합니다:
    
    - **memo_id**: 폴더에서 제거할 메모의 ID
    """
    # 메모 존재 여부 확인
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    
    try:
         # 기존 메모의 folder_id와 brain_id를 가져옴
       
        brain_id = memo.get("brain_id")
        # 메모의 folder_id를 null로 설정
        updated = sqlite_handler.update_memo(
            memo_id,
            memo_title=None,  # 기존 값 유지
            memo_text=None,   # 기존 값 유지
            is_source=None,   # 기존 값 유지
            folder_id=None,    # folder_id를 null로 설정
            type=None,
            is_delete=False,
            brain_id=brain_id
        )
        
        if not updated:
            raise HTTPException(status_code=400, detail="메모 폴더 제거 실패")
            
        updated_memo = sqlite_handler.get_memo(memo_id)
        return updated_memo
    except Exception as e:
        logging.error("메모 폴더 제거 오류: %s", str(e))
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.get("/brain/{brain_id}/trashBinList", response_model=List[MemoResponse],
           summary="휴지통 메모 조회",
           description="특정 Brain의 휴지통에 있는 모든 메모 정보를 반환합니다.")
async def get_trash_bin_memos(brain_id: int):
    """
    특정 Brain의 휴지통에 있는 모든 메모 정보를 반환합니다:
    
    - **brain_id**: 조회할 Brain의 ID
    """
    try:
        # Brain 존재 여부 확인
        brain = sqlite_handler.get_brain(brain_id)
        if not brain:
            raise HTTPException(status_code=404, detail="Brain을 찾을 수 없습니다")

        # 휴지통 메모 조회
        memos = sqlite_handler.get_trash_bin_memos(brain_id)
        return memos
    except Exception as e:
        logging.error("휴지통 메모 조회 오류: %s", str(e))
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.get(
    "/brain/{brain_id}",
    response_model=List[MemoResponse],
    summary="Brain 기준 메모 목록 조회 (루트 vs 모든 폴더)"
)
async def get_memos_by_brain(
    brain_id: int,
    folder_id: Optional[int] = Query(
        None,
        description="없으면 루트 only, 있으면 모든 폴더 내 메모"
    )
):
    try:
        return sqlite_handler.get_memos_by_brain_and_folder(brain_id, folder_id)
    except Exception as e:
        logging.error("메모 조회 오류: %s", e)
        raise HTTPException(status_code=500, detail="서버 오류")

@router.put("/{memo_id}/revert", response_model=MemoResponse,
           summary="메모 휴지통에서 되돌리기",
           description="휴지통에 있는 메모를 원래 상태로 되돌립니다. is_delete가 false로 설정됩니다.")
async def revert_memo(memo_id: int):
    """
    휴지통에 있는 메모를 원래 상태로 되돌립니다:
    
    - **memo_id**: 되돌릴 메모의 ID
    """
    # 메모 존재 여부 확인
    memo = sqlite_handler.get_memo(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    
    try:
        # 기존 메모의 folder_id와 brain_id를 가져옴
        folder_id = memo.get("folder_id")
        brain_id = memo.get("brain_id")
        
        updated = sqlite_handler.update_memo(
            memo_id=memo_id,
            memo_title=None,
            memo_text=None,
            is_source=None,
            folder_id=folder_id,
            type=None,
            is_delete=False,
            brain_id=brain_id,
            deleted_at=None
        )
        
        if not updated:
            raise HTTPException(status_code=400, detail="메모 되돌리기 실패")
            
        updated_memo = sqlite_handler.get_memo(memo_id)
        return updated_memo
    except Exception as e:
        logging.error("메모 되돌리기 오류: %s", str(e))
        raise HTTPException(status_code=500, detail="내부 서버 오류") 
    
@router.delete("/auto/cleanTrash", status_code=200)
async def auto_clean_trash():
    try:
        threshold = datetime.now() - timedelta(days=30)
        deleted_memos = sqlite_handler.get_all_deleted_memos()

        count = 0
        for memo in deleted_memos:
            if memo.get("deleted_at") and datetime.fromisoformat(memo["deleted_at"]) < threshold:
                sqlite_handler.delete_memo(memo["memo_id"])
                count += 1
        return {"deleted_count": count}
    except Exception as e:
        logging.error("휴지통 자동 정리 실패: %s", str(e))
        raise HTTPException(status_code=500, detail="자동 정리 오류")