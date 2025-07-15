from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import os
import logging
from services.voiceService import transcribe

router = APIRouter(prefix="/voices", tags=["Voice Transcription"])

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    음성 파일을 텍스트로 변환
    """
    try:
        # 파일 확장자 검증
        if not file.filename.lower().endswith(('.webm', '.mp3', '.wav', '.m4a')):
            raise HTTPException(status_code=400, detail="지원하지 않는 오디오 형식입니다. webm, mp3, wav, m4a만 지원합니다.")
        
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # 음성 변환 실행
            transcribed_text = transcribe(tmp_file_path)
            
            return JSONResponse(content={
                "text": transcribed_text,
                "success": True
            })
            
        finally:
            # 임시 파일 삭제
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except Exception as e:
        logging.error(f"음성 변환 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"음성 변환에 실패했습니다: {str(e)}") 