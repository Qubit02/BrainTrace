"""
voice_router.py

음성 파일 변환 관련 API 엔드포인트를 관리하는 라우터 모듈입니다.

주요 기능:
- 음성 파일을 텍스트로 변환 (STT: Speech-to-Text)
- 다양한 오디오 형식 지원
- 임시 파일 처리 및 자동 정리

지원하는 엔드포인트:
- POST /voices/transcribe : 음성 파일을 텍스트로 변환

지원하는 오디오 형식:
- .webm: WebM 오디오 파일
- .mp3: MP3 오디오 파일
- .wav: WAV 오디오 파일
- .m4a: M4A 오디오 파일

파일 처리:
- 업로드된 음성 파일을 임시 디렉토리에 저장
- 음성 변환 후 임시 파일 자동 삭제
- 메모리 효율적인 스트리밍 처리

의존성:
- FastAPI: 웹 프레임워크
- voiceService: 음성 변환 서비스
- tempfile: 임시 파일 처리
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import os
import logging
from services.voiceService import transcribe

# ───────── FastAPI 라우터 설정 ───────── #
router = APIRouter(prefix="/voices", tags=["Voice Transcription"])

# ───────── API 엔드포인트 ───────── #

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    음성 파일을 텍스트로 변환합니다.
    
    처리 과정:
    1. 업로드된 파일의 확장자 검증
    2. 임시 파일로 음성 파일 저장
    3. voiceService를 사용하여 음성 변환 실행
    4. 변환된 텍스트 반환
    5. 임시 파일 자동 삭제
    
    Args:
        file (UploadFile): 변환할 음성 파일
            - 지원 형식: .webm, .mp3, .wav, .m4a
            
    Returns:
        JSONResponse: 변환 결과
            - text (str): 변환된 텍스트
            - success (bool): 성공 여부
            
    Raises:
        HTTPException: 
            - 400: 지원하지 않는 오디오 형식
            - 500: 음성 변환 실패
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