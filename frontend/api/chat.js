import { api } from './api';

// 채팅 삭제
export const deleteChat = chat_id =>
    api.delete(`/chat/${chat_id}/delete`).then(r => r.data);
// 채팅에 포함된 참조 노드 목록 조회
export const getReferencedNodes = chat_id =>
    api.get(`/chat/${chat_id}/referenced_nodes`).then(r => r.data);
// 브레인별 채팅 세션 리스트 조회
export const listChatsByBrain = brain_id =>
    api.get(`/chat/chatList/${brain_id}`).then(r => r.data); 