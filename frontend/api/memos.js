import { api } from './api';

// 메모 생성
export const createMemo = body => api.post('/memos', body).then(r => r.data);
// 메모 조회
export const getMemo = id => api.get(`/memos/${id}`).then(r => r.data);
// 메모 수정
export const updateMemo = (id, body) => api.put(`/memos/${id}`, body).then(r => r.data);
// 메모 삭제 (휴지통 이동)
export const deleteMemo = id => api.delete(`/memos/${id}`);
// 메모 완전 삭제 (하드 삭제)
export const hardDeleteMemo = id => api.delete(`/memos/${id}/hard`);
// 휴지통으로 간 메모 복원원
export const restoreMemo = id => api.put(`/memos/${id}/restore`).then(r => r.data);
// 메모를 소스로 변환
export const convertMemoToSource = (memoId) => api.post(`/memos/${memoId}/convertToSource`).then(r => r.data);
// 브레인 내 모든 메모 조회 (휴지통으로 간 메모 포함)
export const getMemosByBrain = (brainId) => api.get(`/memos/brain/${brainId}?include_deleted=true`).then(r => r.data);
// 브레인 내 소스 지정된 메모만 조회
export const getSourceMemosByBrain = (brainId) =>
    api.get(`/memos/source/brain/${brainId}`).then(r => r.data);
// 휴지통 비우기 (삭제된 메모 모두 완전 삭제)
export const emptyTrash = (brainId) => api.delete(`/memos/trash/${brainId}`); 