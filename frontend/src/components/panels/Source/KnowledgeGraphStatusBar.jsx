import React, { useState } from "react";
import { MdExpandMore, MdExpandLess } from "react-icons/md";
import "./KnowledgeGraphStatusBar.css";

function Tooltip({ text }) {
  return <span className="custom-tooltip">{text}</span>;
}

function detectGraphType(nodesCount, edgesCount) {
  if (nodesCount < 2) return "undirected";

  const maxPossibleEdges = (nodesCount * (nodesCount - 1)) / 2;
  const density = edgesCount / maxPossibleEdges;

  return density < 0.3 ? "directed" : "undirected";
}

// 지정된 스펙에 따른 지식그래프 성능 지표 계산 함수
function computeKnowledgeGraphMetrics({ textLength, nodesCount, edgesCount }) {
  // 1) 텍스트 KB 및 안전값
  const textKB = textLength / 1024;
  const safeTextKB = Math.max(textKB, 1);

  // 2) 점수 계산
  const textScore = safeTextKB;
  const nodeScore = nodesCount * 1.5;
  const edgeScore = edgesCount * 2;
  const yieldScore = (nodeScore + edgeScore) / textScore;

  // 3) 밀도 및 연결성 지표
  const nodeDensity = nodesCount / safeTextKB;
  const edgeDensity = edgesCount / safeTextKB;
  const avgDegree = nodesCount > 0 ? (2 * edgesCount) / nodesCount : 0;

  // 모두 문자열(소수점 둘째 자리)로 반환
  return {
    textKB: textKB.toFixed(2),
    nodeDensity: nodeDensity.toFixed(2),
    edgeDensity: edgeDensity.toFixed(2),
    avgDegree: avgDegree.toFixed(2),
    textScore: textScore.toFixed(2),
    nodeScore: nodeScore.toFixed(2),
    edgeScore: edgeScore.toFixed(2),
    yieldScore: yieldScore.toFixed(2),
  };
}

/**
 * 지식 성능 지수 계산
 * - 노드 밀도, 엣지 밀도, 평균 연결도를 각 상한(3.0/9.0/6.0)으로 정규화(0~1)
 * - 세 값의 평균에 10을 곱해 0~10 스케일로 산출
 * - 소수점 둘째 자리 문자열 반환 (예: "7.25")
 */
function computeKnowledgePerformanceIndex({
  nodeDensity,
  edgeDensity,
  avgDegree,
}) {
  const nodeCap = 3.0; // 정규화 기준 상한
  const edgeCap = 9.0;
  const degreeCap = 6.0;

  const nodeNorm = Math.min(nodeDensity / nodeCap, 1);
  const edgeNorm = Math.min(edgeDensity / edgeCap, 1);
  const degreeNorm = Math.min(avgDegree / degreeCap, 1);

  // 동등 가중 평균 → 0~10 스케일
  const score = 10 * ((nodeNorm + edgeNorm + degreeNorm) / 3);
  return score.toFixed(2);
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
              <Tooltip text={"텍스트 1KB당 노드 수"} />
            </span>
          </div>

          <div className="data-metric">
            <span className="metric-label">엣지 밀도</span>
            <span className="metric-value">{edgeDensity}</span>
            <span className="qmark-tooltip">
              ?
              <Tooltip text={"텍스트 1KB당 관계 수"} />
            </span>
          </div>

          <div className="data-metric">
            <span className="metric-label">평균 연결도</span>
            <span className="metric-value">{avgDegree}</span>
            <span className="qmark-tooltip">
              ?
              <Tooltip text={"노드당 평균 연결 개수"} />
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
                    "노드·엣지 밀도와 평균 연결도를 각 상한(3.0/9.0/6.0)으로 정규화 후 평균×10으로 계산"
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
