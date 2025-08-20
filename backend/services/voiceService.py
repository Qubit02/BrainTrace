"""
음성 인식(ASR) 유틸리티
----------------------

이 모듈은 ffmpeg로 입력 오디오(webm/mp3 등)를 16kHz 모노 WAV로 변환한 뒤,
Hugging Face Transformers의 Whisper 파이프라인으로 한국어 음성 인식을 수행합니다.

핵심 동작:
- 디바이스 자동 선택(GPU 우선, 없으면 CPU)
- 임시 WAV 파일 생성 후 ffmpeg로 리샘플링/채널 변환
- librosa로 파형 로딩 후 파이프라인 입력 형식으로 전달
- 인식된 텍스트 문자열 반환(타임스탬프 미반환)

주의사항:
- 시스템에 ffmpeg가 설치되어 있어야 합니다. (PATH 접근 가능)
- 모델은 "o0dimplz0o/Fine-Tuned-Whisper-Large-v2-Zeroth-STT-KO"를 사용합니다.
- 대용량 오디오의 경우 메모리 사용량이 커질 수 있으므로 chunk 파라미터 등을 상황에 맞게 조정하세요.
"""

import subprocess
import tempfile
from transformers import pipeline
import torch
import librosa
import logging
import os

def transcribe(audio_path: str) -> str:
    """주어진 오디오 파일을 텍스트로 변환합니다.

    파이프라인:
      1) 디바이스 선택: CUDA 사용 가능 시 GPU(0), 아니면 CPU(-1)
      2) Whisper ASR 파이프라인 초기화(한국어)
      3) 입력 오디오(webm/mp3 등)를 ffmpeg로 16kHz/모노 WAV 변환
      4) librosa로 파형 로딩 후 파이프라인에 전달
      5) 인식 결과 텍스트 반환

    Args:
        audio_path: 입력 오디오 파일 경로(웹캠/업로드 파일 등)

    Returns:
        str: 인식된 텍스트

    Raises:
        Exception: ffmpeg 변환 실패 혹은 ASR 처리 중 예외 발생 시 상세 메시지 포함
    """
    try:
        logging.info(f"[Transcribe] 시작: {audio_path}")
        # CUDA 사용 가능하면 GPU(0) 사용, 아니면 CPU(-1)
        device = 0 if torch.cuda.is_available() else -1

        # Whisper 파이프라인 초기화
        # - chunk_length_s/stride_length_s: 긴 오디오 스트리밍 처리 안정성 개선
        # - generate_kwargs.language: 한국어 모델 힌트
        asr = pipeline(
            "automatic-speech-recognition",
            model="o0dimplz0o/Fine-Tuned-Whisper-Large-v2-Zeroth-STT-KO",
            device=device,
            chunk_length_s=30,
            stride_length_s=5,
            return_timestamps=False,
            generate_kwargs={"language": "ko"}
        )

        # 입력 포맷(webm/mp3 등)을 ffmpeg로 16kHz 모노 WAV로 변환
        # 임시 파일은 호출 종료 시 수동으로 삭제합니다.
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
            wav_path = tmp_wav.name

        command = [
            "ffmpeg",
            "-y", "-i", audio_path,
            "-ar", "16000", "-ac", "1", wav_path
        ]


        # ffmpeg 호출: 표준 출력/에러는 무시하고, 실패 시 예외 발생(check=True)
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        logging.info(f"[ffmpeg 변환 완료] {wav_path}")


        # librosa로 파형 로딩(sr=16000 고정)
        waveform, _ = librosa.load(wav_path, sr=16000)
        logging.info(f"[Waveform 로딩 완료] 길이: {len(waveform)}")

        # 파이프라인 입력 형식: {"array": np.ndarray|list, "sampling_rate": int}
        result = asr({"array": waveform, "sampling_rate": 16000})
        
        # 임시 wav 파일 삭제(정상/예외와 무관하게 정리 필요)
        os.unlink(wav_path)

        return result["text"]

    except subprocess.CalledProcessError as e:
        logging.exception("ffmpeg 변환 실패")
        raise Exception(f"ffmpeg 변환 실패: {e}")
    except Exception as e:
        logging.exception("transcribe 함수 오류")
        raise Exception(f"음성 변환 실패: {str(e)}")
