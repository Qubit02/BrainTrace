/**
 * chatApi.js - 채팅 및 채팅 세션 관리 API
 * 
 * 기능:
 * - 개별 채팅 메시지 관리 (삭제, 조회)
 * - 채팅 세션 관리 (생성, 조회, 삭제, 이름 변경)
 * - 참조 노드 및 소스 관리
 * - 소스 콘텐츠 조회
 * 
 * API 엔드포인트:
 * - DELETE /chat/{chat_id}/delete - 개별 채팅 삭제
 * - GET /chat/{chat_id}/referenced_nodes - 참조 노드 조회
 * - GET /chat/{chat_id}/node_sources - 노드별 소스 조회
 * - GET /chat/session/{session_id} - 세션별 채팅 내역
 * - DELETE /chat/session/{session_id} - 세션별 채팅 삭제
 * - POST /chat/session/{session_id} - 채팅 저장
 * - GET /chat/{chat_id}/message - 채팅 메시지 조회
 * - POST /chatsession/ - 세션 생성
 * - GET /chatsession/ - 세션 목록 조회
 * - GET /chatsession/brain/{brain_id} - 브레인별 세션 조회
 * - GET /chatsession/{session_id} - 세션 조회
 * - DELETE /chatsession/{session_id} - 세션 삭제
 * - PATCH /chatsession/{session_id}/rename - 세션 이름 변경
 * - GET /brainGraph/getSourceContent - 소스 콘텐츠 조회
 * 
 * 사용법:
 * import { createChatSession, saveChatToSession, fetchChatSessions } from './services/chatApi';
 * 
 * // 채팅 세션 생성
 * const session = await createChatSession('새 채팅방', brainId);
 * 
 * // 채팅 메시지 저장
 * await saveChatToSession(sessionId, { is_ai: false, message: '안녕하세요' });
 */

import { api } from '../config/axiosConfig';

// === 개별 채팅 관리 ===

/**
 * 개별 채팅 삭제
 * @param {string|number} chat_id - 채팅 ID
 * @returns {Promise<Object>} 삭제 결과
 */
export const deleteChat = chat_id =>
    api.delete(`/chat/${chat_id}/delete`)
        .then(r => r.data)
        .catch(error => {
            console.error(`채팅 삭제 실패 (ID: ${chat_id}):`, error);
            throw error;
        });

/**
 * 채팅에 포함된 참조 노드 목록 조회 (그래프 보기용)
 * @param {string|number} chat_id - 채팅 ID
 * @returns {Promise<Array>} 참조 노드 목록
 */
export const getReferencedNodes = chat_id =>
    api.get(`/chat/${chat_id}/referenced_nodes`)
        .then(r => r.data)
        .catch(error => {
            console.error(`참조 노드 조회 실패 (채팅 ID: ${chat_id}):`, error);
            throw error;
        });

/**
 * 노드별 소스 개수 및 타이틀/ID 조회
 * @param {string|number} chat_id - 채팅 ID
 * @param {string} node_name - 노드 이름
 * @returns {Promise<Object>} { titles: [...], ids: [...] }
 */
export const getNodeSourcesByChat = (chat_id, node_name) =>
    api.get(`/chat/${chat_id}/node_sources`, { params: { node_name } })
        .then(r => r.data)
        .catch(error => {
            console.error(`노드 소스 조회 실패 (채팅 ID: ${chat_id}, 노드: ${node_name}):`, error);
            throw error;
        });

// === 세션별 채팅 관리 ===

/**
 * 세션별 전체 채팅 내역 조회
 * @param {string|number} session_id - 세션 ID
 * @returns {Promise<Array>} 채팅 내역
 */
export const fetchChatHistoryBySession = session_id =>
    api.get(`/chat/session/${session_id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`채팅 내역 조회 실패 (세션 ID: ${session_id}):`, error);
            throw error;
        });

/**
 * 세션별 전체 채팅 삭제
 * @param {string|number} session_id - 세션 ID
 * @returns {Promise<Object>} 삭제 결과
 */
export const deleteAllChatsBySession = session_id =>
    api.delete(`/chat/session/${session_id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`세션 채팅 삭제 실패 (세션 ID: ${session_id}):`, error);
            throw error;
        });

/**
 * 채팅(질문/답변) 저장
 * @param {string|number} session_id - 세션 ID
 * @param {Object} chatData - 채팅 데이터
 * @param {boolean|number} chatData.is_ai - AI 응답 여부 (false/0: 사용자, true/1: AI)
 * @param {string} chatData.message - 메시지 내용
 * @param {Array} chatData.referenced_nodes - 참조 노드 목록
 * @param {number} chatData.accuracy - 정확도
 * @returns {Promise<Object>} 저장된 채팅 정보
 */
export const saveChatToSession = (session_id, { is_ai, message, referenced_nodes, accuracy }) => {
    // is_ai를 int 타입으로 변환 (false -> 0, true -> 1)
    const isAiInt = typeof is_ai === 'boolean' ? (is_ai ? 1 : 0) : is_ai;
    
    return api.post(`/chat/session/${session_id}`, { 
        is_ai: isAiInt, 
        message, 
        referenced_nodes, 
        accuracy 
    })
        .then(r => r.data)
        .catch(error => {
            console.error(`채팅 저장 실패 (세션 ID: ${session_id}):`, error);
            throw error;
        });
};

/**
 * 채팅(질문/답변) 메시지 조회
 * @param {string|number} chat_id - 채팅 ID
 * @returns {Promise<string>} 메시지 내용
 */
export const getChatMessageById = chat_id =>
    api.get(`/chat/${chat_id}/message`)
        .then(r => r.data.message)
        .catch(error => {
            console.error(`채팅 메시지 조회 실패 (ID: ${chat_id}):`, error);
            throw error;
        });

// === 채팅 세션 관리 ===

/**
 * 채팅 세션 생성
 * @param {string} session_name - 세션 이름
 * @param {string|number|null} brain_id - 브레인 ID (선택사항)
 * @returns {Promise<Object>} 생성된 세션 정보
 */
export const createChatSession = (session_name, brain_id = null) =>
    api.post('/chatsession/', { session_name, brain_id })
        .then(r => r.data)
        .catch(error => {
            console.error('채팅 세션 생성 실패:', error);
            throw error;
        });

/**
 * 세션 전체 리스트 조회
 * @returns {Promise<Array>} 세션 목록
 */
export const fetchChatSessions = () =>
    api.get('/chatsession/')
        .then(r => r.data)
        .catch(error => {
            console.error('채팅 세션 목록 조회 실패:', error);
            throw error;
        });

/**
 * 특정 브레인의 세션 리스트 조회
 * @param {string|number} brain_id - 브레인 ID
 * @returns {Promise<Array>} 브레인별 세션 목록
 */
export const fetchChatSessionsByBrain = (brain_id) =>
    api.get(`/chatsession/brain/${brain_id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`브레인별 세션 조회 실패 (브레인 ID: ${brain_id}):`, error);
            throw error;
        });

/**
 * 세션 단일 조회
 * @param {string|number} session_id - 세션 ID
 * @returns {Promise<Object>} 세션 정보
 */
export const fetchChatSession = session_id =>
    api.get(`/chatsession/${session_id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`세션 조회 실패 (ID: ${session_id}):`, error);
            throw error;
        });

/**
 * 세션 삭제
 * @param {string|number} session_id - 세션 ID
 * @returns {Promise<Object>} 삭제 결과
 */
export const deleteChatSession = session_id =>
    api.delete(`/chatsession/${session_id}`)
        .then(r => r.data)
        .catch(error => {
            console.error(`세션 삭제 실패 (ID: ${session_id}):`, error);
            throw error;
        });

/**
 * 세션 이름 수정
 * @param {string|number} session_id - 세션 ID
 * @param {string} session_name - 새로운 세션 이름
 * @returns {Promise<Object>} 수정된 세션 정보
 */
export const renameChatSession = (session_id, session_name) =>
    api.patch(`/chatsession/${session_id}/rename`, { session_name })
        .then(r => r.data)
        .catch(error => {
            console.error(`세션 이름 수정 실패 (ID: ${session_id}):`, error);
            throw error;
        });

// === 소스 콘텐츠 조회 ===

/**
 * 소스 콘텐츠 조회
 * @param {string|number} source_id - 소스 ID
 * @param {string|number} brain_id - 브레인 ID
 * @returns {Promise<Object>} 소스 콘텐츠 정보
 */
export const getSourceContent = (source_id, brain_id) =>
    api.get(`/brainGraph/getSourceContent`, {
        params: { source_id, brain_id }
    })
        .then(r => r.data)
        .catch(error => {
            console.error(`소스 콘텐츠 조회 실패 (소스 ID: ${source_id}, 브레인 ID: ${brain_id}):`, error);
            throw error;
        });