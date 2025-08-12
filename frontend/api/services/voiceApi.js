/**
 * voiceApi.js - 음성 처리 API
 * 
 * 기능:
 * - 음성 파일을 텍스트로 변환 (STT)
 * - 다양한 오디오 형식 지원
 * 
 * API 엔드포인트:
 * - POST /voices/transcribe: 음성 파일을 텍스트로 변환
 * 
 * 사용법:
 * import { transcribeAudio } from './services/voiceApi';
 */

import { api } from '../config/axiosConfig';

/**
 * 음성 파일을 텍스트로 변환
 * @param {File} file - 업로드할 오디오 파일
 * @returns {Promise<{ text: string }>} - 변환된 텍스트 반환
 */
export const transcribeAudio = (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post(
        '/voices/transcribe',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    )
        .then(res => res.data)
        .catch(error => {
            console.error('음성 변환 실패:', error);
            throw error;
        });
}; 