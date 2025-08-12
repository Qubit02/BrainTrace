"""
md_router.py

Markdown 파일 관련 API 엔드포인트를 관리하는 라우터 모듈입니다.

주요 기능:
- Markdown 파일 업로드 및 관리 (CRUD 작업)
- Markdown 파일 텍스트 추출 및 저장
- 브레인별 Markdown 파일 관리
- 파일 시스템과 데이터베이스 동기화
- Markdown 파일 검색 및 통계

지원하는 엔드포인트:
- POST /md/ : Markdown 파일 정보 생성
- GET /md/{md_id} : 특정 Markdown 파일 조회
- PUT /md/{md_id} : Markdown 파일 정보 수정
- DELETE /md/{md_id} : Markdown 파일 삭제 (DB + 로컬 파일)
- GET /md/brain/{brain_id} : 브레인별 Markdown 파일 목록 조회
- POST /md/upload-md : Markdown 파일 업로드 및 텍스트 추출
- GET /md/content/{md_id} : Markdown 파일 내용 조회
- GET /md/download/{md_id} : Markdown 파일 다운로드
- GET /md/search/{brain_id} : 브레인 내 Markdown 파일 검색
- GET /md/stats/{brain_id} : 브레인의 Markdown 파일 통계

파일 처리:
- 업로드된 파일은 uploaded_mds 디렉토리에 저장
- 파일명은 UUID로 고유화하여 중복 방지
- Markdown 파일에서 텍스트 자동 추출
- 파일 시스템과 데이터베이스 동기화

데이터베이스:
- SQLite: Markdown 파일 정보 저장 (md_id, md_title, md_path, md_date, type, brain_id, md_text)

의존성:
- FastAPI: 웹 프레임워크
- Pydantic: 데이터 검증 및 직렬화
- SQLiteHandler: SQLite 데이터베이스 작업
"""

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db import SQLiteHandler
import logging, uuid, os, re

# ───────── 데이터베이스 핸들러 초기화 ───────── #
sqlite_handler = SQLiteHandler()

# ───────── FastAPI 라우터 설정 ───────── #
router = APIRouter(
    prefix="/md",
    tags=["MD Files"],
    responses={404: {"description": "Not found"}}
)

# ───────── Pydantic 모델 정의 ───────── #

class MDFileCreate(BaseModel):
    """
    Markdown 파일 생성 요청 모델
    
    새로운 Markdown 파일 정보를 생성할 때 사용되는 데이터 모델입니다.
    
    Attributes:
        md_title (str): Markdown 파일 제목 (1-100자)
        md_path (str): Markdown 파일 경로
        type (Optional[str]): 파일 확장자명
        brain_id (Optional[int]): 연결할 Brain ID
        md_text (Optional[str]): 추출된 텍스트
    """
    md_title: str = Field(..., description="MD 파일 제목", min_length=1, max_length=100)
    md_path: str = Field(..., description="MD 파일 경로")
    type: Optional[str] = Field(None, description="파일 확장자명")
    brain_id: Optional[int] = Field(None, description="연결할 Brain ID")
    md_text: Optional[str] = Field(None, description="추출된 텍스트")

class MDFileUpdate(BaseModel):
    """
    Markdown 파일 수정 요청 모델
    
    기존 Markdown 파일 정보를 수정할 때 사용되는 데이터 모델입니다.
    Optional 필드들로 구성되어 있어 필요한 필드만 수정 가능합니다.
    
    Attributes:
        md_title (Optional[str]): 새로운 Markdown 파일 제목
        md_path (Optional[str]): 새로운 Markdown 파일 경로
        type (Optional[str]): 파일 확장자명
        brain_id (Optional[int]): 새로운 Brain ID
        md_text (Optional[str]): 새로운 텍스트
    """
    md_title: Optional[str] = Field(None, description="새 MD 파일 제목")
    md_path: Optional[str] = Field(None, description="새 MD 파일 경로")
    type: Optional[str] = Field(None, description="파일 확장자명")
    brain_id: Optional[int] = Field(None, description="새로운 Brain ID")
    md_text: Optional[str] = Field(None, description="새 텍스트")

class MDFileResponse(BaseModel):
    """
    Markdown 파일 응답 모델
    
    API 응답으로 사용되는 Markdown 파일 정보 모델입니다.
    
    Attributes:
        md_id (int): Markdown 파일 고유 ID
        md_title (str): Markdown 파일 제목
        md_path (str): Markdown 파일 경로
        md_date (str): 생성 날짜
        type (Optional[str]): 파일 확장자명
        brain_id (Optional[int]): 연결된 Brain ID
        md_text (Optional[str]): 추출된 텍스트
    """
    md_id: int
    md_title: str
    md_path: str
    md_date: str
    type: Optional[str]
    brain_id: Optional[int]
    md_text: Optional[str]

# ───────── API 엔드포인트 ───────── #

@router.post("/", response_model=MDFileResponse, status_code=status.HTTP_201_CREATED)
async def create_mdfile(mdfile_data: MDFileCreate):
    """
    새로운 Markdown 파일 정보를 생성합니다.
    
    처리 과정:
    1. brain_id가 제공된 경우 해당 브레인 존재 여부 확인
    2. Markdown 파일 정보를 데이터베이스에 저장
    3. 생성된 Markdown 파일 정보 반환
    
    Args:
        mdfile_data (MDFileCreate): Markdown 파일 생성 정보
            - md_title: 파일 제목 (필수)
            - md_path: 파일 경로 (필수)
            - type: 파일 확장자명 (선택)
            - brain_id: 연결할 브레인 ID (선택)
            - md_text: 추출된 텍스트 (선택)
        
    Returns:
        MDFileResponse: 생성된 Markdown 파일 정보
        
    Raises:
        HTTPException: 
            - 404: 브레인을 찾을 수 없음
            - 500: 서버 내부 오류
    """
    if mdfile_data.brain_id is not None:
        if not sqlite_handler.get_brain(mdfile_data.brain_id):
            raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")

    try:
        return sqlite_handler.create_mdfile(
            md_title=mdfile_data.md_title,
            md_path=mdfile_data.md_path,
            type=mdfile_data.type,
            brain_id=mdfile_data.brain_id,
            md_text=mdfile_data.md_text
        )
    except Exception as e:
        logging.error("MD 파일 생성 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.get("/{md_id}", response_model=MDFileResponse)
async def get_mdfile(md_id: int):
    """
    특정 Markdown 파일 정보를 조회합니다.
    
    처리 과정:
    1. md_id로 Markdown 파일 정보 조회
    2. 파일이 존재하면 정보 반환, 없으면 404 오류
    
    Args:
        md_id (int): 조회할 Markdown 파일 ID
        
    Returns:
        MDFileResponse: Markdown 파일 정보
        
    Raises:
        HTTPException: 404 - Markdown 파일을 찾을 수 없음
    """
    mdfile = sqlite_handler.get_mdfile(md_id)
    if not mdfile:
        raise HTTPException(status_code=404, detail="MD 파일을 찾을 수 없습니다")
    return mdfile

@router.put("/{md_id}", response_model=MDFileResponse)
async def update_mdfile(md_id: int, mdfile_data: MDFileUpdate):
    """
    Markdown 파일 정보를 수정합니다.
    
    처리 과정:
    1. md_id로 기존 Markdown 파일 존재 여부 확인
    2. brain_id가 제공된 경우 해당 브레인 존재 여부 확인
    3. 파일명 유효성 검사 (길이, 특수문자, 공백 등)
    4. 요청된 필드만 업데이트
    5. 수정된 Markdown 파일 정보 반환
    
    Args:
        md_id (int): 수정할 Markdown 파일 ID
        mdfile_data (MDFileUpdate): 수정할 데이터
        
    Returns:
        MDFileResponse: 수정된 Markdown 파일 정보
        
    Raises:
        HTTPException: 
            - 404: Markdown 파일 또는 브레인을 찾을 수 없음
            - 400: 파일명 유효성 검사 실패
            - 500: 서버 내부 오류
    """
    if not sqlite_handler.get_mdfile(md_id):
        raise HTTPException(status_code=404, detail="MD 파일을 찾을 수 없습니다")

    if mdfile_data.brain_id is not None:
        if not sqlite_handler.get_brain(mdfile_data.brain_id):
            raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")

    # 파일명 제한 검증
    if mdfile_data.md_title is not None:
        name = mdfile_data.md_title
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
        updated = sqlite_handler.update_mdfile(
            md_id=md_id,
            md_title=mdfile_data.md_title,
            md_path=mdfile_data.md_path,
            type=mdfile_data.type,
            brain_id=mdfile_data.brain_id,
            md_text=mdfile_data.md_text
        )
        if not updated:
            raise HTTPException(status_code=400, detail="업데이트할 정보가 없습니다")
        return sqlite_handler.get_mdfile(md_id)
    except Exception as e:
        logging.error("MD 파일 수정 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.delete("/{md_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mdfile(md_id: int):
    """
    Markdown 파일을 삭제합니다 (DB + 로컬 파일 시스템).
    
    처리 과정:
    1. md_id로 Markdown 파일 존재 여부 확인
    2. 데이터베이스에서 Markdown 파일 정보 삭제
    3. 로컬 파일 시스템에서 실제 파일 삭제
    4. 삭제 결과 로깅
    
    주의사항:
    - 이 작업은 되돌릴 수 없습니다
    - 데이터베이스와 파일 시스템 모두에서 삭제됩니다
    
    Args:
        md_id (int): 삭제할 Markdown 파일 ID
        
    Returns:
        Response: 204 No Content
        
    Raises:
        HTTPException: 404 - Markdown 파일을 찾을 수 없음
    """
    md = sqlite_handler.get_mdfile(md_id)
    if not md:
        raise HTTPException(status_code=404, detail="MD 파일을 찾을 수 없습니다")

    sqlite_handler.delete_mdfile(md_id)

    file_path = md["md_path"]
    import os, logging
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logging.info(f"✅ 로컬 파일 삭제 완료: {file_path}")
        else:
            logging.warning(f"⚠️ 파일이 존재하지 않음: {file_path}")
    except Exception as e:
        logging.error(f"❌ 로컬 파일 삭제 실패: {e}")
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/brain/{brain_id}", response_model=List[MDFileResponse])
async def get_mdfiles_by_brain(brain_id: int):
    """
    특정 브레인에 속한 모든 Markdown 파일 목록을 조회합니다.
    
    처리 과정:
    1. brain_id로 해당 브레인에 연결된 모든 Markdown 파일 조회
    2. 브레인별로 그룹화된 Markdown 파일 목록 반환
    
    Args:
        brain_id (int): 조회할 브레인 ID
        
    Returns:
        List[MDFileResponse]: 해당 브레인의 Markdown 파일 목록
        
    Raises:
        HTTPException: 500 - 서버 내부 오류
    """
    try:
        return sqlite_handler.get_mds_by_brain(brain_id)
    except Exception as e:
        logging.error("MD 파일 조회 오류: %s", e)
        raise HTTPException(status_code=500, detail="서버 오류")

# ───────── 파일 업로드 관련 ───────── #

UPLOAD_MD_DIR = "uploaded_mds"
os.makedirs(UPLOAD_MD_DIR, exist_ok=True)

def sanitize_filename(name):
    """
    파일명을 안전하게 정리합니다.
    
    특수문자를 언더스코어로 변경하여 파일 시스템 호환성을 보장합니다.
    
    Args:
        name (str): 원본 파일명
        
    Returns:
        str: 정리된 파일명
    """
    return re.sub(r'[^\w\-_\. ]', '_', name)

@router.post("/upload-md", response_model=List[MDFileResponse])
async def upload_mdfiles(
    files: List[UploadFile] = File(...),
    brain_id: Optional[int] = Form(None)
):
    """
    Markdown 파일을 업로드하고 텍스트를 추출합니다.
    
    처리 과정:
    1. brain_id가 제공된 경우 해당 브레인 존재 여부 확인
    2. 각 파일에 대해:
       - 파일 확장자 검증 (.md만 허용)
       - 안전한 파일명 생성 (UUID + 원본명)
       - 파일을 로컬 디렉토리에 저장
       - UTF-8 인코딩으로 텍스트 읽기
       - 데이터베이스에 파일 정보 저장
    3. 업로드된 모든 파일 정보 반환
    
    Args:
        files (List[UploadFile]): 업로드할 Markdown 파일 목록
        brain_id (Optional[int]): 연결할 브레인 ID (선택)
        
    Returns:
        List[MDFileResponse]: 업로드된 Markdown 파일 정보 목록
        
    Raises:
        HTTPException: 404 - 브레인이 존재하지 않음
    """
    uploaded_mdfiles = []
    if brain_id is not None and not sqlite_handler.get_brain(brain_id):
        raise HTTPException(status_code=404, detail="해당 Brain이 존재하지 않습니다.")

    for file in files:
        try:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext != ".md":
                logging.warning(f"업로드 무시: {file.filename} (md만 지원)")
                continue

            safe_name = sanitize_filename(file.filename)
            unique_name = f"{uuid.uuid4().hex}_{safe_name}"
            file_path = os.path.join(UPLOAD_MD_DIR, unique_name)

            with open(file_path, "wb") as f:
                f.write(await file.read())

            # MD 텍스트 읽기
            text = ""
            try:
                with open(file_path, 'r', encoding='utf-8') as md_file:
                    text = md_file.read()
            except Exception as e:
                logging.warning(f"MD 텍스트 읽기 실패 ({file.filename}): {e}")
                text = ""

            created = sqlite_handler.create_mdfile(
                md_title=safe_name,
                md_path=file_path,
                type="md",
                brain_id=brain_id,
                md_text=text
            )
            uploaded_mdfiles.append(created)
        except Exception as e:
            logging.error("MD 파일 업로드 실패 (%s): %s", file.filename, e)

    return uploaded_mdfiles

@router.get("/content/{md_id}")
async def get_md_content(md_id: int):
    """
    Markdown 파일의 내용을 반환합니다.
    
    처리 과정:
    1. md_id로 Markdown 파일 정보 조회
    2. 파일의 텍스트 내용 반환
    
    Args:
        md_id (int): 조회할 Markdown 파일 ID
        
    Returns:
        dict: Markdown 파일 내용
            - content: 파일의 텍스트 내용
        
    Raises:
        HTTPException: 
            - 404: Markdown 파일을 찾을 수 없음
            - 500: 서버 내부 오류
    """
    try:
        content = sqlite_handler.get_md_content(md_id)
        if content is None:
            raise HTTPException(status_code=404, detail="MD 파일을 찾을 수 없습니다.")
        
        return {"content": content}
    except Exception as e:
        logging.error("MD 파일 내용 조회 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.get("/download/{md_id}")
async def download_md_file(md_id: int):
    """
    Markdown 파일을 다운로드합니다.
    
    처리 과정:
    1. md_id로 Markdown 파일 정보 조회
    2. 파일 경로 존재 여부 확인
    3. FileResponse로 파일 다운로드 제공
    
    Args:
        md_id (int): 다운로드할 Markdown 파일 ID
        
    Returns:
        FileResponse: 다운로드할 파일
        
    Raises:
        HTTPException: 
            - 404: Markdown 파일을 찾을 수 없음 또는 파일이 존재하지 않음
            - 500: 서버 내부 오류
    """
    try:
        md_file = sqlite_handler.get_mdfile(md_id)
        if not md_file:
            raise HTTPException(status_code=404, detail="MD 파일을 찾을 수 없습니다.")
        
        file_path = md_file['md_path']
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="파일이 존재하지 않습니다.")
        
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type="text/markdown"
        )
    except Exception as e:
        logging.error("MD 파일 다운로드 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.get("/search/{brain_id}")
async def search_md_files(brain_id: int, q: str):
    """
    브레인 내에서 Markdown 파일을 검색합니다.
    
    처리 과정:
    1. brain_id와 검색어로 Markdown 파일 검색
    2. 검색 결과 반환
    
    Args:
        brain_id (int): 검색할 브레인 ID
        q (str): 검색어
        
    Returns:
        dict: 검색 결과
            - results: 검색된 Markdown 파일 목록
        
    Raises:
        HTTPException: 500 - 서버 내부 오류
    """
    try:
        results = sqlite_handler.search_mds(brain_id, q)
        return {"results": results}
    except Exception as e:
        logging.error("MD 파일 검색 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.get("/stats/{brain_id}")
async def get_md_stats(brain_id: int):
    """
    브레인의 Markdown 파일 통계 정보를 반환합니다.
    
    처리 과정:
    1. brain_id로 해당 브레인의 Markdown 파일 통계 조회
    2. 통계 정보 반환 (파일 수, 총 크기 등)
    
    Args:
        brain_id (int): 통계를 조회할 브레인 ID
        
    Returns:
        dict: Markdown 파일 통계 정보
        
    Raises:
        HTTPException: 500 - 서버 내부 오류
    """
    try:
        stats = sqlite_handler.get_md_stats(brain_id)
        return stats
    except Exception as e:
        logging.error("MD 파일 통계 조회 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류") 