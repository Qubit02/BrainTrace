// React 및 필요한 모듈 import
import React, { useState, useEffect, useRef } from 'react';
// 스타일 및 API import
import './styles/ChatPanel.css';
import './styles/Scrollbar.css';
import { requestAnswer } from '../../api/tmpAPI';
import copyIcon from '../../assets/icons/copy.png';
import graphIcon from '../../assets/icons/graph-off.png';
import { getBrain, getReferencedNodes, getSourceIdsByNodeName } from '../../../../backend/api/backend';
import ConfirmDialog from '../ConfirmDialog';

// ChatPanel 컴포넌트 정의
function ChatPanel({
  activeProject,
  onReferencedNodesUpdate,
  sessions,
  setSessions,
  currentSessionId,
  setCurrentSessionId,
  allNodeNames = [],
  onOpenSource,
  sourceCount = 0,
}) {
  // ===== 상태 선언부 =====
  const [brainName, setBrainName] = useState(''); // 브레인 이름
  const [inputText, setInputText] = useState(''); // 입력창 텍스트
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태
  const messagesEndRef = useRef(null); // 메시지 끝 ref (스크롤)
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState(null); // hover된 메시지 인덱스
  const [hoveredChatId, setHoveredChatId] = useState(null); // hover된 메시지의 chatId
  const [openSourceNodes, setOpenSourceNodes] = useState({}) // 노드별 출처 열림 상태
  const [showConfirm, setShowConfirm] = useState(false); // 대화 초기화 확인창

  // ===== 대화 초기화 핸들러 =====
  const handleClearChat = () => {
    setSessions([]);
    setCurrentSessionId(null);
    localStorage.removeItem(`sessions-${activeProject}`);
    setShowConfirm(false);
  };

  // ===== 스크롤을 맨 아래로 내리는 함수 =====
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ===== 출처(소스) 토글 함수 =====
  const toggleSourceList = async (nodeName) => {
    if (openSourceNodes[nodeName]) {
      // 이미 열려있으면 닫기
      setOpenSourceNodes(prev => {
        const copy = { ...prev };
        delete copy[nodeName];
        return copy;
      });
    } else {
      // 닫혀있으면 열기 (API로 소스 목록 조회)
      try {
        const res = await getSourceIdsByNodeName(nodeName, activeProject);
        setOpenSourceNodes(prev => ({
          ...prev,
          [nodeName]: res.sources
        }));
      } catch (err) {
        console.error('소스 조회 실패:', err);
      }
    }
  };

  // ===== 브레인 이름 불러오기 (프로젝트 변경 시) =====
  useEffect(() => {
    if (!activeProject) return;
    getBrain(activeProject)
      .then(data => setBrainName(data.brain_name))
      .catch(err => {
        console.error('🛑 brain_name 불러오기 실패:', err);
        setBrainName(`프로젝트 #${activeProject}`);
      });
  }, [activeProject]);

  // ===== 메시지 추가 시 자동 스크롤 =====
  useEffect(scrollToBottom, [sessions, currentSessionId]);

  // ===== 새 세션 생성 함수 =====
  const createNewSession = (firstMessageText) => {
    const newId = Date.now().toString();
    const newSession = {
      id: newId,
      title: firstMessageText ? firstMessageText.slice(0, 20) : '새 대화',
      messages: firstMessageText ? [{ text: firstMessageText, isUser: true }] : [],
    };
    const updated = [...sessions, newSession];
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionId(newId);
    localStorage.setItem(`sessions-${activeProject}`, JSON.stringify(updated));
    return newSession;
  };

  // ===== 현재 세션의 메시지 가져오기 =====
  const getCurrentMessages = () => {
    const session = sessions.find(s => s.id === currentSessionId);
    return session ? session.messages : [];
  };

  // ===== 세션 메시지 업데이트 함수 =====
  const updateSessionMessages = (messages) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === currentSessionId ? { ...s, messages } : s
      )
    );
  };

  // ===== 메시지 전송 핸들러 =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage = { text: inputText, isUser: true };

    let newSession = null;
    if (!currentSessionId) {
      newSession = createNewSession(inputText);
    }

    const sessionId = newSession?.id || currentSessionId;
    setCurrentSessionId(sessionId);

    const targetSession = sessions.find(s => s.id === sessionId);
    const newMessages = [...(targetSession?.messages || []), userMessage];
    updateSessionMessages(newMessages);
    setInputText('');

    try {
      // 답변 요청 API 호출
      const response = await requestAnswer(inputText, activeProject.toString());
      const { answer = '', referenced_nodes = [] } = response;
      console.log("answer", answer)
      if (referenced_nodes && onReferencedNodesUpdate) {
        onReferencedNodesUpdate(referenced_nodes);
      }

      const botMessage = {
        text: answer,
        isUser: false,
        referencedNodes: referenced_nodes,
        chatId: response.chat_id
      };
      console.log("📦 botMessage:", botMessage);
      updateSessionMessages([...newMessages, botMessage]);
    } catch (err) {
      console.error(err);
      updateSessionMessages([...newMessages, { text: '죄송합니다. 응답 생성 중 오류가 발생했어요.', isUser: false }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== 엔터키 입력 시 전송 핸들러 =====
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e);
  };

  // ===== 텍스트 복사 함수 =====
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  // ===== 현재 세션 메시지 및 대화 시작 여부 =====
  const messages = getCurrentMessages();
  const hasChatStarted = messages.some(msg => msg.text.trim() !== '');

  // ===== 렌더링 =====
  return (
    <div className="panel-container">
      {/* 헤더 영역 */}
      <div className="panel-header">
        <span className="header-title">Chat</span>
        {hasChatStarted && (
          <button
            className="refresh-button"
            onClick={() => setShowConfirm(true)}
            title="대화 초기화"
            style={{ marginLeft: '10px' }}
          >
            새로 고침
          </button>)}
      </div>

      {/* 대화가 시작된 경우와 아닌 경우 분기 */}
      {hasChatStarted ? (
        <div className="panel-content chat-content">
          <div
            className="chat-title-container"
          >
          </div>

          {/* 메시지 목록 영역 */}
          <div className="chat-messages">
            {messages.map((m, i) => {
              if (!m.text.trim()) return null;

              return (
                <div
                  key={i}
                  className={`message-wrapper ${m.isUser ? 'user-message' : 'bot-message'}`}
                  onMouseEnter={async () => {
                    setHoveredMessageIndex(i);
                    if (!m.isUser && m.chatId) {
                      console.log("🟡 Hover한 메시지 chatId:", m.chatId);
                      setHoveredChatId(m.chatId);  // ✅ 현재 hover된 메시지의 chatId 저장
                    }
                  }}
                  onMouseLeave={() => setHoveredMessageIndex(null)} >

                  <div className="message">
                    {/* 메시지 본문 및 참고 노드/출처 표시 */}
                    <div className="message-body">
                      {m.text.split('\n').map((line, i) => {
                        const trimmed = line.trim();
                        const isReferenced = trimmed.startsWith('-');
                        const cleanWord = isReferenced ? trimmed.replace(/^-	*/, '') : trimmed;

                        return (
                          <div key={i} className="referenced-line">
                            {allNodeNames.includes(cleanWord) && isReferenced ? (
                              <div className="referenced-block">
                                <div className="referenced-header">
                                  <span style={{ color: 'inherit' }}>-</span>
                                  <span
                                    className="referenced-node-text"
                                    onClick={() => {
                                      console.log('📌 클릭한 노드 이름:', cleanWord);
                                      onReferencedNodesUpdate([cleanWord]);
                                    }}
                                  >
                                    {cleanWord}
                                  </span>
                                  <button
                                    className={`source-toggle-button ${openSourceNodes[cleanWord] ? 'active' : ''}`}
                                    onClick={() => toggleSourceList(cleanWord)}
                                    style={{ marginLeft: '3px' }}
                                  >
                                    {openSourceNodes[cleanWord] ? '(출처닫기)' : '(출처보기)'}
                                  </button>
                                </div>

                                {/* 출처 목록 표시 */}
                                {Array.isArray(openSourceNodes[cleanWord]) && openSourceNodes[cleanWord].length > 0 && (
                                  <ul className="source-title-list">
                                    {openSourceNodes[cleanWord].map((src, idx) => (
                                      <li key={idx} className="source-title-item">
                                        <span
                                          className="source-title-content"
                                          onClick={() => onOpenSource(src.id)}
                                        >
                                          {src.title}
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
                      <button className="copy-button" title="복사" onClick={() => copyToClipboard(m.text)}>
                        <img src={copyIcon} alt="복사" className="copy-icon" />
                      </button>

                      {/* bot 메시지에만 그래프 버튼 표시 */}
                      {!m.isUser && hoveredMessageIndex === i && (
                        <button
                          className="graph-button"
                          title="그래프 보기"
                          onClick={async () => {
                            if (!hoveredChatId) return;
                            try {
                              console.log("🟢 그래프 아이콘 클릭됨 - chatId:", hoveredChatId);
                              const res = await getReferencedNodes(hoveredChatId);
                              console.log("🧠 참고된 노드 리스트:", res.referenced_nodes);
                              if (res.referenced_nodes && res.referenced_nodes.length > 0) {
                                onReferencedNodesUpdate(res.referenced_nodes);
                              } else {
                                console.log("❗참고된 노드가 없습니다.");
                              }
                            } catch (err) {
                              console.error("❌ 참고 노드 불러오기 실패:", err);
                            }
                          }}
                        >
                          <img src={graphIcon} alt="그래프" className="graph-icon" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 로딩 중 표시 */}
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
                onChange={e => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
              />
              <div className="source-count-text">소스 {sourceCount}개</div>
              <button
                type="submit"
                className="submit-circle-button"
                aria-label="메시지 전송"
                disabled={!inputText.trim() || isLoading}
              >
                {isLoading ? <span className="stop-icon">■</span> : <span className="send-icon">➤</span>}
              </button>
            </div>
          </form>
        </div>
      ) : (
        // 대화가 시작되지 않은 경우 안내 및 입력창
        <div className="panel-content empty-chat-content">
          <div className="chat-title-container">
            <div className="chat-title-display">
              <span className="header-title" style={{ fontSize: '23px', fontWeight: '600', marginLeft: '21px' }}>
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
                  onChange={e => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <div className="source-count-text">소스 {sourceCount}개</div>
                <button type="submit" className="submit-circle-button" aria-label="메시지 전송">
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
