/**
 * brainApi.js - 브레인(프로젝트) 관리 API
 * 
 * 기능:
 * - 브레인 생성, 조회, 수정, 삭제
 * - 브레인 목록 관리
 * - 브레인 중요도 토글
 * - 브레인 이름 변경
 * 
 * API 엔드포인트:
 * - POST /brains - 브레인 생성
 * - GET /brains - 브레인 목록 조회
 * - GET /brains/{id} - 특정 브레인 조회
 * - PUT /brains/{id} - 브레인 정보 수정
 * - DELETE /brains/{id} - 브레인 삭제
 * - PATCH /brains/{id}/rename - 브레인 이름 변경
 * - PATCH /brains/{id}/toggle-importance - 브레인 중요도 토글
 * 
 * 사용법:
 * import { createBrain, listBrains, getBrain } from './services/brainApi';
 * 
 * // 브레인 생성
 * const newBrain = await createBrain({ brain_name: '새 프로젝트' });
 * 
 * // 브레인 목록 조회
 * const brains = await listBrains();
 */

import { api } from '../config/axiosConfig';

/**
 * 새로운 브레인 생성
 * @param {Object} brainData - 브레인 데이터
 * @param {string} brainData.brain_name - 브레인 이름
 * @param {string} brainData.deployment_type - 배포 타입 (cloud 또는 local)
 * @returns {Promise<Object>} 생성된 브레인 정보
 */
export const createBrain = ({ brain_name, deployment_type }) => 
    api.post('/brains', { brain_name, deployment_type })
        .then(res => res.data)
        .catch(error => {
            console.error('브레인 생성 실패:', error);
            throw error;
        });

/**
 * 모든 브레인 목록 조회
 * @returns {Promise<Array>} 브레인 목록
 */
export const listBrains = () => 
    api.get('/brains')
        .then(r => r.data)
        .catch(error => {
            console.error('브레인 목록 조회 실패:', error);
            throw error;
        });

/**
 * 특정 브레인 정보 조회
 * @param {string|number} id - 브레인 ID
 * @returns {Promise<Object>} 브레인 정보
 */
export const getBrain = id => 
    api.get(`/brains/${id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`브레인 조회 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * 브레인 정보 수정
 * @param {string|number} id - 브레인 ID
 * @param {Object} body - 수정할 브레인 데이터
 * @returns {Promise<Object>} 수정된 브레인 정보
 */
export const updateBrain = (id, body) => 
    api.put(`/brains/${id}`, body)
        .then(r => r.data)
        .catch(error => {
            console.error(`브레인 수정 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * 브레인 삭제
 * @param {string|number} id - 브레인 ID
 * @returns {Promise<Object>} 삭제 결과
 */
export const deleteBrain = id => 
    api.delete(`/brains/${id}`)
        .catch(error => {
            console.error(`브레인 삭제 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * 브레인 이름 변경
 * @param {string|number} id - 브레인 ID
 * @param {string} brain_name - 새로운 브레인 이름
 * @returns {Promise<Object>} 변경된 브레인 정보
 */
export const renameBrain = (id, brain_name) => 
    api.patch(`/brains/${id}/rename`, { brain_name })
        .then(r => r.data)
        .catch(error => {
            console.error(`브레인 이름 변경 실패 (ID: ${id}):`, error);
            throw error;
        });

/**
 * 브레인 중요도 토글
 * @param {string|number} id - 브레인 ID
 * @returns {Promise<Object>} 토글된 브레인 정보
 */
export const toggleBrainImportance = id => 
    api.patch(`/brains/${id}/toggle-importance`)
        .then(r => r.data)
        .catch(error => {
            console.error(`브레인 중요도 토글 실패 (ID: ${id}):`, error);
            throw error;
        });
