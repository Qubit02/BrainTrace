import { api } from './api';

// 새로운 브레인 생성
export const createBrain = ({ brain_name }) => api.post('/brains', { brain_name }).then(res => res.data);
// 모든 브레인 목록 조회
export const listBrains = () => api.get('/brains').then(r => r.data);
// 특정 브레인 정보 조회
export const getBrain = id => api.get(`/brains/${id}`).then(r => r.data);
// 브레인 정보 수정
export const updateBrain = (id, body) => api.put(`/brains/${id}`, body).then(r => r.data);
// 브레인 삭제
export const deleteBrain = id => api.delete(`/brains/${id}`);
// 브레인 이름 변경
export const renameBrain = (id, brain_name) => api.patch(`/brains/${id}/rename`, { brain_name }).then(r => r.data);
// 브레인 중요도 토글
export const toggleBrainImportance = id => api.patch(`/brains/${id}/toggle-importance`).then(r => r.data);
