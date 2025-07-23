import { api } from './api';

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
    ).then(res => res.data);
}; 