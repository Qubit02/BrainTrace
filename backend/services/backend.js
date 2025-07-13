// src/services/backend.js
import { api } from './api';

/* ───────── BRAINS ───────── */

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

/* ───────── MEMOS ───────── */

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

/* ───────── PDF FILES ───────── */

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

/* ───────── TEXT FILES ───────── */

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

/* ───────── CHAT ───────── */

// 채팅 삭제
export const deleteChat = chat_id =>
    api.delete(`/chat/${chat_id}/delete`).then(r => r.data);
// 채팅에 포함된 참조 노드 목록 조회
export const getReferencedNodes = chat_id =>
    api.get(`/chat/${chat_id}/referenced_nodes`).then(r => r.data);
// 브레인별 채팅 세션 리스트 조회
export const listChatsByBrain = brain_id =>
    api.get(`/chat/chatList/${brain_id}`).then(r => r.data);

/* ───────── GRAPH 조회 ───────── */

// 특정 소스 ID로부터 생성된 노드 목록 조회
export const getNodesBySourceId = (sourceId, brainId) =>
    api.get(`/brainGraph/getNodesBySourceId`, {
        params: { source_id: sourceId, brain_id: brainId }
    }).then(r => r.data);

// 특정 노드 이름과 관련된 소스 ID 목록 조회
export const getSourceIdsByNodeName = (nodeName, brainId) =>
    api.get(`/brainGraph/getSourceIds`, {
        params: { node_name: nodeName, brain_id: brainId }
    }).then(r => r.data);

// 유사 설명 기반으로 관련 소스 ID 목록 검색
export const getSimilarSourceIds = (query, brainId) =>
    api.post('/search/getSimilarSourceIds', {
        query: query,
        brain_id: String(brainId)
    }).then(res => res.data);

/* ───────── VOICE TRANSCRIPTION ───────── */
/**
 * 음성(MP3) 파일을 텍스트로 변환
 * @param {File} file - 업로드할 MP3 파일
 * @returns {Promise<{ text: string }>} - 변환된 텍스트 반환
 */
export const transcribeAudio = (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post(
        '/voices/transcribe',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(res => res.data);
};
