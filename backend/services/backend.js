// src/services/backend.js
import { api } from './api';

/* ───────── USERS ───────── */
export const createUser = (username, password) => api.post('/users', { username, password }).then(r => r.data);
export const listUsers = () => api.get('/users').then(r => r.data);
export const getUser = id => api.get(`/users/${id}`).then(r => r.data);
export const updateUser = (id, body) => api.put(`/users/${id}`, body).then(r => r.data);
export const authUser = (username, password) => api.post('/users/auth', { username, password }).then(r => r.data);

/* ───────── BRAINS ───────── */
export const createBrain = ({ brain_name, user_id, icon_key }) =>
    api.post('/brains', {
        brain_name,
        user_id,
        icon_key,
    }).then(res => res.data);
export const listBrains = () => api.get('/brains').then(r => r.data);
export const listUserBrains = user_id => api.get(`/brains/user/${user_id}`).then(r => r.data);
export const getBrain = id => api.get(`/brains/${id}`).then(r => r.data);
export const updateBrain = (id, body) => api.put(`/brains/${id}`, body).then(r => r.data);
export const deleteBrain = id => api.delete(`/brains/${id}`);
export const renameBrain = (id, brain_name) => api.patch(`/brains/${id}/rename`, { brain_name }).then(r => r.data);

/* ───────── FOLDERS ───────── */
export const createFolder = (folder_name, brain_id) => api.post('/folders/create_folder', { folder_name, brain_id }).then(r => r.data);
export const listBrainFolders = brain_id => api.get(`/folders/brain/${brain_id}`).then(r => r.data);
export const getFolder = id => api.get(`/folders/${id}`).then(r => r.data);
export const updateFolder = (id, folder_name) => api.put(`/folders/${id}`, { folder_name }).then(r => r.data);
export const deleteFolder = id => api.delete(`/folders/${id}`);
export const getFolderTextfiles = folderId => api.get(`/textfiles/folder/${folderId}`).then(r => r.data);
export const getFolderPdfs = folderId => api.get(`/pdfs/folder/${folderId}`).then(r => r.data);
export const getFolderVoices = folderId => api.get(`/voices/folder/${folderId}`).then(r => r.data);
export const deleteFolderWithMemos = (folderId, brainId) =>
    api.delete(`/folders/deleteAll/${folderId}`, { params: { brain_id: brainId } }).then(r => r.data);

/* ───────── MEMOS ───────── */
export const createMemo = body => api.post('/memos', body).then(r => r.data);
export const getMemo = id => api.get(`/memos/${id}`).then(r => r.data);
export const updateMemo = (id, body) => api.put(`/memos/${id}`, body).then(r => r.data);
export const deleteMemo = id => api.delete(`/memos/${id}`);
export const setMemoAsSource = id => api.put(`/memos/${id}/isSource`).then(r => r.data);
export const setMemoAsNotSource = id => api.put(`/memos/${id}/isNotSource`).then(r => r.data);
export const moveMemoToFolder = (targetFolderId, memoId) => api.put(`/memos/changeFolder/${targetFolderId}/${memoId}`).then(r => r.data);
export const removeMemoFromFolder = memoId => api.put(`/memos/MoveOutFolder/${memoId}`).then(r => r.data);
export const getMemosByBrain = (brainId) => api.get(`/memos/brain/${brainId}`).then((r) => r.data);
export const getSourceMemosByBrain = (brainId, folderId = null) => {
    const url = `/memos/source/brain/${brainId}`;
    return api.get(url, {
        params: folderId ? { folder_id: folderId } : {}
    }).then(r => r.data);
};
/* ───────── PDF FILES ───────── */
export const createPdf = body => api.post('/pdfs', body).then(r => r.data);
export const getPdf = id => api.get(`/pdfs/${id}`).then(r => r.data);
export const updatePdf = (id, body) => api.put(`/pdfs/${id}`, body).then(r => r.data);
export const deletePdf = id => api.delete(`/pdfs/${id}`);
export const movePdfToFolder = (brainId, targetFolderId, pdfId) =>
    api.put(`/pdfs/brain/${brainId}/changeFolder/${targetFolderId}/${pdfId}`).then(r => r.data);
export const removePdfFromFolder = (brainId, pdfId) =>
    api.put(`/pdfs/brain/${brainId}/MoveOutFolder/${pdfId}`).then(r => r.data);
export const getPdfsByBrain = (brainId, folderId = null) => {
    const url = `/pdfs/brain/${brainId}`;
    const params = {};
    if (folderId !== null) {
        params.folder_id = folderId;
    }
    return api.get(url, { params }).then(r => r.data);
};

/**
 * files: File[] 드래그·드롭 혹은 파일 선택으로 받은 File 객체 배열
 * folderId, brainId: (선택) 기존 createFolder 등에서 쓰던 ID
 * 반환: Promise<PdfResponse[]> — 방금 업로드된 PDF 메타데이터 목록
 */
export const uploadPdfs = (files, folderId = null, brainId = null) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (folderId != null) formData.append('folder_id', folderId);
    if (brainId != null) formData.append('brain_id', brainId);

    return api.post(
        '/pdfs/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(res => res.data);
};

/* ───────── TEXT FILES ───────── */
export const createTextFile = body => api.post('/textfiles', body).then(r => r.data);
export const getTextFile = id => api.get(`/textfiles/${id}`).then(r => r.data);
export const updateTextFile = (id, body) => api.put(`/textfiles/${id}`, body).then(r => r.data);
export const deleteTextFile = id => api.delete(`/textfiles/${id}`);
export const moveTextfileToFolder = (brainId, targetFolderId, txtId) =>
    api.put(
        `/textfiles/brain/${brainId}/changeFolder/${targetFolderId}/${txtId}`
    ).then(r => r.data);

export const removeTextFileFromFolder = (brainId, txtId) =>
    api.put(
        `/textfiles/brain/${brainId}/MoveOutFolder/${txtId}`
    ).then(r => r.data);
export const getTextfilesByBrain = (brainId, folderId = null) => {
    const url = `/textfiles/brain/${brainId}`;
    const params = {};
    if (folderId !== null) {
        params.folder_id = folderId;
    }
    return api.get(url, { params }).then(r => r.data);
};
// 텍스트를 그래프로 변환
export const createTextToGraph = body =>
    api
        .post(
            '/brainGraph/process_text',
            JSON.stringify(body),                    // ← JSON.stringify() 추가
            { headers: { 'Content-Type': 'application/json' } }  // ← 헤더 명시
        )
        .then(r => r.data);

export const uploadTextfiles = (files, folderId = null, brainId = null) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (folderId != null) formData.append('folder_id', folderId);
    if (brainId != null) formData.append('brain_id', brainId);

    return api.post(
        '/textfiles/upload-txt',  // 위에서 정의한 엔드포인트
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(res => res.data);
};

/* ───────── VOICE FILES ───────── */
export const createVoice = body => api.post('/voices', body).then(r => r.data);
export const getVoice = id => api.get(`/voices/${id}`).then(r => r.data);
export const updateVoice = (id, body) => api.put(`/voices/${id}`, body).then(r => r.data);
export const deleteVoice = id => api.delete(`/voices/${id}`);
export const moveVoiceToFolder = (brainId, targetFolderId, voiceId) =>
    api.put(
        `/voices/brain/${brainId}/changeFolder/${targetFolderId}/${voiceId}`
    ).then(r => r.data);

export const removeVoiceFromFolder = (brainId, voiceId) =>
    api.put(
        `/voices/brain/${brainId}/MoveOutFolder/${voiceId}`
    ).then(r => r.data);
export const getVoicesByBrain = (brainId, folderId = null) => {
    const url = `/voices/brain/${brainId}`;
    const params = {};
    if (folderId !== null) {
        params.folder_id = folderId;
    }
    return api.get(url, { params }).then(r => r.data);
};

// ───────── DEFAULT (루트) ───────── //
export const getDefaultPdfs = () => api.get(`/pdfs/default`).then(r => r.data);
export const getDefaultTextfiles = () => api.get(`/textfiles/default`).then(r => r.data);
export const getDefaultVoices = () => api.get(`/voices/default`).then(r => r.data);

/* ───────── CHAT ───────── */
export const deleteChat = chat_id =>
    api.delete(`/chat/${chat_id}/delete`).then(r => r.data);

export const getReferencedNodes = chat_id =>
    api.get(`/chat/${chat_id}/referenced_nodes`).then(r => r.data);

export const listChatsByBrain = brain_id =>
    api.get(`/chat/chatList/${brain_id}`).then(r => r.data);

export const getNodesBySourceId = (sourceId, brainId) =>
    api.get(`/brainGraph/getNodesBySourceId`, {
        params: { source_id: sourceId, brain_id: brainId }
    }).then(r => r.data);

export const getSourceIdsByNodeName = (nodeName, brainId) =>
    api.get(`/brainGraph/getSourceIds`, {
        params: { node_name: nodeName, brain_id: brainId }
    }).then(r => r.data);

// 유사한 설명 기반으로 source_id 목록을 가져옴
export const getSimilarSourceIds = (query, brainId) =>
    api.post('/search/getSimilarSourceIds', {
        query: query,
        brain_id: String(brainId)
    }).then(res => res.data);


/* ───────── VOICE TRANSCRIPTION ───────── */
/**
 * MP3 파일을 텍스트로 변환합니다.
 * @param {File} file - 업로드할 MP3 파일 객체
 * @returns {Promise<{ text: string }>} - 변환된 텍스트 반환
 */
export const transcribeAudio = (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post(
        '/voices/transcribe',
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    ).then(res => res.data);
};
