/**
 * graphTimelapse.js
 *
 * 그래프 타임랩스 유틸리티 모듈
 *
 * 주요 기능:
 * 1. 노드 등장 순서를 랜덤화하고 시간 축에 배치
 * 2. ease 보간으로 노드 페이드인(__opacity) 처리
 * 3. 등장한 노드 점진적 완성 연출
 * 4. 애니메이션 시작/종료 상태 관리
 *
 * 사용 시나리오:
 * - 지식 그래프 초기 진입 시 인트로 연출
 * - 서브그래프 하이라이트/리플레이 연출
 *
 * 외부 의존성:
 * - d3.shuffle, d3-ease
 */
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
  // ===== 데이터 준비 =====
  // 원본 데이터 변경을 피하기 위해 얕은 복제본을 생성합니다.
  const nodes = [...graphData.nodes];
  const links = [...graphData.links];
  const N = nodes.length;
  if (N === 0) return;

  // ===== 시간/페이드 설정 =====
  // 노드 수에 비례해 재생/페이드 시간을 가변적으로 결정합니다.
  const totalDuration = Math.min(6000, 800 + N * 80);
  const fadeDuration = Math.max(200, Math.min(800, N * 10));

  // ===== 노드 등장 시각 계산 =====
  // 노드 등장 순서를 랜덤화합니다.
  const shuffledNodes = d3.shuffle(nodes);
  // 각 노드의 등장 기준 시각(밀리초)을 사전 계산합니다.
  const appearTimes = shuffledNodes.map((_, i) =>
    (i / (N - 1)) * (totalDuration - fadeDuration)
  );

  // ===== 초기 상태/줌 고정 =====
  // 초기 상태 설정: 애니메이션 시작 및 가시 요소 초기화
  setIsAnimating(true);
  setVisibleNodes([]);
  setVisibleLinks([]);

  // 현재 줌 레벨을 고정하여 애니메이션 동안 갑작스러운 카메라 변화를 방지합니다.
  if (fgRef.current) {
    const currentZoom = fgRef.current.zoom();
    fgRef.current.zoom(currentZoom, 0);
  }

  // 기준 시작 시각 기록
  const startTime = performance.now();

  // ===== 애니메이션 루프 =====
  const tick = now => {
    const t = now - startTime;
    // 현재 시각에 등장 완료된 노드 인덱스를 계산합니다.
    const idx = Math.min(
      N - 1,
      Math.floor((t / (totalDuration - fadeDuration)) * (N - 1))
    );

    // 가시 노드 목록 계산: 각 노드에 페이드인 투명도(__opacity)를 부여합니다.
    const visible = shuffledNodes.slice(0, idx + 1).map((n, i) => {
      const dt = t - appearTimes[i];
      const alpha = dt <= 0
        ? 0
        : dt >= fadeDuration
          ? 1
          : easeCubicInOut(dt / fadeDuration);
      return { ...n, __opacity: alpha };
    });

    // 가시 링크 계산: 현재 가시 노드 집합을 기준으로 필터링합니다.
    const visibleIds = new Set(visible.map(n => n.id));
    const visibleLinks = links.filter(l =>
      visibleIds.has(l.source) && visibleIds.has(l.target)
    );

    // 상태 갱신: ForceGraph가 참조하는 렌더링 데이터 업데이트
    setVisibleNodes(visible);
    setVisibleLinks(visibleLinks);

    // 종료 조건: 총 재생 시간이 경과하면 애니메이션을 종료합니다.
    if (t < totalDuration) {
      requestAnimationFrame(tick);
    } else {
      setIsAnimating(false);
    }
  };

  // 루프 시작
  requestAnimationFrame(tick);
} 