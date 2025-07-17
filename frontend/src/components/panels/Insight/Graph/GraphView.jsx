import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';
import { fetchGraphData } from '../../../../api/graphApi';
import { easeCubicInOut } from 'd3-ease';
import './GraphView.css';

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
  showPopups = true,
  onNewlyAddedNodes,
  onGraphViewReady,
  externalShowReferenced,
  externalShowFocus,
  externalShowNewlyAdded,
  clearTrigger,
  isDarkMode = false,
  customNodeSize = 5,
  customLinkWidth = 1,
  // textDisplayZoomThreshold = 0.5,
  textDisplayZoomThreshold = isFullscreen ? 0.05 : 0.1, // ✅ Modal에서는 더 낮은 임계값

  // ✅ 3개 물리 설정만 (0-100 범위)
  repelStrength = 50,     // 반발력
  linkDistance = 50,      // 링크 거리  
  linkStrength = 50,      // 링크 장력
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [referencedSet, setReferencedSet] = useState(new Set());
  const [showReferenced, setShowReferenced] = useState(true);
  const [showFocus, setShowFocus] = useState(true);
  const fgRef = useRef();
  const [visibleNodes, setVisibleNodes] = useState([]);
  const [visibleLinks, setVisibleLinks] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [newlyAddedNodeNames, setNewlyAddedNodeNames] = useState([]);
  const [showNewlyAdded, setShowNewlyAdded] = useState(false);
  const prevGraphDataRef = useRef({ nodes: [], links: [] });
  const [pulseStartTime, setPulseStartTime] = useState(null);
  const [refPulseStartTime, setRefPulseStartTime] = useState(null);
  const lastClickRef = useRef({ node: null, time: 0 });
  const clickTimeoutRef = useRef();

  // ✅ 콜백 등록 상태 추적
  const callbacksRegisteredRef = useRef(false);
  const prevNewlyAddedRef = useRef([]);

  // 색상 팔레트
  // ✅ 다크모드용 색상 팔레트 추가
  const lightColorPalette = [
    '#444444', '#666666', '#888888', '#aaaaaa', '#3366bb',
    '#333333', '#777777', '#999999', '#5588cc', '#555555',
  ];

  const darkColorPalette = [
    '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#60a5fa',
    '#f1f5f9', '#d1d5db', '#9ca3af', '#3b82f6', '#e5e7eb',
  ];
  // ✅ 현재 팔레트 선택
  const colorPalette = isDarkMode ? darkColorPalette : lightColorPalette;


  // 컨테이너 사이즈 계산
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

  // const getInitialZoomScale = (nodeCount) => {
  //   if (nodeCount >= 1000) return 0.045;
  //   else if (nodeCount >= 500) return 0.05;
  //   else if (nodeCount >= 100) return 0.07;
  //   else if (nodeCount >= 50) return 0.15;
  //   else if (nodeCount >= 40) return 0.2;
  //   else if (nodeCount >= 30) return 0.25;
  //   else if (nodeCount >= 20) return 0.3;
  //   else if (nodeCount >= 10) return 0.4;
  //   else if (nodeCount >= 5) return 0.8;
  //   return 1;
  // };
  const getInitialZoomScale = (nodeCount) => {
    // ✅ Modal용 줌 배율 (더 확대)
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
  // 타임랩스 함수
  const startTimelapse = () => {
    const nodes = [...graphData.nodes];
    const links = [...graphData.links];
    const N = nodes.length;
    if (N === 0) return;

    const totalDuration = Math.min(6000, 800 + N * 80);
    const fadeDuration = Math.max(200, Math.min(800, N * 10));

    const shuffledNodes = d3.shuffle(nodes);
    const appearTimes = shuffledNodes.map((_, i) =>
      (i / (N - 1)) * (totalDuration - fadeDuration)
    );

    setIsAnimating(true);
    setVisibleNodes([]);
    setVisibleLinks([]);

    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom, 0);
    }

    const startTime = performance.now();

    const tick = now => {
      const t = now - startTime;
      const idx = Math.min(
        N - 1,
        Math.floor((t / (totalDuration - fadeDuration)) * (N - 1))
      );

      const visible = shuffledNodes.slice(0, idx + 1).map((n, i) => {
        const dt = t - appearTimes[i];
        const alpha = dt <= 0
          ? 0
          : dt >= fadeDuration
            ? 1
            : easeCubicInOut(dt / fadeDuration);
        return { ...n, __opacity: alpha };
      });

      const visibleIds = new Set(visible.map(n => n.id));
      const visibleLinks = links.filter(l =>
        visibleIds.has(l.source) && visibleIds.has(l.target)
      );

      setVisibleNodes(visible);
      setVisibleLinks(visibleLinks);

      if (t < totalDuration) {
        requestAnimationFrame(tick);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(tick);
  };

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

  //슬라이더 물리 효과 조절
  // ✅ 3개 물리 설정만 처리하는 useEffect
  useEffect(() => {
    if (fgRef.current) {
      const fg = fgRef.current;

      // ✅ 올바른 반발력 공식 (0% = 가까이 모임, 100% = 멀리 퍼짐)
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
  //예찬 더블 클릭했을 때 줌인되게
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
  //
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


  // ✅ 외부에서 제어되는 상태들과 동기화
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

  // ✅ 콜백 등록 - 한 번만 실행되도록 완전히 수정
  useEffect(() => {
    if (onGraphViewReady && !callbacksRegisteredRef.current) {
      console.log('📡 GraphView 콜백 등록 (최초 1회만)');

      // setState 함수들을 직접 전달하지 않고 래퍼 함수로 전달
      const callbacks = {
        setShowReferenced: (value) => {
          console.log('🔄 setShowReferenced 호출:', value);
          setShowReferenced(value);
        },
        setShowFocus: (value) => {
          console.log('🔄 setShowFocus 호출:', value);
          setShowFocus(value);
        },
        setShowNewlyAdded: (value) => {
          console.log('🔄 setShowNewlyAdded 호출:', value);
          setShowNewlyAdded(value);
        },
        setNewlyAddedNodeNames: (value) => {
          console.log('🔄 setNewlyAddedNodeNames 호출:', value);
          setNewlyAddedNodeNames(value);
        }
      };

      onGraphViewReady(callbacks);
      callbacksRegisteredRef.current = true;
    }
  }, []); // ✅ 의존성 배열 완전히 비움

  // ✅ 새로 추가된 노드 알림 - 중복 방지 로직 추가
  useEffect(() => {
    if (!onNewlyAddedNodes || newlyAddedNodeNames.length === 0) return;

    // 이전 값과 비교해서 실제로 변경된 경우만 알림
    const prevNodes = prevNewlyAddedRef.current;
    const isChanged = JSON.stringify(prevNodes) !== JSON.stringify(newlyAddedNodeNames);

    if (isChanged) {
      console.log('🆕 새로 추가된 노드 외부 알림:', newlyAddedNodeNames);
      onNewlyAddedNodes(newlyAddedNodeNames);
      prevNewlyAddedRef.current = [...newlyAddedNodeNames];
    }
  }, [newlyAddedNodeNames]); // ✅ onNewlyAddedNodes 의존성 제거

  // 나머지 useEffect들은 그대로 유지...
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

  // 그래프 데이터 로딩
  useEffect(() => {
    if (initialGraphData) {
      processGraphData(initialGraphData);
      return;
    }

    const loadGraphData = async () => {
      try {
        setLoading(true);
        const data = await fetchGraphData(brainId);
        processGraphData(data);
      } catch (err) {
        setError('그래프 데이터를 불러오는 데 실패했습니다.');
        setLoading(false);
      }
    };

    loadGraphData();
  }, [brainId, initialGraphData]);

  // 그래프 새로고침
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

  // referencedNodes 처리
  useEffect(() => {
    console.log('referencedNodes:', referencedNodes);
    setReferencedSet(new Set(referencedNodes));
    if (referencedNodes.length > 0) {
      setRefPulseStartTime(Date.now());
      setShowReferenced(true);
    }
  }, [referencedNodes]);

  // 참고된 노드 카메라 이동
  useEffect(() => {
    if (!showReferenced || referencedNodes.length === 0 || !graphData.nodes.length) return;

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
  }, [showReferenced, referencedNodes, graphData, referencedSet]);

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

  // 그래프 데이터 처리 함수
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

  // 외부에서 팝업 데이터에 접근할 수 있도록 노출
  React.useImperativeHandle(onTimelapse, () => ({
    startTimelapse,
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

  // ✅ 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      callbacksRegisteredRef.current = false;
      prevNewlyAddedRef.current = [];
    };
  }, []);

  return (
    <div
      className={`graph-area ${isDarkMode ? 'dark-mode' : ''}`}
      ref={containerRef}
      style={{
        backgroundColor: isDarkMode ? '#0f172a' : '#fafafa'
      }}
    >
      {/* 로딩 및 에러 처리 */}
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
          nodeLabel={node => {
            const baseLabel = `${node.name} (연결: ${node.linkCount})`;
            const isReferenced = showReferenced && referencedSet.has(node.name);
            return isReferenced ? `${baseLabel} - 참고됨` : baseLabel;
          }}
          linkLabel={link => link.relation}
          nodeRelSize={customNodeSize}
          linkColor={() => isDarkMode ? "#64748b" : "#dedede"}
          linkWidth={customLinkWidth}
          linkDirectionalArrowLength={6.5}
          linkDirectionalArrowRelPos={1}
          cooldownTime={5000}
          d3VelocityDecay={0.2}
          // ✅ 옵시디언 스타일 d3Force 설정
          d3Force={fg => {
            // 기본 설정
            fg.force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2));
            fg.force("collide", d3.forceCollide(50));

            // ✅ 3개 설정만 적용
            // const repelForce = -10 - (repelStrength / 100) * 290;
            const repelForce = -10 - (repelStrength / 100) * 290;  // 0% = -10, 100% = -300
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

            // const baseSize = 5;
            const baseSize = customNodeSize; // ✅ 기존: const baseSize = 5;
            const sizeFactor = Math.min(node.linkCount * 0.5, 3);
            const nodeSize = baseSize + sizeFactor;
            const nodeRadius = nodeSize / globalScale;
            const pulseScale = 1.8;
            const pulseDuration = 1000;

            // ✅ 다크모드에 따라 실시간으로 노드 색상 결정
            let nodeColor;
            if (node.linkCount >= 3) {
              nodeColor = isDarkMode ? '#60a5fa' : '#3366bb';
            } else if (node.linkCount == 2) {
              nodeColor = isDarkMode ? '#e2e8f0' : '#444444';
            } else {
              nodeColor = isDarkMode ? '#94a3b8' : '#888888';
            }

            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
            ctx.fillStyle = nodeColor; // ✅ 계산된 색상 사용
            ctx.fill();

            const fontSize = (isReferenced || isNewlyAdded || isFocus) ? 13 / globalScale : 9 / globalScale;

            ctx.font = (isReferenced || isNewlyAdded || isFocus)
              ? `bold ${fontSize}px Sans-Serif`
              : `${fontSize}px Sans-Serif`;

            // 펄스 효과들...
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
            if (isNewlyAdded || isFocus) {
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
                : (isDarkMode ? '#64748b' : '#f0f0f0');
              ctx.lineWidth = 0.5 / globalScale;
              ctx.shadowBlur = 0;
            }
            ctx.stroke();

            // 텍스트 색상
            const textColor = isDarkMode
              ? ((isImportantNode || isReferenced || isNewlyAdded || isFocus) ? '#f1f5f9' : '#cbd5e1')
              : ((isImportantNode || isReferenced || isNewlyAdded || isFocus) ? '#222' : '#555');

            // ctx.textAlign = 'center';
            // ctx.textBaseline = 'top';
            // ctx.fillStyle = textColor;
            // ctx.fillText(label, node.x, node.y + nodeRadius + 1);
            // ✅ 이렇게 수정:

            // 줌 레벨이 임계값 이상일 때만 텍스트 표시
            if (globalScale >= textDisplayZoomThreshold) {
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = textColor;
              ctx.fillText(label, node.x, node.y + nodeRadius + 1);
            }
            node.__bckgDimensions = [nodeRadius * 2, fontSize].map(n => n + fontSize * 0.2);

            ctx.restore();
          }



          }


          enableNodeDrag={true}
          enableZoomPanInteraction={true}
          minZoom={0.01}
          maxZoom={5}
          onNodeDragEnd={node => {
            delete node.fx;
            delete node.fy;
          }}
          onNodeHover={node => {
            document.body.style.cursor = node ? 'pointer' : 'default';
          }}
        />
      )}
    </div>
  );
}

export default GraphView;
