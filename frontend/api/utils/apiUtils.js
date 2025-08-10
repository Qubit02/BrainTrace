/**
 * apiUtils.js - API 관련 유틸리티 함수들
 * 
 * 기능:
 * - API 에러 처리
 * - API 응답 정규화
 * - API 요청 헬퍼 함수
 */

import { api } from '../config/axiosConfig';

// === API 에러 처리 ===

/**
 * API 에러를 사용자 친화적인 메시지로 변환
 * @param {Error} error - API 에러 객체
 * @returns {string} 사용자 친화적인 에러 메시지
 */
export const getErrorMessage = (error) => {
    if (error.response) {
        // 서버 응답이 있는 경우
        const { status, data } = error.response;
        
        switch (status) {
            case 400:
                return '잘못된 요청입니다. 입력값을 확인해주세요.';
            case 401:
                return '인증이 필요합니다. 다시 로그인해주세요.';
            case 403:
                return '접근 권한이 없습니다.';
            case 404:
                return '요청한 리소스를 찾을 수 없습니다.';
            case 500:
                return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
            default:
                return data?.message || `오류가 발생했습니다. (${status})`;
        }
    } else if (error.request) {
        // 네트워크 오류
        return '네트워크 연결을 확인해주세요.';
    } else {
        // 기타 오류
        return error.message || '알 수 없는 오류가 발생했습니다.';
    }
};

/**
 * API 요청에 대한 재시도 로직
 * @param {Function} apiCall - API 호출 함수
 * @param {number} maxRetries - 최대 재시도 횟수
 * @param {number} delay - 재시도 간격 (ms)
 * @returns {Promise} API 응답
 */
export const retryApiCall = async (apiCall, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            
            // 네트워크 오류나 5xx 에러인 경우에만 재시도
            if (error.response?.status >= 500 || !error.response) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
                continue;
            }
            throw error;
        }
    }
};

// === API 응답 정규화 ===

/**
 * API 응답을 정규화된 형태로 변환
 * @param {Object} response - API 응답
 * @returns {Object} 정규화된 응답
 */
export const normalizeApiResponse = (response) => {
    return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers
    };
};

/**
 * API 에러를 정규화된 형태로 변환
 * @param {Error} error - API 에러
 * @returns {Object} 정규화된 에러
 */
export const normalizeApiError = (error) => {
    return {
        success: false,
        error: getErrorMessage(error),
        status: error.response?.status,
        data: error.response?.data
    };
};

// === API 요청 헬퍼 ===

/**
 * 파일 업로드를 위한 FormData 생성
 * @param {File} file - 업로드할 파일
 * @param {Object} additionalData - 추가 데이터
 * @returns {FormData} FormData 객체
 */
export const createUploadFormData = (file, additionalData = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    
    Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
    });
    
    return formData;
};

/**
 * API 요청에 로딩 상태 추가
 * @param {Function} apiCall - API 호출 함수
 * @param {Function} setLoading - 로딩 상태 설정 함수
 * @returns {Promise} API 응답
 */
export const withLoading = async (apiCall, setLoading) => {
    setLoading(true);
    try {
        const result = await apiCall();
        return result;
    } finally {
        setLoading(false);
    }
};

// === API 인터셉터 설정 ===

/**
 * API 요청 인터셉터 설정
 */
export const setupApiInterceptors = () => {
    // 요청 인터셉터
    api.interceptors.request.use(
        (config) => {
            // 요청 시작 시간 기록
            config.metadata = { startTime: new Date() };
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // 응답 인터셉터
    api.interceptors.response.use(
        (response) => {
            // 요청 시간 계산
            const endTime = new Date();
            const startTime = response.config.metadata?.startTime;
            const duration = startTime ? endTime - startTime : 0;
            
            if (duration > 5000) {
                console.warn(`느린 API 요청: ${response.config.url} (${duration}ms)`);
            }
            
            return response;
        },
        (error) => {
            // 에러 로깅
            console.error('API 에러:', {
                url: error.config?.url,
                method: error.config?.method,
                status: error.response?.status,
                message: getErrorMessage(error)
            });
            
            return Promise.reject(error);
        }
    );
}; 