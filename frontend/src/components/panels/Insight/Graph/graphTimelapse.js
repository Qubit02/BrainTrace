import * as d3 from 'd3';
import { easeCubicInOut } from 'd3-ease';

/**
 * 그래프 타임랩스 애니메이션 함수
 * @param {Object} params - 파라미터 객체
 * @param {Object} params.graphData - 그래프 데이터 (nodes, links)
 * @param {Function} params.setIsAnimating - 애니메이션 상태 변경 함수
 * @param {Function} params.setVisibleNodes - 보이는 노드 상태 변경 함수
 * @param {Function} params.setVisibleLinks - 보이는 링크 상태 변경 함수
 * @param {Object} params.fgRef - ForceGraph ref 객체
 */
export function startTimelapse({
  graphData,
  setIsAnimating,
  setVisibleNodes,
  setVisibleLinks,
  fgRef
}) {
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
} 