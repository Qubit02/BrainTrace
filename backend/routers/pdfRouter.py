from fastapi import UploadFile, File, Form, APIRouter, HTTPException, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db import SQLiteHandler
import logging, os, shutil, uuid, re

# DB 핸들러 초기화
sqlite_handler = SQLiteHandler()

# FastAPI 라우터 정의
router = APIRouter(
    prefix="/pdfs",
    tags=["pdfs"],
    responses={404: {"description": "Not found"}}
)

# ───────── Pydantic 모델 ─────────
class PdfCreate(BaseModel):
    pdf_title: str
    pdf_path: str
    type: Optional[str] = None
    brain_id: Optional[int] = None
    pdf_text: Optional[str] = None

class PdfUpdate(BaseModel):
    pdf_title: Optional[str] = None
    pdf_path: Optional[str] = None
    type: Optional[str] = None
    brain_id: Optional[int] = None
    pdf_text: Optional[str] = None

class PdfResponse(BaseModel):
    pdf_id: int
    pdf_title: str
    pdf_path: str
    pdf_date: str
    type: Optional[str]
    brain_id: Optional[int]
    pdf_text: Optional[str]

# ───────── CREATE PDF ─────────
@router.post("/", response_model=PdfResponse, status_code=status.HTTP_201_CREATED)
async def create_pdf(pdf_data: PdfCreate):
    """
    새로운 PDF 레코드를 생성합니다.
    """
    if pdf_data.brain_id and not sqlite_handler.get_brain(pdf_data.brain_id):
        raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")

    try:
        pdf = sqlite_handler.create_pdf(
            pdf_title=pdf_data.pdf_title,
            pdf_path=pdf_data.pdf_path,
            type=pdf_data.type,
            brain_id=pdf_data.brain_id,
            pdf_text=pdf_data.pdf_text
        )
        return pdf
    except Exception as e:
        logging.error("PDF 생성 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# ───────── GET BY ID ─────────
@router.get("/{pdf_id}", response_model=PdfResponse)
async def get_pdf(pdf_id: int):
    """
    PDF 단건 조회
    """
    pdf = sqlite_handler.get_pdf(pdf_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF를 찾을 수 없습니다")
    return pdf

# ───────── UPDATE PDF ─────────
@router.put("/{pdf_id}", response_model=PdfResponse)
async def update_pdf(pdf_id: int, pdf_data: PdfUpdate):
    """
    PDF 정보 업데이트
    """
    pdf = sqlite_handler.get_pdf(pdf_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF를 찾을 수 없습니다")

    if pdf_data.brain_id and not sqlite_handler.get_brain(pdf_data.brain_id):
        raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")

    # 파일명 제한 검증
    if pdf_data.pdf_title is not None:
        name = pdf_data.pdf_title
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
        updated = sqlite_handler.update_pdf(
            pdf_id,
            pdf_data.pdf_title,
            pdf_data.pdf_path,
            pdf_data.type,
            pdf_data.brain_id,
            pdf_data.pdf_text
        )
        if not updated:
            raise HTTPException(status_code=400, detail="업데이트할 정보가 없습니다")
        return sqlite_handler.get_pdf(pdf_id)
    except Exception as e:
        logging.error("PDF 수정 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# ───────── DELETE PDF ─────────
@router.delete("/{pdf_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pdf(pdf_id: int):
    """
    PDF 삭제 (DB + 로컬 파일 시스템)
    """
    pdf = sqlite_handler.get_pdf(pdf_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF를 찾을 수 없습니다")

    sqlite_handler.delete_pdf(pdf_id)

    file_path = pdf["pdf_path"]
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logging.info(f"✅ 로컬 파일 삭제 완료: {file_path}")
        else:
            logging.warning(f"⚠️ 파일이 존재하지 않음: {file_path}")
    except Exception as e:
        logging.error(f"❌ 로컬 파일 삭제 실패: {e}")

    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ───────── GET BY BRAIN ─────────
@router.get("/brain/{brain_id}", response_model=List[PdfResponse])
async def get_pdfs_by_brain(brain_id: int):
    """
    특정 브레인에 속한 모든 PDF 목록을 반환
    """
    try:
        return sqlite_handler.get_pdfs_by_brain(brain_id)
    except Exception as e:
        logging.error("PDF 조회 오류: %s", e)
        raise HTTPException(status_code=500, detail="서버 오류")

# ───────── PDF 업로드 및 저장 ─────────
UPLOAD_DIR = "uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def sanitize_filename(name):
    """파일 이름의 특수문자 제거"""
    return re.sub(r'[^\w\-_\. ]', '_', name)

@router.post("/upload", response_model=List[PdfResponse])
async def upload_pdfs(
    files: List[UploadFile] = File(...),
    brain_id: Optional[int] = Form(None)
):
    """
    다중 PDF 파일 업로드 및 저장
    """
    uploaded_pdfs = []

    if brain_id and not sqlite_handler.get_brain(brain_id):
        raise HTTPException(status_code=404, detail="해당 Brain이 존재하지 않습니다.")

    for file in files:
        try:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext != ".pdf":
                continue

            safe_name = sanitize_filename(file.filename)
            unique_name = f"{uuid.uuid4().hex}_{safe_name}"
            file_path = os.path.join(UPLOAD_DIR, unique_name)

            with open(file_path, "wb") as f:
                f.write(await file.read())

            # PDF 텍스트 추출
            import PyPDF2
            text = ""
            try:
                with open(file_path, 'rb') as pdf_file:
                    pdf_reader = PyPDF2.PdfReader(pdf_file)
                    for page in pdf_reader.pages:
                        text += page.extract_text() + "\n\n"
            except Exception as e:
                logging.warning(f"PDF 텍스트 추출 실패 ({file.filename}): {e}")
                text = ""

            created = sqlite_handler.create_pdf(
                pdf_title=safe_name,
                pdf_path=file_path,
                type="pdf",
                brain_id=brain_id,
                pdf_text=text
            )
            uploaded_pdfs.append(created)
        except Exception as e:
            logging.error("PDF 업로드 실패 (%s): %s", file.filename, e)

    return uploaded_pdfs
