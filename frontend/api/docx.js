import { api } from './api';

// DOCX 파일 생성
export const createDocxFile = body => api.post('/docxfiles', body).then(r => r.data);
// DOCX 파일 조회
export const getDocxFile = id => api.get(`/docxfiles/${id}`).then(r => r.data);
// DOCX 파일 수정
export const updateDocxFile = (id, body) => api.put(`/docxfiles/${id}`, body).then(r => r.data);
// DOCX 파일 삭제
export const deleteDocxFile = id => api.delete(`/docxfiles/${id}`);
// 브레인에 속한 모든 DOCX 파일 조회
export const getDocxFilesByBrain = (brainId) => api.get(`/docxfiles/brain/${brainId}`).then(r => r.data);

// DOCX 파일 업로드
export const uploadDocxFiles = (files, brainId = null) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (brainId != null) formData.append('brain_id', brainId);

    return api.post(
        '/docxfiles/upload-docx',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(res => res.data);
}; 