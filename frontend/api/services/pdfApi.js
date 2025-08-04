/**
 * pdfApi.js - PDF 문서 관리 API
 * 
 * 기능:
 * - PDF 파일 업로드 및 관리
 * - PDF 정보 조회, 수정, 삭제
 * - 브레인별 PDF 목록 조회
 * 
 * API 엔드포인트:
 * - POST /pdfs: PDF 생성
 * - GET /pdfs/{id}: PDF 조회
 * - PUT /pdfs/{id}: PDF 정보 수정
 * - DELETE /pdfs/{id}: PDF 삭제
 * - GET /pdfs/brain/{brainId}: 브레인별 PDF 목록
 * - POST /pdfs/upload: PDF 파일 업로드
 * 
 * 사용법:
 * import { uploadPdfs, getPdf, deletePdf } from './services/pdfApi';
 */

import { api } from '../config/axiosConfig';

/**
 * PDF 생성
 * @param {Object} body - PDF 생성 데이터
 * @returns {Promise<Object>} 생성된 PDF 정보
 */
export const createPdf = body => 
    api.post('/pdfs', body)
        .then(r => r.data)
        .catch(error => {
            console.error('PDF 생성 실패:', error);
            throw error;
        });

/**
 * PDF 조회
 * @param {string|number} id - PDF ID
 * @returns {Promise<Object>} PDF 정보
 */
export const getPdf = id => 
    api.get(`/pdfs/${id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`PDF 조회 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * PDF 정보 수정
 * @param {string|number} id - PDF ID
 * @param {Object} body - 수정할 데이터
 * @returns {Promise<Object>} 수정된 PDF 정보
 */
export const updatePdf = (id, body) => 
    api.put(`/pdfs/${id}`, body)
        .then(r => r.data)
        .catch(error => {
            console.error(`PDF 수정 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * PDF 삭제
 * @param {string|number} id - PDF ID
 * @returns {Promise<boolean>} 삭제 결과
 */
export const deletePdf = id => 
    api.delete(`/pdfs/${id}`)
        .then(() => true) // 204 응답이면 성공으로 처리
        .catch(error => {
            console.error(`PDF 삭제 실패 (ID: ${id}):`, error);
            console.error('에러 상세 정보:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            throw error;
        });

/**
 * 브레인에 속한 모든 PDF 목록 조회
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Array>} PDF 목록
 */
export const getPdfsByBrain = (brainId) => 
    api.get(`/pdfs/brain/${brainId}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`브레인 PDF 목록 조회 실패 (브레인 ID: ${brainId}):`, error);
            throw error;
        });

/**
 * PDF 파일 업로드
 * @param {File[]} files - 업로드할 PDF 파일들
 * @param {string|number|null} brainId - 브레인 ID (선택사항)
 * @returns {Promise<Object>} 업로드 결과
 */
export const uploadPdfs = (files, brainId = null) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (brainId != null) formData.append('brain_id', brainId);

    return api.post(
        '/pdfs/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    )
        .then(res => res.data)
        .catch(error => {
            console.error('PDF 업로드 실패:', error);
            throw error;
        });
}; 