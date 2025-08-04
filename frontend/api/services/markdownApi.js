/**
 * markdownApi.js - 마크다운 파일 관리 API
 * 
 * 기능:
 * - 마크다운 파일 업로드 및 관리
 * - 마크다운 정보 조회, 수정, 삭제
 * - 브레인별 마크다운 목록 조회
 * - 마크다운 내용 조회 및 다운로드
 * - 마크다운 파일 검색 및 통계
 * 
 * API 엔드포인트:
 * - POST /md: 마크다운 파일 생성
 * - GET /md/{id}: 마크다운 파일 조회
 * - PUT /md/{id}: 마크다운 파일 수정
 * - DELETE /md/{id}: 마크다운 파일 삭제
 * - GET /md/brain/{brainId}: 브레인별 마크다운 목록
 * - POST /md/upload-md: 마크다운 파일 업로드
 * - GET /md/content/{mdId}: 마크다운 내용 조회
 * - GET /md/download/{mdId}: 마크다운 파일 다운로드
 * - GET /md/search/{brainId}: 마크다운 파일 검색
 * - GET /md/stats/{brainId}: 마크다운 파일 통계
 * 
 * 사용법:
 * import { uploadMDFiles, getMDFile, searchMDFiles } from './services/markdownApi';
 */

import { api } from '../config/axiosConfig';

/**
 * MD 파일 생성
 * @param {Object} body - 마크다운 파일 생성 데이터
 * @returns {Promise<Object>} 생성된 마크다운 파일 정보
 */
export const createMDFile = body => 
    api.post('/md', body)
        .then(r => r.data)
        .catch(error => {
            console.error('마크다운 파일 생성 실패:', error);
            throw error;
        });

/**
 * MD 파일 조회
 * @param {string|number} id - 마크다운 파일 ID
 * @returns {Promise<Object>} 마크다운 파일 정보
 */
export const getMDFile = id => 
    api.get(`/md/${id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`마크다운 파일 조회 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * MD 파일 수정
 * @param {string|number} id - 마크다운 파일 ID
 * @param {Object} body - 수정할 데이터
 * @returns {Promise<Object>} 수정된 마크다운 파일 정보
 */
export const updateMDFile = (id, body) => 
    api.put(`/md/${id}`, body)
        .then(r => r.data)
        .catch(error => {
            console.error(`마크다운 파일 수정 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * MD 파일 삭제
 * @param {string|number} id - 마크다운 파일 ID
 * @returns {Promise<boolean>} 삭제 결과
 */
export const deleteMDFile = id => 
    api.delete(`/md/${id}`)
        .then(() => true) // 204 응답이면 성공으로 처리
        .catch(error => {
            console.error(`마크다운 파일 삭제 실패 (ID: ${id}):`, error);
            console.error('에러 상세 정보:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            throw error;
        });

/**
 * 브레인에 속한 모든 MD 파일 조회
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Array>} 마크다운 파일 목록
 */
export const getMDFilesByBrain = (brainId) => 
    api.get(`/md/brain/${brainId}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`브레인 마크다운 목록 조회 실패 (브레인 ID: ${brainId}):`, error);
            throw error;
        });

/**
 * MD 파일 업로드
 * @param {File[]} files - 업로드할 마크다운 파일들
 * @param {string|number|null} brainId - 브레인 ID (선택사항)
 * @returns {Promise<Object>} 업로드 결과
 */
export const uploadMDFiles = (files, brainId = null) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (brainId != null) formData.append('brain_id', brainId);

    return api.post(
        '/md/upload-md',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    )
        .then(res => res.data)
        .catch(error => {
            console.error('마크다운 파일 업로드 실패:', error);
            throw error;
        });
};

/**
 * MD 파일 내용 조회
 * @param {string|number} mdId - 마크다운 파일 ID
 * @returns {Promise<Object>} 마크다운 내용
 */
export const getMDContent = mdId => 
    api.get(`/md/content/${mdId}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`마크다운 내용 조회 실패 (ID: ${mdId}):`, error);
            throw error;
        });

/**
 * MD 파일 다운로드
 * @param {string|number} mdId - 마크다운 파일 ID
 * @returns {Promise<Blob>} 다운로드된 파일
 */
export const downloadMDFile = mdId => 
    api.get(`/md/download/${mdId}`, { responseType: 'blob' })
        .then(r => r.data)
        .catch(error => {
            console.error(`마크다운 파일 다운로드 실패 (ID: ${mdId}):`, error);
            throw error;
        });

/**
 * MD 파일 검색
 * @param {string|number} brainId - 브레인 ID
 * @param {string} query - 검색 쿼리
 * @returns {Promise<Array>} 검색 결과
 */
export const searchMDFiles = (brainId, query) => 
    api.get(`/md/search/${brainId}?q=${encodeURIComponent(query)}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`마크다운 파일 검색 실패 (브레인 ID: ${brainId}, 쿼리: ${query}):`, error);
            throw error;
        });

/**
 * MD 파일 통계
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Object>} 마크다운 파일 통계
 */
export const getMDStats = brainId => 
    api.get(`/md/stats/${brainId}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`마크다운 파일 통계 조회 실패 (브레인 ID: ${brainId}):`, error);
            throw error;
        }); 