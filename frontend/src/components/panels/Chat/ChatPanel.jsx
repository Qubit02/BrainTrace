// React 및 필요한 모듈 import
import React, { useState, useEffect, useRef } from 'react';
import './ChatPanel.css';
import {
  getBrain,
  getReferencedNodes,
  getSourceIdsByNodeName,
  getChatMessageById,
  requestAnswer
} from '../../../../../frontend/api/backend'

import { PiGraph } from "react-icons/pi";
import { IoCopyOutline } from "react-icons/io5";
import { MdSource } from "react-icons/md";

import { fetchChatHistoryByBrain, deleteAllChatsByBrain, saveChatToBrain } from '../../../../api/chat';
import { getSourceCountByBrain } from '../../../../api/graphApi';
import ConfirmDialog from '../../common/ConfirmDialog';
import { TbSourceCode } from "react-icons/tb";
import { VscOpenPreview } from "react-icons/vsc";

// === 채팅 내역 불러오기 함수 ===
async function fetchChatHistory(brainId) {
  try {
    return await fetchChatHistoryByBrain(brainId);
  } catch (e) {
    console.error(e);
    return [];
  }
}

function ChatPanel({
  selectedBrainId,
  onReferencedNodesUpdate,
  onOpenSource,
  onChatReady,
  sourceCountRefreshTrigger
}) {

  const [brainName, setBrainName] = useState(''); // 브레인 이름
  const [inputText, setInputText] = useState(''); // 입력창 텍스트
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태
  const messagesEndRef = useRef(null); // 메시지 끝 ref (스크롤)
  const [openSourceNodes, setOpenSourceNodes] = useState({}); // 노드별 출처 열림 상태
  const [showConfirm, setShowConfirm] = useState(false); // 대화 초기화 확인창
  const [chatHistory, setChatHistory] = useState([]); // DB 기반 채팅 내역
  const [sourceCount, setSourceCount] = useState(0); // 소스 개수 상태

  // selectedBrainId 변경 시 소스 개수 fetch
  useEffect(() => {
    if (!selectedBrainId) return;
    getSourceCountByBrain(selectedBrainId)
      .then(res => setSourceCount(res.total_count ?? 0))
      .catch(() => setSourceCount(0));
  }, [selectedBrainId, sourceCountRefreshTrigger]);

  // ===== 브레인 이름 불러오기 (프로젝트 변경 시) =====
  useEffect(() => {
    if (!selectedBrainId) return;
    getBrain(selectedBrainId)
      .then((data) => setBrainName(data.brain_name))
      .catch((err) => {
        console.error('🛑 brain_name 불러오기 실패:', err);
        setBrainName(`프로젝트 #${selectedBrainId}`);
      });
  }, [selectedBrainId]);

  // ===== 채팅 내역 불러오기 (프로젝트 변경 시) =====
  useEffect(() => {
    if (!selectedBrainId) return;
    fetchChatHistory(selectedBrainId)
      .then(history => {
        setChatHistory(history);
        if (onChatReady) onChatReady(true);
      })
      .catch(() => {
        if (onChatReady) onChatReady(false);
      });
  }, [selectedBrainId]);

  // ===== 스크롤을 맨 아래로 내리는 함수 =====
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // ===== 메시지 전송 핸들러 =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('submit 시도', { inputText, isLoading });
    if (!inputText.trim() || isLoading) {
      console.log('버튼 비활성화 조건', { inputText, isLoading });
      return;
    }
    setIsLoading(true);

    // 1. 질문을 optimistic하게 바로 추가
    const tempQuestion = {
      chat_id: Date.now(),
      is_ai: false,
      message: inputText,
      referenced_nodes: []
    };
    setChatHistory(prev => [...prev, tempQuestion]);
    // 입력창 즉시 비우기
    setInputText('');
    // DB에 질문 저장 (is_ai=0)
    saveChatToBrain(selectedBrainId, { is_ai: 0, message: inputText, referenced_nodes: [] })
      .catch(err => console.error('질문 DB 저장 실패:', err));

    try {
      // 2. 답변 요청 및 DB 저장
      const res = await requestAnswer(inputText, selectedBrainId.toString(), "gpt");
      console.log('requestAnswer 응답:', res);
      // 3. 답변을 바로 추가
      const tempAnswer = {
        chat_id: res?.chat_id || Date.now() + 1,
        is_ai: true,
        message: res?.answer,
        referenced_nodes: res?.referenced_nodes || []
      };
      setChatHistory(prev => [...prev, tempAnswer]);
      // === 답변에 referenced_nodes가 있으면 콜백 호출 ===
      if (res?.referenced_nodes && res.referenced_nodes.length > 0 && typeof onReferencedNodesUpdate === 'function') {
        onReferencedNodesUpdate(res.referenced_nodes);
      }
      // DB에 답변 저장 (is_ai=1)
      saveChatToBrain(selectedBrainId, {
        is_ai: 1,
        message: res?.answer,
        referenced_nodes: res?.referenced_nodes || []
      }).catch(err => console.error('답변 DB 저장 실패:', err));
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
      await deleteAllChatsByBrain(selectedBrainId);
      // 삭제 후 최신 내역 다시 불러오기
      const updated = await fetchChatHistory(selectedBrainId);
      setChatHistory(updated);
    } catch (e) {
      alert('대화 삭제 중 오류가 발생했습니다.');
      console.error(e);
    } finally {
      setShowConfirm(false);
    }
  };

  // ===== 출처(소스) 토글 함수 =====
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
        const res = await getSourceIdsByNodeName(nodeName, selectedBrainId);
        setOpenSourceNodes((prev) => ({
          ...prev,
          [key]: res.sources,
        }));
      } catch (err) {
        setOpenSourceNodes((prev) => ({ ...prev, [key]: [] }));
      }
    }
  };

  const hasChatStarted = chatHistory.length > 0;
  return (
    <div className="panel-container">
      {/* 헤더는 항상 렌더링 */}
      <div className="panel-header chat-header-custom">
        <span className="header-title">Chat</span>
        <div className="header-actions">
          {hasChatStarted && (
            <button
              className="chat-refresh-btn"
              onClick={() => setShowConfirm(true)}
              title="대화 초기화"
            >
              새로 고침
            </button>
          )}
        </div>
      </div>
      {/* 채팅 내역 분기 */}
      {hasChatStarted ? (
        <div className="panel-content chat-content">
          <div className="chat-title-container"></div>
          {/* 메시지 목록 영역 */}
          <div className="chat-messages">
            {chatHistory.map((m, i) => (
              <div
                key={m.chat_id}
                className={`message-wrapper ${m.is_ai ? 'bot-message' : 'user-message'}`}
              >
                <div className="message">
                  {/* 메시지 본문 및 참고 노드/출처 표시 */}

                  <div className="message-body">
                    {m.message.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      const isReferenced = trimmed.startsWith('-');
                      const nodeName = isReferenced ? trimmed.replace(/^-	*/, '').trim() : trimmed.trim();
                      return (
                        <div key={idx} className="referenced-line">
                          {isReferenced ? (
                            <div className="referenced-block">
                              <div className="referenced-header">
                                <span style={{ color: 'inherit' }}>-</span>
                                <span
                                  className="referenced-node-text"
                                  onClick={() => {
                                    console.log('클릭됨:', nodeName);
                                    if (typeof onReferencedNodesUpdate === 'function') {
                                      onReferencedNodesUpdate([nodeName]);
                                    }
                                  }}
                                >
                                  {nodeName}
                                </span>
                                <button
                                  className={`modern-source-btn${openSourceNodes[`${m.chat_id}_${nodeName}`] ? ' active' : ''}`}
                                  onClick={() => toggleSourceList(m.chat_id, nodeName)}
                                  style={{ marginLeft: '6px' }}
                                >
                                  <VscOpenPreview size={15} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                                  <span>출처보기</span>
                                </button>
                              </div>
                              {/* 출처 목록 표시 */}
                              {openSourceNodes[`${m.chat_id}_${nodeName}`] && (
                                <ul className="source-title-list">
                                  {openSourceNodes[`${m.chat_id}_${nodeName}`].map((source, sourceIndex) => (
                                    <li key={sourceIndex} className="source-title-item">
                                      <span
                                        className="source-title-content"
                                        onClick={() => onOpenSource(source.id)}
                                      >
                                        {source.source_title || source.title || `소스 ${source.id}`}
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
                  <div className="message-actions">
                    <button
                      className="copy-button"
                      title="복사"
                      onClick={async () => {
                        try {
                          // chat_id가 있으면 서버에서 message를 받아서 복사
                          if (m.chat_id) {
                            const message = await getChatMessageById(m.chat_id);
                            console.log('message:', message);
                            await navigator.clipboard.writeText(message);
                          } else {
                            // fallback: 현재 메시지 그대로 복사
                            await navigator.clipboard.writeText(m.message);
                          }
                        } catch (err) {
                          console.error('복사 실패:', err);
                        }
                      }}
                    >
                      <IoCopyOutline size={18} />
                    </button>
                    {/* bot 메시지에만 그래프 버튼 표시 */}
                    {m.is_ai && (
                      <button
                        className="graph-button"
                        title="그래프 보기"
                        onClick={async () => {
                          if (!m.chat_id) return;
                          try {
                            const res = await getReferencedNodes(m.chat_id);
                            if (res.referenced_nodes && res.referenced_nodes.length > 0) {
                              onReferencedNodesUpdate(res.referenced_nodes);
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
              <div className="message-wrapper bot-message">
                <div className="message">
                  <div className="thinking-indicator">
                    <span>생각하는 중</span>
                    <div className="thinking-dots">
                      <div className="thinking-dot" />
                      <div className="thinking-dot" />
                      <div className="thinking-dot" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* 입력창 및 전송 버튼 */}
          <form className="chat-controls" onSubmit={handleSubmit}>
            <div className="input-with-button">
              <textarea
                className="chat-input"
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
              <div className="source-count-text">소스 {sourceCount}개</div>
              <button
                type="submit"
                className="submit-circle-button"
                aria-label="메시지 전송"
                disabled={!inputText.trim() || isLoading}
              >
                {isLoading ? (
                  <span className="stop-icon">■</span>
                ) : (
                  <span className="send-icon">➤</span>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        // 대화가 시작되지 않은 경우 안내 및 입력창
        <div className="panel-content empty-chat-content">
          <div className="chat-title-container">
            <div className="chat-title-display">
              <span
                className="header-title"
                style={{ fontSize: '23px', fontWeight: '600', marginLeft: '21px' }}
              >
                {brainName}
              </span>
            </div>
          </div>
          <div className="centered-input-container">
            <div className="hero-section">
              <h1 className="hero-title">당신의 세컨드 브레인을 추적해보세요.</h1>
            </div>
            <form className="input-wrapper" onSubmit={handleSubmit}>
              <div className="input-with-button rounded">
                <textarea
                  className="chat-input"
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
                <div className="source-count-text">소스 {sourceCount}개</div>
                <button
                  type="submit"
                  className="submit-circle-button"
                  aria-label="메시지 전송"
                >
                  <span className="send-icon">➤</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 안내 문구 */}
      <p className="chat-disclaimer">
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

// 컴포넌트 export
export default ChatPanel;
