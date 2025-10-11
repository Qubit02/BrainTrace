import React, { useState } from "react";
import { MdExpandMore, MdExpandLess } from "react-icons/md";
import "./KnowledgeGraphStatusBar.css";

function Tooltip({ text }) {
  return <span className="custom-tooltip">{text}</span>;
}

/**
 * 그래프 타입 감지
 *
 * @param {number} nodesCount - 노드 개수
 * @param {number} edgesCount - 엣지 개수
 * @returns {string} 그래프 타입 ("directed" | "undirected" | "sparse" | "dense")
 */
function detectGraphType(nodesCount, edgesCount) {
  if (nodesCount < 2) return "undirected";

  const maxPossibleEdges = (nodesCount * (nodesCount - 1)) / 2;
  const density = maxPossibleEdges > 0 ? edgesCount / maxPossibleEdges : 0;

  // 더 세밀한 그래프 타입 분류
  if (density < 0.15) return "sparse"; // 희소 그래프
  if (density < 0.3) return "directed"; // 방향성 그래프
  if (density < 0.6) return "undirected"; // 무방향 그래프
  return "dense"; // 밀집 그래프
}

/**
 * 지식그래프 성능 지표 계산 (개선된 버전)
 *
 * 계산 방식:
 * - 텍스트 크기에 따른 적응형 기준값 적용
 * - 비선형 스케일링으로 극단값 처리
 * - 그래프 구조의 품질을 다각도로 평가
 *
 * @param {Object} params - 계산 파라미터
 * @param {number} params.textLength - 텍스트 길이 (바이트)
 * @param {number} params.nodesCount - 노드 개수
 * @param {number} params.edgesCount - 엣지 개수
 * @returns {Object} 계산된 지표 (모두 소수점 둘째 자리 문자열)
 */
function computeKnowledgeGraphMetrics({ textLength, nodesCount, edgesCount }) {
  // 1) 텍스트 크기 계산 (KB 단위)
  const textKB = textLength / 1024;
  const safeTextKB = Math.max(textKB, 0.1); // 최소값 0.1KB로 설정 (너무 작은 값 방지)

  // 2) 기본 밀도 지표 계산
  const nodeDensity = nodesCount / safeTextKB; // 텍스트 1KB당 노드 수
  const edgeDensity = edgesCount / safeTextKB; // 텍스트 1KB당 엣지 수
  const avgDegree = nodesCount > 0 ? (2 * edgesCount) / nodesCount : 0; // 노드당 평균 연결 개수

  // 3) 그래프 연결성 지표 (추가)
  const maxPossibleEdges =
    nodesCount > 1 ? (nodesCount * (nodesCount - 1)) / 2 : 1;
  const connectivity = edgesCount / maxPossibleEdges; // 0~1 사이 값 (연결 밀도)

  // 4) 정보 추출 효율성 점수
  // - 작은 텍스트에서 많은 노드를 추출했다면 효율이 높음
  // - 노드와 엣지의 균형도 고려
  const nodeScore = nodesCount * 1.5; // 노드 기여도
  const edgeScore = edgesCount * 2.0; // 엣지 기여도 (노드보다 중요)
  const balanceScore =
    nodesCount > 0 ? Math.min(edgesCount / nodesCount, 3) : 0; // 균형 점수 (상한 3)

  // 5) 종합 수율 점수 (Yield Score)
  // - 텍스트 대비 얼마나 많은 지식을 추출했는지
  // - 균형 점수를 반영하여 노드만 많고 관계가 없는 경우 패널티
  const rawYield = (nodeScore + edgeScore) / safeTextKB;
  const yieldScore = rawYield * (0.7 + 0.3 * Math.min(balanceScore / 2, 1)); // 균형도 30% 반영

  // 6) 텍스트 활용도 점수
  // - 작은 텍스트: 높은 밀도 요구 (소수 정예)
  // - 큰 텍스트: 상대적으로 낮은 밀도도 허용 (대량 처리)
  const textSizeMultiplier = Math.log10(Math.max(textKB, 1) + 1); // 로그 스케일
  const utilizationScore =
    (nodeDensity + edgeDensity * 1.5) * textSizeMultiplier;

  // 모든 지표를 문자열로 반환 (소수점 둘째 자리)
  return {
    textKB: textKB.toFixed(2),
    nodeDensity: nodeDensity.toFixed(2),
    edgeDensity: edgeDensity.toFixed(2),
    avgDegree: avgDegree.toFixed(2),
    connectivity: (connectivity * 100).toFixed(2), // 백분율로 표시
    textScore: safeTextKB.toFixed(2),
    nodeScore: nodeScore.toFixed(2),
    edgeScore: edgeScore.toFixed(2),
    balanceScore: balanceScore.toFixed(2),
    yieldScore: yieldScore.toFixed(2),
    utilizationScore: utilizationScore.toFixed(2),
  };
}

/**
 * 지식 성능 지수 계산 (개선된 버전)
 *
 * 계산 방식:
 * - 차등 가중치 적용: 평균 연결도(50%) > 엣지 밀도(30%) > 노드 밀도(20%)
 * - 비선형 스케일링: 로그 곡선으로 극단값 완화
 * - 품질 등급 반영: 연결성이 높을수록 보너스 점수
 * - 최종 점수: 0~10 스케일
 *
 * @param {Object} params - 계산 파라미터
 * @param {number} params.nodeDensity - 노드 밀도 (텍스트 1KB당 노드 수)
 * @param {number} params.edgeDensity - 엣지 밀도 (텍스트 1KB당 엣지 수)
 * @param {number} params.avgDegree - 평균 연결도 (노드당 평균 연결 개수)
 * @returns {string} 지식 성능 지수 (0~10, 소수점 둘째 자리)
 */
function computeKnowledgePerformanceIndex({
  nodeDensity,
  edgeDensity,
  avgDegree,
}) {
  // 1) 적응형 상한값 설정 (텍스트 크기와 품질에 따라 조정)
  const nodeCap = 3.5; // 노드 밀도 상한 (1KB당 3.5개 = 우수)
  const edgeCap = 10.0; // 엣지 밀도 상한 (1KB당 10개 = 우수)
  const degreeCap = 6.0; // 평균 연결도 상한 (노드당 6개 = 우수)

  // 2) 비선형 정규화 (로그 스케일로 극단값 완화)
  // - 0에 가까운 값도 어느 정도 점수를 받을 수 있도록
  // - 상한을 넘어도 급격히 증가하지 않도록
  const nodeNorm = Math.min(
    Math.log10(nodeDensity + 1) / Math.log10(nodeCap + 1),
    1
  );
  const edgeNorm = Math.min(
    Math.log10(edgeDensity + 1) / Math.log10(edgeCap + 1),
    1
  );
  const degreeNorm = Math.min(
    Math.log10(avgDegree + 1) / Math.log10(degreeCap + 1),
    1
  );

  // 3) 차등 가중치 적용
  // - 평균 연결도가 가장 중요 (그래프의 핵심 품질 지표)
  // - 엣지 밀도가 두 번째 (관계의 풍부함)
  // - 노드 밀도는 상대적으로 덜 중요 (양보다 질)
  const WEIGHTS = {
    NODE: 0.2, // 20%
    EDGE: 0.3, // 30%
    DEGREE: 0.5, // 50%
  };

  const weightedScore =
    nodeNorm * WEIGHTS.NODE +
    edgeNorm * WEIGHTS.EDGE +
    degreeNorm * WEIGHTS.DEGREE;

  // 4) 품질 보너스 (연결도가 매우 높으면 보너스)
  const qualityBonus =
    avgDegree >= 4.0
      ? 0.15
      : avgDegree >= 3.0
      ? 0.1
      : avgDegree >= 2.0
      ? 0.05
      : 0;

  // 5) 최종 점수 계산 (0~10 스케일)
  const finalScore = Math.min((weightedScore + qualityBonus) * 10, 10);

  return finalScore.toFixed(2);
}

function KnowledgeGraphStatusBar({ textLength, nodesCount, edgesCount }) {
  const [collapsed, setCollapsed] = useState(true);

  // 스펙 기반 지표 계산
  const metrics = computeKnowledgeGraphMetrics({
    textLength,
    nodesCount,
    edgesCount,
  });

  const graphType = detectGraphType(nodesCount, edgesCount);
  // 기존 표시 로직은 유지하되, 값의 출처를 새 계산식으로 교체
  const nodeDensity = metrics.nodeDensity; // string
  const edgeDensity = metrics.edgeDensity; // string
  const avgDegree = metrics.avgDegree; // string
  const avgDegreeNum = parseFloat(avgDegree); // 비교/판정 용 숫자값

  // 지식 성능 지수 계산 (0~10)
  const perfIndex = computeKnowledgePerformanceIndex({
    nodeDensity: parseFloat(nodeDensity),
    edgeDensity: parseFloat(edgeDensity),
    avgDegree: avgDegreeNum,
  });

  return (
    <div
      className={`source-quota-bar technical with-strong-border ${
        !collapsed ? "expanded" : ""
      }`}
    >
      <div className="quota-label main-title kg-header">
        <div className="kg-title">
          <span>Graph Metrics</span>
        </div>

        <span
          className="collapse-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((c) => !c);
          }}
          tabIndex={0}
          role="button"
          aria-label={collapsed ? "펼치기" : "접기"}
        >
          {collapsed ? <MdExpandLess /> : <MdExpandMore />}
        </span>
      </div>

      {/* 지식 그래프 품질 평가 안내 블록 제거됨 */}

      {!collapsed && (
        <div className="quota-details">
          <div className="data-metric">
            <span className="metric-label">노드 밀도</span>
            <span className="metric-value">{nodeDensity}</span>
            <span className="qmark-tooltip">
              ?
              <Tooltip
                text={
                  "텍스트 1KB당 추출된 개념(노드) 수. 높을수록 정보 추출 효율이 좋음"
                }
              />
            </span>
          </div>

          <div className="data-metric">
            <span className="metric-label">엣지 밀도</span>
            <span className="metric-value">{edgeDensity}</span>
            <span className="qmark-tooltip">
              ?
              <Tooltip
                text={
                  "텍스트 1KB당 개념 간 관계(엣지) 수. 높을수록 지식의 연결성이 풍부함"
                }
              />
            </span>
          </div>

          <div className="data-metric">
            <span className="metric-label">평균 연결도</span>
            <span className="metric-value">{avgDegree}</span>
            <span className="qmark-tooltip">
              ?
              <Tooltip
                text={
                  "각 개념(노드)이 평균적으로 연결된 개수. 높을수록 그래프 구조가 견고함 (우수: 4.0+)"
                }
              />
            </span>
          </div>

          <div className="data-metric total">
            <div className="kg-total-row">
              <span className="metric-label">지식 성능 지수</span>
              <span className="metric-value">{perfIndex}/10</span>
              <span className="qmark-tooltip">
                ?
                <Tooltip
                  text={
                    "종합 품질 지수: 평균 연결도(50%) + 엣지 밀도(30%) + 노드 밀도(20%) 가중 평균."
                  }
                />
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KnowledgeGraphStatusBar;
