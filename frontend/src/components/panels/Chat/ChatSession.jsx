import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ChatSession.css';
import {
  fetchChatSessions,
  fetchChatSessionsByBrain,
  createChatSession,
  deleteChatSession,
  renameChatSession
} from '../../../../api/services/chatApi';
import ChatPanel from './ChatPanel';
import { PiChatsCircle } from "react-icons/pi";
import { RiDeleteBinLine } from 'react-icons/ri';
import { GoPencil } from 'react-icons/go';
import ConfirmDialog from '../../common/ConfirmDialog';

function ChatSession({
  selectedBrainId,
  onSessionSelect,
  onChatReady
}) {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isEditingId, setIsEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [newlyCreatedSessionId, setNewlyCreatedSessionId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const menuRef = useRef(null);

  // 세션 리스트 불러오기
  const loadSessions = async () => {
    if (!selectedBrainId) {
      setSessions([]);
      if (onChatReady) onChatReady(true);
      return;
    }
    
    setLoading(true);
    try {
      const data = await fetchChatSessionsByBrain(selectedBrainId);
      setSessions(data);
      if (onChatReady) onChatReady(true);
    } catch (e) {
      setSessions([]);
      if (onChatReady) onChatReady(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [selectedBrainId]);

  // 날짜 포맷팅 함수
  const formatDate = timestamp => {
    if (!timestamp) return '';
    
    let date;
    if (typeof timestamp === 'string') {
      // SQLite DATETIME 문자열 형태 (예: "2024-01-15 10:30:45")
      date = new Date(timestamp);
    } else {
      // 숫자 타임스탬프
      date = new Date(Number(timestamp));
    }
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 메뉴 토글
  const toggleMenu = (sessionId, event) => {
    if (openMenuId === sessionId) {
      setOpenMenuId(null);
    } else {
      // 메뉴 버튼의 위치 계산
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 160 // 메뉴 너비만큼 왼쪽으로
      });
      setOpenMenuId(sessionId);
    }
  };

  // 세션 생성
  const handleCreateSession = async () => {
    // 디바운싱: 1초 내 중복 클릭 방지
    const now = Date.now();
    if (now - lastClickTime < 1000) {
      return;
    }
    setLastClickTime(now);

    if (creating || !selectedBrainId) return;
    setCreating(true);
    try {
      const result = await createChatSession('Untitled', selectedBrainId);
      
      // 새로 생성된 세션을 임시로 리스트에 추가 (undefined 제목으로)
      const tempSession = {
        session_id: result.session_id,
        session_name: 'Untitled',
        created_at: Date.now(),
        brain_id: selectedBrainId
      };
      setSessions(prev => [tempSession, ...prev]);
      setNewlyCreatedSessionId(result.session_id);
      
      // 2초 후 깜빡임 효과 제거하고 실제 데이터로 업데이트
      setTimeout(async () => {
        setNewlyCreatedSessionId(null);
        await loadSessions(); // 실제 데이터로 새로고침
      }, 2000);
      
      // 1.5초 후 ChatPanel로 이동 (깜빡임 효과를 보여주기 위해)
      setTimeout(() => {
        if (onSessionSelect) {
          onSessionSelect(result.session_id, { 
            isNewSession: true,
            sessionInfo: tempSession
          });
        }
      }, 1500);
      
    } catch (error) {
      console.error('채팅방 생성 실패:', error);
      alert('채팅방 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  // 세션 삭제 확인 다이얼로그 표시
  const handleDeleteSession = (session_id) => {
    setSessionToDelete(session_id);
    setShowDeleteConfirm(true);
    setOpenMenuId(null);
  };

  // 세션 삭제 실행
  const executeDeleteSession = async () => {
    if (!sessionToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteChatSession(sessionToDelete);
      if (selectedSession === sessionToDelete) setSelectedSession(null);
      await loadSessions();
    } catch (error) {
      console.error('채팅방 삭제 실패:', error);
      alert('채팅방 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setSessionToDelete(null);
    }
  };

  // 세션 이름 수정 시작
  const handleEditStart = (session) => {
    setIsEditingId(session.session_id);
    setEditingTitle(session.session_name || 'Untitled');
    setOpenMenuId(null);
  };

  // 세션 이름 수정 완료
  const handleEditFinish = async () => {
    if (editingTitle.trim() && isEditingId) {
      try {
        await renameChatSession(isEditingId, editingTitle.trim());
        await loadSessions(); // 세션 리스트 새로고침
        console.log('세션 이름 수정 완료:', isEditingId, editingTitle.trim());
      } catch (error) {
        console.error('세션 이름 수정 실패:', error);
        alert('세션 이름 수정에 실패했습니다.');
      }
    }
    setIsEditingId(null);
    setEditingTitle('');
  };

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      const isInsideMenuButton = event.target.closest('.chat-session-menu-button');
      const isInsideDropdown = event.target.closest('.chat-session-dropdown-menu');

      if (!isInsideMenuButton && !isInsideDropdown) {
        setOpenMenuId(null);
      }
    };

    // Portal로 렌더링된 메뉴가 있을 때만 이벤트 리스너 추가
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openMenuId]);

  return (
    <div className="chat-session-panel-container">
      <div className="chat-session-panel-header">
        <span className="chat-session-header-title">Chat</span>
      </div>

      <div className="chat-session-sidebar-header">
        <h2>채팅 목록</h2>
        <button 
          onClick={handleCreateSession} 
          disabled={creating || !selectedBrainId}
          className="chat-session-new-chat-button"
        >
          {creating ? '생성 중...' : '+ 새 채팅'}
        </button>
      </div>

      <ul className="chat-session-list">
        {loading ? (
          <li className="chat-session-loading-item">불러오는 중...</li>
        ) : sessions.length === 0 ? (
          <li className="chat-session-empty-item">
            <div className="chat-session-empty-content">
              <div className="chat-session-empty-icon">💬</div>
              <div className="chat-session-empty-title">첫 번째 대화를 시작해보세요</div>
              <div className="chat-session-empty-description">
                새로운 아이디어를 탐색하고 질문에 답변을 받아보세요
              </div>
            </div>
          </li>
        ) : (
          [...sessions]
            .sort((a, b) => Number(b.session_id) - Number(a.session_id)) // 가장 최신 순으로 정렬
            .map(session => (
              <li
                key={session.session_id}
                className={`chat-session-item 
                  ${session.session_id === selectedSession ? 'active' : ''} 
                  ${session.session_id === newlyCreatedSessionId ? 'blinking' : ''}`}
                onClick={() => {
                  setSelectedSession(session.session_id);
                  if (onSessionSelect) {
                    onSessionSelect(session.session_id);
                  }
                }}
              >
                {isEditingId === session.session_id ? (
                  <input
                    className="chat-session-edit-input"
                    value={editingTitle}
                    autoFocus
                    onChange={e => setEditingTitle(e.target.value)}
                    onBlur={handleEditFinish}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleEditFinish();
                      if (e.key === 'Escape') {
                        setIsEditingId(null);
                        setEditingTitle('');
                      }
                    }}
                  />
                ) : (
                  <div className="chat-session-text-block">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <PiChatsCircle size={17} color="#999" style={{ marginRight: 7 }} />
                      <span className={`chat-session-title ${session.session_name === undefined ? 'undefined' : ''}`}>
                        {session.session_name !== undefined ? session.session_name : 'Untitled'}
                      </span>
                    </div>
                    <span className="chat-session-date">{formatDate(session.created_at)}</span>
                  </div>
                )}

                <div className="chat-session-menu-wrapper" ref={menuRef} onClick={(e) => e.stopPropagation()}>
                  <button 
                    className="chat-session-menu-button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenu(session.session_id, e);
                    }}
                  >
                    ⋯
                  </button>
                </div>
              </li>
            ))
        )}
      </ul>

      {/* Portal로 렌더링되는 메뉴 */}
      {openMenuId && createPortal(
        <div 
          className="chat-session-dropdown-menu" 
          style={{ 
            position: 'fixed', 
            top: menuPosition.top, 
            left: menuPosition.left,
            zIndex: 999999 
          }}
        >
          <div className="chat-session-popup-item" onClick={() => handleEditStart(sessions.find(s => s.session_id === openMenuId))}>
            <GoPencil size={15} style={{ marginRight: 6 }} />
            채팅 이름 바꾸기
          </div>
          <div className="chat-session-popup-item" onClick={() => handleDeleteSession(openMenuId)}>
            <RiDeleteBinLine size={15} style={{ marginRight: 6 }} />
            채팅 삭제
          </div>
        </div>,
        document.body
      )}

      {/* 안내 문구 */}
      <p className="chat-session-disclaimer">
        BrainTrace는 학습된 정보 기반으로 응답하며, 실제와 다를 수 있습니다.
      </p>

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteConfirm && (
        <ConfirmDialog
          message="이 채팅방을 삭제하시겠습니까?"
          onOk={executeDeleteSession}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setSessionToDelete(null);
          }}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}

export default ChatSession; 