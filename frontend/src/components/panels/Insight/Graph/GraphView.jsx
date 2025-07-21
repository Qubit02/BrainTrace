// === GraphView: 지식 그래프 2D Force-Directed 시각화 메인 컴포넌트 ===
// - 노드/링크 데이터 렌더링
// - 노드 하이라이트, 포커스, 신규 노드 애니메이션 등 다양한 UX 제공
// - 외부 상태(참고노드, 포커스노드 등)와 동기화
// - 그래프 물리 파라미터(반발력, 링크거리 등) 실시간 조정 지원

import React, { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';
import { fetchGraphData } from '../../../../../api/graphApi';
import './GraphView.css';
import { startTimelapse } from './graphTimelapse';
import { FiSearch, FiX } from 'react-icons/fi';
import { MdOutlineSearch } from "react-icons/md";

function GraphView({
  brainId = 'default-brain-id',
  height = '100%',
  graphData: initialGraphData = null,
  referencedNodes = [],
  focusNodeNames = [],
  graphRefreshTrigger,
  isFullscreen = false,
  onGraphDataUpdate,
  onTimelapse,
  onNewlyAddedNodes,
  onGraphReady,
  externalShowReferenced,
  externalShowFocus,
  externalShowNewlyAdded,
  clearTrigger,
  isDarkMode = false,
  customNodeSize = 5,
  customLinkWidth = 1,
  textDisplayZoomThreshold = isFullscreen ? 0.05 : 0.1, // ✅ Modal에서는 더 낮은 임계값

  // 3개 물리 설정 (0-100 범위)
  repelStrength = 50,     // 반발력
  linkDistance = 50,      // 링크 거리  
  linkStrength = 50,      // 링크 장력
  onClearReferencedNodes,
  onClearFocusNodes,
  onClearNewlyAddedNodes,
  fromFullscreen = false,
  showSearch
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
  const [hoveredNode, setHoveredNode] = useState(null); // ⭐️ hover된 노드 상태 추가
  const [hoveredLink, setHoveredLink] = useState(null); // ⭐️ hover된 링크 상태 추가

  // ⭐️ 자석 효과: 마우스 근처 노드 자동 hover
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
        if (typeof node.x !== 'number' || typeof node.y !== 'number') continue;
        const dx = node.x - x;
        const dy = node.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          nearest = node;
        }
      }
      if (nearest && minDist < 40) {
        setHoveredNode(nearest);
        document.body.style.cursor = 'pointer';
      } else {
        setHoveredNode(null);
        document.body.style.cursor = 'default';
      }
    };
    const handleMouseLeave = () => {
      setHoveredNode(null);
      setHoveredLink(null);
      document.body.style.cursor = 'default';
    };
    // ⭐️ 자석 hover 더블클릭 시 해당 노드로 이동
    const handleDblClick = (e) => {
      if (!fgRef.current || !hoveredNode) return;
      // 노드 중심으로 카메라 이동 및 확대
      fgRef.current.centerAt(hoveredNode.x, hoveredNode.y, 800);
      fgRef.current.zoom(2, 800);
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
      container.addEventListener('dblclick', handleDblClick);
    }
    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('dblclick', handleDblClick);
      }
    };
  }, [fgRef, containerRef, graphData, visibleNodes, isAnimating, loading, hoveredNode]);

  // === 하이라이트/포커스/신규노드 관련 ===
  const [referencedSet, setReferencedSet] = useState(new Set()); // 참고노드 집합(빠른 lookup용)
  const [showReferenced, setShowReferenced] = useState(() => !localStorage.getItem('참고노드팝업닫힘')); // 참고노드 하이라이트 표시 여부
  const [showFocus, setShowFocus] = useState(() => !localStorage.getItem('포커스노드팝업닫힘')); // 포커스노드 하이라이트 표시 여부
  const [newlyAddedNodeNames, setNewlyAddedNodeNames] = useState([]); // 새로 추가된 노드 이름 목록
  const [showNewlyAdded, setShowNewlyAdded] = useState(() => !localStorage.getItem('추가노드팝업닫힘')); // 신규노드 하이라이트 표시 여부
  const [referencedNodesState, setReferencedNodesState] = useState(referencedNodes || []); // referencedNodes를 state로 관리

  // === 더블클릭/이벤트 관련 ===
  const lastClickRef = useRef({ node: null, time: 0 }); // 노드 더블클릭 감지용
  const clickTimeoutRef = useRef(); // 더블클릭 타이머 ref

  // === 그래프 준비 상태 ===
  const [graphReady, setGraphReady] = useState(false); // 그래프 준비 상태

  // === 색상 팔레트 및 다크모드 대응 ===
  // 다크모드용 색상 팔레트 추가
  const lightColorPalette = [
    '#444444', '#666666', '#888888', '#aaaaaa', '#3366bb',
    '#333333', '#777777', '#999999', '#5588cc', '#555555',
  ];

  const darkColorPalette = [
    '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#60a5fa',
    '#f1f5f9', '#d1d5db', '#9ca3af', '#3b82f6', '#e5e7eb',
  ];

  // 현재 팔레트 선택
  const colorPalette = isDarkMode ? darkColorPalette : lightColorPalette;

  // === 컨테이너 크기 계산 및 반응형 처리 ===
  // 창 크기 변화에 따라 그래프 영역 크기 자동 조정
  const updateDimensions = () => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const calcHeight =
      typeof height === 'number'
        ? height
        : height === '100%'
          ? window.innerHeight
          : containerRef.current.clientHeight || 550;

    setDimensions({ width, height: calcHeight });
  };

  // === 그래프 초기 줌/중심 위치 계산 ===
  // 노드 개수에 따라 적절한 줌 배율 계산
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

  // === 노드 클릭/더블클릭 핸들러 ===
  // - 단일 클릭: nothing
  // - 더블 클릭: 해당 노드로 카메라 이동 및 확대
  // 노드 클릭 핸들러
  const handleNodeClick = (node) => {
    const now = Date.now();
    const { node: lastNode, time: lastTime } = lastClickRef.current;

    if (lastNode === node && now - lastTime < 300) {
      clearTimeout(clickTimeoutRef.current);
      lastClickRef.current = { node: null, time: 0 };

      if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 800);
        fgRef.current.zoom(2, 800);
      }
    } else {
      lastClickRef.current = { node, time: now };
      clickTimeoutRef.current = setTimeout(() => {
        lastClickRef.current = { node: null, time: 0 };
      }, 300);
    }
  };

  // === 그래프 물리 파라미터(반발력, 링크거리 등) 실시간 적용 ===
  // 슬라이더 등으로 조정된 값이 바로 반영되도록 d3Force 설정
  //슬라이더 물리 효과 조절
  // 3개 물리 설정만 처리하는 useEffect
  useEffect(() => {
    if (fgRef.current) {
      const fg = fgRef.current;

      // 반발력 공식 (0% = 가까이 모임, 100% = 멀리 퍼짐)
      const repelForce = -10 - (repelStrength / 100) * 290;    // 0% = -10, 100% = -300
      const linkDist = 50 + (linkDistance / 100) * 250;        // 50 to 300
      const linkForce = 0.1 + (linkStrength / 100) * 0.9;      // 0.1 to 1.0

      // 해당 force만 업데이트
      fg.d3Force("charge", d3.forceManyBody().strength(repelForce));
      fg.d3Force("link", d3.forceLink().id(d => d.id).distance(linkDist).strength(linkForce));

      // 시뮬레이션 재시작
      fg.d3ReheatSimulation();
    }
  }, [repelStrength, linkDistance, linkStrength]);

  // === 더블클릭 시 그래프 줌인 ===
  // 노드가 아닌 곳 더블클릭 시 해당 위치로 카메라 이동 및 확대
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !fgRef.current) return;

    const handleDoubleClick = (e) => {
      // 노드가 아닌 곳에서 더블클릭 시 줌인
      // 예외적으로 마우스 커서가 노드 위가 아니었는지 확인하는 조건 필요
      if (!document.body.style.cursor.includes('pointer')) {
        const fg = fgRef.current;
        const boundingRect = container.getBoundingClientRect();
        const mouseX = e.clientX - boundingRect.left;
        const mouseY = e.clientY - boundingRect.top;

        const graphCoords = fg.screen2GraphCoords(mouseX, mouseY);
        fg.centerAt(graphCoords.x, graphCoords.y, 800);
        fg.zoom(fg.zoom() * 2, 800); // 현재 줌에서 1.5배 확대
      }
    };

    container.addEventListener('dblclick', handleDoubleClick);

    return () => {
      container.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [dimensions]);

  useEffect(() => {
    if (clearTrigger > 0) {
      console.log('🧹 GraphView에서 하이라이팅 해제 트리거 감지:', clearTrigger);

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

  // === 외부에서 하이라이트/포커스/신규노드 상태 제어 동기화 ===
  // 외부 props로 showReferenced, showFocus, showNewlyAdded 등 제어
  useEffect(() => {
    if (typeof externalShowReferenced === 'boolean') {
      setShowReferenced(externalShowReferenced);
    }
  }, [externalShowReferenced]);

  useEffect(() => {
    if (typeof externalShowFocus === 'boolean') {
      setShowFocus(externalShowFocus);
    }
  }, [externalShowFocus]);

  useEffect(() => {
    if (typeof externalShowNewlyAdded === 'boolean') {
      setShowNewlyAdded(externalShowNewlyAdded);
    }
  }, [externalShowNewlyAdded]);

  // === 신규 노드 추가 감지 및 콜백 ===
  // 그래프 데이터 변경 시 신규 노드 감지, 콜백 호출
  // 새로 추가된 노드 알림 - 중복 방지 로직 추가
  useEffect(() => {
    if (!onNewlyAddedNodes || newlyAddedNodeNames.length === 0) return;

    // 이전 값과 비교해서 실제로 변경된 경우만 알림
    const prevNodes = prevGraphDataRef.current.nodes.map(n => n.name);
    const isChanged = JSON.stringify(prevNodes) !== JSON.stringify(newlyAddedNodeNames);

    if (isChanged) {
      console.log('🆕 새로 추가된 노드 외부 알림:', newlyAddedNodeNames);
      onNewlyAddedNodes(newlyAddedNodeNames);
      prevGraphDataRef.current = { ...prevGraphDataRef.current, nodes: [...prevGraphDataRef.current.nodes, ...graphData.nodes.filter(n => newlyAddedNodeNames.includes(n.name))] };
    }
  }, [newlyAddedNodeNames, graphData.nodes]); // ✅ onNewlyAddedNodes 의존성 제거

  useEffect(() => {
    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      if (containerRef.current) resizeObserver.unobserve(containerRef.current);
    };
  }, [height]);

  useEffect(() => {
    if (!loading && graphData.nodes.length > 0 && fgRef.current) {
      const zoom = getInitialZoomScale(graphData.nodes.length);
      console.log("노드의 갯수 : ", graphData.nodes.length)
      fgRef.current.centerAt(0, 0, 0);
      fgRef.current.zoom(zoom, 0);
    }
  }, [loading, graphData]);

  // focusNodeNames 변경 시 펄스 시작
  useEffect(() => {
    if (focusNodeNames && focusNodeNames.length > 0) {
      setShowFocus(true);
      setPulseStartTime(Date.now());
    }
  }, [focusNodeNames]);

  // 그래프 데이터 로딩
  useEffect(() => {
    if (initialGraphData) {
      processGraphData(initialGraphData);
      setGraphReady(true);
      return;
    }

    const loadGraphData = async () => {
      try {
        setLoading(true);
        const data = await fetchGraphData(brainId);
        processGraphData(data);
        setGraphReady(true);
      } catch (err) {
        setError('그래프 데이터를 불러오는 데 실패했습니다.');
        setLoading(false);
        setGraphReady(false);
      }
    };

    loadGraphData();
  }, [brainId, initialGraphData]);

  // === 그래프 준비 완료 시 콜백 ===
  // graphReady가 바뀔 때마다 부모에 전달
  useEffect(() => {
    if (onGraphReady) onGraphReady(graphReady);
  }, [graphReady, onGraphReady]);

  // === 그래프 새로고침 트리거 처리 ===
  // - 새로고침 시 신규 노드 감지 및 하이라이트
  useEffect(() => {
    if (!graphRefreshTrigger) return;

    const loadAndDetect = async () => {
      try {
        setLoading(true);

        const data = await fetchGraphData(brainId);

        const prevNames = new Set(prevGraphDataRef.current.nodes.map(n => n.name));
        const added = data.nodes
          .map(n => n.name)
          .filter(name => !prevNames.has(name));

        setNewlyAddedNodeNames(added);
        setShowNewlyAdded(added.length > 0);
        if (added.length > 0) {
          setPulseStartTime(Date.now());
        }

        processGraphData(data);

      } catch (err) {
        console.error('그래프 새로고침 실패:', err);
        setError('그래프 데이터를 불러오는 데 실패했습니다.');
        setLoading(false);
      }
    };

    loadAndDetect();
  }, [graphRefreshTrigger, brainId]);

  useEffect(() => {
    setReferencedNodesState(referencedNodes || []);
  }, [referencedNodes]);

  // === 참고노드(referencedNodes) 하이라이트 처리 ===
  useEffect(() => {
    console.log('referencedNodes:', referencedNodesState);
    setReferencedSet(new Set(referencedNodesState));
    if (referencedNodesState.length > 0) {
      setRefPulseStartTime(Date.now());
      setShowReferenced(true);
    }
  }, [referencedNodesState]);

  // === 포커스노드(focusNodeNames) 하이라이트 및 카메라 이동 ===
  // 포커스 노드 카메라 이동
  useEffect(() => {
    if (!focusNodeNames || !focusNodeNames.length || !graphData.nodes.length) return;

    const focusNodes = graphData.nodes.filter(n => focusNodeNames.includes(n.name));
    console.log("🎯 Focus 대상 노드:", focusNodes.map(n => n.name));

    const validNodes = focusNodes.filter(n => typeof n.x === 'number' && typeof n.y === 'number');
    console.log("🧭 위치 정보 포함된 유효 노드:", validNodes.map(n => ({ name: n.name, x: n.x, y: n.y })));

    if (validNodes.length === 0) {
      console.warn("⚠️ 유효한 위치 정보가 없어 카메라 이동 생략됨");
      return;
    }

    const fg = fgRef.current;
    if (!fg || !dimensions.width || !dimensions.height) return;

    const avgX = validNodes.reduce((sum, n) => sum + n.x, 0) / validNodes.length;
    const avgY = validNodes.reduce((sum, n) => sum + n.y, 0) / validNodes.length;

    const xs = validNodes.map(n => n.x);
    const ys = validNodes.map(n => n.y);
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

    fg.zoom(0.05, 800);

    setTimeout(() => {
      fg.centerAt(avgX, avgY, 1000);
      setTimeout(() => {
        fg.zoom(targetZoom, 1000);
      }, 1000);
    }, 900);
  }, [focusNodeNames, graphData.nodes]);

  // === 참고노드 카메라 이동 ===
  // 참고된 노드 카메라 이동
  useEffect(() => {
    if (!showReferenced || referencedNodesState.length === 0 || !graphData.nodes.length) return;

    const referenced = graphData.nodes.filter(n => referencedSet.has(n.name));
    if (referenced.length === 0) return;

    const timer = setTimeout(() => {
      const validNodes = referenced.filter(n => typeof n.x === 'number' && typeof n.y === 'number');
      if (validNodes.length === 0) return;

      const fg = fgRef.current;
      if (!fg || !dimensions.width || !dimensions.height) return;

      const avgX = validNodes.reduce((sum, n) => sum + n.x, 0) / validNodes.length;
      const avgY = validNodes.reduce((sum, n) => sum + n.y, 0) / validNodes.length;

      const xs = validNodes.map(n => n.x);
      const ys = validNodes.map(n => n.y);
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

      fg.zoom(0.05, 800);

      setTimeout(() => {
        fg.centerAt(avgX, avgY, 1000);
        setTimeout(() => {
          fg.zoom(targetZoom, 1000);
        }, 1000);
      }, 900);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showReferenced, referencedNodesState, graphData, referencedSet]);

  // === 신규노드 카메라 이동 ===
  // 새로 추가된 노드 카메라 이동
  useEffect(() => {
    if (!newlyAddedNodeNames.length || !graphData.nodes.length) return;

    const addedNodes = graphData.nodes.filter(n => newlyAddedNodeNames.includes(n.name));
    if (addedNodes.length === 0) return;

    const timer = setTimeout(() => {
      const validNodes = addedNodes.filter(n => typeof n.x === 'number' && typeof n.y === 'number');
      if (validNodes.length === 0) return;

      const fg = fgRef.current;
      if (!fg || !dimensions.width || !dimensions.height) return;

      const avgX = validNodes.reduce((sum, n) => sum + n.x, 0) / validNodes.length;
      const avgY = validNodes.reduce((sum, n) => sum + n.y, 0) / validNodes.length;

      const xs = validNodes.map(n => n.x);
      const ys = validNodes.map(n => n.y);
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

      fg.zoom(0.05, 800);

      setTimeout(() => {
        fg.centerAt(avgX, avgY, 1000);
        setTimeout(() => {
          fg.zoom(targetZoom, 1000);
        }, 1000);
      }, 900);
    }, 2000);

    return () => clearTimeout(timer);
  }, [newlyAddedNodeNames, graphData]);

  // === 그래프 데이터 처리 함수 ===
  // - 노드/링크별 색상, 연결수 등 가공
  // - onGraphDataUpdate 콜백 호출
  const processGraphData = (data) => {
    const linkCounts = {};
    data.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

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
          linkCount: linkCount
        };
      }),
      links: data.links.map(l => ({
        ...l,
        source: typeof l.source === 'object' ? l.source.id : l.source,
        target: typeof l.target === 'object' ? l.target.id : l.target,
        relation: l.relation || l.label || '연결'
      }))
    };

    setGraphData(processedData);
    prevGraphDataRef.current = processedData;
    setLoading(false);
    if (onGraphDataUpdate) {
      onGraphDataUpdate(processedData);
    }
  };

  // === 타임랩스/팝업 등 외부 제어용 ref 노출 ===
  // 외부에서 팝업 데이터에 접근할 수 있도록 노출
  React.useImperativeHandle(onTimelapse, () => ({
    startTimelapse: () => startTimelapse({ graphData, setIsAnimating, setVisibleNodes, setVisibleLinks, fgRef }),
    getPopupData: () => ({
      showNewlyAdded,
      newlyAddedNodeNames,
      showReferenced,
      referencedNodes,
      showFocus,
      focusNodeNames,
      setShowNewlyAdded,
      setNewlyAddedNodeNames,
      setShowReferenced,
      setShowFocus
    })
  }));

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // 노드 이름 목록
  const allNodeNames = graphData.nodes.map(node => node.name);

  // 노드 검색 로직 (부분일치, 대소문자 무시)
  const handleSearch = useCallback((query) => {
    if (!query.trim() || allNodeNames.length === 0) {
      setSearchResults([]);
      return;
    }
    const lower = query.toLowerCase();
    const matchingNodes = allNodeNames.filter(nodeName => nodeName.toLowerCase().includes(lower));
    setSearchResults(matchingNodes);
  }, [allNodeNames]);

  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    handleSearch(query);
  };

  // 검색 결과 노드 카메라 이동 및 펄스
  useEffect(() => {
    if (searchQuery === '') {
      setShowReferenced(false);
      setReferencedSet(new Set());
      setRefPulseStartTime(null);
      return;
    }
    if (searchResults.length === 0) return;
    // 여러 노드 모두 하이라이트
    setShowReferenced(true);
    setReferencedSet(new Set(searchResults));
    setRefPulseStartTime(Date.now());
  }, [searchQuery, searchResults]);

  return (
    <div
      className={`graph-area ${isDarkMode ? 'dark-mode' : ''}`}
      ref={containerRef}
      style={{
        backgroundColor: isDarkMode ? '#0f172a' : '#fafafa'
      }}
    >

      {/* 상단에 검색 인풋 표시 (showSearch prop이 true일 때만) */}
      {showSearch && (
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            placeholder="노드 검색"
            value={searchQuery}
            onChange={handleSearchInput}
            className="graph-search-input"
          />
        </div>
      )}
      
      {/* 추가된 노드 UI 표시 */}
      {showNewlyAdded && newlyAddedNodeNames.length > 0 && (
        <div className="graph-popup">
          <span>추가된 노드: {newlyAddedNodeNames.join(', ')}</span>
          <span className="close-x" onClick={() => {
            setShowNewlyAdded(false);
            setNewlyAddedNodeNames([]);
            if (onClearNewlyAddedNodes) onClearNewlyAddedNodes();
          }}>×</span>
        </div>
      )}
      {/* 참고된 노드가 있을 때 정보 표시 */}
      {(!fromFullscreen) && showReferenced && referencedNodesState && referencedNodesState.length > 0 && (
        <div className="graph-popup">
          <span>참고된 노드: {referencedNodesState.join(', ')}</span>
          <span className="close-x" onClick={() => {
            setShowReferenced(false);
            setReferencedNodesState([]);
            if (onClearReferencedNodes) onClearReferencedNodes();
          }}>×</span>
        </div>
      )}
      {/* 포커스 노드 팝업 */}
      {showFocus && Array.isArray(focusNodeNames) && focusNodeNames.length > 0 && (
        <div className="graph-popup">
          <span>소스로 생성된 노드: {focusNodeNames.join(', ')}</span>
          <span className="close-x" onClick={() => {
            setShowFocus(false);
            if (onClearFocusNodes) onClearFocusNodes();
          }}>×</span>
        </div>
      )}
      {/* 자석 hover 툴팁 */}
      {hoveredNode && !hoveredLink && (
        <div
          style={{
            position: 'fixed',
            left: `${window._lastMouseX || 0}px`,
            top: `${window._lastMouseY || 0}px`,
            pointerEvents: 'none',
            background: isDarkMode ? 'rgba(176,184,193,0.97)' : 'rgba(225,227,231,0.97)', // 트렌디한 회색
            color: isDarkMode ? '#222' : '#333',
            borderRadius: 8,
            padding: '3px 10px',
            fontSize: 15,
            fontWeight: 500,
            boxShadow: isDarkMode ? '0 2px 16px 0 #b0b8c1' : '0 2px 16px 0 #e5e7eb',
            zIndex: 1000,
            transform: 'translate(12px, 8px)'
          }}
        >
          노드 : {hoveredNode.name} <span style={{ fontWeight: 400, fontSize: 13 }}>(연결: {hoveredNode.linkCount})</span>
        </div>
      )}
      {hoveredLink && (
        <div
          style={{
            position: 'fixed',
            left: `${window._lastMouseX || 0}px`,
            top: `${window._lastMouseY || 0}px`,
            pointerEvents: 'none',
            background: isDarkMode ? 'rgba(176,184,193,0.97)' : 'rgba(225,227,231,0.97)', // 트렌디한 회색
            color: isDarkMode ? '#222' : '#333',
            borderRadius: 8,
            padding: '3px 10px',
            fontSize: 15,
            fontWeight: 500,
            boxShadow: isDarkMode ? '0 2px 16px 0 #b0b8c1' : '0 2px 16px 0 #e5e7eb',
            zIndex: 1000,
            transform: 'translate(12px, 8px)'
          }}
        >
          <div>{hoveredLink.source?.name || hoveredLink.source} → {hoveredLink.target?.name || hoveredLink.target}</div>
          <div style={{ fontWeight: 400, fontSize: 13 }}>관계 : {hoveredLink.relation || '관계'}</div>
        </div>
      )}
      {loading && (
        <div className="graph-loading" style={{
          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.8)',
          color: isDarkMode ? '#f1f5f9' : '#000'
        }}>
          <div
            className="graph-loading-spinner"
            style={{
              borderColor: isDarkMode ? '#475569' : '#adadad',
              borderTopColor: isDarkMode ? '#f1f5f9' : '#2c2929'
            }}
          ></div>
          <div>그래프를 불러오는 중입니다...</div>
        </div>
      )}
      {error && (
        <div
          className="graph-error"
          style={{
            backgroundColor: isDarkMode ? '#0f172a' : '#fafafa',
            color: isDarkMode ? '#fca5a5' : 'red'
          }}
        >
          {error}
        </div>
      )}

      {!loading && graphData.nodes.length > 0 && dimensions.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={isAnimating ? {
            nodes: visibleNodes,
            links: visibleLinks
          } : graphData}
          onNodeClick={handleNodeClick}
          //nodeLabel={node => {
            // const baseLabel = `${node.name} (연결: ${node.linkCount})`;
            // const isReferenced = showReferenced && referencedSet.has(node.name);
            // return isReferenced ? `${baseLabel} - 참고됨` : baseLabel;
          //}}
          //linkLabel={link => link.relation}
          nodeRelSize={customNodeSize}
          linkColor={() => isDarkMode ? "#64748b" : "#dedede"}
          linkWidth={customLinkWidth}
          linkDirectionalArrowLength={6.5}
          linkDirectionalArrowRelPos={1}
          cooldownTime={5000}
          d3VelocityDecay={0.2}
          d3Force={fg => {
            fg.force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2));
            fg.force("collide", d3.forceCollide(50));

            const repelForce = -10 - (repelStrength / 100) * 290;
            const linkDist = 50 + (linkDistance / 100) * 250;
            const linkForce = 0.1 + (linkStrength / 100) * 0.9;

            fg.force("charge", d3.forceManyBody().strength(repelForce));
            fg.force("link", d3.forceLink().id(d => d.id).distance(linkDist).strength(linkForce));
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            ctx.save();
            ctx.globalAlpha = node.__opacity ?? 1;
            const label = node.name || node.id;
            const isReferenced = showReferenced && referencedSet.has(node.name);
            const isImportantNode = node.linkCount >= 3;
            const isNewlyAdded = newlyAddedNodeNames.includes(node.name);
            const isFocus = showFocus && focusNodeNames?.includes(node.name);
            const isRef = showReferenced && referencedSet.has(label);
            const r = (5 + Math.min(node.linkCount * 0.5, 3)) / globalScale;

            const baseSize = customNodeSize; // 기존: const baseSize = 5;
            const sizeFactor = Math.min(node.linkCount * 0.5, 3);
            const nodeSize = baseSize + sizeFactor;
            const nodeRadius = nodeSize / globalScale;
            const pulseScale = 1.8;
            const pulseDuration = 1000;

            // 다크모드에 따라 실시간으로 노드 색상 결정
            let nodeColor;
            if (node.linkCount >= 3) {
              nodeColor = isDarkMode ? '#60a5fa' : '#3366bb';
            } else if (node.linkCount == 2) {
              nodeColor = isDarkMode ? '#e2e8f0' : '#444444';
            } else {
              nodeColor = isDarkMode ? '#94a3b8' : '#888888';
            }

            // hover 효과: glow 및 테두리 강조
            const isHovered = hoveredNode && hoveredNode.id === node.id;
            if (isHovered) {
              ctx.shadowColor = isDarkMode ? '#8ac0ffff' : '#9bc3ffff'; // 트렌디한 회색 glow
              ctx.shadowBlur = 16;
              ctx.fillStyle = isDarkMode ? '#76b1f9ff' : '#73a0f9ff'; // 트렌디한 회색으로 꽉 채움
            }

            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
            ctx.fillStyle = nodeColor;
            ctx.fill();

            const fontSize = (isReferenced || isNewlyAdded || isFocus) ? 13 / globalScale : 9 / globalScale;

            ctx.font = (isReferenced || isNewlyAdded || isFocus)
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
              ctx.strokeStyle = isDarkMode ? '#67acfaff' : '#93bcf8ff'; // hover 시 기존 색상 유지
              ctx.lineWidth = 7 / globalScale;
            } else if (isNewlyAdded || isFocus) {
              ctx.strokeStyle = isDarkMode ? '#60a5fa' : '#2196f3';
              ctx.lineWidth = 4 / globalScale;
              ctx.shadowColor = isDarkMode ? '#3b82f6' : '#90caf9';
              ctx.shadowBlur = 10;
            } else if (isReferenced) {
              ctx.strokeStyle = isDarkMode ? '#fb923c' : '#d9820f';
              ctx.lineWidth = 3 / globalScale;
              ctx.shadowColor = isDarkMode ? '#f97316' : '#ffc107';
              ctx.shadowBlur = 6;
            } else {
              ctx.strokeStyle = isImportantNode
                ? (isDarkMode ? '#e2e8f0' : 'white')
                : (isDarkMode ? '#64748b' : '#cec8c8ff');
              ctx.lineWidth = 0.5 / globalScale;
              ctx.shadowBlur = 0;
            }
            ctx.stroke();

            // 텍스트 색상
            const textColor = isDarkMode
              ? ((isImportantNode || isReferenced || isNewlyAdded || isFocus) ? '#f1f5f9' : '#cbd5e1')
              : ((isImportantNode || isReferenced || isNewlyAdded || isFocus) ? '#222' : '#555');

            // 줌 레벨이 임계값 이상일 때만 텍스트 표시
            if (globalScale >= textDisplayZoomThreshold) {
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = textColor;
              ctx.fillText(label, node.x, node.y + nodeRadius + 1);
            }
            node.__bckgDimensions = [nodeRadius * 2, fontSize].map(n => n + fontSize * 0.2);

            ctx.restore();
          }}
          enableNodeDrag={true}
          enableZoomPanInteraction={true}
          minZoom={0.01}
          maxZoom={5}
          onNodeDragEnd={node => {
            delete node.fx;
            delete node.fy;
          }}
          onNodeHover={node => {
            setHoveredNode(node); // hover 상태 업데이트
            document.body.style.cursor = node ? 'pointer' : 'default';
          }}
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link, ctx, globalScale) => {
            // 링크 hover 효과: 트렌디한 회색 glow 및 강조
            const isHovered = hoveredLink && (hoveredLink.source === link.source && hoveredLink.target === link.target);
            if (isHovered) {
              ctx.save();
              ctx.globalAlpha = 1;
              ctx.strokeStyle = isDarkMode ? '#66acfcff' : '#94bdfcff'; // 트렌디한 회색
              ctx.shadowColor = isDarkMode ? '#89c0feff' : '#92b5fbff'; // 트렌디한 회색 glow
              ctx.shadowBlur = 16;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(link.source.x, link.source.y);
              ctx.lineTo(link.target.x, link.target.y);
              ctx.stroke();
              ctx.restore();
            }
          }}
          onLinkHover={link => {
            setHoveredLink(link);
          }}
        />
      )}
      {/* 그래프 하단(채팅바 아래)에 검색 결과 노드 리스트 고정 표시 */}
      {searchQuery.trim() !== '' && referencedSet.size > 0 && (
        <>
          <ul className="graph-search-result-list">
            {[...referencedSet].map(name => (
              <li
                key={name}
                onClick={() => {
                  const foundNode = graphData.nodes.find(n => n.name === name);
                  if (foundNode && typeof foundNode.x === 'number' && typeof foundNode.y === 'number' && fgRef.current) {
                    fgRef.current.centerAt(foundNode.x, foundNode.y, 800);
                    fgRef.current.zoom(2, 800);
                  }
                }}
              >
                {name}
              </li>
            ))}
          </ul>
          <div style={{ fontSize: 11, color: '#888', marginLeft: 18, marginBottom: 20 }}>
            해당 노드를 클릭하면 그래프가 해당 위치로 이동합니다.
          </div>
        </>
      )}
    </div>
  );
}

export default GraphView;
