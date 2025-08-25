/**
 * AI 모델 관련 API 서비스
 *
 * 이 파일은 AI 모델과 관련된 모든 API 호출을 담당합니다.
 *
 * 주요 기능:
 * - AI 모델 목록 조회
 * - AI 모델 설치
 *
 * @fileoverview AI 모델 관리 API 서비스
 */

import { api } from '../config/axiosConfig';

/**
 * 사용 가능한 AI 모델 목록을 조회합니다.
 *
 * @returns {Promise<Object>} 사용 가능한 모델 목록
 * @throws {Error} API 호출 실패 시 에러 발생
 */
export const listModels = async () => {
  try {
    const response = await api.get('/models/');
    return response.data;
  } catch (error) {
    console.error('모델 목록 조회 실패:', error);
    throw error;
  }
};

/**
 * 지정된 AI 모델을 설치합니다.
 *
 * @param {string} modelName - 설치할 모델의 이름
 * @returns {Promise<Object>} 설치 결과
 * @throws {Error} API 호출 실패 시 에러 발생
 */
export const installModel = async (modelName) => {
  try {
    const response = await api.post(`/models/${modelName}/install`);
    return response.data;
  } catch (error) {
    console.error('모델 설치 실패:', error);
    throw error;
  }
};

/**
 * 설치된 AI 모델 목록과 상세 정보를 조회합니다.
 *
 * @returns {Promise<Object>} 설치된 모델 목록과 상세 정보 (크기, 수정일 등)
 * @throws {Error} API 호출 실패 시 에러 발생
 */
export const getInstalledModels = async () => {
  try {
    const response = await api.get('/models/installed');
    return response.data;
  } catch (error) {
    console.error('설치된 모델 목록 조회 실패:', error);
    throw error;
  }
};
