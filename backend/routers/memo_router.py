"""
memo_router.py

메모 관련 API 엔드포인트를 관리하는 라우터 모듈입니다.

주요 기능:
- 메모 생성, 조회, 수정, 삭제 (CRUD 작업)
- 메모 소스 변환 및 관리
- 브레인별 메모 관리
- 소프트 삭제 및 복구 기능
- 휴지통 관리

지원하는 엔드포인트:
- POST /memos/ : 메모 생성
- GET /memos/{memo_id} : 특정 메모 조회
- PUT /memos/{memo_id} : 메모 수정
- DELETE /memos/{memo_id} : 메모 소프트 삭제
- DELETE /memos/{memo_id}/hard : 메모 완전 삭제
- PUT /memos/{memo_id}/restore : 삭제된 메모 복구
- PUT /memos/{memo_id}/isSource : 메모를 소스로 설정
- PUT /memos/{memo_id}/isNotSource : 메모를 비소스로 설정 (완전 삭제)
- GET /memos/brain/{brain_id} : 브레인별 메모 목록 조회
- GET /memos/source/brain/{brain_id} : 브레인별 소스 메모만 조회
- POST /memos/{memo_id}/convertToSource : 메모를 소스로 변환
- DELETE /memos/trash/{brain_id} : 휴지통 비우기

메모 관리 기능:
- 소프트 삭제: is_deleted 플래그로 삭제 상태 관리
- 소스 변환: 일반 메모를 소스 메모로 변환
- 휴지통: 삭제된 메모들을 임시 보관
- 복구 기능: 삭제된 메모를 다시 복구

데이터베이스:
- SQLite: 메모 정보 저장 (memo_id, memo_title, memo_text, memo_date, is_source, type, brain_id, is_deleted)

의존성:
- FastAPI: 웹 프레임워크
- Pydantic: 데이터 검증 및 직렬화
- SQLiteHandler: SQLite 데이터베이스 작업
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db import SQLiteHandler
import logging
import re

# ───────── 데이터베이스 핸들러 초기화 ───────── #
sqlite_handler = SQLiteHandler()

# ───────── FastAPI 라우터 설정 ───────── #
router = APIRouter(
    prefix="/memos",
    tags=["memos"],
    responses={404: {"description": "Not found"}}
)

# ───────── Pydantic 모델 정의 ───────── #

class MemoCreate(BaseModel):
    """
    메모 생성 요청 모델
    
    새로운 메모를 생성할 때 사용되는 데이터 모델입니다.
    
    Attributes:
        memo_title (Optional[str]): 메모 제목 (최대 100자)
        memo_text (str): 메모 내용 (필수)
        is_source (Optional[bool]): 소스 여부 (기본값: False)
        type (Optional[str]): 메모 타입
        brain_id (Optional[int]): 연결할 브레인 ID
    """
    memo_title: Optional[str] = Field(None, max_length=100)
    memo_text: str
    is_source: Optional[bool] = False
    type: Optional[str] = None
    brain_id: Optional[int] = None

class MemoUpdate(BaseModel):
    """
    메모 수정 요청 모델
    
    기존 메모를 수정할 때 사용되는 데이터 모델입니다.
    Optional 필드들로 구성되어 있어 필요한 필드만 수정 가능합니다.
    
    Attributes:
        memo_title (Optional[str]): 새로운 메모 제목 (1-100자)
        memo_text (Optional[str]): 새로운 메모 내용
        is_source (Optional[bool]): 소스 여부
        type (Optional[str]): 메모 타입
        brain_id (Optional[int]): 새로운 브레인 ID
    """
    memo_title: Optional[str] = Field(None, min_length=1, max_length=100)
    memo_text: Optional[str] = None
    is_source: Optional[bool] = None
    type: Optional[str] = None
    brain_id: Optional[int] = None

class MemoResponse(BaseModel):
    """
    메모 응답 모델
    
    API 응답으로 사용되는 메모 정보 모델입니다.
    
    Attributes:
        memo_id (int): 메모 고유 ID
        memo_title (str): 메모 제목
        memo_text (str): 메모 내용
        memo_date (str): 생성 날짜
        is_source (bool): 소스 여부
        type (Optional[str]): 메모 타입
        brain_id (Optional[int]): 연결된 브레인 ID
        is_deleted (Optional[bool]): 삭제 여부 (기본값: False)
    """
    memo_id: int
    memo_title: str
    memo_text: str
    memo_date: str
    is_source: bool
    type: Optional[str]
    brain_id: Optional[int]
    is_deleted: Optional[bool] = False

# ───────── API 엔드포인트 ───────── #

@router.post("/", response_model=MemoResponse, status_code=status.HTTP_201_CREATED)
async def create_memo(memo_data: MemoCreate):
    """
    새로운 메모를 생성합니다.
    
    처리 과정:
    1. brain_id가 제공된 경우 해당 브레인 존재 여부 확인
    2. 메모 정보를 데이터베이스에 저장
    3. 생성된 메모 정보 반환
    
    Args:
        memo_data (MemoCreate): 메모 생성 정보
            - memo_title: 메모 제목 (선택)
            - memo_text: 메모 내용 (필수)
            - is_source: 소스 여부 (선택, 기본값: False)
            - type: 메모 타입 (선택)
            - brain_id: 연결할 브레인 ID (선택)
        
    Returns:
        MemoResponse: 생성된 메모 정보
        
    Raises:
        HTTPException: 
            - 404: 브레인을 찾을 수 없음
            - 500: 서버 내부 오류
    """
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

@router.get("/{memo_id}", response_model=MemoResponse)
async def get_memo(memo_id: int):
    """
    특정 메모 정보를 조회합니다.
    
    처리 과정:
    1. memo_id로 메모 정보 조회 (삭제된 메모 포함)
    2. 메모가 존재하면 정보 반환, 없으면 404 오류
    
    Args:
        memo_id (int): 조회할 메모 ID
        
    Returns:
        MemoResponse: 메모 정보 (삭제된 메모도 포함)
        
    Raises:
        HTTPException: 404 - 메모를 찾을 수 없음
    """
    memo = sqlite_handler.get_memo_with_deleted(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return memo

@router.put("/{memo_id}", response_model=MemoResponse)
async def update_memo(memo_id: int, memo_data: MemoUpdate):
    """
    메모 정보를 수정합니다.
    
    처리 과정:
    1. memo_id로 기존 메모 존재 여부 확인
    2. brain_id가 제공된 경우 해당 브레인 존재 여부 확인
    3. 메모 제목 유효성 검사 (길이, 특수문자, 공백 등)
    4. 요청된 필드만 업데이트
    5. 수정된 메모 정보 반환
    
    Args:
        memo_id (int): 수정할 메모 ID
        memo_data (MemoUpdate): 수정할 데이터
        
    Returns:
        MemoResponse: 수정된 메모 정보
        
    Raises:
        HTTPException: 
            - 404: 메모 또는 브레인을 찾을 수 없음
            - 400: 메모 제목 유효성 검사 실패
            - 500: 서버 내부 오류
    """
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

@router.delete("/{memo_id}", status_code=204)
async def delete_memo(memo_id: int):
    """
    메모를 소프트 삭제합니다.
    
    처리 과정:
    1. memo_id로 메모 존재 여부 확인
    2. is_deleted 플래그를 True로 설정하여 소프트 삭제
    3. 메모는 데이터베이스에서 완전히 삭제되지 않고 보관됨
    
    Args:
        memo_id (int): 삭제할 메모 ID
        
    Returns:
        Response: 204 No Content
        
    Raises:
        HTTPException: 
            - 404: 삭제할 메모를 찾을 수 없음
            - 400: 메모 삭제 실패
            - 500: 서버 내부 오류
    """
    if not sqlite_handler.get_memo(memo_id):
        raise HTTPException(status_code=404, detail="삭제할 메모를 찾을 수 없습니다")
    try:
        if not sqlite_handler.delete_memo(memo_id):
            raise HTTPException(status_code=400, detail="메모 삭제 실패")
    except Exception as e:
        logging.error(f"메모 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

@router.delete("/{memo_id}/hard", status_code=204)
async def hard_delete_memo(memo_id: int):
    """
    메모를 완전 삭제합니다.
    
    처리 과정:
    1. memo_id로 메모 존재 여부 확인 (삭제된 메모 포함)
    2. 데이터베이스에서 메모를 완전히 삭제
    3. 이 작업은 되돌릴 수 없음
    
    주의사항:
    - 이 작업은 되돌릴 수 없습니다
    - 메모가 데이터베이스에서 완전히 제거됩니다
    
    Args:
        memo_id (int): 완전 삭제할 메모 ID
        
    Returns:
        Response: 204 No Content
        
    Raises:
        HTTPException: 
            - 404: 삭제할 메모를 찾을 수 없음
            - 400: 메모 완전 삭제 실패
            - 500: 서버 내부 오류
    """
    if not sqlite_handler.get_memo_with_deleted(memo_id):
        raise HTTPException(status_code=404, detail="삭제할 메모를 찾을 수 없습니다")
    try:
        if not sqlite_handler.hard_delete_memo(memo_id):
            raise HTTPException(status_code=400, detail="메모 완전 삭제 실패")
    except Exception as e:
        logging.error(f"메모 완전 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

@router.put("/{memo_id}/restore", response_model=MemoResponse)
async def restore_memo(memo_id: int):
    """
    삭제된 메모를 복구합니다.
    
    처리 과정:
    1. memo_id로 메모 존재 여부 확인 (삭제된 메모 포함)
    2. is_deleted 플래그를 False로 설정하여 복구
    3. 복구된 메모 정보 반환
    
    Args:
        memo_id (int): 복구할 메모 ID
        
    Returns:
        MemoResponse: 복구된 메모 정보
        
    Raises:
        HTTPException: 
            - 404: 복구할 메모를 찾을 수 없음
            - 400: 메모 복구 실패
            - 500: 서버 내부 오류
    """
    if not sqlite_handler.get_memo_with_deleted(memo_id):
        raise HTTPException(status_code=404, detail="복구할 메모를 찾을 수 없습니다")
    try:
        if not sqlite_handler.restore_memo(memo_id):
            raise HTTPException(status_code=400, detail="메모 복구 실패")
        return sqlite_handler.get_memo(memo_id)
    except Exception as e:
        logging.error(f"메모 복구 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

@router.put("/{memo_id}/isSource", response_model=MemoResponse)
async def set_memo_as_source(memo_id: int):
    """
    메모를 소스로 설정합니다.
    
    처리 과정:
    1. memo_id로 메모 존재 여부 확인 (삭제된 메모 포함)
    2. is_source 플래그를 True로 설정
    3. 수정된 메모 정보 반환
    
    Args:
        memo_id (int): 소스로 설정할 메모 ID
        
    Returns:
        MemoResponse: 소스로 설정된 메모 정보
        
    Raises:
        HTTPException: 
            - 404: 메모를 찾을 수 없음
            - 400: 메모 업데이트 실패
            - 500: 서버 내부 오류
    """
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

@router.put("/{memo_id}/isNotSource", status_code=204)
async def set_memo_as_not_source(memo_id: int):
    """
    메모를 비소스로 설정하고 완전 삭제합니다.
    
    처리 과정:
    1. memo_id로 메모 존재 여부 확인 (삭제된 메모 포함)
    2. 메모를 완전히 삭제 (소프트 삭제가 아닌 완전 삭제)
    
    주의사항:
    - 이 작업은 되돌릴 수 없습니다
    - 메모가 데이터베이스에서 완전히 제거됩니다
    
    Args:
        memo_id (int): 비소스로 설정하고 삭제할 메모 ID
        
    Returns:
        Response: 204 No Content
        
    Raises:
        HTTPException: 
            - 404: 메모를 찾을 수 없음
            - 400: 메모 삭제 실패
            - 500: 서버 내부 오류
    """
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

@router.get("/brain/{brain_id}", response_model=List[MemoResponse])
async def get_memos_by_brain(brain_id: int, include_deleted: bool = False):
    """
    브레인 내 모든 메모를 조회합니다.
    
    처리 과정:
    1. brain_id로 해당 브레인에 연결된 모든 메모 조회
    2. include_deleted 파라미터에 따라 삭제된 메모 포함 여부 결정
    3. 브레인별로 그룹화된 메모 목록 반환
    
    Args:
        brain_id (int): 조회할 브레인 ID
        include_deleted (bool): 삭제된 메모 포함 여부 (기본값: False)
        
    Returns:
        List[MemoResponse]: 해당 브레인의 메모 목록
        
    Raises:
        HTTPException: 500 - 서버 내부 오류
    """
    try:
        return sqlite_handler.get_memos_by_brain(brain_id, include_deleted=include_deleted)
    except Exception as e:
        logging.error(f"메모 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

@router.get("/source/brain/{brain_id}", response_model=List[MemoResponse])
async def get_source_memos_by_brain(brain_id: int):
    """
    브레인 내 소스 메모만 조회합니다.
    
    처리 과정:
    1. brain_id로 해당 브레인에 연결된 소스 메모만 조회
    2. is_source=True인 메모들만 필터링
    3. 삭제된 메모도 포함하여 조회
    
    Args:
        brain_id (int): 조회할 브레인 ID
        
    Returns:
        List[MemoResponse]: 해당 브레인의 소스 메모 목록
        
    Raises:
        HTTPException: 500 - 서버 내부 오류
    """
    try:
        return sqlite_handler.get_memos_by_brain(brain_id, is_source=True, include_deleted=True)
    except Exception as e:
        logging.error(f"소스 메모 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")

@router.post("/{memo_id}/convertToSource", response_model=MemoResponse, status_code=status.HTTP_201_CREATED)
async def convert_memo_to_source(memo_id: int):
    """
    메모를 소스로 변환합니다.
    
    처리 과정:
    1. memo_id로 원본 메모 조회 (삭제된 메모 포함)
    2. 원본 메모의 정보를 기반으로 새로운 소스 메모 생성
    3. 새로운 소스 메모 정보 반환
    
    Args:
        memo_id (int): 소스로 변환할 메모 ID
        
    Returns:
        MemoResponse: 새로 생성된 소스 메모 정보
        
    Raises:
        HTTPException: 
            - 404: 메모를 찾을 수 없음
            - 500: 서버 내부 오류
    """
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

@router.delete("/trash/{brain_id}", status_code=204)
async def empty_trash(brain_id: int):
    """
    휴지통을 비웁니다 (삭제된 메모 모두 완전 삭제).
    
    처리 과정:
    1. brain_id로 해당 브레인의 삭제된 메모들을 모두 조회
    2. 삭제된 메모들을 완전히 삭제
    3. 삭제된 메모 수 반환
    
    주의사항:
    - 이 작업은 되돌릴 수 없습니다
    - 삭제된 메모들이 데이터베이스에서 완전히 제거됩니다
    
    Args:
        brain_id (int): 휴지통을 비울 브레인 ID
        
    Returns:
        dict: 삭제 결과
            - deleted_count: 삭제된 메모 수
        
    Raises:
        HTTPException: 500 - 서버 내부 오류
    """
    try:
        # 브레인 내 삭제된 메모들을 모두 완전 삭제
        deleted_count = sqlite_handler.empty_trash(brain_id)
        logging.info(f"휴지통 비우기 완료: brain_id={brain_id}, 삭제된 메모 수={deleted_count}")
        return {"deleted_count": deleted_count}
    except Exception as e:
        logging.error(f"휴지통 비우기 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 오류")
