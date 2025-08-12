// === MainLayout: 메인 레이아웃 컴포넌트 ===
// - 3개 패널(Source, Chat, Insight)의 리사이즈 가능한 레이아웃 관리
// - 프로젝트 변경 시 상태 초기화 및 패널 간 데이터 동기화
// - 그래프 노드 하이라이팅, 포커싱, 소스 열기 등 복합 상태 관리
// - 외부 윈도우(localStorage)와의 상태 동기화
// - 패널 접힘/펼침 상태 및 크기 자동 조정

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import "./MainLayout.css";

import ProjectPanel from "../panels/Project/ProjectPanel";
import SourcePanel from "../panels/Source/SourcePanel";
import ChatSession from "../panels/Chat/ChatSession";
import ChatPanel from "../panels/Chat/ChatPanel";
import InsightPanel from "../panels/Insight/InsightPanel";
import Spinner from "../common/Spinner";

// === 패널 크기 상수 ===
// 각 패널의 기본 크기, 최소 크기, 접힘 시 크기 정의
const PANEL = {
  SOURCE: { DEFAULT: 20, MIN: 10, COLLAPSED: 5 }, // 소스 패널: 기본 20%, 최소 10%, 접힘 시 5%
  CHAT: { DEFAULT: 45, MIN: 30 }, // 채팅 패널: 기본 45%, 최소 30%
  INSIGHT: { DEFAULT: 35, MIN: 10, COLLAPSED: 5 }, // 인사이트 패널: 기본 35%, 최소 10%, 접힘 시 5%
};

// === 리사이즈 핸들 컴포넌트 ===
// 패널 간 크기 조절을 위한 드래그 핸들
function ResizeHandle() {
  return (
    <PanelResizeHandle className="resize-handle">
      <div className="handle-line"></div>
    </PanelResizeHandle>
  );
}

function MainLayout() {
  // === 라우팅 관련 상태 ===
  const { projectId } = useParams(); // URL 파라미터에서 프로젝트 ID 추출

  // === 프로젝트 및 세션 상태 ===
  const [selectedBrainId, setSelectedBrainId] = useState(projectId); // 현재 선택된 브레인 ID

  // === 패널 접힘 상태 ===
  const [sourceCollapsed, setSourceCollapsed] = useState(false); // 소스 패널 접힘 여부
  const [insightCollapsed, setInsightCollapsed] = useState(false); // 인사이트 패널 접힘 여부

  // === 그래프 연관 노드 상태 ===
  const [referencedNodes, setReferencedNodes] = useState([]); // 응답에 등장한 노드들 (하이라이팅용)
  const [allNodeNames, setAllNodeNames] = useState([]); // 그래프 내 전체 노드 이름 목록
  const [focusNodeNames, setFocusNodeNames] = useState([]); // 포커싱할 노드들 (그래프에서 강조)
  const [focusSourceId, setFocusSourceId] = useState(null); // 포커싱할 소스 ID (소스 패널에서 강조)

  // === 채팅 상태 관리 ===
  const [selectedChatSession, setSelectedChatSession] = useState(null); // 선택된 채팅 세션 ID
  const [sessionInfo, setSessionInfo] = useState(null); // 선택된 세션의 상세 정보

  // === 새로고침 트리거 ===
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState(0); // 그래프 새로고침 트리거
  const handleGraphRefresh = () => {
    setGraphRefreshTrigger((prev) => prev + 1);
    syncToStandaloneWindow({ action: "refresh" });
  };

  const [sourceCountRefreshTrigger, setSourceCountRefreshTrigger] = useState(0); // 소스 개수 새로고침 트리거
  const handleSourceCountRefresh = () => {
    setSourceCountRefreshTrigger((prev) => prev + 1);
  };

  // === 그래프 데이터 관리 ===
  // 그래프 데이터 변경 시 전체 노드명 업데이트
  const handleGraphDataUpdate = (graphData) => {
    const nodeNames = graphData?.nodes?.map((n) => n.name) || [];
    setAllNodeNames(nodeNames);
  };

  // 추가된 노드 상태 (신규 노드 하이라이팅용)
  const [newlyAddedNodeNames, setNewlyAddedNodeNames] = useState([]);

  // === 패널 참조 및 크기 관리 ===
  const sourcePanelRef = useRef(null); // 소스 패널 참조
  const chatPanelRef = useRef(null); // 채팅 패널 참조
  const InsightPanelRef = useRef(null); // 인사이트 패널 참조
  const firstSourceExpand = useRef(true); // 소스 처음 열릴 때 한 번만 확장되도록 하는 플래그

  // 패널 크기 상태
  const [sourcePanelSize, setSourcePanelSize] = useState(PANEL.SOURCE.DEFAULT);
  const [chatPanelSize, setChatPanelSize] = useState(PANEL.CHAT.DEFAULT);
  const [insightPanelSize, setInsightPanelSize] = useState(
    PANEL.INSIGHT.DEFAULT
  );

  // === UI 상태 관리 ===
  const [isSourceOpen, setIsSourceOpen] = useState(false); // 소스 열림 여부

  // === 패널 준비 상태 ===
  const [isSourcePanelReady, setSourcePanelReady] = useState(false); // SourcePanel 준비 상태
  const [isGraphReady, setGraphReady] = useState(false); // 그래프 준비 상태
  const [isChatReady, setChatReady] = useState(false); // ChatPanel 준비 상태
  const allReady = isSourcePanelReady && isGraphReady && isChatReady; // 모든 패널 준비 완료 여부

  // === 로딩 상태 ===
  const [isProjectLoading, setIsProjectLoading] = useState(false); // 프로젝트 이동 중 로딩 상태
  const [isNodeViewLoading, setIsNodeViewLoading] = useState(null); // 노드 보기 로딩 상태

  // === 외부 윈도우 동기화 ===
  // 그래프 상태를 외부 윈도우(localStorage)로 동기화하는 함수
  const syncToStandaloneWindow = (data) => {
    localStorage.setItem(
      "graphStateSync",
      JSON.stringify({
        brainId: selectedBrainId,
        timestamp: Date.now(),
        ...data,
      })
    );
  };

  // === 소스 뷰 네비게이션 ===
  // 소스 뷰에서 뒤로가기 눌렀을 때 초기 상태로 복구하는 함수
  const handleBackFromSource = () => {
    setIsSourceOpen(false);
    setHighlightingInfo(null); // 하이라이팅 정보 초기화
    firstSourceExpand.current = true;
    if (sourcePanelRef.current) {
      sourcePanelRef.current.resize(PANEL.SOURCE.DEFAULT);
    }
  };

  // === 프로젝트 변경 처리 ===
  // 프로젝트 변경 시 모든 상태를 초기화하고 새 프로젝트로 전환하는 함수
  const handleProjectChange = (projectId) => {
    setIsProjectLoading(true);
    setSourcePanelReady(false);
    setSelectedBrainId(projectId);
    setReferencedNodes([]);
    setFocusNodeNames([]);
    setNewlyAddedNodeNames([]);
    setOpenSourceId(null);
    setFocusSourceId(null);
    setSelectedChatSession(null);
    setSessionInfo(null);
    setHighlightingInfo(null); // 하이라이팅 정보 초기화
    firstSourceExpand.current = true;
    setIsSourceOpen(false);
    setSourcePanelSize(PANEL.SOURCE.DEFAULT);
    setChatPanelSize(PANEL.CHAT.DEFAULT);
    setInsightPanelSize(PANEL.INSIGHT.DEFAULT);
  };

  // === 패널 리사이즈 핸들러 ===
  // 사용자 리사이즈 동작을 상태에 반영하는 핸들러들
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

  // === 노드 상태 관리 핸들러 ===
  // 참조 노드 업데이트 핸들러 (채팅 응답에서 언급된 노드들)
  const onReferencedNodesUpdate = (nodes) => {
    setReferencedNodes(nodes);
    syncToStandaloneWindow({ referencedNodes: nodes });
  };

  // 특정 노드 이름들에 포커스를 설정하고 상태를 동기화하는 핸들러
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

  // === 소스 관리 상태 ===
  // 특정 소스를 열 때 포커스 ID와 타임스탬프를 기록하는 상태
  const [openSourceId, setOpenSourceId] = useState(null); // 열린 소스 ID
  const [highlightingInfo, setHighlightingInfo] = useState(null); // 하이라이팅 정보

  // 특정 소스를 열고 하이라이팅 정보를 설정하는 핸들러
  const handleOpenSource = (sourceId, highlightingData = null) => {
    setOpenSourceId(sourceId);
    setFocusSourceId({ id: sourceId, timestamp: Date.now() });
    setHighlightingInfo(highlightingData);
  };

  // === 채팅 세션 관리 ===
  // 채팅 세션 선택 핸들러
  const handleSessionSelect = (sessionId, options = {}) => {
    setSelectedChatSession(sessionId);
    setSessionInfo(options.sessionInfo || null);
  };

  // 채팅 목록으로 돌아가기 핸들러
  const handleBackToList = () => {
    setSelectedChatSession(null);
    setSessionInfo(null);
  };

  // === 패널 크기 자동 조정 ===
  // 소스/채팅/메모 패널의 비율 합이 100%를 초과하거나 부족할 경우 자동으로 정규화
  useEffect(() => {
    if (!sourceCollapsed && !insightCollapsed) {
      const total = sourcePanelSize + chatPanelSize + insightPanelSize;
      if (Math.abs(total - 100) >= 0.5) {
        const ratio = 100 / total;
        setSourcePanelSize((prev) => +(prev * ratio).toFixed(1));
        setChatPanelSize((prev) => +(prev * ratio).toFixed(1));
        setInsightPanelSize((prev) => +(prev * ratio).toFixed(1));
      }
    }
  }, [sourceCollapsed, insightCollapsed]);

  // === 소스 패널 크기 조절 ===
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

  // === 인사이트 패널 크기 조절 ===
  // 메모 패널 열림/접힘에 따른 크기 조절
  useEffect(() => {
    if (!InsightPanelRef.current) return;
    if (insightCollapsed) {
      InsightPanelRef.current.resize(PANEL.INSIGHT.COLLAPSED);
    } else {
      InsightPanelRef.current.resize(
        insightPanelSize === PANEL.INSIGHT.COLLAPSED
          ? PANEL.INSIGHT.DEFAULT
          : insightPanelSize
      );
    }
  }, [insightCollapsed]);

  // === 프로젝트 변경 감지 ===
  // URL 변경(projectId 변경)에 따라 selectedBrainId 상태 업데이트
  useEffect(() => {
    setSelectedBrainId(projectId);
    setIsProjectLoading(true);
  }, [projectId]);

  // 모든 패널이 준비되면 로딩 상태 해제
  useEffect(() => {
    if (isProjectLoading && allReady) setIsProjectLoading(false);
    // projectId가 바뀔 때만 검사
  }, [allReady, isProjectLoading, projectId]);

  // === 노드 뷰 로딩 상태 관리 ===
  // focusNodeNames가 실제로 변경(즉, 그래프에 반영)될 때 스피너 해제
  useEffect(() => {
    if (isNodeViewLoading) {
      setIsNodeViewLoading(null);
    }
  }, [focusNodeNames]);

  return (
    <div className="main-container" style={{ position: "relative" }}>
      {/* === 프로젝트 로딩 오버레이 === */}
      {isProjectLoading && (
        <div className="loading-overlay">
          <Spinner />
        </div>
      )}

      {/* === 좌측 프로젝트 선택 패널 === */}
      <div className="layout project-layout">
        <ProjectPanel
          selectedBrainId={Number(selectedBrainId)}
          onProjectChange={handleProjectChange}
        />
      </div>

      {/* === 중앙 패널 그룹: 소스 - 채팅 - 인사이트 === */}
      <PanelGroup direction="horizontal" className="panels-container">
        {/* === 1. Source 패널 === */}
        <Panel
          ref={sourcePanelRef}
          defaultSize={
            sourceCollapsed ? PANEL.SOURCE.COLLAPSED : PANEL.SOURCE.DEFAULT
          }
          minSize={sourceCollapsed ? PANEL.SOURCE.COLLAPSED : PANEL.SOURCE.MIN}
          maxSize={100}
          className={sourceCollapsed ? "panel-collapsed" : ""}
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
              highlightingInfo={highlightingInfo}
              onSourcePanelReady={() => setSourcePanelReady(true)}
              isNodeViewLoading={isNodeViewLoading}
              setIsNodeViewLoading={setIsNodeViewLoading}
            />
          </div>
        </Panel>

        <ResizeHandle />

        {/* === 2. Chat 패널 === */}
        <Panel
          ref={chatPanelRef}
          defaultSize={PANEL.CHAT.DEFAULT}
          minSize={30}
          onResize={handleChatResize}
        >
          <div className="layout-inner chat-inner">
            {selectedChatSession ? (
              <ChatPanel
                selectedSessionId={selectedChatSession}
                selectedBrainId={selectedBrainId}
                onReferencedNodesUpdate={onReferencedNodesUpdate}
                onOpenSource={handleOpenSource}
                onChatReady={setChatReady}
                sourceCountRefreshTrigger={sourceCountRefreshTrigger}
                onBackToList={handleBackToList}
                sessionInfo={sessionInfo}
              />
            ) : (
              <ChatSession
                selectedBrainId={selectedBrainId}
                onSessionSelect={handleSessionSelect}
                onChatReady={setChatReady}
              />
            )}
          </div>
        </Panel>

        <ResizeHandle />

        {/* === 3. Insight 패널 === */}
        <Panel
          ref={InsightPanelRef}
          defaultSize={
            insightCollapsed ? PANEL.INSIGHT.COLLAPSED : PANEL.INSIGHT.DEFAULT
          }
          minSize={
            insightCollapsed ? PANEL.INSIGHT.COLLAPSED : PANEL.INSIGHT.MIN
          }
          maxSize={100}
          className={insightCollapsed ? "panel-collapsed" : ""}
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
