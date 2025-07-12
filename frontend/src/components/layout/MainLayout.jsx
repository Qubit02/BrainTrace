// src/components/layout/MainLayout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from 'react-resizable-panels';
import './MainLayout.css';

import ProjectPanel from '../panels/ProjectPanel';
import SourcePanel from '../panels/SourcePanel';
import ChatPanel from '../panels/ChatPanel';
import ChatSidebar from '../panels/ChatSidebar';
import MemoPanel from '../panels/MemoPanel';
import { listBrains } from '../../../../backend/services/backend'

// 패널 사이즈 상수
const PANEL = {
  SOURCE: { DEFAULT: 18, MIN: 10, COLLAPSED: 5 },
  CHAT: { DEFAULT: 50, MIN: 30 },
  MEMO: { DEFAULT: 40, MIN: 10, COLLAPSED: 5 },
};

// 리사이즈 핸들 컴포넌트
function ResizeHandle() {
  return (
    <PanelResizeHandle className="resize-handle">
      <div className="handle-line"></div>
    </PanelResizeHandle>
  );
}

function MainLayout() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [hasProject, setHasProject] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showChatPanel, setShowChatPanel] = useState(false); // ← 채팅 보기 여부
  const [newlyCreatedSessionId, setNewlyCreatedSessionId] = useState(null);
  const lastSavedProjectRef = useRef(null);

  const DEFAULT_SOURCE_PANEL_SIZE = 18;
  const DEFAULT_CHAT_PANEL_SIZE = 50;
  const DEFAULT_MEMO_PANEL_SIZE = 40;

  const [activeProject, setActiveProject] = useState(projectId);
  const [sourceCollapsed, setSourceCollapsed] = useState(false);
  const [memoCollapsed, setMemoCollapsed] = useState(false);

  // 참고된 노드 목록을 위한 state 추가
  const [referencedNodes, setReferencedNodes] = useState([]);
  const [allNodeNames, setAllNodeNames] = useState([]);
  const [focusNodeNames, setFocusNodeNames] = useState([]);
  const [focusSourceId, setFocusSourceId] = useState(null);

  // 그래프 Refresh 용도
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState(0);
  // FileView에서 호출할 함수
  const handleGraphRefresh = () => {
    setGraphRefreshTrigger(prev => prev + 1);
    syncToStandaloneWindow({ action: 'refresh' });

  };
  const handleGraphDataUpdate = (graphData) => {
    const nodeNames = graphData?.nodes?.map(n => n.name) || [];
    setAllNodeNames(nodeNames);
  };

  const sourcePanelRef = useRef(null);
  const chatPanelRef = useRef(null);
  const memoPanelRef = useRef(null);
  const firstPdfExpand = useRef(true);

  const [sourcePanelSize, setSourcePanelSize] = useState(PANEL.SOURCE.DEFAULT);
  const [chatPanelSize, setChatPanelSize] = useState(PANEL.CHAT.DEFAULT);
  const [memoPanelSize, setMemoPanelSize] = useState(PANEL.MEMO.DEFAULT);
  const [isPDFOpen, setIsPDFOpen] = useState(false);
  const [sourceCount, setSourceCount] = useState(0);

  const syncToStandaloneWindow = (data) => {
    localStorage.setItem('graphStateSync', JSON.stringify({
      brainId: activeProject,
      timestamp: Date.now(),
      ...data
    }));
  };

  const handleBackFromPDF = () => {
    setIsPDFOpen(false);
    firstPdfExpand.current = true;
    if (sourcePanelRef.current) {
      sourcePanelRef.current.resize(PANEL.SOURCE.DEFAULT);
    }
  };

  const handleProjectChange = (projectId) => {
    if (activeProject && sessions.length > 0) {
      localStorage.setItem(`sessions-${activeProject}`, JSON.stringify(sessions));
    }

    setActiveProject(projectId);
    setShowChatPanel(false);
    navigate(`/project/${projectId}`);
    setReferencedNodes([]);
  };

  // 패널 리사이즈 핸들러들
  const handleSourceResize = (size) => {
    if (!sourceCollapsed) { setSourcePanelSize(size); }
  };

  const handleChatResize = (size) => { setChatPanelSize(size); };

  const handleMemoResize = (size) => {
    if (!memoCollapsed) { setMemoPanelSize(size); }
  };

  // 참고된 노드 목록 업데이트
  const onReferencedNodesUpdate = (nodes) => {
    setReferencedNodes(nodes);
    syncToStandaloneWindow({ referencedNodes: nodes });

  };

  // 노드 이름 포커스 처리
  const handleFocusNodeNames = (nodeObject) => {
    if (Array.isArray(nodeObject)) {
      setFocusNodeNames(nodeObject);
      syncToStandaloneWindow({ focusNodeNames: nodeObject });
    } else if (nodeObject && nodeObject.nodes) {
      setFocusNodeNames(nodeObject.nodes);
      syncToStandaloneWindow({ focusNodeNames: nodeObject.nodes });
    } else {
      setFocusNodeNames([]);
      syncToStandaloneWindow({ focusNodeNames: [] });
    }
  };

  const onRenameSession = (id, newTitle) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const onDeleteSession = (id) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem(`sessions-${activeProject}`, JSON.stringify(updated));

    if (id === currentSessionId) {
      setCurrentSessionId(null);
      setShowChatPanel(false);
    }
  };

  const handleOpenSource = (sourceId) => {
    console.log("sourceId : ", sourceId)
    setFocusSourceId({ id: sourceId, timestamp: Date.now() });
  };

  useEffect(() => {
    setActiveProject(projectId);
    setShowChatPanel(false);  // 프로젝트 이동 시 채팅 리스트로 초기화
  }, [projectId]);

  useEffect(() => {
    if (!activeProject || !showChatPanel) return;

    const activeProjectStr = String(activeProject);
    const projectIdStr = String(projectId);

    if (
      activeProjectStr === projectIdStr &&
      lastSavedProjectRef.current !== activeProjectStr
    ) {
      localStorage.setItem(`sessions-${activeProjectStr}`, JSON.stringify(sessions));
      lastSavedProjectRef.current = activeProjectStr;
    }
  }, [sessions, activeProject, projectId, showChatPanel]);

  useEffect(() => {
    if (!activeProject) return;
    const saved = localStorage.getItem(`sessions-${activeProject}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      setCurrentSessionId(parsed[0]?.id || null);
    } else {
      setSessions([]);
      setCurrentSessionId(null);
    }
  }, [activeProject]);

  // 소스 패널 크기 변경 효과
  useEffect(() => {
    if (!projectId) return;
    listBrains()
      .then(list => {
        const exist = list.some(b => b.brain_id === Number(projectId));
        if (!exist) navigate('/');
        setHasProject(exist);
      })
      .catch(() => navigate('/'));
  }, [projectId, navigate]);


  // 소스 패널 크기 변경 효과
  useEffect(() => {
    if (!sourcePanelRef.current) return;
    if (sourceCollapsed) return sourcePanelRef.current.resize(PANEL.SOURCE.COLLAPSED);
    if (isPDFOpen && firstPdfExpand.current) {
      sourcePanelRef.current.resize(40);
      firstPdfExpand.current = false;
    } else {
      sourcePanelRef.current.resize(sourcePanelSize);
    }
  }, [isPDFOpen, sourceCollapsed, sourcePanelSize]);

  // 메모 패널 크기 변경 효과
  useEffect(() => {
    if (!memoPanelRef.current) return;
    if (memoCollapsed) memoPanelRef.current.resize(PANEL.MEMO.COLLAPSED);
    else memoPanelRef.current.resize(memoPanelSize === PANEL.MEMO.COLLAPSED ? PANEL.MEMO.DEFAULT : memoPanelSize);
  }, [memoCollapsed]);

  // 패널 레이아웃 재조정 (총합이 100%가 되도록)
  useEffect(() => {
    if (!sourceCollapsed && !memoCollapsed) {
      const total = sourcePanelSize + chatPanelSize + memoPanelSize;
      if (Math.abs(total - 100) >= 0.5) {
        const ratio = 100 / total;
        setSourcePanelSize(prev => +(prev * ratio).toFixed(1));
        setChatPanelSize(prev => +(prev * ratio).toFixed(1));
        setMemoPanelSize(prev => +(prev * ratio).toFixed(1));
      }
    }
  }, [sourceCollapsed, memoCollapsed]);

  useEffect(() => {
    const handleDragOver = (e) => e.preventDefault();
    window.addEventListener('dragover', handleDragOver);
    return () => window.removeEventListener('dragover', handleDragOver);
  }, []);

  return (
    <div className="main-container">
      <div className="layout project-layout">
        <ProjectPanel
          activeProject={Number(activeProject)}
          onProjectChange={handleProjectChange}
        />
      </div>

      <PanelGroup direction="horizontal" className="panels-container">
        <Panel
          ref={sourcePanelRef}
          defaultSize={sourceCollapsed ? PANEL.SOURCE.COLLAPSED : PANEL.SOURCE.DEFAULT}
          minSize={sourceCollapsed ? PANEL.SOURCE.COLLAPSED : PANEL.SOURCE.MIN}
          maxSize={100}
          className={sourceCollapsed ? 'panel-collapsed' : ''}
          onResize={handleSourceResize}
        >
          <div className="layout-inner source-inner">
            <SourcePanel
              activeProject={Number(activeProject)}
              collapsed={sourceCollapsed}
              setCollapsed={setSourceCollapsed}
              setIsSourceOpen={setIsPDFOpen}
              onBackFromPDF={handleBackFromPDF}
              onGraphRefresh={handleGraphRefresh}
              onFocusNodeNamesUpdate={handleFocusNodeNames}
              focusSource={focusSourceId}
              onSourceCountChange={setSourceCount}
            />
          </div>
        </Panel>

        <ResizeHandle />

        <Panel
          ref={chatPanelRef}
          defaultSize={PANEL.CHAT.DEFAULT}
          minSize={30}
          onResize={handleChatResize}
        >
          <div className="layout-inner chat-inner">
            {!showChatPanel ? (
              <ChatSidebar
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={(id) => {
                  setCurrentSessionId(id);
                  setShowChatPanel(true);
                }}
                onNewSession={(firstMessageText = '') => {
                  const newId = Date.now().toString();
                  const newSession = {
                    id: newId,
                    title: firstMessageText.slice(0, 20) || 'Untitled',
                    messages: firstMessageText ? [{ text: firstMessageText, isUser: true }] : [],
                  };
                  const updated = [...sessions, newSession];
                  setSessions(updated);
                  setNewlyCreatedSessionId(newId);
                  setTimeout(() => {
                    setCurrentSessionId(newId);
                    setShowChatPanel(true);
                    setNewlyCreatedSessionId(null);
                  }, 1200);
                  return newSession;
                }}
                onRenameSession={onRenameSession}
                onDeleteSession={onDeleteSession}
                newlyCreatedSessionId={newlyCreatedSessionId}
                setNewlyCreatedSessionId={setNewlyCreatedSessionId}
              />
            ) : (
              <ChatPanel
                activeProject={activeProject}
                onReferencedNodesUpdate={onReferencedNodesUpdate}
                sessions={sessions}
                setSessions={setSessions}
                currentSessionId={currentSessionId}
                setCurrentSessionId={setCurrentSessionId}
                showChatPanel={showChatPanel}
                setShowChatPanel={setShowChatPanel}
                allNodeNames={allNodeNames}
                onOpenSource={handleOpenSource}
                sourceCount={sourceCount}
              />
            )}
          </div>
        </Panel>

        <ResizeHandle />

        <Panel
          ref={memoPanelRef}
          defaultSize={memoCollapsed ? PANEL.MEMO.COLLAPSED : PANEL.MEMO.DEFAULT}
          minSize={memoCollapsed ? PANEL.MEMO.COLLAPSED : PANEL.MEMO.MIN}
          maxSize={100}
          className={memoCollapsed ? 'panel-collapsed' : ''}
          onResize={handleMemoResize}
        >
          <div className="layout-inner memo-inner">
            <MemoPanel
              activeProject={Number(activeProject)}
              collapsed={memoCollapsed}
              setCollapsed={setMemoCollapsed}
              referencedNodes={referencedNodes}
              graphRefreshTrigger={graphRefreshTrigger}
              onGraphDataUpdate={handleGraphDataUpdate}
              focusNodeNames={focusNodeNames}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default MainLayout;