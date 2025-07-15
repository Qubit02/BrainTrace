import { api } from './api';

// PDF 생성
export const createPdf = body => api.post('/pdfs', body).then(r => r.data);
// PDF 조회
export const getPdf = id => api.get(`/pdfs/${id}`).then(r => r.data);
// PDF 정보 수정
export const updatePdf = (id, body) => api.put(`/pdfs/${id}`, body).then(r => r.data);
// PDF 삭제
export const deletePdf = id => api.delete(`/pdfs/${id}`);
// 브레인에 속한 모든 PDF 목록 조회
export const getPdfsByBrain = (brainId) => api.get(`/pdfs/brain/${brainId}`).then(r => r.data);

// PDF 업로드
export const uploadPdfs = (files, brainId = null) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (brainId != null) formData.append('brain_id', brainId);

    return api.post(
        '/pdfs/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(res => res.data);
}; 