import { api } from './api';

// MD 파일 생성
export const createMDFile = body => api.post('/md', body).then(r => r.data);
// MD 파일 조회
export const getMDFile = id => api.get(`/md/${id}`).then(r => r.data);
// MD 파일 수정
export const updateMDFile = (id, body) => api.put(`/md/${id}`, body).then(r => r.data);
// MD 파일 삭제
export const deleteMDFile = id => api.delete(`/md/${id}`);
// 브레인에 속한 모든 MD 파일 조회
export const getMDFilesByBrain = (brainId) => api.get(`/md/brain/${brainId}`).then(r => r.data);

// MD 파일 업로드
export const uploadMDFiles = (files, brainId = null) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (brainId != null) formData.append('brain_id', brainId);

    return api.post(
        '/md/upload-md',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(res => res.data);
};

// MD 파일 내용 조회
export const getMDContent = mdId => api.get(`/md/content/${mdId}`).then(r => r.data);
// MD 파일 다운로드
export const downloadMDFile = mdId => api.get(`/md/download/${mdId}`, { responseType: 'blob' }).then(r => r.data);
// MD 파일 검색
export const searchMDFiles = (brainId, query) => api.get(`/md/search/${brainId}?q=${encodeURIComponent(query)}`).then(r => r.data);
// MD 파일 통계
export const getMDStats = brainId => api.get(`/md/stats/${brainId}`).then(r => r.data); 