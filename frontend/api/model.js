// src/api/model.js
import { api } from './api';

// 모델 관련 API 함수들
export const listModels = async () => {
    try {
        const response = await api.get('/models/');
        return response.data;
    } catch (error) {
        console.error('모델 목록 조회 실패:', error);
        throw error;
    }
};

export const installModel = async (modelName) => {
    try {
        const response = await api.post(`/models/${modelName}/install`);
        return response.data;
    } catch (error) {
        console.error('모델 설치 실패:', error);
        throw error;
    }
}; 