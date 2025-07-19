import { api } from './api';

// 채팅 삭제 (개별)
export const deleteChat = chat_id =>
    api.delete(`/chat/${chat_id}/delete`).then(r => r.data);
// 채팅에 포함된 참조 노드 목록 조회
export const getReferencedNodes = chat_id =>
    api.get(`/chat/${chat_id}/referenced_nodes`).then(r => r.data);

// === DB 기반: 브레인별 전체 채팅 내역 조회 ===
export const fetchChatHistoryByBrain = brain_id =>
    api.get(`/chat/brain/${brain_id}`).then(r => r.data);

// === DB 기반: 브레인별 전체 채팅 삭제 ===
export const deleteAllChatsByBrain = brain_id =>
    api.delete(`/chat/brain/${brain_id}`).then(r => r.data);

// === DB 기반: 채팅(질문/답변) 저장 ===
export const saveChatToBrain = (brain_id, { is_ai, message, referenced_nodes }) =>
    api.post(`/chat/brain/${brain_id}`, { is_ai, message, referenced_nodes }).then(r => r.data); 