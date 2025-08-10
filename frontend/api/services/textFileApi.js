/**
 * textFileApi.js - 텍스트 파일 관리 API
 *
 * 기능:
 * - 텍스트 파일 업로드 및 관리
 * - 텍스트 정보 조회, 수정, 삭제
 * - 브레인별 텍스트 파일 목록 조회
 * - 텍스트를 그래프로 변환
 *
 * API 엔드포인트:
 * - POST /textfiles: 텍스트 파일 생성
 * - GET /textfiles/{id}: 텍스트 파일 조회
 * - PUT /textfiles/{id}: 텍스트 파일 수정
 * - DELETE /textfiles/{id}: 텍스트 파일 삭제
 * - GET /textfiles/brain/{brainId}: 브레인별 텍스트 파일 목록
 * - POST /textfiles/upload-txt: 텍스트 파일 업로드
 * - POST /brainGraph/process_text: 텍스트를 그래프로 변환
 *
 * 사용법:
 * import { uploadTextfiles, getTextFile, createTextToGraph } from './services/textFileApi';
 */

import { api } from '../config/axiosConfig';

/**
 * 텍스트 파일 생성
 * @param {Object} body - 텍스트 파일 생성 데이터
 * @returns {Promise<Object>} 생성된 텍스트 파일 정보
 */
export const createTextFile = (body) =>
  api
    .post('/textfiles', body)
    .then((r) => r.data)
    .catch((error) => {
      console.error('텍스트 파일 생성 실패:', error);
      throw error;
    });

/**
 * 텍스트 파일 조회
 * @param {string|number} id - 텍스트 파일 ID
 * @returns {Promise<Object>} 텍스트 파일 정보
 */
export const getTextFile = (id) =>
  api
    .get(`/textfiles/${id}`)
    .then((r) => r.data)
    .catch((error) => {
      console.error(`텍스트 파일 조회 실패 (ID: ${id}):`, error);
      throw error;
    });

/**
 * 텍스트 파일 수정
 * @param {string|number} id - 텍스트 파일 ID
 * @param {Object} body - 수정할 데이터
 * @returns {Promise<Object>} 수정된 텍스트 파일 정보
 */
export const updateTextFile = (id, body) =>
  api
    .put(`/textfiles/${id}`, body)
    .then((r) => r.data)
    .catch((error) => {
      console.error(`텍스트 파일 수정 실패 (ID: ${id}):`, error);
      throw error;
    });

/**
 * 텍스트 파일 삭제
 * @param {string|number} id - 텍스트 파일 ID
 * @returns {Promise<boolean>} 삭제 결과
 */
export const deleteTextFile = (id) =>
  api
    .delete(`/textfiles/${id}`)
    .then(() => true) // 204 응답이면 성공으로 처리
    .catch((error) => {
      console.error(`텍스트 파일 삭제 실패 (ID: ${id}):`, error);
      console.error('에러 상세 정보:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      throw error;
    });

/**
 * 브레인에 속한 모든 텍스트 파일 조회
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Array>} 텍스트 파일 목록
 */
export const getTextfilesByBrain = (brainId) =>
  api
    .get(`/textfiles/brain/${brainId}`)
    .then((r) => r.data)
    .catch((error) => {
      console.error(
        `브레인 텍스트 파일 목록 조회 실패 (브레인 ID: ${brainId}):`,
        error
      );
      throw error;
    });

/**
 * 텍스트 → 그래프 변환 요청
 * @param {Object} body - 변환할 텍스트 데이터
 * @returns {Promise<Object>} 그래프 변환 결과
 */
export const createTextToGraph = (body) =>
  api
    .post('/brainGraph/process_text', JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
    })
    .then((r) => r.data)
    .catch((error) => {
      console.error('텍스트 그래프 변환 실패:', error);
      throw error;
    });

/**
 * 텍스트 파일 업로드
 * @param {File[]} files - 업로드할 텍스트 파일들
 * @param {string|number|null} brainId - 브레인 ID (선택사항)
 * @returns {Promise<Object>} 업로드 결과
 */
export const uploadTextfiles = (files, brainId = null) => {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  if (brainId != null) formData.append('brain_id', brainId);

  return api
    .post('/textfiles/upload-txt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((res) => res.data)
    .catch((error) => {
      console.error('텍스트 파일 업로드 실패:', error);
      throw error;
    });
};
