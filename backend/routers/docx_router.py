"""
docx_router.py

DOCX 파일 관련 API 엔드포인트를 관리하는 라우터 모듈입니다.

주요 기능:
- DOCX 파일 업로드 및 관리 (CRUD 작업)
- DOCX 파일 텍스트 추출 및 저장
- 브레인별 DOCX 파일 관리
- 파일 시스템과 데이터베이스 동기화

지원하는 엔드포인트:
- POST /docxfiles/ : DOCX 파일 정보 생성
- GET /docxfiles/{docx_id} : 특정 DOCX 파일 조회
- PUT /docxfiles/{docx_id} : DOCX 파일 정보 수정
- DELETE /docxfiles/{docx_id} : DOCX 파일 삭제 (DB + 로컬 파일)
- GET /docxfiles/brain/{brain_id} : 브레인별 DOCX 파일 목록 조회
- POST /docxfiles/upload-docx : DOCX 파일 업로드 및 텍스트 추출

파일 처리:
- 업로드된 파일은 uploaded_docx 디렉토리에 저장
- 파일명은 UUID로 고유화하여 중복 방지
- DOCX 파일에서 텍스트 자동 추출
- 파일 시스템과 데이터베이스 동기화

데이터베이스:
- SQLite: DOCX 파일 정보 저장 (docx_id, docx_title, docx_path, docx_date, type, brain_id, docx_text)

의존성:
- FastAPI: 웹 프레임워크
- Pydantic: 데이터 검증 및 직렬화
- python-docx: DOCX 파일 텍스트 추출
- SQLiteHandler: SQLite 데이터베이스 작업
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db import SQLiteHandler
import logging, uuid, os, re
from docx import Document

# ───────── 데이터베이스 핸들러 초기화 ───────── #
sqlite_handler = SQLiteHandler()

# ───────── FastAPI 라우터 설정 ───────── #
router = APIRouter(
    prefix="/docxfiles",
    tags=["docxfiles"],
    responses={404: {"description": "Not found"}}
)

# ───────── 파일 업로드 설정 ───────── #
UPLOAD_DOCX_DIR = os.path.join("C:\\brainT\\backend\\uploaded_files", "uploaded_docx")
os.makedirs(UPLOAD_DOCX_DIR, exist_ok=True)

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

# ───────── Pydantic 모델 정의 ───────── #

class DocxFileCreate(BaseModel):
    """
    DOCX 파일 생성 요청 모델
    
    새로운 DOCX 파일 정보를 생성할 때 사용되는 데이터 모델입니다.
    
    Attributes:
        docx_title (str): DOCX 파일 제목 (1-100자)
        docx_path (str): DOCX 파일 경로
        type (Optional[str]): 파일 확장자명
        brain_id (Optional[int]): 연결할 Brain ID
        docx_text (Optional[str]): 추출된 텍스트
    """
    docx_title: str = Field(..., description="DOCX 파일 제목", min_length=1, max_length=100)
    docx_path:  str = Field(..., description="DOCX 파일 경로")
    type:      Optional[str] = Field(None, description="파일 확장자명")
    brain_id:  Optional[int] = Field(None, description="연결할 Brain ID")
    docx_text: Optional[str] = Field(None, description="추출된 텍스트")

class DocxFileUpdate(BaseModel):
    """
    DOCX 파일 수정 요청 모델
    
    기존 DOCX 파일 정보를 수정할 때 사용되는 데이터 모델입니다.
    Optional 필드들로 구성되어 있어 필요한 필드만 수정 가능합니다.
    
    Attributes:
        docx_title (Optional[str]): 새로운 DOCX 파일 제목
        docx_path (Optional[str]): 새로운 DOCX 파일 경로
        type (Optional[str]): 파일 확장자명
        brain_id (Optional[int]): 새로운 Brain ID
        docx_text (Optional[str]): 새로운 텍스트
    """
    docx_title: Optional[str] = Field(None, description="새 DOCX 파일 제목")
    docx_path:  Optional[str] = Field(None, description="새 DOCX 파일 경로")
    type:      Optional[str] = Field(None, description="파일 확장자명")
    brain_id:  Optional[int] = Field(None, description="새로운 Brain ID")
    docx_text: Optional[str] = Field(None, description="새 텍스트")

class DocxFileResponse(BaseModel):
    """
    DOCX 파일 응답 모델
    
    API 응답으로 사용되는 DOCX 파일 정보 모델입니다.
    
    Attributes:
        docx_id (int): DOCX 파일 고유 ID
        docx_title (str): DOCX 파일 제목
        docx_path (str): DOCX 파일 경로
        docx_date (str): 생성 날짜
        type (Optional[str]): 파일 확장자명
        brain_id (Optional[int]): 연결된 Brain ID
        docx_text (Optional[str]): 추출된 텍스트
    """
    docx_id:    int
    docx_title: str
    docx_path:  str
    docx_date:  str
    type:      Optional[str]
    brain_id:  Optional[int]
    docx_text: Optional[str]

# ───────── API 엔드포인트 ───────── #

@router.post("/", response_model=DocxFileResponse, status_code=status.HTTP_201_CREATED)
async def create_docxfile(docxfile_data: DocxFileCreate):
    """
    새로운 DOCX 파일 정보를 생성합니다.
    
    처리 과정:
    1. brain_id가 제공된 경우 해당 브레인 존재 여부 확인
    2. DOCX 파일 정보를 데이터베이스에 저장
    3. 생성된 DOCX 파일 정보 반환
    
    Args:
        docxfile_data (DocxFileCreate): DOCX 파일 생성 정보
            - docx_title: 파일 제목 (필수)
            - docx_path: 파일 경로 (필수)
            - type: 파일 확장자명 (선택)
            - brain_id: 연결할 브레인 ID (선택)
            - docx_text: 추출된 텍스트 (선택)
        
    Returns:
        DocxFileResponse: 생성된 DOCX 파일 정보
        
    Raises:
        HTTPException: 
            - 404: 브레인을 찾을 수 없음
            - 500: 서버 내부 오류
    """
    if docxfile_data.brain_id is not None:
        if not sqlite_handler.get_brain(docxfile_data.brain_id):
            raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")
    try:
        return sqlite_handler.create_docxfile(
            docx_title=docxfile_data.docx_title,
            docx_path=docxfile_data.docx_path,
            type=docxfile_data.type,
            brain_id=docxfile_data.brain_id,
            docx_text=docxfile_data.docx_text
        )
    except Exception as e:
        logging.error("DOCX 파일 생성 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.get("/{docx_id}", response_model=DocxFileResponse)
async def get_docxfile(docx_id: int):
    """
    특정 DOCX 파일 정보를 조회합니다.
    
    처리 과정:
    1. docx_id로 DOCX 파일 정보 조회
    2. 파일이 존재하면 정보 반환, 없으면 404 오류
    
    Args:
        docx_id (int): 조회할 DOCX 파일 ID
        
    Returns:
        DocxFileResponse: DOCX 파일 정보
        
    Raises:
        HTTPException: 404 - DOCX 파일을 찾을 수 없음
    """
    docxfile = sqlite_handler.get_docxfile(docx_id)
    if not docxfile:
        raise HTTPException(status_code=404, detail="DOCX 파일을 찾을 수 없습니다")
    return docxfile

@router.put("/{docx_id}", response_model=DocxFileResponse)
async def update_docxfile(docx_id: int, docxfile_data: DocxFileUpdate):
    """
    DOCX 파일 정보를 수정합니다.
    
    처리 과정:
    1. docx_id로 기존 DOCX 파일 존재 여부 확인
    2. brain_id가 제공된 경우 해당 브레인 존재 여부 확인
    3. 파일명 유효성 검사 (길이, 특수문자, 공백 등)
    4. 요청된 필드만 업데이트
    5. 수정된 DOCX 파일 정보 반환
    
    Args:
        docx_id (int): 수정할 DOCX 파일 ID
        docxfile_data (DocxFileUpdate): 수정할 데이터
        
    Returns:
        DocxFileResponse: 수정된 DOCX 파일 정보
        
    Raises:
        HTTPException: 
            - 404: DOCX 파일 또는 브레인을 찾을 수 없음
            - 400: 파일명 유효성 검사 실패
            - 500: 서버 내부 오류
    """
    docx = sqlite_handler.get_docxfile(docx_id)
    if not docx:
        raise HTTPException(status_code=404, detail="DOCX 파일을 찾을 수 없습니다")
    if docxfile_data.brain_id:
        if not sqlite_handler.get_brain(docxfile_data.brain_id):
            raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")

    # 파일명 제한 검증
    if docxfile_data.docx_title is not None:
        name = docxfile_data.docx_title
        # 1. 길이 제한
        if not (1 <= len(name) <= 100):
            raise HTTPException(status_code=400, detail="파일명은 1~100자여야 합니다.")
        # 2. 공백만 입력 금지
        if name.strip() == "":
            raise HTTPException(status_code=400, detail="파일명에 공백만 입력할 수 없습니다.")
        # 3. 특수문자 제한
        import re
        if re.search(r'[\\/:*?"<>|]', name):
            raise HTTPException(status_code=400, detail="파일명에 / \\ : * ? \" < > | 문자를 사용할 수 없습니다.")
        # 4. 점(.)으로 시작/끝 금지
        if name.startswith('.') or name.endswith('.'):
            raise HTTPException(status_code=400, detail="파일명은 .(점)으로 시작하거나 끝날 수 없습니다.")

    try:
        updated = sqlite_handler.update_docxfile(
            docx_id,
            docxfile_data.docx_title,
            docxfile_data.docx_path,
            docxfile_data.type,
            docxfile_data.brain_id,
            docxfile_data.docx_text
        )
        if not updated:
            raise HTTPException(status_code=400, detail="업데이트할 정보가 없습니다")
        return sqlite_handler.get_docxfile(docx_id)
    except Exception as e:
        logging.error("DOCX 파일 수정 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

@router.delete("/{docx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_docxfile(docx_id: int):
    """
    DOCX 파일을 삭제합니다 (DB + 로컬 파일 시스템).
    
    처리 과정:
    1. docx_id로 DOCX 파일 존재 여부 확인
    2. 데이터베이스에서 DOCX 파일 정보 삭제
    3. 로컬 파일 시스템에서 실제 파일 삭제
    4. 삭제 결과 로깅
    
    주의사항:
    - 이 작업은 되돌릴 수 없습니다
    - 데이터베이스와 파일 시스템 모두에서 삭제됩니다
    
    Args:
        docx_id (int): 삭제할 DOCX 파일 ID
        
    Returns:
        Response: 204 No Content
        
    Raises:
        HTTPException: 404 - DOCX 파일을 찾을 수 없음
    """
    docx = sqlite_handler.get_docxfile(docx_id)
    if not docx:
        raise HTTPException(status_code=404, detail="DOCX 파일을 찾을 수 없습니다")

    sqlite_handler.delete_docxfile(docx_id)

    file_path = docx["docx_path"]
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

@router.get("/brain/{brain_id}", response_model=List[DocxFileResponse])
async def get_docxfiles_by_brain(brain_id: int):
    """
    특정 브레인에 속한 모든 DOCX 파일 목록을 조회합니다.
    
    처리 과정:
    1. brain_id로 해당 브레인에 연결된 모든 DOCX 파일 조회
    2. 브레인별로 그룹화된 DOCX 파일 목록 반환
    
    Args:
        brain_id (int): 조회할 브레인 ID
        
    Returns:
        List[DocxFileResponse]: 해당 브레인의 DOCX 파일 목록
        
    Raises:
        HTTPException: 500 - 서버 내부 오류
    """
    try:
        return sqlite_handler.get_docxfiles_by_brain(brain_id)
    except Exception as e:
        logging.error("DOCX 파일 조회 오류: %s", e)
        raise HTTPException(status_code=500, detail="서버 오류")

@router.post("/upload-docx")
async def upload_docxfiles(
    files: List[UploadFile] = File(...),
    brain_id: Optional[int] = Form(None)
):
    """
    DOCX 파일을 업로드하고 텍스트를 추출합니다.
    
    처리 과정:
    1. brain_id가 제공된 경우 해당 브레인 존재 여부 확인
    2. 각 파일에 대해:
       - 파일 확장자 검증 (.docx만 허용)
       - 안전한 파일명 생성 (UUID + 원본명)
       - 파일을 로컬 디렉토리에 저장
       - python-docx를 사용하여 텍스트 추출
       - 데이터베이스에 파일 정보 저장
    3. 업로드된 모든 파일 정보 반환
    
    Args:
        files (List[UploadFile]): 업로드할 DOCX 파일 목록
        brain_id (Optional[int]): 연결할 브레인 ID (선택)
        
    Returns:
        list: 업로드된 DOCX 파일 정보 목록
        
    Raises:
        HTTPException: 404 - 브레인이 존재하지 않음
    """
    uploaded_docxfiles = []
    if brain_id is not None and not sqlite_handler.get_brain(brain_id):
        raise HTTPException(status_code=404, detail="해당 Brain이 존재하지 않습니다.")

    for file in files:
        try:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext != ".docx":
                logging.warning(f"업로드 무시: {file.filename} (docx만 지원)")
                continue

            safe_name = sanitize_filename(file.filename)
            unique_name = f"{uuid.uuid4().hex}_{safe_name}"
            file_path = os.path.join(UPLOAD_DOCX_DIR, unique_name)

            with open(file_path, "wb") as f:
                f.write(await file.read())

            # DOCX 텍스트 추출
            docx = Document(file_path)
            text = '\n'.join([para.text for para in docx.paragraphs])

            created = sqlite_handler.create_docxfile(
                docx_title=safe_name,
                docx_path=file_path,
                type="docx",
                brain_id=brain_id,
                docx_text=text
            )
            uploaded_docxfiles.append(created)
        except Exception as e:
            logging.error("DOCX 업로드 실패 (%s): %s", file.filename, e)

    return uploaded_docxfiles 