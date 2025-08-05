from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db import SQLiteHandler
import logging, uuid, os, re
from docx import Document

sqlite_handler = SQLiteHandler()
router = APIRouter(
    prefix="/docxfiles",
    tags=["docxfiles"],
    responses={404: {"description": "Not found"}}
)

UPLOAD_DOCX_DIR = "uploaded_docx"
os.makedirs(UPLOAD_DOCX_DIR, exist_ok=True)

def sanitize_filename(name):
    return re.sub(r'[^\w\-_\. ]', '_', name)

# ───────── Pydantic 모델 ─────────
class DocxFileCreate(BaseModel):
    docx_title: str = Field(..., description="DOCX 파일 제목", min_length=1, max_length=100)
    docx_path:  str = Field(..., description="DOCX 파일 경로")
    type:      Optional[str] = Field(None, description="파일 확장자명")
    brain_id:  Optional[int] = Field(None, description="연결할 Brain ID")
    docx_text: Optional[str] = Field(None, description="추출된 텍스트")

class DocxFileUpdate(BaseModel):
    docx_title: Optional[str] = Field(None, description="새 DOCX 파일 제목")
    docx_path:  Optional[str] = Field(None, description="새 DOCX 파일 경로")
    type:      Optional[str] = Field(None, description="파일 확장자명")
    brain_id:  Optional[int] = Field(None, description="새로운 Brain ID")
    docx_text: Optional[str] = Field(None, description="새 텍스트")

class DocxFileResponse(BaseModel):
    docx_id:    int
    docx_title: str
    docx_path:  str
    docx_date:  str
    type:      Optional[str]
    brain_id:  Optional[int]
    docx_text: Optional[str]

# ───────── DOCX 파일 생성 ─────────
@router.post("/", response_model=DocxFileResponse, status_code=status.HTTP_201_CREATED)
async def create_docxfile(docxfile_data: DocxFileCreate):
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

# ───────── DOCX 파일 단건 조회 ─────────
@router.get("/{docx_id}", response_model=DocxFileResponse)
async def get_docxfile(docx_id: int):
    docxfile = sqlite_handler.get_docxfile(docx_id)
    if not docxfile:
        raise HTTPException(status_code=404, detail="DOCX 파일을 찾을 수 없습니다")
    return docxfile

# ───────── DOCX 파일 수정 ─────────
@router.put("/{docx_id}", response_model=DocxFileResponse)
async def update_docxfile(docx_id: int, docxfile_data: DocxFileUpdate):
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

# ───────── DOCX 파일 삭제 ─────────
@router.delete("/{docx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_docxfile(docx_id: int):
    """DOCX 파일 삭제 (DB + 로컬 파일 시스템)"""
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

# ───────── Brain 기준 DOCX 파일 목록 조회 ─────────
@router.get("/brain/{brain_id}", response_model=List[DocxFileResponse])
async def get_docxfiles_by_brain(brain_id: int):
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