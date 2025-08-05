/**
 * ChatPanel.jsx
 * 
 * 채팅 패널 메인 컴포넌트
 * 
 * 주요 기능:
 * 1. 채팅 세션 관리 (제목 편집, 대화 초기화)
 * 2. 메시지 전송 및 응답 처리
 * 3. 모델 선택 및 설치 관리
 * 4. 출처(소스) 노드 표시 및 탐색
 * 5. 메시지 복사 및 그래프 연동
 * 
 * 컴포넌트 구조:
 * - TitleEditor: 세션 제목 편집
 * - ModelDropdown: 모델 선택 드롭다운
 * - ChatInput: 메시지 입력 및 전송
 * - ChatMessage: 개별 메시지 표시
 * - LoadingIndicator: 로딩 상태 표시
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ChatPanel.css';
import {
  getReferencedNodes,
  getNodeSourcesByChat,
  getChatMessageById,
  renameChatSession,
  fetchChatSession,
  fetchChatHistoryBySession, 
  deleteAllChatsBySession
} from '../../../../api/services/chatApi';
import { createSourceViewClickHandler, extractOriginalSentencesForHover } from './sourceViewUtils';
import { requestAnswer, getSourceCountByBrain } from '../../../../api/services/graphApi';
import { listModels, installModel } from '../../../../api/services/aiModelApi';
import SourceHoverTooltip from './SourceHoverTooltip';

// UI 컴포넌트 import
import ConfirmDialog from '../../common/ConfirmDialog';

// 아이콘 import
import { PiGraph } from "react-icons/pi";
import { IoCopyOutline, IoCheckmarkOutline, IoChevronDown } from "react-icons/io5";
import { VscOpenPreview } from "react-icons/vsc";
import { GoPencil } from 'react-icons/go';
import { HiOutlineBars4 } from "react-icons/hi2";
import { WiCloudRefresh } from "react-icons/wi";

// 모델 관련 유틸리티 import
import { 
  getModelData, 
  addGpt4oToModels, 
  separateInstalledAndAvailableModels, 
  sortModelsWithSelectedFirst 
} from './modelUtils';

/**
 * TitleEditor 컴포넌트
 * 
 * 채팅 세션의 제목을 편집하는 컴포넌트
 * 
 * 기능:
 * - 제목 클릭 시 편집 모드 활성화
 * - 편집 중 Enter: 저장, Escape: 취소
 * - 새로고침 버튼으로 대화 초기화
 * 
 * @param {string} sessionName - 현재 세션 이름
 * @param {boolean} isEditingTitle - 편집 모드 여부
 * @param {string} editingTitle - 편집 중인 제목
 * @param {function} setEditingTitle - 편집 제목 설정 함수
 * @param {function} handleEditTitleStart - 편집 시작 핸들러
 * @param {function} handleEditTitleFinish - 편집 완료 핸들러
 * @param {boolean} hasChatStarted - 채팅 시작 여부
 * @param {function} onRefreshClick - 새로고침 클릭 핸들러
 */
const TitleEditor = ({ 
  sessionName, 
  isEditingTitle, 
  editingTitle, 
  setEditingTitle, 
  handleEditTitleStart, 
  handleEditTitleFinish,
  hasChatStarted,
  onRefreshClick
}) => {
  if (isEditingTitle) {
    return (
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
    );
  }

  return (
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
        {hasChatStarted && (
          <button
            className="chat-panel-refresh-btn"
            onClick={onRefreshClick}
            title="대화 초기화"
          >
            <WiCloudRefresh size={30} />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * ModelDropdown 컴포넌트
 * 
 * 모델 선택 드롭다운 컴포넌트
 * 
 * 기능:
 * - 설치된 모델과 설치 가능한 모델 분리 표시
 * - 선택된 모델을 맨 위에 배치
 * - 모델 설치 기능 (설치 중 상태 표시)
 * - 체크마크로 현재 선택된 모델 표시
 * 
 * @param {string} selectedModel - 현재 선택된 모델
 * @param {Array} availableModels - 사용 가능한 모델 목록
 * @param {boolean} showModelDropdown - 드롭다운 표시 여부
 * @param {function} setShowModelDropdown - 드롭다운 표시 설정 함수
 * @param {function} handleModelSelect - 모델 선택 핸들러
 * @param {function} handleInstallModel - 모델 설치 핸들러
 * @param {string|null} installingModel - 설치 중인 모델 이름
 */
const ModelDropdown = ({
  selectedModel,
  availableModels,
  showModelDropdown,
  setShowModelDropdown,
  handleModelSelect,
  handleInstallModel,
  installingModel
}) => {
  return (
    <div className="chat-panel-model-selector-inline">
      <div 
        className="chat-panel-model-dropdown-inline"
        onClick={() => setShowModelDropdown(!showModelDropdown)}
      >
        <span className="chat-panel-model-value-inline">{selectedModel}</span>
        <IoChevronDown 
          size={14} 
          className={`chat-panel-dropdown-arrow-inline ${showModelDropdown ? 'rotated' : ''}`}
        />
      </div>
      {showModelDropdown && (
        <div className="chat-panel-model-menu-inline">
          {/* 설치된 모델 목록 */}
          {sortModelsWithSelectedFirst(
            availableModels.filter(model => model.installed), 
            selectedModel
          ).map((apiModelInfo) => {
            const model = apiModelInfo.name;
            const isInstalled = apiModelInfo.installed;
            const modelData = getModelData(model);
            return (
              <div
                key={model}
                className={`chat-panel-model-item-inline ${selectedModel === model ? 'selected' : ''}`}
                onClick={() => handleModelSelect(model)}
              >
                <div className="chat-panel-model-info-inline">
                  <div className="chat-panel-model-header-inline">
                    <span className="chat-panel-model-name-inline">{modelData.name}</span>
                    {selectedModel === model && (
                      <IoCheckmarkOutline size={16} className="chat-panel-model-checkmark-inline" />
                    )}
                  </div>
                  <div className="chat-panel-model-description-inline">{modelData.description}</div>
                  <div className="chat-panel-model-meta-inline">
                    <span className="chat-panel-model-size-inline">{modelData.size}</span>
                    <span className="chat-panel-model-type-inline">{modelData.type}</span>
                    <span className="chat-panel-model-provider-inline">{modelData.provider}</span>
                  </div>
                  {modelData.usage && (
                    <div className="chat-panel-model-usage-inline">{modelData.usage}</div>
                  )}
                </div>
                {modelData.buttonText && (
                  <button
                    className="chat-panel-model-action-btn-inline"
                    onClick={(e) => {
                      e.stopPropagation();
                      // 새 채팅 기능 구현
                    }}
                  >
                    {modelData.buttonText}
                  </button>
                )}
                {installingModel === model && (
                  <span className="chat-panel-installing-inline">설치 중...</span>
                )}

              </div>
            );
          })}
          
          {/* 구분선 - 설치된 모델과 설치 가능한 모델 사이 */}
          {(() => {
            const { installed, available } = separateInstalledAndAvailableModels(availableModels);
            return installed.length > 0 && available.length > 0 ? (
              <div className="chat-panel-model-separator-inline"></div>
            ) : null;
          })()}
          
          {/* 설치 가능한 모델 목록 */}
          {availableModels.filter(model => !model.installed).map((apiModelInfo) => {
            const model = apiModelInfo.name;
            const isInstalled = apiModelInfo.installed;
            const modelData = getModelData(model);
            return (
              <div
                key={model}
                className={`chat-panel-model-item-inline ${selectedModel === model ? 'selected' : ''}`}
                onClick={() => handleModelSelect(model)}
              >
                <div className="chat-panel-model-info-inline">
                  <div className="chat-panel-model-header-inline">
                    <span className="chat-panel-model-name-inline">{modelData.name}</span>
                    {selectedModel === model && (
                      <IoCheckmarkOutline size={16} className="chat-panel-model-checkmark-inline" />
                    )}
                  </div>
                  <div className="chat-panel-model-description-inline">{modelData.description}</div>
                  <div className="chat-panel-model-meta-inline">
                    <span className="chat-panel-model-size-inline">{modelData.size}</span>
                    <span className="chat-panel-model-type-inline">{modelData.type}</span>
                    <span className="chat-panel-model-provider-inline">{modelData.provider}</span>
                  </div>
                  {modelData.usage && (
                    <div className="chat-panel-model-usage-inline">{modelData.usage}</div>
                  )}
                </div>
                {modelData.buttonText && (
                  <button
                    className="chat-panel-model-action-btn-inline"
                    onClick={(e) => {
                      e.stopPropagation();
                      // 새 채팅 기능 구현
                    }}
                  >
                    {modelData.buttonText}
                  </button>
                )}
                {installingModel === model ? (
                  <span className="chat-panel-installing-inline">설치 중...</span>
                ) : (
                  selectedModel !== model && !modelData.buttonText && !isInstalled && (
                    <button
                      className="chat-panel-install-btn-inline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInstallModel(model);
                      }}
                    >
                      설치
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * ChatInput 컴포넌트
 * 
 * 메시지 입력 및 전송 컴포넌트
 * 
 * 기능:
 * - 텍스트 입력 (Enter로 전송, Shift+Enter로 줄바꿈)
 * - 소스 개수 표시
 * - 모델 선택 드롭다운 포함
 * - 전송 버튼 (로딩 중일 때 정지 버튼으로 변경)
 * 
 * @param {string} inputText - 입력 텍스트
 * @param {function} setInputText - 입력 텍스트 설정 함수
 * @param {boolean} isLoading - 로딩 상태
 * @param {function} handleSubmit - 전송 핸들러
 * @param {number} sourceCount - 소스 개수
 * @param {string} selectedModel - 선택된 모델
 * @param {Array} availableModels - 사용 가능한 모델 목록
 * @param {boolean} showModelDropdown - 모델 드롭다운 표시 여부
 * @param {function} setShowModelDropdown - 모델 드롭다운 표시 설정 함수
 * @param {function} handleModelSelect - 모델 선택 핸들러
 * @param {function} handleInstallModel - 모델 설치 핸들러
 * @param {string|null} installingModel - 설치 중인 모델
 */
const ChatInput = ({
  inputText,
  setInputText,
  isLoading,
  handleSubmit,
  sourceCount,
  selectedModel,
  availableModels,
  showModelDropdown,
  setShowModelDropdown,
  handleModelSelect,
  handleInstallModel,
  installingModel
}) => {
  return (
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
        <ModelDropdown
          selectedModel={selectedModel}
          availableModels={availableModels}
          showModelDropdown={showModelDropdown}
          setShowModelDropdown={setShowModelDropdown}
          handleModelSelect={handleModelSelect}
          handleInstallModel={handleInstallModel}
          installingModel={installingModel}
        />
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
  );
};

/**
 * ChatMessage 컴포넌트
 * 
 * 개별 채팅 메시지를 표시하는 컴포넌트
 * 
 * 기능:
 * - 사용자/AI 메시지 구분 표시
 * - 참조된 노드 목록 표시 및 클릭 가능
 * - 출처 보기 기능 (소스 목록 토글)
 * - 메시지 복사 기능
 * - 그래프 연동 (AI 메시지만)
 * - 정확도 표시 (AI 메시지만)
 * 
 * @param {object} message - 메시지 객체
 * @param {object} openSourceNodes - 열린 소스 노드 상태
 * @param {function} toggleSourceList - 소스 목록 토글 함수
 * @param {function} handleCopyMessage - 메시지 복사 핸들러
 * @param {string|null} copiedMessageId - 복사된 메시지 ID
 * @param {function} onReferencedNodesUpdate - 참조 노드 업데이트 콜백
 * @param {function} onOpenSource - 소스 열기 콜백
 */
const ChatMessage = ({
  message,
  openSourceNodes,
  toggleSourceList,
  handleCopyMessage,
  copiedMessageId,
  onReferencedNodesUpdate,
  onOpenSource,
  selectedBrainId
}) => {

  return (
    <div
      className={`chat-panel-message-wrapper ${message.is_ai ? 'chat-panel-bot-message' : 'chat-panel-user-message'}`}
    >
      <div className="chat-panel-message">
        <div className="chat-panel-message-body">
          {message.message.split('\n').map((line, idx) => {
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
                        className={`chat-panel-modern-source-btn${openSourceNodes[`${message.chat_id}_${nodeName}`] ? ' active' : ''}`}
                        onClick={() => toggleSourceList(message.chat_id, nodeName)}
                        style={{ marginLeft: '6px' }}
                      >
                        <VscOpenPreview size={15} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                        <span>출처보기</span>
                      </button>
                    </div>
                    {/* 출처 목록 표시 */}
                    {openSourceNodes[`${message.chat_id}_${nodeName}`] && (
                      <ul className="chat-panel-source-title-list">
                        {openSourceNodes[`${message.chat_id}_${nodeName}`].map((item, sourceIndex) => (
                          <li key={sourceIndex} className="chat-panel-source-title-item">
                            <SourceHoverTooltip
                              originalSentences={extractOriginalSentencesForHover(item, message, nodeName)}
                              sourceTitle={item.title}
                            >
                              <span
                                className="chat-panel-source-title-content"
                                onClick={createSourceViewClickHandler(item, message, nodeName, selectedBrainId, onOpenSource)}
                                style={{ cursor: item.id ? 'pointer' : 'default' }}
                              >
                                {item.title}
                              </span>
                            </SourceHoverTooltip>
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
            onClick={() => handleCopyMessage(message)}
          >
            {copiedMessageId === (message.chat_id || message.message) ? (
              <IoCheckmarkOutline size={18} color="#303030ff" />
            ) : (
              <IoCopyOutline size={18} />
            )}
          </button>
          {/* bot 메시지에만 그래프 버튼 표시 */}
          {message.is_ai && (
            <button
              className="chat-panel-graph-button"
              title="그래프 보기"
              onClick={async () => {
                if (!message.chat_id) return;
                try {
                  const res = await getReferencedNodes(message.chat_id);
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
        {/* 정확도 표시 (AI 답변에만) */}
        {message.is_ai && message.accuracy !== null && message.accuracy !== undefined && (
          <div className="chat-panel-accuracy-display">
            <span className="chat-panel-accuracy-label">정확도:</span>
            <span 
              className="chat-panel-accuracy-value"
              data-accuracy={
                message.accuracy >= 0.8 ? "high" : 
                message.accuracy >= 0.6 ? "medium" : "low"
              }
            >
              {(message.accuracy * 100).toFixed(1)}%
            </span>
            <span className="chat-panel-accuracy-help">?</span>
          </div>
        )}
      </div>
      

    </div>
  );
};

/**
 * LoadingIndicator 컴포넌트
 * 
 * 로딩 상태를 표시하는 컴포넌트
 * 
 * 기능:
 * - 로딩 메시지 표시
 * - 애니메이션 점 3개로 로딩 효과
 * 
 * @param {string} message - 표시할 로딩 메시지 (기본값: "생각하는 중")
 */
const LoadingIndicator = ({ message = "생각하는 중" }) => (
  <div className="chat-panel-thinking-indicator">
    <span>{message}</span>
    <div className="chat-panel-thinking-dots">
      <div className="chat-panel-thinking-dot" />
      <div className="chat-panel-thinking-dot" />
      <div className="chat-panel-thinking-dot" />
    </div>
  </div>
);

/**
 * ChatPanel 메인 컴포넌트
 * 
 * 채팅 패널의 메인 컴포넌트로 모든 하위 컴포넌트를 관리
 * 
 * 주요 상태:
 * - inputText: 입력 텍스트
 * - chatHistory: 채팅 내역
 * - selectedModel: 선택된 모델
 * - availableModels: 사용 가능한 모델 목록
 * - isLoading: 로딩 상태
 * - sessionName: 세션 이름
 * 
 * 주요 기능:
 * - 채팅 세션 관리
 * - 메시지 전송 및 응답 처리
 * - 모델 선택 및 설치
 * - 출처 노드 탐색
 * 
 * @param {string} selectedSessionId - 선택된 세션 ID
 * @param {string} selectedBrainId - 선택된 브레인 ID
 * @param {function} onReferencedNodesUpdate - 참조 노드 업데이트 콜백
 * @param {function} onOpenSource - 소스 열기 콜백
 * @param {function} onChatReady - 채팅 준비 완료 콜백
 * @param {any} sourceCountRefreshTrigger - 소스 개수 새로고침 트리거
 * @param {function} onBackToList - 목록으로 돌아가기 콜백
 * @param {object} sessionInfo - 세션 정보
 */
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

  // ===== 상태 관리 =====
  
  // 채팅 관련 상태
  const [inputText, setInputText] = useState(''); // 입력 텍스트
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태
  const [chatHistory, setChatHistory] = useState([]); // 채팅 내역
  const [copiedMessageId, setCopiedMessageId] = useState(null); // 복사된 메시지 ID
  
  // UI 관련 상태
  const messagesEndRef = useRef(null); // 메시지 끝 참조 (자동 스크롤용)
  const [openSourceNodes, setOpenSourceNodes] = useState({}); // 열린 소스 노드 상태
  const [showConfirm, setShowConfirm] = useState(false); // 확인 다이얼로그 표시
  const [isInitialLoading, setIsInitialLoading] = useState(true); // 초기 로딩 상태
  
  // 세션 관련 상태
  const [sessionName, setSessionName] = useState(''); // 세션 이름
  const [isEditingTitle, setIsEditingTitle] = useState(false); // 제목 편집 모드
  const [editingTitle, setEditingTitle] = useState(''); // 편집 중인 제목
  const [sourceCount, setSourceCount] = useState(0); // 소스 개수

  // 모델 선택 관련 상태
  const [availableModels, setAvailableModels] = useState([]); // 사용 가능한 모델 목록
  const [selectedModel, setSelectedModel] = useState('gpt-4o'); // 선택된 모델
  const [showModelDropdown, setShowModelDropdown] = useState(false); // 모델 드롭다운 표시
  const [installingModel, setInstallingModel] = useState(null); // 설치 중인 모델

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
    // 채팅 내역이 변경될 때마다 맨 아래로 스크롤
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // ===== 채팅 내역 로드 후 자동 스크롤 =====
  useEffect(() => {
    if (!isInitialLoading && chatHistory.length > 0) {
      // 약간의 지연을 두어 DOM이 완전히 렌더링된 후 스크롤
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [isInitialLoading, chatHistory.length]);

  // ===== 드롭다운 외부 클릭 시 닫기 =====
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showModelDropdown && !event.target.closest('.chat-panel-model-selector-inline')) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showModelDropdown]);

  // ===== 모델 목록 불러오기 =====
  const loadModels = async () => {
    try {
      const models = await listModels();
      // gpt-4o를 모델 목록에 추가
      const updatedModels = addGpt4oToModels(models);
      setAvailableModels(updatedModels);
    } catch (error) {
      console.error('모델 목록 로드 실패:', error);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  /**
   * 모델 설치 함수
   * 
   * 선택한 모델을 설치하고 설치 완료 후 모델 목록을 재로드
   * 
   * @param {string} modelName - 설치할 모델 이름
   */
  const handleInstallModel = async (modelName) => {
    if (installingModel) return; // 이미 설치 중이면 무시
    
    setInstallingModel(modelName);
    try {
      await installModel(modelName);
      alert(`${modelName} 모델이 성공적으로 설치되었습니다.`);
      // 설치 완료 후 모델 목록 재로드
      await loadModels();
    } catch (error) {
      alert(`모델 설치에 실패했습니다: ${error.message}`);
    } finally {
      setInstallingModel(null);
    }
  };

  /**
   * 모델 선택 함수
   * 
   * 모델을 선택하고 드롭다운을 닫음
   * 
   * @param {string} modelName - 선택할 모델 이름
   */
  const handleModelSelect = (modelName) => {
    setSelectedModel(modelName);
    setShowModelDropdown(false);
  };

  /**
   * 제목 편집 시작 함수
   * 
   * 제목 편집 모드를 활성화하고 현재 세션 이름을 편집 필드에 설정
   */
  const handleEditTitleStart = () => {
    setIsEditingTitle(true);
    setEditingTitle(sessionName !== undefined ? sessionName : 'Untitled');
  };

  /**
   * 제목 편집 완료 함수
   * 
   * 편집된 제목을 서버에 저장하고 편집 모드를 종료
   */
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

  /**
   * 메시지 전송 핸들러
   * 
   * 사용자 입력을 처리하고 AI 응답을 받아오는 핵심 함수
   * 
   * 동작 과정:
   * 1. 입력 텍스트 검증
   * 2. 사용자 메시지를 즉시 UI에 추가 (optimistic update)
   * 3. AI에게 답변 요청
   * 4. 응답 처리 (실제 답변 + 안내 메시지)
   * 5. 참조 노드 정보 업데이트
   * 
   * @param {Event} e - 폼 제출 이벤트
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    setIsLoading(true);
    
    // 1. 사용자 질문을 즉시 UI에 추가 (optimistic update)
    const tempQuestion = {
      chat_id: Date.now(),
      is_ai: false,
      message: inputText,
      referenced_nodes: []
    };
    setChatHistory(prev => [...prev, tempQuestion]);
    setInputText('');

    try {
      // 2. AI에게 답변 요청
      // GPT 모델인지 확인하고 적절한 model과 model_name 설정
      const isGptModel = selectedModel.startsWith('gpt-');
      const model = isGptModel ? 'openai' : 'ollama';
      const model_name = isGptModel ? '' : selectedModel;
      const res = await requestAnswer(inputText, selectedSessionId, selectedBrainId, model, model_name);
      
      // 3. 응답 처리
      const hasRealAnswer = res?.answer && res.answer.trim() !== '';
      const hasGuideMessage = res?.message && res.message.trim() !== '';
      
      if (!hasRealAnswer && !hasGuideMessage) return;
      
      // 4. 실제 답변이 있으면 추가
      if (hasRealAnswer) {
        const tempAnswer = {
          chat_id: res?.chat_id || Date.now() + 1,
          is_ai: true,
          message: res?.answer,
          referenced_nodes: res?.referenced_nodes || [],
          accuracy: res?.accuracy || null
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
            referenced_nodes: [],
            accuracy: null
          }
        ]);
      }
      
      // 6. 참조 노드 정보가 있으면 그래프 업데이트
      if (res?.referenced_nodes && res.referenced_nodes.length > 0 && typeof onReferencedNodesUpdate === 'function') {
        const nodeNames = res.referenced_nodes.map(n => n.name);
        onReferencedNodesUpdate(nodeNames);
      }
    } catch (err) {
      console.error('답변 생성 중 오류:', err);
      // 더 구체적인 에러 메시지 제공
      let errorMessage = '답변 생성 중 오류가 발생했습니다.';
      if (err.response?.status === 400) {
        errorMessage = '잘못된 요청입니다. 입력을 확인해주세요.';
      } else if (err.response?.status === 500) {
        errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      } else if (err.code === 'NETWORK_ERROR') {
        errorMessage = '네트워크 연결을 확인해주세요.';
      }
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 대화 초기화 핸들러
   * 
   * 현재 세션의 모든 채팅 내역을 삭제하고 빈 상태로 초기화
   */
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

  /**
   * 출처(소스) 토글 함수
   * 
   * 참조된 노드의 출처 목록을 토글하여 표시/숨김
   * 
   * @param {string} chatId - 채팅 ID
   * @param {string} nodeName - 노드 이름
   */
  const toggleSourceList = async (chatId, nodeName) => {
    const key = `${chatId}_${nodeName}`;
    if (openSourceNodes[key]) {
      // 이미 열려있으면 닫기
      setOpenSourceNodes((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    } else {
      // 닫혀있으면 열기 (API 호출)
      try {
        const res = await getNodeSourcesByChat(chatId, nodeName);
        setOpenSourceNodes((prev) => ({
          ...prev,
          [key]: (res.titles || []).map((title, idx) => ({ 
            title, 
            id: (res.ids && res.ids[idx]) || null 
          })),
        }));
      } catch (err) {
        setOpenSourceNodes((prev) => ({ ...prev, [key]: [] }));
      }
    }
  };

  /**
   * 메시지 복사 핸들러
   * 
   * 메시지를 클립보드에 복사하고 복사 완료 상태를 표시
   * 
   * @param {object} m - 복사할 메시지 객체
   */
  const handleCopyMessage = async (m) => {
    try {
      let messageToCopy = m.message;
      
      // chat_id가 있고 유효한 숫자인 경우에만 서버에서 메시지를 가져옴
      if (m.chat_id && !isNaN(Number(m.chat_id))) {
        try {
          const serverMessage = await getChatMessageById(m.chat_id);
          if (serverMessage) {
            messageToCopy = serverMessage;
          }
        } catch (serverErr) {
          console.warn('서버에서 메시지를 가져오는데 실패했습니다. 로컬 메시지를 사용합니다:', serverErr);
          // 서버에서 가져오기 실패 시 로컬 메시지 사용
          messageToCopy = m.message;
        }
      }
      
      await navigator.clipboard.writeText(messageToCopy);
      setCopiedMessageId(m.chat_id || m.message);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('복사 실패:', err);
      // 복사 실패 시 사용자에게 알림
      alert('메시지 복사에 실패했습니다.');
    }
  };

  // ===== 유틸리티 변수 =====
  const hasChatStarted = chatHistory.length > 0; // 채팅 시작 여부

  // ===== 공통 props 객체 =====
  // ChatInput 컴포넌트에 전달할 props 객체
  const chatInputProps = {
    inputText,
    setInputText,
    isLoading,
    handleSubmit,
    sourceCount,
    selectedModel,
    availableModels,
    showModelDropdown,
    setShowModelDropdown,
    handleModelSelect,
    handleInstallModel,
    installingModel
  };

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
          <LoadingIndicator message="채팅 내역을 불러오는 중..." />
        </div>
      ) : hasChatStarted ? (
        <div className="chat-panel-content">
          <div className="chat-panel-title-container">
            <TitleEditor
              sessionName={sessionName}
              isEditingTitle={isEditingTitle}
              editingTitle={editingTitle}
              setEditingTitle={setEditingTitle}
              handleEditTitleStart={handleEditTitleStart}
              handleEditTitleFinish={handleEditTitleFinish}
              hasChatStarted={hasChatStarted}
              onRefreshClick={() => setShowConfirm(true)}
            />
          </div>
          {/* 메시지 목록 영역 */}
          <div className="chat-panel-messages">
            {chatHistory.map((message) => (
              <ChatMessage
                key={message.chat_id}
                message={message}
                openSourceNodes={openSourceNodes}
                toggleSourceList={toggleSourceList}
                handleCopyMessage={handleCopyMessage}
                copiedMessageId={copiedMessageId}
                onReferencedNodesUpdate={onReferencedNodesUpdate}
                onOpenSource={onOpenSource}
                selectedBrainId={selectedBrainId}
              />
            ))}
            {isLoading && (
              <div className="chat-panel-message-wrapper chat-panel-bot-message">
                <div className="chat-panel-message">
                  <LoadingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* 입력창 및 전송 버튼 */}
          <ChatInput {...chatInputProps} />
        </div>
      ) : (
        // 대화가 시작되지 않은 경우 안내 및 입력창
        <div className="chat-panel-empty-content">
                      <div className="chat-panel-title-container">
              <TitleEditor
                sessionName={sessionName}
                isEditingTitle={isEditingTitle}
                editingTitle={editingTitle}
                setEditingTitle={setEditingTitle}
                handleEditTitleStart={handleEditTitleStart}
                handleEditTitleFinish={handleEditTitleFinish}
                hasChatStarted={hasChatStarted}
                onRefreshClick={() => setShowConfirm(true)}
              />
            </div>
          <div className="chat-panel-centered-input-container">
            <div className="chat-panel-hero-section">
              <h1 className="chat-panel-hero-title">지식 그래프와 대화하여 인사이트를 발견하세요.</h1>
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
                <ModelDropdown
                  selectedModel={selectedModel}
                  availableModels={availableModels}
                  showModelDropdown={showModelDropdown}
                  setShowModelDropdown={setShowModelDropdown}
                  handleModelSelect={handleModelSelect}
                  handleInstallModel={handleInstallModel}
                  installingModel={installingModel}
                />
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
