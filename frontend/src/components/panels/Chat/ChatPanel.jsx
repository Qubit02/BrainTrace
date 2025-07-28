// React 및 필요한 모듈 import
import React, { useState, useEffect, useRef } from 'react';
import './ChatPanel.css';
import {
  getReferencedNodes,
  getNodeSourcesByChat,
  getChatMessageById,
  renameChatSession,
  fetchChatSession
} from '../../../../api/chat';
import { PiGraph } from "react-icons/pi";
import { IoCopyOutline } from "react-icons/io5";
import { IoCheckmarkOutline } from "react-icons/io5";
import ConfirmDialog from '../../common/ConfirmDialog';
import { VscOpenPreview } from "react-icons/vsc";
import { fetchChatHistoryBySession, deleteAllChatsBySession } from '../../../../api/chat';
import { requestAnswer, getSourceCountByBrain } from '../../../../api/graphApi';
import { GoPencil } from 'react-icons/go';
import { HiOutlineBars4 } from "react-icons/hi2";
import { WiCloudRefresh } from "react-icons/wi";

function ChatPanel({
  selectedSessionId,
  selectedBrainId,
  onReferencedNodesUpdate,
  onOpenSource,
  onChatReady,
  sourceCountRefreshTrigger,
  onBackToList,
  sessionInfo
}) {

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [openSourceNodes, setOpenSourceNodes] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [sessionName, setSessionName] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // ===== 초기 로딩 화면 (채팅 내역 로드 후 0.5초) =====
  useEffect(() => {
    if (!selectedSessionId) {
      setIsInitialLoading(false);
      return;
    }

    const loadChatHistory = async () => {
      try {
        const history = await fetchChatHistoryBySession(selectedSessionId);
        setChatHistory(history);
        if (onChatReady) onChatReady(true);
        
        // 채팅 내역 로드 후 0.5초 더 대기
        setTimeout(() => {
          setIsInitialLoading(false);
        }, 500);
      } catch (error) {
        console.error('채팅 내역 로드 실패:', error);
        if (onChatReady) onChatReady(false);
        
        // 에러가 발생해도 0.5초 후 로딩 종료
        setTimeout(() => {
          setIsInitialLoading(false);
        }, 500);
      }
    };

    loadChatHistory();
  }, [selectedSessionId, onChatReady]);

  // ===== 소스 개수 및 브레인 이름 불러오기 =====
  useEffect(() => {
    if (!selectedBrainId) return;
    getSourceCountByBrain(selectedBrainId)
      .then(res => setSourceCount(res.total_count ?? 0))
      .catch(() => setSourceCount(0));
    // 브레인 이름 불러오기 (필요시)
    // getBrain(selectedBrainId).then(data => setBrainName(data.brain_name)).catch(() => setBrainName(`프로젝트 #${selectedBrainId}`));
  }, [selectedBrainId, sourceCountRefreshTrigger]);

  // ===== 세션 정보 불러오기 =====
  useEffect(() => {
    if (sessionInfo) {
      setSessionName(sessionInfo.session_name !== undefined ? sessionInfo.session_name : 'Untitled');
    } else if (selectedSessionId) {
      // 기존 세션인 경우에만 fetch
      fetchChatSession(selectedSessionId)
        .then(session => {
          setSessionName(session.session_name !== undefined ? session.session_name : 'Untitled');
        })
        .catch(() => {
          setSessionName('Untitled');
        });
    }
  }, [sessionInfo, selectedSessionId]);

  // ===== 새 세션이면 자동으로 제목 편집 모드 활성화 =====
  useEffect(() => {
    if (sessionInfo?.isNewSession && selectedSessionId) {
      setIsEditingTitle(true);
      setEditingTitle('Untitled');
    }
  }, [sessionInfo?.isNewSession, selectedSessionId]);

  // ===== 스크롤을 맨 아래로 내리는 함수 =====
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // ===== 제목 편집 시작 =====
  const handleEditTitleStart = () => {
    setIsEditingTitle(true);
    setEditingTitle(sessionName !== undefined ? sessionName : 'Untitled');
  };

  // ===== 제목 편집 완료 =====
  const handleEditTitleFinish = async () => {
    if (editingTitle.trim() && selectedSessionId) {
      try {
        await renameChatSession(selectedSessionId, editingTitle.trim());
        setSessionName(editingTitle.trim());
        console.log('세션 이름 수정 완료:', selectedSessionId, editingTitle.trim());
      } catch (error) {
        console.error('세션 이름 수정 실패:', error);
        alert('세션 이름 수정에 실패했습니다.');
      }
    }
    setIsEditingTitle(false);
    setEditingTitle('');
  };

  // ===== 메시지 전송 핸들러 (임시, 실제 답변 저장/생성 로직 필요) =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    setIsLoading(true);
    // 1. 질문을 optimistic하게 바로 추가
    const tempQuestion = {
      chat_id: Date.now(),
      is_ai: false,
      message: inputText,
      referenced_nodes: []
    };
    setChatHistory(prev => [...prev, tempQuestion]);
    setInputText('');

    try {
      // === sessionId로 답변 요청 ===
      const res = await requestAnswer(inputText, selectedSessionId, selectedBrainId, "gpt");
      // 답변 처리 로직 (기존과 동일)
      const hasRealAnswer = res?.answer && res.answer.trim() !== '';
      const hasGuideMessage = res?.message && res.message.trim() !== '';
      if (!hasRealAnswer && !hasGuideMessage) return;
      if (hasRealAnswer) {
        const tempAnswer = {
          chat_id: res?.chat_id || Date.now() + 1,
          is_ai: true,
          message: res?.answer,
          referenced_nodes: res?.referenced_nodes || []
        };
        setChatHistory(prev => [...prev, tempAnswer]);
      }
      // 5. 안내 메시지가 있으면 추가
      if (hasGuideMessage) {
        setChatHistory(prev => [
          ...prev,
          {
            chat_id: res.chat_id || Date.now() + 2,
            is_ai: true,
            message: res.message,
            referenced_nodes: []
          }
        ]);
      }
      // === 답변에 referenced_nodes가 있으면 콜백 호출 ===
      if (res?.referenced_nodes && res.referenced_nodes.length > 0 && typeof onReferencedNodesUpdate === 'function') {
        const nodeNames = res.referenced_nodes.map(n => n.name);
        onReferencedNodesUpdate(nodeNames);
      }
    } catch (err) {
      alert('답변 생성 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== 대화 초기화 핸들러 =====
  const handleClearChat = async () => {
    try {
      await deleteAllChatsBySession(selectedSessionId);
      const updated = await fetchChatHistoryBySession(selectedSessionId);
      setChatHistory(updated);
    } catch (e) {
      alert('대화 삭제 중 오류가 발생했습니다.');
      console.error(e);
    } finally {
      setShowConfirm(false);
    }
  };

  // ===== 출처(소스) 토글 함수 (API 호출 방식, title+id 저장) =====
  const toggleSourceList = async (chatId, nodeName) => {
    const key = `${chatId}_${nodeName}`;
    if (openSourceNodes[key]) {
      setOpenSourceNodes((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    } else {
      try {
        const res = await getNodeSourcesByChat(chatId, nodeName);
        setOpenSourceNodes((prev) => ({
          ...prev,
          [key]: (res.titles || []).map((title, idx) => ({ title, id: (res.ids && res.ids[idx]) || null })),
        }));
      } catch (err) {
        setOpenSourceNodes((prev) => ({ ...prev, [key]: [] }));
      }
    }
  };

  // ===== 메시지 복사 핸들러 =====
  const handleCopyMessage = async (m) => {
    try {
      let messageToCopy = m.message;
      if (m.chat_id) {
        const serverMessage = await getChatMessageById(m.chat_id);
        if (serverMessage) messageToCopy = serverMessage;
      }
      await navigator.clipboard.writeText(messageToCopy);
      setCopiedMessageId(m.chat_id || m.message);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  const hasChatStarted = chatHistory.length > 0;
  return (
    <div className="panel-container">
      <div className="chat-panel-header-custom">
        <div className="chat-panel-header-left">
          <span className="header-title">Chat</span>
        </div>
        <div className="chat-panel-header-actions">
          <button
            className="chat-panel-menu-btn"
            onClick={onBackToList}
            title="메뉴"
          >
            <HiOutlineBars4 size={22} color="#303030ff" />
          </button>
        </div>
      </div>
      {isInitialLoading ? (
        <div className="chat-panel-initial-loading">
          <div className="chat-panel-thinking-indicator">
            <span>데이터를 불러오는 중...</span>
            <div className="chat-panel-thinking-dots">
              <div className="chat-panel-thinking-dot" />
              <div className="chat-panel-thinking-dot" />
              <div className="chat-panel-thinking-dot" />
            </div>
          </div>
        </div>
      ) : hasChatStarted ? (
        <div className="chat-panel-content">
          <div className="chat-panel-title-container">
            {isEditingTitle ? (
              <div className="chat-panel-title-edit">
                <input
                  className="chat-panel-title-input"
                  value={editingTitle}
                  autoFocus
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleEditTitleFinish}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditTitleFinish();
                    if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                      setEditingTitle('');
                    }
                  }}
                />
              </div>
            ) : (
              <div className="chat-panel-title-display">
                <div className="chat-panel-title-left">
                  <span
                    className="chat-panel-header-title clickable"
                    style={{ fontSize: '23px', fontWeight: '600', marginLeft: '21px', cursor: 'pointer' }}
                    onClick={handleEditTitleStart}
                    title="클릭하여 제목 편집"
                  >
                    {sessionName || 'Untitled'}
                  </span>
                  <button
                    className="chat-panel-edit-title-btn"
                    onClick={handleEditTitleStart}
                    title="제목 편집"
                  >
                    <GoPencil size={16} />
                  </button>
                </div>
                {hasChatStarted && (
                  <button
                    className="chat-panel-refresh-btn"
                    onClick={() => setShowConfirm(true)}
                    title="대화 초기화"
                  >
                    <WiCloudRefresh size={30} />
                  </button>
                )}
              </div>
            )}
          </div>
          {/* 메시지 목록 영역 */}
          <div className="chat-panel-messages">
            {chatHistory.map((m, i) => (
              <div
                key={m.chat_id}
                className={`chat-panel-message-wrapper ${m.is_ai ? 'chat-panel-bot-message' : 'chat-panel-user-message'}`}
              >
                <div className="chat-panel-message">
                  {/* 메시지 본문 및 참고 노드/출처 표시 */}

                  <div className="chat-panel-message-body">
                    {m.message.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      const isReferenced = trimmed.startsWith('-');
                      const nodeName = isReferenced ? trimmed.replace(/^-\t*/, '').trim() : trimmed.trim();
                      return (
                        <div key={idx} className="chat-panel-referenced-line">
                          {isReferenced ? (
                            <div className="chat-panel-referenced-block">
                              <div className="chat-panel-referenced-header">
                                <span style={{ color: 'inherit' }}>-</span>
                                <span
                                  className="chat-panel-referenced-node-text"
                                  onClick={() => {
                                    if (typeof onReferencedNodesUpdate === 'function') {
                                      onReferencedNodesUpdate([nodeName]);
                                    }
                                  }}
                                >
                                  {nodeName}
                                </span>
                                <button
                                  className={`chat-panel-modern-source-btn${openSourceNodes[`${m.chat_id}_${nodeName}`] ? ' active' : ''}`}
                                  onClick={() => toggleSourceList(m.chat_id, nodeName)}
                                  style={{ marginLeft: '6px' }}
                                >
                                  <VscOpenPreview size={15} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                                  <span>출처보기</span>
                                </button>
                              </div>
                              {/* 출처 목록 표시 */}
                              {openSourceNodes[`${m.chat_id}_${nodeName}`] && (
                                <ul className="chat-panel-source-title-list">
                                  {openSourceNodes[`${m.chat_id}_${nodeName}`].map((item, sourceIndex) => (
                                    <li key={sourceIndex} className="chat-panel-source-title-item">
                                      <span
                                        className="chat-panel-source-title-content"
                                        onClick={() => {
                                          console.log('소스 title 클릭:', item.title, 'id:', item.id);
                                          if (item.id) onOpenSource(item.id);
                                        }}
                                        style={{ cursor: item.id ? 'pointer' : 'default' }}
                                      >
                                        {item.title}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : (
                            trimmed
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* 메시지 액션(복사, 그래프) 버튼 */}
                  <div className="chat-panel-message-actions">
                    <button
                      className="chat-panel-copy-button"
                      title="복사"
                      onClick={() => handleCopyMessage(m)}
                    >
                      {copiedMessageId === (m.chat_id || m.message) ? (
                        <IoCheckmarkOutline size={18} color="#303030ff" />
                      ) : (
                        <IoCopyOutline size={18} />
                      )}
                    </button>
                    {/* bot 메시지에만 그래프 버튼 표시 */}
                    {m.is_ai && (
                      <button
                        className="chat-panel-graph-button"
                        title="그래프 보기"
                        onClick={async () => {
                          if (!m.chat_id) return;
                          try {
                            const res = await getReferencedNodes(m.chat_id);
                            if (res.referenced_nodes && res.referenced_nodes.length > 0) {
                              const nodeNames = res.referenced_nodes.map(n => n.name ?? n);
                              onReferencedNodesUpdate(nodeNames);
                            }
                          } catch (err) {
                            console.error('❌ 참고 노드 불러오기 실패:', err);
                          }
                        }}
                      >
                        <PiGraph size={19} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-panel-message-wrapper chat-panel-bot-message">
                <div className="chat-panel-message">
                  <div className="chat-panel-thinking-indicator">
                    <span>생각하는 중</span>
                    <div className="chat-panel-thinking-dots">
                      <div className="chat-panel-thinking-dot" />
                      <div className="chat-panel-thinking-dot" />
                      <div className="chat-panel-thinking-dot" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* 입력창 및 전송 버튼 */}
          <form className="chat-controls" onSubmit={handleSubmit}>
            <div className="chat-panel-input-with-button">
              <textarea
                className="chat-panel-input"
                placeholder="무엇이든 물어보세요"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim() && !isLoading) {
                      handleSubmit(e);
                    }
                  }
                }}
                disabled={isLoading}
              />
              <div className="chat-panel-source-count-text">소스 {sourceCount}개</div>
              <button
                type="submit"
                className="chat-panel-submit-circle-button"
                aria-label="메시지 전송"
                disabled={!inputText.trim() || isLoading}
              >
                {isLoading ? (
                  <span className="chat-panel-stop-icon">■</span>
                ) : (
                  <span className="chat-panel-send-icon">➤</span>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        // 대화가 시작되지 않은 경우 안내 및 입력창
        <div className="chat-panel-empty-content">
          <div className="chat-panel-title-container">
            {isEditingTitle ? (
              <div className="chat-panel-title-edit">
                <input
                  className="chat-panel-title-input"
                  value={editingTitle}
                  autoFocus
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleEditTitleFinish}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditTitleFinish();
                    if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                      setEditingTitle('');
                    }
                  }}
                />
              </div>
            ) : (
              <div className="chat-panel-title-display">
                <div className="chat-panel-title-left">
                  <span
                    className="chat-panel-header-title clickable"
                    style={{ fontSize: '23px', fontWeight: '600', marginLeft: '21px', cursor: 'pointer' }}
                    onClick={handleEditTitleStart}
                    title="클릭하여 제목 편집"
                  >
                    {sessionName || 'Untitled'}
                  </span>
                  <button
                    className="chat-panel-edit-title-btn"
                    onClick={handleEditTitleStart}
                    title="제목 편집"
                  >
                    <GoPencil size={16} />
                  </button>
                </div>
                {hasChatStarted && (
                  <button
                    className="chat-panel-refresh-btn"
                    onClick={() => setShowConfirm(true)}
                    title="대화 초기화"
                  >
                    <WiCloudRefresh size={20} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="chat-panel-centered-input-container">
            <div className="chat-panel-hero-section">
              <h1 className="chat-panel-hero-title">당신의 세컨드 브레인을 추적해보세요.</h1>
            </div>
            <form className="chat-panel-input-wrapper" onSubmit={handleSubmit}>
              <div className="chat-panel-input-with-button rounded">
                <textarea
                  className="chat-panel-input"
                  placeholder="무엇이든 물어보세요"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (inputText.trim() && !isLoading) {
                        handleSubmit(e);
                      }
                    }
                  }}
                />
                <div className="chat-panel-source-count-text">소스 {sourceCount}개</div>
                <button
                  type="submit"
                  className="chat-panel-submit-circle-button"
                  aria-label="메시지 전송"
                >
                  <span className="chat-panel-send-icon">➤</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 안내 문구 */}
      <p className="chat-panel-disclaimer">
        BrainTrace는 학습된 정보 기반으로 응답하며, 실제와 다를 수 있습니다.
      </p>
      {/* 대화 초기화 확인 다이얼로그 */}
      {showConfirm && (
        <ConfirmDialog
          message="채팅 기록을 모두 삭제하시겠습니까?"
          onOk={handleClearChat}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

export default ChatPanel;
