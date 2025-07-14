import { api } from './api';

// 텍스트 파일 생성
export const createTextFile = body => api.post('/textfiles', body).then(r => r.data);
// 텍스트 파일 조회
export const getTextFile = id => api.get(`/textfiles/${id}`).then(r => r.data);
// 텍스트 파일 수정
export const updateTextFile = (id, body) => api.put(`/textfiles/${id}`, body).then(r => r.data);
// 텍스트 파일 삭제
export const deleteTextFile = id => api.delete(`/textfiles/${id}`);
// 브레인에 속한 모든 텍스트 파일 조회
export const getTextfilesByBrain = (brainId) => api.get(`/textfiles/brain/${brainId}`).then(r => r.data);

// 텍스트 → 그래프 변환 요청
export const createTextToGraph = body =>
    api.post(
        '/brainGraph/process_text',
        JSON.stringify(body),
        { headers: { 'Content-Type': 'application/json' } }
    ).then(r => r.data);

// 텍스트 파일 업로드
export const uploadTextfiles = (files, brainId = null) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (brainId != null) formData.append('brain_id', brainId);

    return api.post(
        '/textfiles/upload-txt',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(res => res.data);
}; 