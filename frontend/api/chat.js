import { api } from './api';

// 채팅 삭제 (개별)
export const deleteChat = chat_id =>
    api.delete(`/chat/${chat_id}/delete`).then(r => r.data);

// 채팅에 포함된 참조 노드 목록 조회 (그래프 보기)
export const getReferencedNodes = chat_id =>
    api.get(`/chat/${chat_id}/referenced_nodes`).then(r => r.data);

// 노드별 소스 개수 및 타이틀/ID 조회 (API 응답: { titles: [...], ids: [...] })
export const getNodeSourcesByChat = (chat_id, node_name) =>
    api.get(`/chat/${chat_id}/node_sources`, { params: { node_name } }).then(r => r.data);

// === 세션별 전체 채팅 내역 조회 ===
export const fetchChatHistoryBySession = session_id =>
    api.get(`/chat/session/${session_id}`).then(r => r.data);

// === 세션별 전체 채팅 삭제 ===
export const deleteAllChatsBySession = session_id =>
    api.delete(`/chat/session/${session_id}`).then(r => r.data);

// === 채팅(질문/답변) 저장 ===
export const saveChatToSession = (session_id, { is_ai, message, referenced_nodes }) =>
    api.post(`/chat/session/${session_id}`, { is_ai, message, referenced_nodes }).then(r => r.data);

// === 채팅(질문/답변) 메시지 조회 ===
export const getChatMessageById = chat_id =>
    api.get(`/chat/${chat_id}/message`).then(r => r.data.message);

// === 챗세션(채팅방) API ===
// 세션 생성
export const createChatSession = (session_name, brain_id = null) =>
    api.post('/chatsession/', { session_name, brain_id }).then(r => r.data);

// 세션 전체 리스트 조회
export const fetchChatSessions = () =>
    api.get('/chatsession/').then(r => r.data);

// 특정 브레인의 세션 리스트 조회
export const fetchChatSessionsByBrain = (brain_id) =>
    api.get(`/chatsession/brain/${brain_id}`).then(r => r.data);

// 세션 단일 조회
export const fetchChatSession = session_id =>
    api.get(`/chatsession/${session_id}`).then(r => r.data);

// 세션 삭제
export const deleteChatSession = session_id =>
    api.delete(`/chatsession/${session_id}`).then(r => r.data);

// 세션 이름 수정
export const renameChatSession = (session_id, session_name) =>
    api.patch(`/chatsession/${session_id}/rename`, { session_name }).then(r => r.data);