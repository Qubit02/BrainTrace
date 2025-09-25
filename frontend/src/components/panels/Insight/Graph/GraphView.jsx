/**
 * GraphView 컴포넌트
 *
 * 이 컴포넌트는 브레인 프로젝트의 2D Force-Directed 지식 그래프 시각화를 담당합니다.
 * 주요 기능:
 * - ForceGraph2D를 사용한 인터랙티브 그래프 렌더링
 * - 노드/링크 데이터 시각화 및 상호작용
 * - 노드 하이라이트, 포커스, 신규 노드 애니메이션
 * - 외부 상태(참고노드, 포커스노드 등)와 동기화
 * - 그래프 물리 파라미터(반발력, 링크거리 등) 실시간 조정
 * - 마우스/키보드 인터랙션 (드래그, 줌, 팬, 검색)
 * - 다크모드 지원 및 반응형 UI
 * - 타임랩스 애니메이션 및 노드 상태 팝업
 *
 * Props:
 * - brainId: 현재 브레인 ID
 * - height: 그래프 높이 (숫자 또는 '100%')
 * - graphData: 초기 그래프 데이터 (선택사항)
 * - referencedNodes: 참고된 노드 이름 목록
 * - focusNodeNames: 포커스할 노드 이름 목록
 * - graphRefreshTrigger: 그래프 새로고침 트리거
 * - isFullscreen: 전체화면 모드 여부
 * - onGraphDataUpdate: 그래프 데이터 업데이트 콜백
 * - onTimelapse: 타임랩스 제어용 ref
 * - onNewlyAddedNodes: 신규 노드 추가 시 콜백
 * - onGraphReady: 그래프 준비 완료 시 콜백
 * - externalShowReferenced: 외부에서 참고노드 표시 제어
 * - externalShowFocus: 외부에서 포커스노드 표시 제어
 * - externalShowNewlyAdded: 외부에서 신규노드 표시 제어
 * - clearTrigger: 하이라이팅 해제 트리거
 * - isDarkMode: 다크모드 여부
 * - customNodeSize: 노드 크기 조정
 * - customLinkWidth: 링크 두께 조정
 * - textDisplayZoomThreshold: 텍스트 표시 줌 임계값
 * - textAlpha: 텍스트 투명도
 * - repelStrength: 반발력 강도 (0-100)
 * - linkDistance: 링크 거리 (0-100)
 * - linkStrength: 링크 장력 (0-100)
 * - onClearReferencedNodes: 참고노드 하이라이트 해제 콜백
 * - onClearFocusNodes: 포커스노드 하이라이트 해제 콜백
 * - onClearNewlyAddedNodes: 신규노드 하이라이트 해제 콜백
 * - fromFullscreen: 전체화면에서 복귀 여부
 * - showSearch: 검색 입력 표시 여부
 *
 * 상태 관리:
 * - dimensions: 그래프 컨테이너 크기
 * - graphData: 현재 그래프 데이터
 * - loading: 데이터 로딩 상태
 * - error: 에러 상태
 * - visibleNodes/visibleLinks: 애니메이션용 노드/링크
 * - isAnimating: 애니메이션 진행 상태
 * - pulseStartTime: 펄스 애니메이션 시작 시간
 * - hoveredNode/hoveredLink: 호버된 노드/링크
 * - draggedNode: 드래그 중인 노드
 * - connectedNodeSet: 드래그 중인 노드와 연결된 노드 집합
 * - showReferenced/showFocus/showNewlyAdded: 하이라이팅 표시 여부
 * - newlyAddedNodeNames: 신규 추가된 노드 이름 목록
 * - searchQuery/searchResults: 검색 관련 상태
 * - graphReady: 그래프 준비 완료 상태
 *
 * 주요 기능:
 * - 노드 클릭/더블클릭 처리 (카메라 이동, 줌)
 * - 마우스 호버 시 자동 노드 감지
 * - 드래그 중 연결된 노드 하이라이트
 * - 물리 시뮬레이션 파라미터 실시간 조정
 * - 검색 결과 노드 하이라이트 및 카메라 이동
 * - 키보드 단축키 (Ctrl+/- 줌, 더블클릭 줌인)
 * - 반응형 크기 조정 및 초기 줌 레벨 계산
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import ForceGraph2D from "react-force-graph-2d";
import * as d3 from "d3";
import { fetchGraphData } from "../../../../../api/services/graphApi";
import "./GraphView.css";
import { startTimelapse } from "./graphTimelapse";
import { toast } from "react-toastify";
import SpaceBackground from "./SpaceBackground";

/**
 * NodeStatusPopup 컴포넌트
 *
 * 그래프에서 특정 상태의 노드들을 표시하는 팝업 컴포넌트입니다.
 *
 * Props:
 * - type: 노드 타입 (NEW, REF, FOCUS)
 * - color: 타입별 색상
 * - nodes: 표시할 노드 이름 목록
 * - onClose: 팝업 닫기 콜백
 *
 * 기능:
 * - 노드 목록 표시 및 확장/축소
 * - 텍스트 오버플로우 감지 및 확장 가능 여부 표시
 * - 클릭으로 확장/축소 토글
 */
const NodeStatusPopup = ({ type, color, nodes, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current) {
      const element = textRef.current;
      // 접힌 상태에서 텍스트가 넘치는지 확인 (말줄임표가 나타나는지)
      const isOverflowing = element.scrollWidth > element.clientWidth;
      setCanExpand(isOverflowing);

      // 펼칠 수 없으면 항상 접힌 상태로 유지
      if (!isOverflowing) {
        setIsExpanded(false);
      }
    }
  }, [nodes]);

  const toggleExpand = () => {
    if (canExpand) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={`graph-popup ${isExpanded ? "expanded" : ""} ${canExpand ? "expandable" : ""
        }`}
      onClick={toggleExpand}
    >
      <div className="popup-content">
        <span className="popup-tag" style={{ background: color }}>
          {type}
        </span>
        <span ref={textRef} className="popup-text">
          {nodes.join(", ")}
        </span>
      </div>
      <span className="close-x" onClick={onClose}>
        ×
      </span>
    </div>
  );
};

function GraphView({
  // === 기본 설정 ===
  brainId = "default-brain-id",
  height = "100%",
  graphData: initialGraphData = null,

  // === 노드 상태 관리 ===
  referencedNodes = [],
  focusNodeNames = [],
  graphRefreshTrigger,

  // === UI 모드 설정 ===
  isFullscreen = false,
  isDarkMode = false,
  fromFullscreen = false,
  showSearch,

  // === 콜백 함수들 ===
  onGraphDataUpdate,
  onTimelapse,
  onNewlyAddedNodes,
  onGraphReady,
  onClearReferencedNodes,
  onClearFocusNodes,
  onClearNewlyAddedNodes,

  // === 외부 제어 상태 ===
  externalShowReferenced,
  externalShowFocus,
  externalShowNewlyAdded,
  clearTrigger,

  // === 시각적 설정 ===
  customNodeSize = 5,
  customLinkWidth = 1,
  textDisplayZoomThreshold = isFullscreen ? 0.05 : 0.1,
  textAlpha = 1.0,

  // === 물리 시뮬레이션 설정 (0-100 범위) ===
  repelStrength = 3, // 반발력 강도
  linkDistance = 30, // 링크 거리
  linkStrength = 50, // 링크 장력
}) {
  // === 그래프 컨테이너/크기 관련 ===
  const containerRef = useRef(null); // 그래프 컨테이너 DOM 참조
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 }); // 그래프 영역 크기

  // === 그래프 데이터/로딩/에러 관련 ===
  const [graphData, setGraphData] = useState({ nodes: [], links: [] }); // 현재 그래프 데이터
  const [loading, setLoading] = useState(true); // 데이터 로딩 상태
  const [error, setError] = useState(null); // 에러 상태
  const prevGraphDataRef = useRef({ nodes: [], links: [] }); // 이전 그래프 데이터(신규노드 감지용)

  // === ForceGraph2D 및 애니메이션 관련 ===
  const fgRef = useRef(); // ForceGraph2D ref
  const [visibleNodes, setVisibleNodes] = useState([]); // 애니메이션 등에서 보여지는 노드 목록
  const [visibleLinks, setVisibleLinks] = useState([]); // 애니메이션 등에서 보여지는 링크 목록
  const [isAnimating, setIsAnimating] = useState(false); // 타임랩스 등 애니메이션 동작 여부
  const [pulseStartTime, setPulseStartTime] = useState(null); // 포커스/신규노드 펄스 애니메이션 시작 시각
  const [refPulseStartTime, setRefPulseStartTime] = useState(null); // 참고노드 펄스 애니메이션 시작 시각

  // === 마우스 인터랙션 상태 ===
  const [hoveredNode, setHoveredNode] = useState(null); // 호버된 노드 상태
  const [hoveredLink, setHoveredLink] = useState(null); // 호버된 링크 상태

  // === 드래그 상태 관리 ===
  const [draggedNode, setDraggedNode] = useState(null); // 드래그 중인 노드
  const [connectedNodeSet, setConnectedNodeSet] = useState(new Set()); // 드래그 중인 노드와 연결된 노드 집합

  /**
   * BFS를 사용하여 시작 노드와 연결된 노드 ID 집합을 반환합니다.
   * 2단계 깊이까지만 탐색하여 가까운 연결만 고려합니다.
   *
   * @param {string} startId - 시작 노드 ID
   * @param {Array} links - 그래프의 모든 링크 배열
   * @returns {Set} 연결된 노드 ID 집합 (2단계 깊이까지)
   */
  const getAllConnectedNodeIds = (startId, links) => {
    const visited = new Set();
    const queue = [{ id: startId, depth: 0 }];
    const maxDepth = 2; // 최대 2단계 깊이까지만 탐색

    while (queue.length > 0) {
      const { id: current, depth } = queue.shift();

      if (!visited.has(current) && depth <= maxDepth) {
        visited.add(current);

        // 최대 깊이에 도달했으면 더 이상 탐색하지 않음
        if (depth === maxDepth) continue;

        links.forEach((link) => {
          // source/target이 객체일 수 있으니 id로 변환
          const sourceId =
            typeof link.source === "object" ? link.source.id : link.source;
          const targetId =
            typeof link.target === "object" ? link.target.id : link.target;

          if (sourceId === current && !visited.has(targetId)) {
            queue.push({ id: targetId, depth: depth + 1 });
          }
          if (targetId === current && !visited.has(sourceId)) {
            queue.push({ id: sourceId, depth: depth + 1 });
          }
        });
      }
    }
    return visited;
  };

  // === 마우스 인터랙션 처리 ===
  // 마우스 근처 노드 자동 호버 및 더블클릭 처리
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!fgRef.current || loading) return;
      window._lastMouseX = e.clientX;
      window._lastMouseY = e.clientY;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { x, y } = fgRef.current.screen2GraphCoords(mouseX, mouseY);
      const nodes = (isAnimating ? visibleNodes : graphData.nodes) || [];
      let minDist = Infinity;
      let nearest = null;
      for (const node of nodes) {
        if (typeof node.x !== "number" || typeof node.y !== "number") continue;
        const dx = node.x - x;
        const dy = node.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          nearest = node;
        }
      }
      if (nearest && minDist < 35) {
        setHoveredNode(nearest);
        document.body.style.cursor = "pointer";
      } else {
        setHoveredNode(null);
        document.body.style.cursor = "default";
      }
    };
    const handleMouseLeave = () => {
      setHoveredNode(null);
      setHoveredLink(null);
      document.body.style.cursor = "default";
    };
    // hover 더블클릭 시 해당 노드로 이동
    const handleDblClick = (e) => {
      if (!fgRef.current || !hoveredNode) return;
      // 노드 중심으로 카메라 이동 및 확대
      fgRef.current.centerAt(hoveredNode.x, hoveredNode.y, 800);
      fgRef.current.zoom(1.5, 800);
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", handleMouseLeave);
      container.addEventListener("dblclick", handleDblClick);
    }
    return () => {
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", handleMouseLeave);
        container.removeEventListener("dblclick", handleDblClick);
      }
    };
  }, [
    fgRef,
    containerRef,
    graphData,
    visibleNodes,
    isAnimating,
    loading,
    hoveredNode,
  ]);

  // === 하이라이트/포커스/신규노드 관련 ===
  const [showReferenced, setShowReferenced] = useState(
    () => !localStorage.getItem("참고노드팝업닫힘")
  ); // 참고노드 하이라이트 표시 여부
  const [showFocus, setShowFocus] = useState(
    () => !localStorage.getItem("포커스노드팝업닫힘")
  ); // 포커스노드 하이라이트 표시 여부
  const [newlyAddedNodeNames, setNewlyAddedNodeNames] = useState([]); // 새로 추가된 노드 이름 목록
  const [showNewlyAdded, setShowNewlyAdded] = useState(
    () => !localStorage.getItem("추가노드팝업닫힘")
  ); // 신규노드 하이라이트 표시 여부

  // 노드 이름 비교 정규화 유틸리티 (공백/대소문자 무시)
  const normalizeName = (name) =>
    String(name || "")
      .replace(/\*/g, "")
      .trim()
      .toLowerCase();

  // 표시용 클린 노드명 생성 (모든 *) 제거
  const cleanNodeName = (name) => (name || "").replace(/\*/g, "");

  // referencedSet을 useMemo로 변경하여 불필요한 재생성 방지
  const referencedSet = useMemo(
    () => new Set((referencedNodes || []).map((n) => normalizeName(n))),
    [referencedNodes]
  );

  // 검색 결과를 위한 별도의 Set
  const [searchReferencedSet, setSearchReferencedSet] = useState(new Set());

  // === 더블클릭/이벤트 관련 ===
  const lastClickRef = useRef({ node: null, time: 0 }); // 노드 더블클릭 감지용
  const clickTimeoutRef = useRef(); // 더블클릭 타이머 ref

  // === 그래프 준비 상태 ===
  const [graphReady, setGraphReady] = useState(false); // 그래프 준비 완료 상태

  // === 색상 팔레트 및 다크모드 대응 ===
  // 라이트모드용 색상 팔레트 (노드 연결수에 따른 색상)
  const lightColorPalette = [
    "#444444",
    "#666666",
    "#888888",
    "#aaaaaa",
    "#3366bb",
    "#333333",
    "#777777",
    "#999999",
    "#5588cc",
    "#555555",
  ];

  // 다크모드용 색상 팔레트 (노드 연결수에 따른 색상)
  const darkColorPalette = [
    "#e2e8f0",
    "#cbd5e1",
    "#94a3b8",
    "#64748b",
    "#60a5fa",
    "#f1f5f9",
    "#d1d5db",
    "#9ca3af",
    "#3b82f6",
    "#e5e7eb",
  ];

  // 현재 모드에 따른 색상 팔레트 선택
  const colorPalette = isDarkMode ? darkColorPalette : lightColorPalette;

  // === 컨테이너 크기 계산 및 반응형 처리 ===
  /**
   * 창 크기 변화에 따라 그래프 영역 크기를 자동으로 조정합니다.
   * ResizeObserver와 함께 사용되어 반응형 레이아웃을 지원합니다.
   */
  const updateDimensions = () => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const calcHeight =
      typeof height === "number"
        ? height
        : height === "100%"
          ? window.innerHeight
          : containerRef.current.clientHeight || 550;

    setDimensions({ width, height: calcHeight });
  };

  // === 그래프 초기 줌/중심 위치 계산 ===
  /**
   * 노드 개수에 따라 적절한 초기 줌 배율을 계산합니다.
   *
   * @param {number} nodeCount - 그래프의 총 노드 개수
   * @returns {number} 초기 줌 배율 (0.01 ~ 5.0 범위)
   */
  const getInitialZoomScale = (nodeCount) => {
    // Modal용 줌 배율 (더 확대)
    const modalMultiplier = isFullscreen ? 5 : 1.5; // Modal일 때 1.5배 더 확대

    let baseZoom;
    if (nodeCount >= 1000) baseZoom = 0.045;
    else if (nodeCount >= 500) baseZoom = 0.05;
    else if (nodeCount >= 100) baseZoom = 0.07;
    else if (nodeCount >= 50) baseZoom = 0.15;
    else if (nodeCount >= 40) baseZoom = 0.2;
    else if (nodeCount >= 30) baseZoom = 0.25;
    else if (nodeCount >= 20) baseZoom = 0.3;
    else if (nodeCount >= 10) baseZoom = 0.4;
    else if (nodeCount >= 5) baseZoom = 0.8;
    else baseZoom = 1;

    return Math.min(baseZoom * modalMultiplier, 5); // 최대 줌 제한
  };

  // === 카메라 이동 유틸리티 함수 ===
  /**
   * 지정된 노드들로 카메라를 이동시키는 공통 함수입니다.
   *
   * @param {Array} nodes - 이동할 노드 배열
   * @param {number} delay - 이동 시작 전 대기 시간 (ms)
   * @param {number} zoomDuration - 줌 애니메이션 지속 시간 (ms)
   * @param {number} centerDuration - 중심 이동 애니메이션 지속 시간 (ms)
   */
  const moveCameraToNodes = (
    nodes,
    delay = 1000,
    zoomDuration = 800,
    centerDuration = 1000
  ) => {
    if (
      !nodes.length ||
      !fgRef.current ||
      !dimensions.width ||
      !dimensions.height
    )
      return;

    const validNodes = nodes.filter(
      (n) => typeof n.x === "number" && typeof n.y === "number"
    );
    if (validNodes.length === 0) return;

    const fg = fgRef.current;

    // 중심점 계산
    const avgX =
      validNodes.reduce((sum, n) => sum + n.x, 0) / validNodes.length;
    const avgY =
      validNodes.reduce((sum, n) => sum + n.y, 0) / validNodes.length;

    // 바운딩 박스 계산
    const xs = validNodes.map((n) => n.x);
    const ys = validNodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    const padding = 500;
    const zoomScaleX = dimensions.width / (boxWidth + padding);
    const zoomScaleY = dimensions.height / (boxHeight + padding);
    const targetZoom = Math.min(zoomScaleX, zoomScaleY, 5);

    // 카메라 이동 애니메이션
    fg.zoom(0.05, zoomDuration);

    setTimeout(() => {
      fg.centerAt(avgX, avgY, centerDuration);
      setTimeout(() => {
        fg.zoom(targetZoom, centerDuration);
      }, centerDuration);
    }, zoomDuration);
  };

  // === 노드 클릭/더블클릭 핸들러 ===
  /**
   * 노드 클릭 이벤트를 처리합니다.
   * - 단일 클릭: 아무 동작 없음
   * - 더블 클릭: 해당 노드로 카메라 이동 및 확대
   *
   * @param {Object} node - 클릭된 노드 객체
   */
  const handleNodeClick = (node) => {
    const now = Date.now();
    const { node: lastNode, time: lastTime } = lastClickRef.current;

    if (lastNode === node && now - lastTime < 300) {
      clearTimeout(clickTimeoutRef.current);
      lastClickRef.current = { node: null, time: 0 };

      if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 800);
        fgRef.current.zoom(1.5, 800);
      }
    } else {
      lastClickRef.current = { node, time: now };
      clickTimeoutRef.current = setTimeout(() => {
        lastClickRef.current = { node: null, time: 0 };
      }, 300);
    }
  };

  // === 그래프 물리 파라미터 실시간 적용 ===
  /**
   * 물리 시뮬레이션 설정(반발력, 링크거리, 링크장력)이 변경될 때
   * ForceGraph2D의 D3 시뮬레이션을 업데이트합니다.
   */
  useEffect(() => {
    if (fgRef.current && graphData && graphData.nodes) {
      const fg = fgRef.current;

      // 물리 설정 계산
      const repelForce = -10 - (repelStrength / 100) * 290;
      const linkDist = 30 + (linkDistance / 100) * 270;
      const linkForce = 0.1 + (linkStrength / 100) * 0.9;

      console.log("🔧 물리 설정 업데이트:", {
        repelStrength,
        linkDistance,
        linkStrength,
        repelForce,
        linkDist,
        linkForce,
      });

      // 올바른 ForceGraph2D 방식으로 물리 설정 변경
      fg.d3Force("charge", d3.forceManyBody().strength(repelForce));
      fg.d3Force(
        "link",
        d3
          .forceLink()
          .id((d) => d.id)
          .distance(linkDist)
          .strength(linkForce)
      );

      // 노드들의 고정 상태 해제
      graphData.nodes.forEach((node) => {
        delete node.fx;
        delete node.fy;
      });

      // 시뮬레이션 완전 재시작
      fg.d3ReheatSimulation();

      // 강제로 시뮬레이션 활성화
      setTimeout(() => {
        const simulation = fg.d3Force();
        if (simulation) {
          // 시뮬레이션 alpha 값을 높여서 활성화
          simulation.alpha(1);
          simulation.alphaDecay(0.02);
          simulation.velocityDecay(0.4);

          // 추가로 시뮬레이션 재시작
          fg.d3ReheatSimulation();

          const chargeForce = simulation.force("charge");
          const linkForce = simulation.force("link");

          console.log("🔍 물리 설정 확인:", {
            chargeStrength: chargeForce ? chargeForce.strength() : "N/A",
            linkDistance: linkForce ? linkForce.distance() : "N/A",
            linkStrength: linkForce ? linkForce.strength() : "N/A",
            targetCharge: repelForce,
            targetLinkDist: linkDist,
            targetLinkStrength: linkForce,
            simulationAlpha: simulation.alpha(),
            nodeCount: graphData.nodes.length,
          });
        }
      }, 100);

      // 추가 지연으로 한 번 더 재시작
      setTimeout(() => {
        fg.d3ReheatSimulation();

        // 모든 노드의 고정 상태 완전 해제
        graphData.nodes.forEach((node) => {
          delete node.fx;
          delete node.fy;
        });

        // 시뮬레이션 강제 활성화
        const simulation = fg.d3Force();
        if (simulation) {
          simulation.alpha(1);
          simulation.alphaDecay(0.01);
          simulation.velocityDecay(0.3);
        }

        console.log("🔄 최종 시뮬레이션 재시작 완료");
      }, 300);

      console.log("✅ 물리 설정 적용 완료");
    }
  }, [repelStrength, linkDistance, linkStrength, graphData]);

  // === 더블클릭 시 그래프 줌인 ===
  /**
   * 노드가 아닌 곳에서 더블클릭 시 해당 위치로 카메라를 이동하고 확대합니다.
   * 사용자가 그래프의 빈 공간을 더블클릭하여 해당 영역을 자세히 볼 수 있습니다.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !fgRef.current) return;

    const handleDoubleClick = (e) => {
      // 노드가 아닌 곳에서 더블클릭 시 줌인
      // hoveredNode가 없을 때만 실행 (노드가 아닌 곳)
      if (!hoveredNode) {
        const fg = fgRef.current;
        const boundingRect = container.getBoundingClientRect();
        const mouseX = e.clientX - boundingRect.left;
        const mouseY = e.clientY - boundingRect.top;

        const graphCoords = fg.screen2GraphCoords(mouseX, mouseY);
        fg.centerAt(graphCoords.x, graphCoords.y, 800);
        fg.zoom(fg.zoom() * 2, 800); // 현재 줌에서 2배 확대
      }
    };

    container.addEventListener("dblclick", handleDoubleClick);

    return () => {
      container.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [dimensions]);

  // === 하이라이팅 해제 처리 ===
  /**
   * 외부에서 전달된 clearTrigger를 감지하여 모든 하이라이팅 상태를 해제합니다.
   * 참고노드, 포커스노드, 신규노드의 하이라이팅과 펄스 애니메이션을 모두 중지합니다.
   */
  useEffect(() => {
    if (clearTrigger > 0) {
      console.log(
        "🧹 GraphView에서 하이라이팅 해제 트리거 감지:",
        clearTrigger
      );

      // 모든 하이라이팅 상태 해제
      setShowReferenced(false);
      setShowFocus(false);
      setShowNewlyAdded(false);
      setNewlyAddedNodeNames([]);

      // 펄스 애니메이션도 중지
      setPulseStartTime(null);
      setRefPulseStartTime(null);
    }
  }, [clearTrigger]);

  // === 외부 상태 동기화 ===
  /**
   * 외부에서 전달된 props로 하이라이팅 상태를 제어합니다.
   * 부모 컴포넌트에서 참고노드, 포커스노드, 신규노드의 표시 여부를
   * 동적으로 변경할 수 있습니다.
   */

  // 참고노드 표시 상태 동기화
  useEffect(() => {
    if (typeof externalShowReferenced === "boolean") {
      setShowReferenced(externalShowReferenced);
    }
  }, [externalShowReferenced]);

  // 포커스노드 표시 상태 동기화
  useEffect(() => {
    if (typeof externalShowFocus === "boolean") {
      setShowFocus(externalShowFocus);
    }
  }, [externalShowFocus]);

  // 신규노드 표시 상태 동기화
  useEffect(() => {
    if (typeof externalShowNewlyAdded === "boolean") {
      setShowNewlyAdded(externalShowNewlyAdded);
    }
  }, [externalShowNewlyAdded]);

  // === 신규 노드 추가 감지 및 콜백 ===
  /**
   * 그래프 데이터 변경 시 신규 노드를 감지하고 부모 컴포넌트에 알립니다.
   * 중복 알림을 방지하기 위해 이전 값과 비교하여 실제 변경된 경우만 콜백을 호출합니다.
   */
  useEffect(() => {
    if (!onNewlyAddedNodes || newlyAddedNodeNames.length === 0) return;

    // 이전 값과 비교해서 실제로 변경된 경우만 알림
    const prevNodes = prevGraphDataRef.current.nodes.map((n) => n.name);
    const isChanged =
      JSON.stringify(prevNodes) !== JSON.stringify(newlyAddedNodeNames);

    if (isChanged) {
      console.log("새로 추가된 노드 외부 알림:", newlyAddedNodeNames);
      onNewlyAddedNodes(newlyAddedNodeNames);
      prevGraphDataRef.current = {
        ...prevGraphDataRef.current,
        nodes: [
          ...prevGraphDataRef.current.nodes,
          ...graphData.nodes.filter((n) =>
            newlyAddedNodeNames.includes(n.name)
          ),
        ],
      };
    }
  }, [newlyAddedNodeNames, onNewlyAddedNodes]);

  // === 컨테이너 크기 조정 및 반응형 처리 ===
  /**
   * 컨테이너 크기 변화를 감지하고 그래프 영역을 자동으로 조정합니다.
   * ResizeObserver를 사용하여 DOM 크기 변화를 실시간으로 감지합니다.
   */
  useEffect(() => {
    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      if (containerRef.current) resizeObserver.unobserve(containerRef.current);
    };
  }, [height]);

  // === 초기 줌 및 중심 위치 설정 ===
  /**
   * 그래프 로딩 완료 후 노드 개수에 따라 적절한 초기 줌 레벨을 설정합니다.
   * 그래프를 화면 중앙에 배치하고 사용자가 전체 구조를 한눈에 볼 수 있도록 합니다.
   */
  useEffect(() => {
    if (!loading && graphData.nodes.length > 0 && fgRef.current) {
      const zoom = getInitialZoomScale(graphData.nodes.length);
      fgRef.current.centerAt(0, 0, 0);
      fgRef.current.zoom(zoom, 0);

      // 초기 로드 시 시뮬레이션을 더 활발하게 시작
      setTimeout(() => {
        if (fgRef.current) {
          const simulation = fgRef.current.d3Force();
          if (simulation) {
            // 시뮬레이션을 강하게 시작하여 노드들이 빠르게 분산되도록 함
            simulation.alpha(1);
            simulation.alphaDecay(0.01); // 천천히 감소하여 오래 지속
            simulation.velocityDecay(0.2); // 속도 감소를 줄여서 더 오래 움직이도록
            fgRef.current.d3ReheatSimulation();
          }
        }
      }, 100);
    }
  }, [loading, graphData]);

  // === 포커스 노드 펄스 애니메이션 시작 ===
  /**
   * focusNodeNames가 변경될 때 포커스 노드의 펄스 애니메이션을 시작합니다.
   * 사용자가 특정 노드에 집중할 수 있도록 시각적 피드백을 제공합니다.
   */
  useEffect(() => {
    if (focusNodeNames && focusNodeNames.length > 0) {
      setShowFocus(true);
      setPulseStartTime(Date.now());
    }
  }, [focusNodeNames]);

  // === 그래프 데이터 로딩 ===
  /**
   * 컴포넌트 마운트 시 그래프 데이터를 로딩합니다.
   * initialGraphData가 제공된 경우 이를 사용하고, 그렇지 않으면 API에서 데이터를 가져옵니다.
   */
  useEffect(() => {
    if (initialGraphData) {
      processGraphData(initialGraphData);
      setgraphReady(true);
      return;
    }

    const loadGraphData = async () => {
      try {
        setLoading(true);
        const data = await fetchGraphData(brainId);
        processGraphData(data);
        setGraphReady(true);
      } catch (err) {
        setError("그래프 데이터를 불러오는 데 실패했습니다.");
        setLoading(false);
        setGraphReady(false);
      }
    };

    loadGraphData();
  }, [brainId, initialGraphData]);

  // === 그래프 준비 완료 콜백 ===
  /**
   * graphReady 상태가 변경될 때마다 부모 컴포넌트에 알립니다.
   * 부모 컴포넌트에서 그래프의 준비 상태를 추적할 수 있습니다.
   */
  useEffect(() => {
    if (onGraphReady) onGraphReady(graphReady);
  }, [graphReady, onGraphReady]);

  // === 그래프 새로고침 트리거 처리 ===
  /**
   * 외부에서 전달된 graphRefreshTrigger를 감지하여 그래프를 새로고침합니다.
   * 새로고침 시 신규 노드를 감지하고 하이라이트하여 사용자에게 알립니다.
   */
  useEffect(() => {
    if (!graphRefreshTrigger) return;

    const loadAndDetect = async () => {
      try {
        setLoading(true);

        const data = await fetchGraphData(brainId);

        const prevNames = new Set(
          prevGraphDataRef.current.nodes.map((n) => n.name)
        );
        const added = data.nodes
          .map((n) => n.name)
          .filter((name) => !prevNames.has(name));

        setNewlyAddedNodeNames(added);
        setShowNewlyAdded(added.length > 0);
        if (added.length > 0) {
          setPulseStartTime(Date.now());
        }

        processGraphData(data);
      } catch (err) {
        console.error("그래프 새로고침 실패:", err);
        setError("그래프 데이터를 불러오는 데 실패했습니다.");
        setLoading(false);
      }
    };

    loadAndDetect();
  }, [graphRefreshTrigger, brainId]);

  // === 참고노드 하이라이트 처리 ===
  /**
   * referencedNodes가 변경될 때 참고노드의 하이라이트를 활성화합니다.
   * 참고노드가 있을 때 펄스 애니메이션을 시작하여 사용자의 주의를 끕니다.
   */
  useEffect(() => {
    if (referencedNodes && referencedNodes.length > 0) {
      setRefPulseStartTime(Date.now());
      setShowReferenced(true);
      console.log("🎯 참조된 노드 하이라이팅 활성화:", referencedNodes);
    } else {
      setShowReferenced(false);
    }
  }, [referencedNodes]);

  // === 포커스노드 카메라 이동 ===
  /**
   * focusNodeNames가 변경될 때 해당 노드들로 카메라를 이동시킵니다.
   * 포커스 노드들을 화면 중앙에 배치하고 적절한 줌 레벨로 조정합니다.
   */
  useEffect(() => {
    if (!focusNodeNames || !focusNodeNames.length || !graphData.nodes.length)
      return;

    const focusNodes = graphData.nodes.filter((n) =>
      focusNodeNames.includes(n.name)
    );
    console.log(
      "🎯 Focus 대상 노드:",
      focusNodes.map((n) => n.name)
    );

    const validNodes = focusNodes.filter(
      (n) => typeof n.x === "number" && typeof n.y === "number"
    );
    console.log(
      "🧭 위치 정보 포함된 유효 노드:",
      validNodes.map((n) => ({ name: n.name, x: n.x, y: n.y }))
    );

    if (validNodes.length === 0) {
      console.warn("⚠️ 유효한 위치 정보가 없어 카메라 이동 생략됨");
      return;
    }

    moveCameraToNodes(validNodes, 1000, 800, 1000);
  }, [focusNodeNames, graphData.nodes]);

  // === 참고노드 카메라 이동 ===
  /**
   * 참고노드 하이라이트가 활성화될 때 해당 노드들로 카메라를 이동시킵니다.
   * 참고노드들을 화면 중앙에 배치하고 적절한 줌 레벨로 조정합니다.
   */
  useEffect(() => {
    if (
      !showReferenced ||
      !referencedNodes ||
      referencedNodes.length === 0 ||
      !graphData.nodes.length
    )
      return;

    const referenced = graphData.nodes.filter((n) =>
      searchQuery
        ? searchReferencedSet.has(cleanNodeName(n.name))
        : referencedSet.has(normalizeName(n.name))
    );
    if (referenced.length === 0) return;

    const timer = setTimeout(() => {
      const validNodes = referenced.filter(
        (n) => typeof n.x === "number" && typeof n.y === "number"
      );
      if (validNodes.length === 0) return;

      moveCameraToNodes(validNodes, 1000, 800, 1000);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showReferenced, referencedNodes, graphData, referencedSet]);

  // === 신규노드 카메라 이동 ===
  /**
   * 신규노드가 감지될 때 해당 노드들로 카메라를 이동시킵니다.
   * 새로 추가된 노드들을 화면 중앙에 배치하고 적절한 줌 레벨로 조정합니다.
   */
  useEffect(() => {
    if (!newlyAddedNodeNames.length || !graphData.nodes.length) return;

    const addedNodes = graphData.nodes.filter((n) =>
      newlyAddedNodeNames.includes(n.name)
    );
    if (addedNodes.length === 0) return;

    const timer = setTimeout(() => {
      const validNodes = addedNodes.filter(
        (n) => typeof n.x === "number" && typeof n.y === "number"
      );
      if (validNodes.length === 0) return;

      moveCameraToNodes(validNodes, 2000, 800, 1000);
    }, 2000);

    return () => clearTimeout(timer);
  }, [newlyAddedNodeNames, graphData]);

  // === 그래프 데이터 처리 함수 ===
  /**
   * API에서 받은 원시 그래프 데이터를 시각화에 적합한 형태로 가공합니다.
   *
   * 처리 내용:
   * - 노드별 연결 수 계산 및 색상 할당
   * - 링크의 source/target ID 정규화
   * - 노드 크기 및 시각적 속성 설정
   * - 부모 컴포넌트에 처리된 데이터 전달
   *
   * @param {Object} data - 원시 그래프 데이터 {nodes: [], links: []}
   */
  const processGraphData = (data) => {
    const linkCounts = {};
    data.links.forEach((link) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;

      linkCounts[sourceId] = (linkCounts[sourceId] || 0) + 1;
      linkCounts[targetId] = (linkCounts[targetId] || 0) + 1;
    });

    const processedData = {
      nodes: data.nodes.map((n, index) => {
        const nodeId = n.id || n.name;
        let nodeColor;

        const linkCount = linkCounts[nodeId] || 0;

        if (linkCount >= 3) {
          nodeColor = colorPalette[4];
        } else if (linkCount == 2) {
          nodeColor = colorPalette[0];
        } else {
          nodeColor = colorPalette[2];
        }

        const nodeName = n.name || n.label || n.id;

        return {
          ...n,
          id: nodeId || Math.random().toString(36).substr(2, 9),
          name: nodeName,
          color: nodeColor,
          linkCount: linkCount,
        };
      }),
      links: data.links.map((l) => ({
        ...l,
        source: typeof l.source === "object" ? l.source.id : l.source,
        target: typeof l.target === "object" ? l.target.id : l.target,
        relation: l.relation || l.label || "연결",
      })),
    };

    setGraphData(processedData);
    prevGraphDataRef.current = processedData;
    setLoading(false);
    if (onGraphDataUpdate) {
      onGraphDataUpdate(processedData);
    }
  };

  // === 외부 제어용 ref 노출 ===
  /**
   * 부모 컴포넌트에서 타임랩스 제어 및 팝업 데이터에 접근할 수 있도록
   * 컴포넌트의 내부 메서드와 상태를 노출합니다.
   */
  React.useImperativeHandle(onTimelapse, () => ({
    startTimelapse: () =>
      startTimelapse({
        graphData,
        setIsAnimating,
        setVisibleNodes,
        setVisibleLinks,
        fgRef,
      }),
    getPopupData: () => ({
      showNewlyAdded,
      newlyAddedNodeNames,
      showReferenced,
      referencedNodes: referencedNodes || [],
      showFocus,
      focusNodeNames,
      setShowNewlyAdded,
      setNewlyAddedNodeNames,
      setShowReferenced,
      setShowFocus,
    }),
  }));

  // === 검색 기능 관련 상태 ===
  const [searchQuery, setSearchQuery] = useState(""); // 검색 쿼리
  const [searchResults, setSearchResults] = useState([]); // 검색 결과
  const searchInputRef = useRef(null); // 검색 입력 필드 ref

  // 모든 노드 이름 목록 (검색용)
  const allNodeNames = graphData.nodes.map((node) => cleanNodeName(node.name));

  /**
   * 노드 검색 로직을 처리합니다 (부분일치, 대소문자 무시).
   *
   * @param {string} query - 검색 쿼리
   */
  const handleSearch = useCallback(
    (query) => {
      if (!query.trim() || allNodeNames.length === 0) {
        setSearchResults([]);
        return;
      }
      const lower = query.toLowerCase();
      const matchingNodes = allNodeNames.filter((nodeName) =>
        nodeName.toLowerCase().includes(lower)
      );
      setSearchResults(matchingNodes);
    },
    [allNodeNames]
  );

  /**
   * 검색 입력 필드의 변경을 처리합니다.
   *
   * @param {Event} e - 입력 이벤트
   */
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    handleSearch(query);
  };

  // === 검색 결과 처리 ===
  /**
   * 검색 결과가 변경될 때 해당 노드들을 하이라이트하고 펄스 애니메이션을 시작합니다.
   * 검색 쿼리가 비어있으면 하이라이팅을 해제합니다.
   */
  useEffect(() => {
    if (searchQuery === "") {
      setShowReferenced(false);
      setSearchReferencedSet(new Set());
      setRefPulseStartTime(null);
      return;
    }
    if (searchResults.length === 0) return;
    // 여러 노드 모두 하이라이트
    setShowReferenced(true);
    setSearchReferencedSet(new Set(searchResults));
    setRefPulseStartTime(Date.now());
  }, [searchQuery, searchResults]);

  // === 검색 입력 포커스 관리 ===
  /**
   * showSearch가 true가 될 때 검색 입력 필드에 자동으로 포커스를 설정합니다.
   * showSearch가 false가 될 때 검색 쿼리를 초기화합니다.
   */
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!showSearch) {
      setSearchQuery("");
    }
  }, [showSearch]);

  // === 키보드 단축키 처리 ===
  /**
   * 키보드 단축키를 처리하여 줌인/줌아웃 기능을 제공합니다.
   * Ctrl/Cmd + +/- 키로 그래프를 확대/축소할 수 있습니다.
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!fgRef.current) return;
      const fg = fgRef.current;
      const zoomStep = 1.2;
      let currZoom = fg.zoom();

      // Ctrl 키와 함께 눌러야 작동하도록 수정
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "+":
          case "=":
            e.preventDefault();
            fg.zoom(currZoom * zoomStep, 300);
            break;
          case "-":
          case "_":
            e.preventDefault();
            fg.zoom(currZoom / zoomStep, 300);
            break;
          default:
            break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fgRef]);

  // === 참고노드 안내 토스트 ===
  /**
   * 참고된 노드가 그래프에 하나도 없을 때 사용자에게 안내 토스트 메시지를 표시합니다.
   * 사용자가 참고노드가 왜 하이라이트되지 않는지 이해할 수 있도록 도움을 줍니다.
   */
  useEffect(() => {
    // 참고된 노드 팝업이 활성화되어 있고,
    // referencedNodes에 값이 있으며,
    // 그래프에 노드가 하나 이상 있고,
    // referencedNodes와 매치되는 노드가 그래프에 하나도 없을 때
    if (
      showReferenced &&
      referencedNodes &&
      referencedNodes.length > 0 &&
      graphData.nodes.length > 0 &&
      !graphData.nodes.some((n) => referencedSet.has(normalizeName(n.name)))
    ) {
      toast.info("참고된 노드가 그래프에 없습니다.");
    }
  }, [showReferenced, referencedNodes, graphData.nodes, referencedSet]);

  return (
    <div
      className={`graph-area ${isDarkMode ? "dark-mode" : ""}`}
      ref={containerRef}
      style={{
        backgroundColor: isDarkMode ? "transparent" : "#fafafa",
      }}
    >
      {isFullscreen && (
        <SpaceBackground isVisible={true} isDarkMode={isDarkMode} />
      )}

      {/* === 검색 입력 필드 === */}
      {/* 상단에 검색 입력 필드를 표시합니다 (showSearch prop이 true일 때만) */}
      {showSearch && (
        <div className="search-container">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="노드 검색"
            value={searchQuery}
            onChange={handleSearchInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchResults.length > 0) {
                const foundNodes = graphData.nodes.filter(
                  (n) =>
                    searchResults.includes(n.name) &&
                    typeof n.x === "number" &&
                    typeof n.y === "number"
                );
                if (
                  foundNodes.length === 0 ||
                  !fgRef.current ||
                  !dimensions.width ||
                  !dimensions.height
                )
                  return;

                // 중심점 계산
                const avgX =
                  foundNodes.reduce((sum, n) => sum + n.x, 0) /
                  foundNodes.length;
                const avgY =
                  foundNodes.reduce((sum, n) => sum + n.y, 0) /
                  foundNodes.length;

                // bounding box 계산
                const xs = foundNodes.map((n) => n.x);
                const ys = foundNodes.map((n) => n.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                const boxWidth = maxX - minX;
                const boxHeight = maxY - minY;
                const padding = 800;
                const zoomScaleX = dimensions.width / (boxWidth + padding);
                const zoomScaleY = dimensions.height / (boxHeight + padding);
                const targetZoom = Math.min(zoomScaleX, zoomScaleY, 5);

                fgRef.current.centerAt(avgX, avgY, 800);
                fgRef.current.zoom(targetZoom, 800);
              }
            }}
            className="graph-search-input"
          />
        </div>
      )}

      {/* === 노드 상태 팝업 컴포넌트들 === */}
      {/* 신규 추가된 노드 상태 팝업 */}
      {showNewlyAdded && newlyAddedNodeNames.length > 0 && (
        <NodeStatusPopup
          type="NEW"
          color="#10b981"
          nodes={newlyAddedNodeNames.map(cleanNodeName)}
          onClose={() => {
            setShowNewlyAdded(false);
            setNewlyAddedNodeNames([]);
            if (onClearNewlyAddedNodes) onClearNewlyAddedNodes();
          }}
        />
      )}

      {/* 참고노드 상태 팝업 (전체화면에서 복귀한 경우 제외) */}
      {!fromFullscreen &&
        showReferenced &&
        referencedNodes &&
        referencedNodes.length > 0 &&
        graphData.nodes.some((n) =>
          referencedSet.has(normalizeName(n.name))
        ) && (
          <NodeStatusPopup
            type="REF"
            color="#f59e0b"
            nodes={referencedNodes.map(cleanNodeName)}
            onClose={() => {
              setShowReferenced(false);
              if (onClearReferencedNodes) onClearReferencedNodes();
            }}
          />
        )}

      {/* 포커스노드 상태 팝업 */}
      {showFocus &&
        Array.isArray(focusNodeNames) &&
        focusNodeNames.length > 0 && (
          <NodeStatusPopup
            type="FOCUS"
            color="#3b82f6"
            nodes={focusNodeNames.map(cleanNodeName)}
            onClose={() => {
              setShowFocus(false);
              if (onClearFocusNodes) onClearFocusNodes();
            }}
          />
        )}

      {/* === 호버 툴팁 === */}
      {/* 마우스가 노드나 링크 위에 있을 때 표시되는 툴팁 */}
      {(hoveredNode || hoveredLink) && (
        <div
          className={`graph-hover-tooltip ${isFullscreen ? "fullscreen" : ""}`}
          style={{
            left: hoveredLink ? "8px" : "16px",
          }}
        >
          {hoveredNode && !hoveredLink && !draggedNode && (
            <div className="tooltip-content">
              <div className="tooltip-row">
                <span className="tooltip-label">노드:</span>
                <span className="tooltip-value">
                  {cleanNodeName(hoveredNode.name || hoveredNode.id)}
                </span>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-info">
                  (연결: {hoveredNode.linkCount})
                </span>
              </div>
            </div>
          )}
          {hoveredLink && (
            <div className="tooltip-content">
              <div className="tooltip-row">
                <span className="tooltip-value">
                  {cleanNodeName(
                    hoveredLink.source?.name || hoveredLink.source
                  )}
                </span>
                <span className="tooltip-arrow">→</span>
                <span className="tooltip-value">
                  {cleanNodeName(
                    hoveredLink.target?.name || hoveredLink.target
                  )}
                </span>
              </div>
              <div className="tooltip-row tooltip-indent">
                <span className="tooltip-info">
                  링크: {hoveredLink.relation || "없음"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === 로딩 및 에러 상태 표시 === */}
      {/* ForceGraph2D의 내장 tooltip 사용: nodeTitle, linkTitle 설정 */}
      {loading &&
        (isFullscreen ? (
          <div className={`graph-loading ${isDarkMode ? "dark" : "light"}`}>
            <div className="graph-loading-spinner"></div>
            <div>그래프를 불러오는 중입니다...</div>
          </div>
        ) : (
          <div className="graph-loading">
            <div className="graph-loading-text-animate">
              그래프를 불러오는 중입니다
              <span className="dot-animate">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          </div>
        ))}
      {error && <div className="graph-error">{error}</div>}

      {/* === ForceGraph2D 메인 그래프 컴포넌트 === */}
      {/* 로딩이 완료되고 노드가 있으며 컨테이너 크기가 설정된 경우에만 렌더링 */}
      {!loading && graphData.nodes.length > 0 && dimensions.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={
            isAnimating
              ? {
                nodes: visibleNodes,
                links: visibleLinks,
              }
              : graphData
          }
          linkLabel={(link) => `${link.relation}`}
          onNodeClick={handleNodeClick}
          nodeRelSize={customNodeSize}
          linkColor={() => (isDarkMode ? "#64748b" : "#dedede")}
          linkWidth={customLinkWidth}
          linkDirectionalArrowLength={6.5}
          linkDirectionalArrowRelPos={1}
          cooldownTime={8000} // 시뮬레이션 지속 시간 증가
          d3VelocityDecay={0.1} // 속도 감소를 줄여서 더 오래 움직이도록
          d3Force={(fg) => {
            fg.force(
              "center",
              d3.forceCenter(dimensions.width / 2, dimensions.height / 2)
            );
            fg.force("collide", d3.forceCollide(80)); // 노드 간 충돌 거리 증가

            // 초기 물리 설정 - 더 강한 반발력과 넓은 링크 거리
            fg.force("charge", d3.forceManyBody().strength(-150)); // 반발력 강화
            fg.force(
              "link",
              d3
                .forceLink()
                .id((d) => d.id)
                .distance(200) // 링크 거리 증가
                .strength(0.3) // 링크 장력 감소로 더 자유로운 움직임
            );
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            // === 노드 렌더링 로직 ===
            // 각 노드를 Canvas에 직접 그리는 함수
            ctx.save();
            // 드래그 중이면 연결된 모든 노드만 진하게, 나머지는 투명하게
            if (draggedNode) {
              // node.id가 string인지 확인, 아니면 변환
              const nodeId = typeof node.id === "object" ? node.id.id : node.id;
              ctx.globalAlpha = connectedNodeSet.has(nodeId) ? 1 : 0.18;
            } else {
              ctx.globalAlpha = node.__opacity ?? 1;
            }
            const label = cleanNodeName(node.name || node.id);
            const isReferenced =
              showReferenced &&
              (searchQuery
                ? searchReferencedSet.has(label)
                : referencedSet.has(normalizeName(label)));
            const isImportantNode = node.linkCount >= 3;
            const isNewlyAdded = newlyAddedNodeNames.includes(node.name);
            const isFocus = showFocus && focusNodeNames?.includes(node.name);
            const isRef =
              showReferenced &&
              (searchQuery
                ? searchReferencedSet.has(label)
                : referencedSet.has(normalizeName(label)));
            const r = (5 + Math.min(node.linkCount * 0.5, 3)) / globalScale;

            const baseSize = customNodeSize;
            const sizeFactor = Math.min(node.linkCount * 0.5, 3);
            const nodeSize = baseSize + sizeFactor;
            const nodeRadius = nodeSize / globalScale;
            const pulseScale = 1.5;
            const pulseDuration = 1000;

            // 다크모드에 따라 실시간으로 노드 색상 결정
            let nodeColor;
            if (node.linkCount >= 3) {
              nodeColor = isDarkMode ? "#60a5fa" : "#3366bb";
            } else if (node.linkCount == 2) {
              nodeColor = isDarkMode ? "#e2e8f0" : "#444444";
            } else {
              nodeColor = isDarkMode ? "#94a3b8" : "#888888";
            }

            // hover 효과: glow 및 테두리 강조
            // 링크가 hover 중이면 노드 hover 효과를 무시한다
            const isHovered =
              hoveredNode &&
              hoveredNode.id === node.id &&
              !draggedNode &&
              !hoveredLink;
            if (isHovered) {
              ctx.shadowColor = isDarkMode ? "#8ac0ffff" : "#9bc3ffff";
              ctx.shadowBlur = 16;
              ctx.fillStyle = isDarkMode ? "#76b1f9ff" : "#73a0f9ff";
            }

            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
            ctx.fillStyle = nodeColor;
            ctx.fill();

            // 드래그 중 연결된 노드는 폰트도 더 굵고 크게
            const fontSize =
              isReferenced || isNewlyAdded || isFocus
                ? 13 / globalScale
                : 9 / globalScale;
            ctx.font =
              isReferenced || isNewlyAdded || isFocus
                ? `bold ${fontSize}px Sans-Serif`
                : `${fontSize}px Sans-Serif`;

            // 펄스 효과
            if ((isNewlyAdded || isFocus) && pulseStartTime) {
              const elapsed = (Date.now() - pulseStartTime) % pulseDuration;
              const t = elapsed / pulseDuration;
              const ringR = r * (1 + t * (pulseScale - 1));
              ctx.beginPath();
              ctx.arc(node.x, node.y, ringR, 0, 2 * Math.PI);
              ctx.strokeStyle = isDarkMode
                ? `rgba(96, 165, 250, ${1 - t})`
                : `rgba(33,150,243,${1 - t})`;
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
            }

            if (isRef && refPulseStartTime) {
              const elapsed2 = (Date.now() - refPulseStartTime) % pulseDuration;
              const t2 = elapsed2 / pulseDuration;
              const ringR2 = r * (1 + t2 * (pulseScale - 1));
              ctx.beginPath();
              ctx.arc(node.x, node.y, ringR2, 0, 2 * Math.PI);
              ctx.strokeStyle = isDarkMode
                ? `rgba(251, 146, 60, ${1 - t2})`
                : `rgba(217,130,15,${1 - t2})`;
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
            }

            // 테두리 색상
            if (isHovered) {
              ctx.strokeStyle = isDarkMode ? "#67acfaff" : "#93bcf8ff";
              ctx.lineWidth = 7 / globalScale;
            } else if (isNewlyAdded || isFocus) {
              ctx.strokeStyle = isDarkMode ? "#60a5fa" : "#2196f3";
              ctx.lineWidth = 4 / globalScale;
              ctx.shadowColor = isDarkMode ? "#3b82f6" : "#90caf9";
              ctx.shadowBlur = 10;
            } else if (isReferenced) {
              ctx.strokeStyle = isDarkMode ? "#fb923c" : "#d9820f";
              ctx.lineWidth = 3 / globalScale;
              ctx.shadowColor = isDarkMode ? "#f97316" : "#ffc107";
              ctx.shadowBlur = 6;
            } else {
              ctx.strokeStyle = isImportantNode
                ? isDarkMode
                  ? "#e2e8f0"
                  : "white"
                : isDarkMode
                  ? "#64748b"
                  : "#cec8c8ff";
              ctx.lineWidth = 0.5 / globalScale;
              ctx.shadowBlur = 0;
            }
            ctx.stroke();

            // 텍스트 색상
            // 드래그 중 연결된 노드는 더 진한 색상
            const textColor = isDarkMode
              ? isImportantNode || isReferenced || isNewlyAdded || isFocus
                ? "#f1f5f9"
                : "#cbd5e1"
              : isImportantNode || isReferenced || isNewlyAdded || isFocus
                ? "#111"
                : "#555";

            // 줌 레벨이 임계값 이상일 때만 텍스트 표시
            if (globalScale >= textDisplayZoomThreshold) {
              ctx.globalAlpha = textAlpha;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = textColor;
              ctx.fillText(label, node.x, node.y + nodeRadius + 1);
              ctx.globalAlpha = 1; // 텍스트 이후 alpha 복원
            }
            node.__bckgDimensions = [nodeRadius * 2, fontSize].map(
              (n) => n + fontSize * 0.2
            );

            ctx.restore();
          }}
          enableNodeDrag={true}
          enableZoomPanInteraction={true}
          minZoom={0.01}
          maxZoom={5}
          onNodeDragEnd={(node) => {
            // === 노드 드래그 종료 처리 ===
            // 노드 고정 상태 해제 및 물리 시뮬레이션 복원
            delete node.fx;
            delete node.fy;
            setDraggedNode(null);
            setConnectedNodeSet(new Set());
            const fg = fgRef.current;
            if (fg) {
              // 반발력 strength 원래 값으로 복원
              const repelForce = -10 - (repelStrength / 100) * 290;
              fg.d3Force("charge", d3.forceManyBody().strength(repelForce));
              fg.d3ReheatSimulation();

              // 시뮬레이션 활성화
              const simulation = fg.d3Force();
              if (simulation) {
                simulation.alpha(1);
              }
            }
          }}
          onNodeDrag={(node) => {
            // === 노드 드래그 중 처리 ===
            // 연결된 노드 집합 계산 및 약한 반발력 적용
            setDraggedNode(node);
            // BFS로 연결된 모든 노드 집합 계산
            const connected = getAllConnectedNodeIds(node.id, graphData.links);
            setConnectedNodeSet(connected);
            const fg = fgRef.current;
            if (fg) {
              fg.d3Force("charge", d3.forceManyBody().strength(-10)); // 드래그 중 약한 반발력
            }
          }}
          linkCanvasObjectMode={() => "after"}
          linkCanvasObject={(link, ctx, globalScale) => {
            // === 링크 렌더링 로직 ===
            // 각 링크를 Canvas에 직접 그리는 함수
            const isHovered =
              hoveredLink &&
              hoveredLink.source === link.source &&
              hoveredLink.target === link.target &&
              !draggedNode;
            const sourceId =
              typeof link.source === "object" ? link.source.id : link.source;
            const targetId =
              typeof link.target === "object" ? link.target.id : link.target;
            if (draggedNode) {
              const isConnected =
                connectedNodeSet.has(sourceId) &&
                connectedNodeSet.has(targetId);
              ctx.save();
              ctx.globalAlpha = isConnected ? 1 : 0.13;

              // 연결된 링크는 흰색 계열로 표시
              if (isConnected) {
                ctx.strokeStyle = isDarkMode ? "#ffffff" : "#444444";
                ctx.lineWidth = customLinkWidth * 1.1;
                ctx.shadowColor = isDarkMode ? "#ffffff" : "#000000";
                ctx.shadowBlur = 4;
              } else {
                ctx.strokeStyle = isDarkMode ? "#64748b" : "#dedede";
                ctx.lineWidth = customLinkWidth;
                ctx.shadowBlur = 0;
              }

              ctx.beginPath();
              ctx.moveTo(link.source.x, link.source.y);
              ctx.lineTo(link.target.x, link.target.y);
              ctx.stroke();

              // hover 효과는 항상 마지막에 한 번만
              if (isHovered) {
                ctx.strokeStyle = isDarkMode ? "#66acfcff" : "#94bdfcff";
                ctx.shadowColor = isDarkMode ? "#89c0feff" : "#92b5fbff";
                ctx.shadowBlur = 16;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(link.source.x, link.source.y);
                ctx.lineTo(link.target.x, link.target.y);
                ctx.stroke();
              }
              ctx.restore();
            } else if (isHovered) {
              ctx.save();
              ctx.globalAlpha = 1;
              ctx.strokeStyle = isDarkMode ? "#66acfcff" : "#94bdfcff";
              ctx.shadowColor = isDarkMode ? "#89c0feff" : "#92b5fbff";
              ctx.shadowBlur = 16;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(link.source.x, link.source.y);
              ctx.lineTo(link.target.x, link.target.y);
              ctx.stroke();
              ctx.restore();
            }
          }}
          onLinkHover={(link) => {
            // === 링크 호버 처리 ===
            // 마우스가 링크 위에 있을 때 호버 상태 설정
            setHoveredLink(link);
          }}
        />
      )}
    </div>
  );
}

export default GraphView;