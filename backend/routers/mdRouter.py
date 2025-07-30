from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlite_db import SQLiteHandler
import logging, uuid, os, re

sqlite_handler = SQLiteHandler()
router = APIRouter(
    prefix="/md",
    tags=["MD Files"],
    responses={404: {"description": "Not found"}}
)

# ───────── Pydantic 모델 ─────────
class MDFileCreate(BaseModel):
    md_title: str = Field(..., description="MD 파일 제목", min_length=1, max_length=100)
    md_path: str = Field(..., description="MD 파일 경로")
    type: Optional[str] = Field(None, description="파일 확장자명")
    brain_id: Optional[int] = Field(None, description="연결할 Brain ID")

class MDFileUpdate(BaseModel):
    md_title: Optional[str] = Field(None, description="새 MD 파일 제목")
    md_path: Optional[str] = Field(None, description="새 MD 파일 경로")
    type: Optional[str] = Field(None, description="파일 확장자명")
    brain_id: Optional[int] = Field(None, description="새로운 Brain ID")

class MDFileResponse(BaseModel):
    md_id: int
    md_title: str
    md_path: str
    md_date: str
    type: Optional[str]
    brain_id: Optional[int]

# ───────── MD 파일 생성 ─────────
@router.post("/", response_model=MDFileResponse, status_code=status.HTTP_201_CREATED)
async def create_mdfile(mdfile_data: MDFileCreate):
    """새로운 MD 파일을 DB에 등록합니다."""
    if mdfile_data.brain_id is not None:
        if not sqlite_handler.get_brain(mdfile_data.brain_id):
            raise HTTPException(status_code=404, detail="Brain 엔티티를 찾을 수 없습니다")

    try:
        return sqlite_handler.create_mdfile(
            md_title=mdfile_data.md_title,
            md_path=mdfile_data.md_path,
            type=mdfile_data.type,
            brain_id=mdfile_data.brain_id
        )
    except Exception as e:
        logging.error("MD 파일 생성 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# ───────── MD 파일 단건 조회 ─────────
@router.get("/{md_id}", response_model=MDFileResponse)
async def get_mdfile(md_id: int):
    """MD 파일 ID로 단일 조회"""
    mdfile = sqlite_handler.get_mdfile(md_id)
    if not mdfile:
        raise HTTPException(status_code=404, detail="MD 파일을 찾을 수 없습니다")
    return mdfile

# ───────── MD 파일 수정 ─────────
@router.put("/{md_id}", response_model=MDFileResponse)
async def update_mdfile(md_id: int, mdfile_data: MDFileUpdate):
    """MD 파일의 제목, 경로, brain_id 등을 수정"""
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
            brain_id=mdfile_data.brain_id
        )
        if not updated:
            raise HTTPException(status_code=400, detail="업데이트할 정보가 없습니다")
        return sqlite_handler.get_mdfile(md_id)
    except Exception as e:
        logging.error("MD 파일 업데이트 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# ───────── MD 파일 삭제 ─────────
@router.delete("/{md_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mdfile(md_id: int):
    """MD 파일 삭제 (DB + 로컬 파일 시스템)"""
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
    return

# ───────── Brain 기준 MD 파일 목록 조회 ─────────
@router.get("/brain/{brain_id}", response_model=List[MDFileResponse])
async def get_mdfiles_by_brain(brain_id: int):
    """특정 Brain에 속한 MD 파일 목록 전체 조회"""
    try:
        return sqlite_handler.get_mds_by_brain(brain_id)
    except Exception as e:
        logging.error("MD 파일 조회 오류: %s", e)
        raise HTTPException(status_code=500, detail="서버 오류")

# ───────── MD 파일 업로드 ─────────
UPLOAD_MD_DIR = "uploaded_mds"
os.makedirs(UPLOAD_MD_DIR, exist_ok=True)

def sanitize_filename(name):
    """파일명에서 위험한 문자 제거"""
    return re.sub(r'[^\w\-_\. ]', '_', name)

@router.post("/upload-md", response_model=List[MDFileResponse])
async def upload_mdfiles(
    files: List[UploadFile] = File(...),
    brain_id: Optional[int] = Form(None)
):
    """MD 파일 업로드 후 DB에 등록"""
    uploaded_mdfiles = []

    if brain_id is not None and not sqlite_handler.get_brain(brain_id):
        raise HTTPException(status_code=404, detail="해당 Brain이 존재하지 않습니다.")

    for file in files:
        try:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext != ".md":
                continue

            safe_name = sanitize_filename(file.filename)
            unique_name = f"{uuid.uuid4().hex}_{safe_name}"
            file_path = os.path.join(UPLOAD_MD_DIR, unique_name)

            with open(file_path, "wb") as f:
                f.write(await file.read())

            created = sqlite_handler.create_mdfile(
                md_title=safe_name,
                md_path=file_path,
                type="md",
                brain_id=brain_id
            )
            uploaded_mdfiles.append(created)
        except Exception as e:
            logging.error("MD 업로드 실패 (%s): %s", file.filename, e)

    return uploaded_mdfiles

# ───────── MD 파일 내용 조회 ─────────
@router.get("/content/{md_id}")
async def get_md_content(md_id: int):
    """MD 파일의 내용을 반환합니다."""
    try:
        content = sqlite_handler.get_md_content(md_id)
        if content is None:
            raise HTTPException(status_code=404, detail="MD 파일을 찾을 수 없습니다.")
        
        return {"content": content}
    except Exception as e:
        logging.error("MD 파일 내용 조회 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# ───────── MD 파일 다운로드 ─────────
@router.get("/download/{md_id}")
async def download_md_file(md_id: int):
    """MD 파일을 다운로드합니다."""
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

# ───────── MD 파일 검색 ─────────
@router.get("/search/{brain_id}")
async def search_md_files(brain_id: int, q: str):
    """브레인 내에서 MD 파일을 검색합니다."""
    try:
        results = sqlite_handler.search_mds(brain_id, q)
        return {"results": results}
    except Exception as e:
        logging.error("MD 파일 검색 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류")

# ───────── MD 파일 통계 ─────────
@router.get("/stats/{brain_id}")
async def get_md_stats(brain_id: int):
    """브레인의 MD 파일 통계 정보를 반환합니다."""
    try:
        stats = sqlite_handler.get_md_stats(brain_id)
        return stats
    except Exception as e:
        logging.error("MD 파일 통계 조회 오류: %s", e)
        raise HTTPException(status_code=500, detail="내부 서버 오류") 