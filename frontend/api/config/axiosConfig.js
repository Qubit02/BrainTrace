/**
 * axiosConfig.js - Axios HTTP 클라이언트 설정
 * 
 * 기능:
 * - Axios 인스턴스 생성 및 기본 설정
 * - API 요청 기본 URL 및 헤더 설정
 * - 전역 인터셉터 설정 (에러 처리, 로깅 등)
 * 
 * 사용법:
 * import { api } from './config/axiosConfig';
 * 
 * // API 요청 예시
 * const response = await api.get('/endpoint');
 */

import axios from 'axios';

// Axios 인스턴스 생성
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
    headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// 요청 인터셉터 - 요청 전 처리
api.interceptors.request.use(
    (config) => {
        // 요청 시작 시간 기록
        config.metadata = { startTime: new Date() };
        
        // 개발 환경에서 요청 로깅
        if (import.meta.env.DEV) {
            console.log(`🚀 API 요청: ${config.method?.toUpperCase()} ${config.url}`);
        }
        
        return config;
    },
    (error) => {
        console.error('❌ 요청 인터셉터 에러:', error);
        return Promise.reject(error);
    }
);

// 응답 인터셉터 - 응답 후 처리
api.interceptors.response.use(
    (response) => {
        // 요청 시간 계산
        const endTime = new Date();
        const startTime = response.config.metadata?.startTime;
        const duration = startTime ? endTime - startTime : 0;
        
        // 개발 환경에서 응답 로깅
        if (import.meta.env.DEV) {
            console.log(`✅ API 응답: ${response.config.url} (${duration}ms)`);
        }
        
        // 느린 요청 경고
        if (duration > 5000) {
            console.warn(`⚠️ 느린 API 요청: ${response.config.url} (${duration}ms)`);
        }
        
        return response;
    },
    (error) => {
        // 에러 로깅
        console.error('❌ API 에러:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            message: error.message
        });
        
        return Promise.reject(error);
    }
);
