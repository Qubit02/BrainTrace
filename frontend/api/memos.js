import { api } from './api';

// 메모 생성
export const createMemo = body => api.post('/memos', body).then(r => r.data);
// 메모 조회
export const getMemo = id => api.get(`/memos/${id}`).then(r => r.data);
// 메모 수정
export const updateMemo = (id, body) => api.put(`/memos/${id}`, body).then(r => r.data);
// 메모 삭제
export const deleteMemo = id => api.delete(`/memos/${id}`);
// 메모를 지식그래프의 소스로 지정
export const setMemoAsSource = id => api.put(`/memos/${id}/isSource`).then(r => r.data);
// 메모를 소스에서 제외
export const setMemoAsNotSource = id => api.put(`/memos/${id}/isNotSource`).then(r => r.data);
// 브레인 내 모든 메모 조회
export const getMemosByBrain = (brainId) => api.get(`/memos/brain/${brainId}`).then(r => r.data);
// 브레인 내 소스 지정된 메모만 조회
export const getSourceMemosByBrain = (brainId) =>
    api.get(`/memos/source/brain/${brainId}`).then(r => r.data); 