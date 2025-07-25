// src/components/layout/MainLayout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from 'react-resizable-panels';
import './MainLayout.css';

import ProjectPanel from '../panels/Project/ProjectPanel';
import SourcePanel from '../panels/Source/SourcePanel';
import ChatPanel from '../panels/Chat/ChatPanel';
import InsightPanel from '../panels/Insight/InsightPanel';
import Spinner from '../common/Spinner';

// 패널 사이즈 상수
const PANEL = {
  SOURCE: { DEFAULT: 19, MIN: 10, COLLAPSED: 5 },
  CHAT: { DEFAULT: 50, MIN: 30 },
  INSIGHT: { DEFAULT: 40, MIN: 10, COLLAPSED: 5 },
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

  // 라우팅 관련 상태
  const { projectId } = useParams();

  // 프로젝트 및 세션 상태
  const [selectedBrainId, setSelectedBrainId] = useState(projectId);  // 현재 brain_id

  // 패널 접힘 상태
  const [sourceCollapsed, setSourceCollapsed] = useState(false);
  const [insightCollapsed, setInsightCollapsed] = useState(false);

  // 그래프 연관 노드 상태
  const [referencedNodes, setReferencedNodes] = useState([]);  // 응답에 등장한 노드
  const [allNodeNames, setAllNodeNames] = useState([]);        // 그래프 내 전체 노드 이름
  const [focusNodeNames, setFocusNodeNames] = useState([]);    // 포커싱할 노드들
  const [focusSourceId, setFocusSourceId] = useState(null);    // 포커싱할 소스 ID

  // 그래프 Refresh 용도
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState(0);
  const handleGraphRefresh = () => {
    setGraphRefreshTrigger(prev => prev + 1);
    syncToStandaloneWindow({ action: 'refresh' });
  };

  // 소스 개수 새로고침 트리거
  const [sourceCountRefreshTrigger, setSourceCountRefreshTrigger] = useState(0);
  const handleSourceCountRefresh = () => {
    setSourceCountRefreshTrigger(prev => prev + 1);
  };

  // 그래프 데이터 변경 시 전체 노드명 업데이트
  const handleGraphDataUpdate = (graphData) => {
    const nodeNames = graphData?.nodes?.map(n => n.name) || [];
    setAllNodeNames(nodeNames);
  };

  // 추가된 노드 상태
  const [newlyAddedNodeNames, setNewlyAddedNodeNames] = useState([]);

  // 각 패널 크기 조절을 위한 ref
  const sourcePanelRef = useRef(null);
  const chatPanelRef = useRef(null);
  const InsightPanelRef = useRef(null);
  const firstSourceExpand = useRef(true);  // 소스 처음 열릴 때 한 번만 확장되도록

  // 패널 크기 상태
  const [sourcePanelSize, setSourcePanelSize] = useState(PANEL.SOURCE.DEFAULT);
  const [chatPanelSize, setChatPanelSize] = useState(PANEL.CHAT.DEFAULT);
  const [insightPanelSize, setInsightPanelSize] = useState(PANEL.INSIGHT.DEFAULT);

  // 소스 열림 여부 상태
  const [isSourceOpen, setIsSourceOpen] = useState(false);

  // 패널 데이터 준비 상태
  const [isSourcePanelReady, setSourcePanelReady] = useState(false); // SourcePanel 준비 상태
  const [isGraphReady, setGraphReady] = useState(false);
  const [isChatReady, setChatReady] = useState(false); // ChatPanel 준비 상태
  const allReady = isSourcePanelReady && isGraphReady && isChatReady;

  // 프로젝트 이동 중 로딩 상태
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [isNodeViewLoading, setIsNodeViewLoading] = useState(null); // 노드 보기 로딩 상태

  // 그래프 상태를 외부 윈도우(localStorage)로 동기화
  const syncToStandaloneWindow = (data) => {
    localStorage.setItem('graphStateSync', JSON.stringify({
      brainId: selectedBrainId,
      timestamp: Date.now(),
      ...data
    }));
  };

  // 소스 뷰에서 뒤로가기 눌렀을 때 초기 상태로 복구
  const handleBackFromSource = () => {
    setIsSourceOpen(false);
    firstSourceExpand.current = true;
    if (sourcePanelRef.current) {
      sourcePanelRef.current.resize(PANEL.SOURCE.DEFAULT);
    }
  };

  // 프로젝트 변경 시 상태 저장 및 라우팅 이동 처리
  const handleProjectChange = (projectId) => {
    setIsProjectLoading(true);
    setSourcePanelReady(false);
    setSelectedBrainId(projectId);
    setReferencedNodes([]);
    setFocusNodeNames([]);
    setNewlyAddedNodeNames([]);
    setOpenSourceId(null);
    setFocusSourceId(null);
    firstSourceExpand.current = true;
    setIsSourceOpen(false);
    setSourcePanelSize(PANEL.SOURCE.DEFAULT);
    setChatPanelSize(PANEL.CHAT.DEFAULT);
    setInsightPanelSize(PANEL.INSIGHT.DEFAULT);
  };

  // 패널 리사이즈 핸들러들 (사용자 리사이즈 반영용)
  const handleSourceResize = (size) => {
    if (!sourceCollapsed) {
      setSourcePanelSize(size);
    }
  };

  const handleChatResize = (size) => {
    setChatPanelSize(size);
  };

  const handleMemoResize = (size) => {
    if (!insightCollapsed) {
      setInsightPanelSize(size);
    }
  };

  // 참고된 노드 목록을 업데이트하고 상태를 동기화
  const onReferencedNodesUpdate = (nodes) => {
    setReferencedNodes(nodes);
    syncToStandaloneWindow({ referencedNodes: nodes });
  };

  // 특정 노드 이름들에 포커스를 설정하고 상태를 동기화
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

  // 특정 소스를 열 때 포커스 ID와 타임스탬프를 기록
  const [openSourceId, setOpenSourceId] = useState(null);

  const handleOpenSource = (sourceId) => {
    setOpenSourceId(sourceId);
    setFocusSourceId({ id: sourceId, timestamp: Date.now() });
  };

  // 소스/채팅/메모 패널의 비율 합이 100%를 초과하거나 부족할 경우 자동으로 정규화
  useEffect(() => {
    if (!sourceCollapsed && !insightCollapsed) {
      const total = sourcePanelSize + chatPanelSize + insightPanelSize;
      if (Math.abs(total - 100) >= 0.5) {
        const ratio = 100 / total;
        setSourcePanelSize(prev => +(prev * ratio).toFixed(1));
        setChatPanelSize(prev => +(prev * ratio).toFixed(1));
        setInsightPanelSize(prev => +(prev * ratio).toFixed(1));
      }
    }
  }, [sourceCollapsed, insightCollapsed]);

  // 소스 열림 여부나 소스 패널 접힘 여부에 따라 소스 패널 크기 조절
  useEffect(() => {
    if (!sourcePanelRef.current) return;

    if (sourceCollapsed) {
      sourcePanelRef.current.resize(PANEL.SOURCE.COLLAPSED);
    } else if (isSourceOpen && firstSourceExpand.current) {
      sourcePanelRef.current.resize(40);
      firstSourceExpand.current = false;
    } else {
      sourcePanelRef.current.resize(sourcePanelSize);
    }
  }, [isSourceOpen, sourceCollapsed, sourcePanelSize]);

  // 메모 패널 열림/접힘에 따른 크기 조절
  useEffect(() => {
    if (!InsightPanelRef.current) return;
    if (insightCollapsed) {
      InsightPanelRef.current.resize(PANEL.INSIGHT.COLLAPSED);
    } else {
      InsightPanelRef.current.resize(
        insightPanelSize === PANEL.INSIGHT.COLLAPSED ? PANEL.INSIGHT.DEFAULT : insightPanelSize
      );
    }
  }, [insightCollapsed]);

  // URL 변경(projectId 변경)에 따라 selectedBrainId 상태 업데이트
  useEffect(() => {
    setSelectedBrainId(projectId);
    setIsProjectLoading(true);
  }, [projectId]);

  useEffect(() => {
    if (isProjectLoading && allReady) setIsProjectLoading(false);
    // projectId가 바뀔 때만 검사
  }, [allReady, isProjectLoading, projectId]);

  // focusNodeNames가 실제로 변경(즉, 그래프에 반영)될 때 스피너 해제
  useEffect(() => {
    if (isNodeViewLoading) {
      setIsNodeViewLoading(null);
    }
  }, [focusNodeNames]);

  return (
    <div className="main-container" style={{ position: 'relative' }}>
      {isProjectLoading && (
        <div className="loading-overlay">
          <Spinner />
        </div>
      )}
      {/* 좌측 프로젝트 선택 패널 */}
      <div className="layout project-layout">
        <ProjectPanel
          selectedBrainId={Number(selectedBrainId)}
          onProjectChange={handleProjectChange}
        />
      </div>

      {/* 중앙 패널 그룹: 소스 - 채팅 - 메모 */}
      <PanelGroup direction="horizontal" className="panels-container">

        {/* 1. Source 패널 */}
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
              selectedBrainId={Number(selectedBrainId)}
              collapsed={sourceCollapsed}
              setCollapsed={setSourceCollapsed}
              setIsSourceOpen={setIsSourceOpen}
              onBackFromSource={handleBackFromSource}
              onGraphRefresh={handleGraphRefresh}
              onSourceCountRefresh={handleSourceCountRefresh}
              onFocusNodeNamesUpdate={handleFocusNodeNames}
              focusSource={focusSourceId}
              openSourceId={openSourceId}
              onSourcePanelReady={() => setSourcePanelReady(true)}
              isNodeViewLoading={isNodeViewLoading}
              setIsNodeViewLoading={setIsNodeViewLoading}
            />
          </div>
        </Panel>

        <ResizeHandle />

        {/* 2. Chat 패널 */}
        <Panel
          ref={chatPanelRef}
          defaultSize={PANEL.CHAT.DEFAULT}
          minSize={30}
          onResize={handleChatResize}
        >
          <div className="layout-inner chat-inner">
            <ChatPanel
              selectedBrainId={selectedBrainId}
              onReferencedNodesUpdate={onReferencedNodesUpdate}
              onOpenSource={handleOpenSource}
              onChatReady={setChatReady}
              sourceCountRefreshTrigger={sourceCountRefreshTrigger}
            />
          </div>
        </Panel>

        <ResizeHandle />

        {/* 3. Insight 패널 */}
        <Panel
          ref={InsightPanelRef}
          defaultSize={insightCollapsed ? PANEL.INSIGHT.COLLAPSED : PANEL.INSIGHT.DEFAULT}
          minSize={insightCollapsed ? PANEL.INSIGHT.COLLAPSED : PANEL.INSIGHT.MIN}
          maxSize={100}
          className={insightCollapsed ? 'panel-collapsed' : ''}
          onResize={handleMemoResize}
        >
          <div className="layout-inner insight-inner">
            <InsightPanel
              selectedBrainId={Number(selectedBrainId)}
              collapsed={insightCollapsed}
              setCollapsed={setInsightCollapsed}
              referencedNodes={referencedNodes}
              graphRefreshTrigger={graphRefreshTrigger}
              onGraphDataUpdate={handleGraphDataUpdate}
              focusNodeNames={focusNodeNames}
              onGraphReady={setGraphReady}
              setReferencedNodes={setReferencedNodes}
              setFocusNodeNames={setFocusNodeNames}
              setNewlyAddedNodeNames={setNewlyAddedNodeNames}
            />
          </div>
        </Panel>

      </PanelGroup>
    </div>
  );
}

export default MainLayout;