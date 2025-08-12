/**
 * docxApi.js - DOCX 문서 관리 API
 * 
 * 기능:
 * - DOCX 파일 업로드 및 관리
 * - DOCX 정보 조회, 수정, 삭제
 * - 브레인별 DOCX 목록 조회
 * 
 * API 엔드포인트:
 * - POST /docxfiles: DOCX 생성
 * - GET /docxfiles/{id}: DOCX 조회
 * - PUT /docxfiles/{id}: DOCX 정보 수정
 * - DELETE /docxfiles/{id}: DOCX 삭제
 * - GET /docxfiles/brain/{brainId}: 브레인별 DOCX 목록
 * - POST /docxfiles/upload-docx: DOCX 파일 업로드
 * 
 * 사용법:
 * import { uploadDocxFiles, getDocxFile, deleteDocxFile } from './services/docxApi';
 */

import { api } from '../config/axiosConfig';

/**
 * DOCX 파일 생성
 * @param {Object} body - DOCX 생성 데이터
 * @returns {Promise<Object>} 생성된 DOCX 정보
 */
export const createDocxFile = body => 
    api.post('/docxfiles', body)
        .then(r => r.data)
        .catch(error => {
            console.error('DOCX 생성 실패:', error);
            throw error;
        });

/**
 * DOCX 파일 조회
 * @param {string|number} id - DOCX ID
 * @returns {Promise<Object>} DOCX 정보
 */
export const getDocxFile = id => 
    api.get(`/docxfiles/${id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`DOCX 조회 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * DOCX 파일 수정
 * @param {string|number} id - DOCX ID
 * @param {Object} body - 수정할 데이터
 * @returns {Promise<Object>} 수정된 DOCX 정보
 */
export const updateDocxFile = (id, body) => 
    api.put(`/docxfiles/${id}`, body)
        .then(r => r.data)
        .catch(error => {
            console.error(`DOCX 수정 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * DOCX 파일 삭제
 * @param {string|number} id - DOCX ID
 * @returns {Promise<boolean>} 삭제 결과
 */
export const deleteDocxFile = id => 
    api.delete(`/docxfiles/${id}`)
        .then(() => true) // 204 응답이면 성공으로 처리
        .catch(error => {
            console.error(`DOCX 삭제 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * 브레인에 속한 모든 DOCX 파일 조회
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Array>} DOCX 목록
 */
export const getDocxFilesByBrain = (brainId) => 
    api.get(`/docxfiles/brain/${brainId}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`브레인 DOCX 목록 조회 실패 (브레인 ID: ${brainId}):`, error);
            throw error;
        });

/**
 * DOCX 파일 업로드
 * @param {File[]} files - 업로드할 DOCX 파일들
 * @param {string|number|null} brainId - 브레인 ID (선택사항)
 * @returns {Promise<Object>} 업로드 결과
 */
export const uploadDocxFiles = (files, brainId = null) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (brainId != null) formData.append('brain_id', brainId);

    return api.post(
        '/docxfiles/upload-docx',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    )
        .then(res => res.data)
        .catch(error => {
            console.error('DOCX 업로드 실패:', error);
            throw error;
        });
}; 