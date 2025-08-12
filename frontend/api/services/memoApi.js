/**
 * memoApi.js - 메모 관리 API
 * 
 * 기능:
 * - 메모 생성, 조회, 수정, 삭제
 * - 메모 휴지통 관리 (소프트 삭제/복원)
 * - 메모 완전 삭제 (하드 삭제)
 * - 메모를 소스로 변환
 * - 브레인별 메모 목록 조회
 * - 휴지통 비우기
 * 
 * API 엔드포인트:
 * - POST /memos: 메모 생성
 * - GET /memos/{id}: 메모 조회
 * - PUT /memos/{id}: 메모 수정
 * - DELETE /memos/{id}: 메모 삭제 (휴지통 이동)
 * - DELETE /memos/{id}/hard: 메모 완전 삭제
 * - PUT /memos/{id}/restore: 메모 복원
 * - POST /memos/{memoId}/convertToSource: 메모를 소스로 변환
 * - GET /memos/brain/{brainId}: 브레인별 메모 목록
 * - GET /memos/source/brain/{brainId}: 브레인별 소스 메모 목록
 * - DELETE /memos/trash/{brainId}: 휴지통 비우기
 * 
 * 사용법:
 * import { createMemo, getMemo, deleteMemo, hardDeleteMemo } from './services/memoApi';
 */

import { api } from '../config/axiosConfig';

/**
 * 메모 생성
 * @param {Object} body - 메모 생성 데이터
 * @returns {Promise<Object>} 생성된 메모 정보
 */
export const createMemo = body => 
    api.post('/memos', body)
        .then(r => r.data)
        .catch(error => {
            console.error('메모 생성 실패:', error);
            throw error;
        });

/**
 * 메모 조회
 * @param {string|number} id - 메모 ID
 * @returns {Promise<Object>} 메모 정보
 */
export const getMemo = id => 
    api.get(`/memos/${id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`메모 조회 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * 메모 수정
 * @param {string|number} id - 메모 ID
 * @param {Object} body - 수정할 데이터
 * @returns {Promise<Object>} 수정된 메모 정보
 */
export const updateMemo = (id, body) => 
    api.put(`/memos/${id}`, body)
        .then(r => r.data)
        .catch(error => {
            console.error(`메모 수정 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * 메모 삭제 (휴지통 이동)
 * @param {string|number} id - 메모 ID
 * @returns {Promise<Object>} 삭제 결과
 */
export const deleteMemo = id => 
    api.delete(`/memos/${id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`메모 삭제 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * 메모 완전 삭제 (하드 삭제)
 * @param {string|number} id - 메모 ID
 * @returns {Promise<boolean>} 삭제 결과
 */
export const hardDeleteMemo = id => 
    api.delete(`/memos/${id}/hard`)
        .then(() => true) // 204 응답이면 성공으로 처리
        .catch(error => {
            console.error(`메모 완전 삭제 실패 (ID: ${id}):`, error);
            console.error('에러 상세 정보:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            throw error;
        });

/**
 * 휴지통으로 간 메모 복원
 * @param {string|number} id - 메모 ID
 * @returns {Promise<Object>} 복원된 메모 정보
 */
export const restoreMemo = id => 
    api.put(`/memos/${id}/restore`)
        .then(r => r.data)
        .catch(error => {
            console.error(`메모 복원 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * 메모를 소스로 변환
 * @param {string|number} memoId - 메모 ID
 * @returns {Promise<Object>} 변환 결과
 */
export const convertMemoToSource = (memoId) => 
    api.post(`/memos/${memoId}/convertToSource`)
        .then(r => r.data)
        .catch(error => {
            console.error(`메모 소스 변환 실패 (ID: ${memoId}):`, error);
            throw error;
        });

/**
 * 브레인 내 모든 메모 조회 (휴지통으로 간 메모 포함)
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Array>} 메모 목록
 */
export const getMemosByBrain = (brainId) => 
    api.get(`/memos/brain/${brainId}?include_deleted=true`)
        .then(r => r.data)
        .catch(error => {
            console.error(`브레인 메모 목록 조회 실패 (브레인 ID: ${brainId}):`, error);
            throw error;
        });

/**
 * 브레인 내 소스 지정된 메모만 조회
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Array>} 소스 메모 목록
 */
export const getSourceMemosByBrain = (brainId) =>
    api.get(`/memos/source/brain/${brainId}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`브레인 소스 메모 목록 조회 실패 (브레인 ID: ${brainId}):`, error);
            throw error;
        });

/**
 * 휴지통 비우기 (삭제된 메모 모두 완전 삭제)
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Object>} 비우기 결과
 */
export const emptyTrash = (brainId) => 
    api.delete(`/memos/trash/${brainId}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`휴지통 비우기 실패 (브레인 ID: ${brainId}):`, error);
            throw error;
        }); 