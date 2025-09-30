/*
 GraphViewForFullscreen.jsx
 
 전체화면 그래프 보기 컴포넌트
 
 주요 기능:
 1. 전체화면 모드에서 그래프 탐색/검색/하이라이트 제어
 2. 다크모드 토글 및 고급 설정 패널 제공
 3. 그래프 통계(노드/링크/하이라이트) 표시
 4. 핵심 커스터마이징(노드 크기/링크 두께/텍스트 투명도 + 반발력/링크 거리/장력)
 
 UI 구성:
 - SpaceBackground: 다크모드 시 우주 배경
 - GraphView: 실제 그래프 렌더링 뷰(풀스크린 플래그, 커스터마이징 전달)
 - Toolbar: 좌측 검색/우측 토글들(다크모드/설정/새로고침/해제)
 - Advanced Controls Panel: 표시/물리 슬라이더 제어
 - Status Bar: 현재 하이라이트/포커스/새 노드 상태, 단축키 도움말
 
 상호작용/단축키:
 - Ctrl/Cmd + F: 검색 입력 포커스
 - Ctrl/Cmd + K: 고급 설정 패널 토글
 - Ctrl/Cmd + D: 다크모드 토글
 - ESC: 닫기 및 초기화
 */

import React, { useState, useEffect, useCallback } from "react";
import GraphView from "./GraphView";
import SpaceBackground from "./SpaceBackground";
import "./GraphViewForFullscreen.css";
import "./SpaceBackground.css";
import {
  FiSearch,
  FiX,
  FiSun,
  FiMoon,
  FiSettings,
  FiRefreshCw,
  FiMapPin,
  FiLoader,
} from "react-icons/fi";

// ===== 메인 컴포넌트 =====
/**
 * 전체화면 그래프 뷰 컴포넌트
 *
 * 전달 props:
 * - isFullscreen?: boolean            전체화면 렌더링 여부 (기본값: true)
 * - referencedNodes?: string[]        하이라이트할 노드 이름 배열
 * - focusNodeNames?: string[]         포커스할 노드 이름 배열
 * - brainId?: string | number         그래프 동기화용 식별자 (localStorage 신호에 활용)
 * - onGraphDataUpdate?: (data) => void 그래프 데이터 변경 시 상위로 전달
 * - onNewlyAddedNodes?: (names) => void 신규 노드 감지 시 상위로 전달 (GraphView에서 사용)
 * - onClearHighlights?: () => void    하이라이트 초기화 핸들러 (없다면 localStorage 신호 사용)
 * - onRefresh?: () => void            그래프 새로고침 핸들러 (없다면 localStorage 신호 사용)
 * - onClose?: () => void              ESC 시 전체화면 종료 등 상위 처리
 * - 그 외 props는 GraphView로 전달됩니다.
 *
 * 반환:
 * - 전체화면 컨테이너 + GraphView + 오버레이 UI(툴바/패널/상태바)
 */
function GraphViewForFullscreen(props) {
  const { isFullscreen = true, ...restProps } = props;

  // ===== 상태/설정 =====
  const [allNodes, setAllNodes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [localReferencedNodes, setLocalReferencedNodes] = useState(
    props.referencedNodes || []
  );
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [graphStats, setGraphStats] = useState({ nodes: 0, links: 0 });
  const [newlyAddedNodes, setNewlyAddedNodes] = useState([]);
  const [clearTrigger, setClearTrigger] = useState(0);

  // 다크모드 상태
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 색상 상수 (다크/라이트에 따라 자동 전환)
  const ICON_COLOR = isDarkMode ? "white" : "black";

  // 핵심 커스터마이징 설정
  const [graphSettings, setGraphSettings] = useState({
    nodeSize: 6, // 노드 크기
    linkWidth: 1, // 링크 두께
    textZoomThreshold: 0.5, // 텍스트 표시 시작점
    textAlpha: 1.0, // 텍스트 투명도
  });

  // ===== 콜백 =====
  /**
   * 다크모드 토글
   * - 상태를 반전시켜 배경/아이콘 색 등 UI를 전환합니다.
   */
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  /**
   * 그래프 데이터 업데이트 핸들러
   *
   * @param {Object} graphData - GraphView에서 전달되는 그래프 데이터
   * @param {Array} graphData.nodes - 노드 배열
   * @param {Array} graphData.links - 링크 배열
   *
   * 동작:
   * - 모든 노드의 이름을 수집하여 검색용 목록(allNodes)으로 저장
   * - 그래프 통계(노드/링크 수) 업데이트
   * - 상위 onGraphDataUpdate 콜백이 존재하면 그대로 전달
   */
  const handleGraphDataUpdate = useCallback(
    (graphData) => {
      if (graphData && graphData.nodes) {
        setAllNodes(graphData.nodes.map((node) => node.name));
        setGraphStats({
          nodes: graphData.nodes.length,
          links: graphData.links?.length || 0,
        });
      }
      if (props.onGraphDataUpdate) {
        props.onGraphDataUpdate(graphData);
      }
    },
    [props.onGraphDataUpdate]
  );

  /**
   * 신규 추가 노드 감지 핸들러
   *
   * @param {string[]} nodeNames - 새로 추가된 노드들의 이름 배열
   *
   * 동작:
   * - 상태에 저장하여 상태바 및 GraphView 하이라이트에 반영
   */
  const handleNewlyAddedNodes = useCallback((nodeNames) => {
    console.log("풀스크린에서 새로 추가된 노드 감지:", nodeNames);
    setNewlyAddedNodes(nodeNames || []);
  }, []);

  // ===== 이펙트 =====
  /**
   * 상위에서 전달되는 referencedNodes 변경 시 로컬 상태 동기화
   */
  useEffect(() => {
    setLocalReferencedNodes(props.referencedNodes || []);
  }, [props.referencedNodes]);

  /**
   * 노드명 검색 핸들러
   *
   * @param {string} query - 검색어(공백 분리 멀티 토큰 지원)
   *
   * 동작:
   * - allNodes에서 검색어 토큰 중 하나라도 포함하는 노드명을 매칭
   * - 매칭 결과를 하이라이트 대상으로 설정
   * - 빈 검색어나 노드가 없으면 상위에서 내려온 referencedNodes로 복원
   */
  const handleSearch = useCallback(
    (query) => {
      if (!query.trim() || allNodes.length === 0) {
        setLocalReferencedNodes(props.referencedNodes || []);
        return;
      }

      const searchTerms = query.toLowerCase().split(/\s+/);
      const matchingNodes = allNodes.filter((nodeName) =>
        searchTerms.some((term) => nodeName.toLowerCase().includes(term))
      );

      setLocalReferencedNodes(matchingNodes);
    },
    [allNodes, props.referencedNodes]
  );

  /**
   * 검색 입력 처리 핸들러
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e
   *
   * 동작:
   * - 입력값을 상태에 반영하고 로딩 애니메이션 표시
   * - 300ms 지연 후 실제 검색(handleSearch) 실행
   */
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsSearching(true);

    // Simulate search delay for animation
    setTimeout(() => {
      handleSearch(query);
      setIsSearching(false);
    }, 300);
  };

  /**
   * 검색/하이라이트 초기화
   *
   * 동작:
   * - 검색어 및 하이라이트 상태를 모두 초기화
   * - onClearHighlights 콜백이 있으면 호출, 없으면 localStorage 신호 발행
   */
  const clearSearch = () => {
    console.log("검색 및 하이라이트 해제");
    setSearchQuery("");
    setLocalReferencedNodes([]);
    setNewlyAddedNodes([]);
    setClearTrigger((prev) => prev + 1);

    if (props.onClearHighlights) {
      props.onClearHighlights();
    } else {
      localStorage.setItem(
        "graphStateSync",
        JSON.stringify({
          brainId: props.brainId,
          action: "clear_highlights_from_fullscreen",
          timestamp: Date.now(),
        })
      );
    }
  };

  /**
   * 키보드 단축키 이펙트
   *
   * - Ctrl/Cmd + F: 검색창 포커스
   * - ESC: 닫기(onClose) 호출 후 검색 초기화
   * - Ctrl/Cmd + K: 고급 설정 패널 토글
   * - Ctrl/Cmd + D: 다크모드 토글
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        document.getElementById("fullscreen-node-search")?.focus();
      }
      if (e.key === "Escape") {
        if (props.onClose) {
          props.onClose();
        }
        clearSearch();
        document.getElementById("fullscreen-node-search")?.blur();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowAdvancedControls((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        toggleDarkMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDarkMode]);

  return (
    <div
      className={`graph-fullscreen-container ${isDarkMode ? "dark-mode" : ""}`}
    >
      {/* 우주 배경 - 다크모드일 때만 표시 */}
      <SpaceBackground isVisible={isDarkMode} />
      <GraphView
        {...restProps}
        isFullscreen={isFullscreen}
        fromFullscreen={true}
        referencedNodes={localReferencedNodes}
        onGraphDataUpdate={handleGraphDataUpdate}
        onNewlyAddedNodes={handleNewlyAddedNodes}
        externalShowReferenced={
          localReferencedNodes.length === 0 ? false : undefined
        }
        externalShowFocus={
          localReferencedNodes.length === 0 ? false : undefined
        }
        externalShowNewlyAdded={
          newlyAddedNodes.length === 0 ? false : undefined
        }
        clearTrigger={clearTrigger}
        isDarkMode={isDarkMode}
        // 커스터마이징 props 전달
        customNodeSize={graphSettings.nodeSize}
        customLinkWidth={graphSettings.linkWidth}
        textDisplayZoomThreshold={graphSettings.textZoomThreshold}
        textAlpha={graphSettings.textAlpha}
      />

      <div className="fullscreen-overlay">
        <div className="fullscreen-toolbar">
          <div className="toolbar-left">
            <div className="fullscreen-search-container">
              <div className="fullscreen-search-input-wrapper">
                {isSearching ? (
                  <FiLoader
                    className="fullscreen-search-icon search-loading"
                    style={{ color: ICON_COLOR }}
                  />
                ) : (
                  <FiSearch
                    className="fullscreen-search-icon"
                    style={{ color: ICON_COLOR }}
                  />
                )}
                <input
                  id="fullscreen-node-search"
                  type="text"
                  placeholder="노드 검색"
                  value={searchQuery}
                  onChange={handleSearchInput}
                  className="fullscreen-search-input"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="fullscreen-clear-search-btn"
                    title="검색 초기화"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FiX color={ICON_COLOR} />
                  </button>
                )}
              </div>
              {searchQuery && (
                <div
                  className={`fullscreen-search-results ${
                    localReferencedNodes.length > 0 ? "search-found" : ""
                  }`}
                >
                  {localReferencedNodes.length}개 노드 발견
                </div>
              )}
            </div>
          </div>

          <div className="toolbar-right">
            <button
              onClick={toggleDarkMode}
              className="fullscreen-control-btn darkmode-toggle"
              title={`${isDarkMode ? "라이트" : "다크"}모드`}
            >
              <span className="fullscreen-btn-icon">
                {isDarkMode ? (
                  <FiSun color={ICON_COLOR} />
                ) : (
                  <FiMoon color={ICON_COLOR} />
                )}
              </span>
              <span className="btn-text">{isDarkMode ? "라이트" : "다크"}</span>
            </button>

            <button
              onClick={() => setShowAdvancedControls((prev) => !prev)}
              className={`fullscreen-control-btn advanced-toggle ${
                showAdvancedControls ? "active" : ""
              }`}
              title="설정 컨트롤 토글"
            >
              <span className="fullscreen-btn-icon">
                <FiSettings color={ICON_COLOR} />
              </span>
              <span className="btn-text">설정</span>
            </button>

            <button
              onClick={() => {
                if (props.onRefresh) {
                  props.onRefresh();
                } else {
                  localStorage.setItem(
                    "graphStateSync",
                    JSON.stringify({
                      brainId: props.brainId,
                      action: "refresh_from_fullscreen",
                      timestamp: Date.now(),
                    })
                  );
                }
              }}
              className="fullscreen-control-btn refresh-btn"
              title="그래프 새로고침"
            >
              <span className="fullscreen-btn-icon">
                <FiRefreshCw color={ICON_COLOR} />
              </span>
              <span className="btn-text">새로고침</span>
            </button>

            {(localReferencedNodes.length > 0 ||
              (props.focusNodeNames && props.focusNodeNames.length > 0) ||
              newlyAddedNodes.length > 0) && (
              <button
                onClick={clearSearch}
                className="fullscreen-control-btn fullscreen-clear-btn"
                title="하이라이트 해제"
              >
                <span className="fullscreen-btn-icon">
                  <FiX color={ICON_COLOR} />
                </span>
                <span className="btn-text">해제</span>
              </button>
            )}
          </div>
        </div>

        {showAdvancedControls && (
          <>
            <div
              className="fullscreen-advanced-controls-overlay"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 1000,
                background: "rgba(0,0,0,0.01)",
                pointerEvents: "auto",
              }}
              onClick={() => setShowAdvancedControls(false)}
            />
            <div
              className="fullscreen-advanced-controls-panel"
              style={{ zIndex: 1001, position: "absolute", top: 80, right: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="fullscreen-panel-header">
                <h4>그래프 설정</h4>
                <button
                  onClick={() => setShowAdvancedControls(false)}
                  className="fullscreen-close-panel-btn"
                >
                  ✕
                </button>
              </div>
              <div className="fullscreen-panel-content">
                <div className="fullscreen-control-group">
                  <label>그래프 통계</label>
                  <div className="fullscreen-stats-grid">
                    <div className="fullscreen-stat-item">
                      <span className="fullscreen-stat-label">노드</span>
                      <span className="fullscreen-stat-value">
                        {graphStats.nodes}
                      </span>
                    </div>
                    <div className="fullscreen-stat-item">
                      <span className="fullscreen-stat-label">연결</span>
                      <span className="fullscreen-stat-value">
                        {graphStats.links}
                      </span>
                    </div>
                    <div className="fullscreen-stat-item">
                      <span className="fullscreen-stat-label">하이라이트</span>
                      <span className="fullscreen-stat-value">
                        {localReferencedNodes.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 표시 설정 */}
                <div className="fullscreen-control-group">
                  <label>표시 설정</label>
                  <div className="fullscreen-slider-container">
                    {/* 노드 크기 */}
                    <div className="fullscreen-slider-item">
                      <span className="fullscreen-slider-label">노드 크기</span>
                      <input
                        type="range"
                        min="3"
                        max="12"
                        step="0.5"
                        value={graphSettings.nodeSize}
                        onChange={(e) =>
                          setGraphSettings((prev) => ({
                            ...prev,
                            nodeSize: parseFloat(e.target.value),
                          }))
                        }
                        className="fullscreen-slider"
                      />
                      <span className="fullscreen-slider-value">
                        {graphSettings.nodeSize}
                      </span>
                    </div>

                    {/* 링크 두께 */}
                    <div className="fullscreen-slider-item">
                      <span className="fullscreen-slider-label">링크 두께</span>
                      <input
                        type="range"
                        min="0.5"
                        max="4"
                        step="0.1"
                        value={graphSettings.linkWidth}
                        onChange={(e) =>
                          setGraphSettings((prev) => ({
                            ...prev,
                            linkWidth: parseFloat(e.target.value),
                          }))
                        }
                        className="fullscreen-slider"
                      />
                      <span className="fullscreen-slider-value">
                        {graphSettings.linkWidth}
                      </span>
                    </div>

                    {/* 텍스트 투명도 */}
                    <div className="fullscreen-slider-item">
                      <span className="fullscreen-slider-label">
                        텍스트 투명도
                      </span>
                      <input
                        type="range"
                        min="0.0"
                        max="1"
                        step="0.05"
                        value={1 - graphSettings.textAlpha}
                        onChange={(e) =>
                          setGraphSettings((prev) => ({
                            ...prev,
                            textAlpha: 1 - parseFloat(e.target.value),
                          }))
                        }
                        className="fullscreen-slider"
                      />
                      <span className="fullscreen-slider-value">
                        {Math.round((1 - graphSettings.textAlpha) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="fullscreen-statusbar">
          <div className="fullscreen-status-left">
            {(localReferencedNodes.length > 0 ||
              newlyAddedNodes.length > 0) && (
              <div className="fullscreen-highlighted-nodes">
                <span className="fullscreen-status-icon">
                  <FiMapPin color={ICON_COLOR} />
                </span>
                <span className="fullscreen-status-text">
                  {props.focusNodeNames && props.focusNodeNames.length > 0
                    ? "포커스"
                    : newlyAddedNodes.length > 0
                    ? "새로 추가"
                    : "하이라이트"}
                  :
                  {(localReferencedNodes.length > 0
                    ? localReferencedNodes
                    : newlyAddedNodes
                  )
                    .slice(0, 3)
                    .join(", ")}
                  {(localReferencedNodes.length > 0
                    ? localReferencedNodes
                    : newlyAddedNodes
                  ).length > 3 &&
                    ` 외 ${
                      (localReferencedNodes.length > 0
                        ? localReferencedNodes
                        : newlyAddedNodes
                      ).length - 3
                    }개`}
                </span>
              </div>
            )}
          </div>

          <div className="fullscreen-status-right">
            <div className="fullscreen-keyboard-shortcuts">
              <span className="fullscreen-shortcut">Ctrl + +</span>
              <span className="fullscreen-shortcut-desc">줌인</span>
              <span className="fullscreen-shortcut">Ctrl + -</span>
              <span className="fullscreen-shortcut-desc">줌아웃</span>
              <span className="fullscreen-shortcut">Ctrl + K</span>
              <span className="fullscreen-shortcut-desc">설정</span>
              <span className="fullscreen-shortcut">ESC</span>
              <span className="fullscreen-shortcut-desc">전체화면 종료</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GraphViewForFullscreen;
