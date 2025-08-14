/**
 * KnowledgeGraphStatusBar.jsx
 * 지식 그래프 현황을 표시하는 상태바 컴포넌트
 *
 * 기능:
 * - 텍스트 총량, 노드 수, 엣지 수 등 기본 메트릭 표시
 * - 지식량 점수 계산 및 표시
 * - 효율성 지표 (노드 밀도, 엣지 밀도, 평균 연결도) 계산
 * - 접기/펼치기 기능으로 UI 공간 절약
 * - 툴팁을 통한 상세 설명 제공
 * - 지식 추출 성능 지수 등급 시스템 (우수/양호/보통/미흡)
 */

import React, { useState } from "react";
import {
  MdExpandMore,
  MdExpandLess,
  MdInfoOutline,
  MdStar,
  MdTrendingUp,
  MdTrendingDown,
  MdRemove,
} from "react-icons/md";
import "./KnowledgeGraphStatusBar.css";

/**
 * 툴팁 컴포넌트
 * @param {string} text - 툴팁에 표시할 텍스트
 * @param {object} position - 툴팁 위치 정보 (선택사항)
 * @returns {JSX.Element} 툴팁 요소
 */
function Tooltip({ text, position = null }) {
  if (position) {
    // 동적 위치 계산이 필요한 경우 (지식 추출 성능 지수)
    const tooltipStyle = {
      position: "absolute",
      right: "0px",
      top: position.top || "-50px",
      bottom: position.bottom || "auto",
      transform: "none",
      minWidth: "200px",
      maxWidth: "280px",
      background: "#fff",
      color: "#111",
      border: "1px solid #e0e0e0",
      borderRadius: "7px",
      boxShadow: "0 4px 12px 0 rgba(60, 60, 60, 0.15)",
      fontSize: "0.97em",
      fontWeight: "400",
      padding: "10px 15px",
      whiteSpace: "normal",
      zIndex: 9, // 우선순위 높임
      pointerEvents: "none",
      transition: "opacity 0.18s ease",
    };

    return (
      <span className="custom-tooltip" style={tooltipStyle}>
        {text}
      </span>
    );
  } else {
    // 기존 CSS 스타일 사용 (노드 밀도, 엣지 밀도, 평균 연결도)
    return <span className="custom-tooltip">{text}</span>;
  }
}

/**
 * 툴팁 위치 계산 함수
 * @param {HTMLElement} element - 툴팁을 표시할 요소
 * @param {MouseEvent} mouseEvent - 마우스 이벤트
 * @returns {object} 툴팁 위치 정보
 */
function calculateTooltipPosition(element, mouseEvent) {
  if (!element || !mouseEvent) return { top: "-60px", left: "0" };

  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const tooltipHeight = 80; // 툴팁 예상 높이
  const tooltipWidth = 250; // 툴팁 예상 너비

  // 마우스 커서 위치
  const mouseX = mouseEvent.clientX;
  const mouseY = mouseEvent.clientY;

  let position = {};

  // 마우스 커서 왼쪽 위에 표시 (적절한 거리로 조정)
  position.top = "-100px"; // 마우스 커서 위 50px로 줄임
  position.left = "0"; // 왼쪽 정렬
  position.right = "auto";

  return position;
}

/**
 * 바이트 단위를 사람이 읽기 쉬운 형태로 변환
 * @param {number} bytes - 바이트 수
 * @returns {string} 변환된 문자열 (예: "1.5KB", "2.3MB")
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / (1024 * 1024)).toFixed(2) + "MB";
}

/**
 * 지식 추출 성능 지수 등급 계산 (노드 밀도, 엣지 밀도, 평균 연결도 기반)
 * @param {number} nodeDensity - 노드 밀도 (노드 수 / 텍스트 KB)
 * @param {number} edgeDensity - 엣지 밀도 (엣지 수 / 텍스트 KB)
 * @param {number} avgDegree - 평균 연결도 (2 × 엣지 수 / 노드 수)
 * @returns {object} 등급 정보 (grade, icon, description, score)
 *
 * 평가 원칙: 연결성 중심의 종합적 평가
 * - 노드 밀도(25%): 핵심 개념 추출 능력
 * - 엣지 밀도(25%): 관계 발견 능력
 * - 평균 연결도(50%): 지식 네트워크 응집도 (가장 중요)
 */
function getEfficiencyGrade(nodeDensity, edgeDensity, avgDegree) {
  // === 논리적 기준 분석 (연결성 중심 평가) ===
  //
  // 1. 노드 밀도 기준 - 개념 추출 효율성:
  //    - 0.5 미만: 매우 낮음 (텍스트 대비 개념 추출 부족)
  //    - 0.5-1.0: 낮음 (개선 필요)
  //    - 1.0-2.0: 보통 (적절한 수준)
  //    - 2.0-3.0: 높음 (좋은 추출)
  //    - 3.0 이상: 매우 높음 (우수한 추출)
  //
  // 2. 엣지 밀도 기준 - 관계 발견 효율성 (엄격한 기준):
  //    - 1.0 미만: 매우 낮음 (관계 추출 부족)
  //    - 1.0-2.0: 낮음 (개선 필요)
  //    - 2.0-4.0: 보통 (적절한 수준)
  //    - 4.0-6.0: 높음 (좋은 관계 추출)
  //    - 6.0 이상: 매우 높음 (우수한 관계 추출)
  //
  // 3. 평균 연결도 기준 - 지식 네트워크 응집도 (가장 엄격한 기준):
  //    - 2.0 미만: 매우 낮음 (노드 간 연결 부족)
  //    - 2.0-3.0: 낮음 (개선 필요)
  //    - 3.0-4.5: 보통 (적절한 연결)
  //    - 4.5-6.0: 높음 (좋은 연결)
  //    - 6.0 이상: 매우 높음 (우수한 연결)

  // === 종합 점수 계산 (10점 만점) ===
  let totalScore = 0;
  let maxScore = 0;

  // 노드 밀도 점수 (최대 2.0점) - 중요도 25%
  // - 개념 추출은 기본이지만, 연결성보다는 낮은 가중치
  let nodeScore = 0;
  if (nodeDensity >= 3.0) nodeScore = 2.0; // 매우 높음
  else if (nodeDensity >= 2.0) nodeScore = 1.5; // 높음
  else if (nodeDensity >= 1.0) nodeScore = 1.0; // 보통
  else if (nodeDensity >= 0.5) nodeScore = 0.5; // 낮음
  else nodeScore = 0.0; // 매우 낮음

  // 엣지 밀도 점수 (최대 3.5점) - 중요도 25%
  // - 관계 발견은 중요하지만, 연결 품질보다는 낮은 가중치
  let edgeScore = 0;
  if (edgeDensity >= 6.0) edgeScore = 3.5; // 매우 높음
  else if (edgeDensity >= 4.0) edgeScore = 2.5; // 높음
  else if (edgeDensity >= 2.0) edgeScore = 1.5; // 보통
  else if (edgeDensity >= 1.0) edgeScore = 0.5; // 낮음
  else edgeScore = 0.0; // 매우 낮음

  // 평균 연결도 점수 (최대 4.5점) - 중요도 50% (가장 중요)
  // - 지식 네트워크의 응집도와 질적 수준을 나타내는 핵심 지표
  let degreeScore = 0;
  if (avgDegree >= 6.0) degreeScore = 4.5; // 매우 높음
  else if (avgDegree >= 4.5) degreeScore = 3.5; // 높음
  else if (avgDegree >= 3.0) degreeScore = 2.5; // 보통
  else if (avgDegree >= 2.0) degreeScore = 1.0; // 낮음
  else degreeScore = 0.0; // 매우 낮음

  totalScore = nodeScore + edgeScore + degreeScore;
  maxScore = 10.0; // 2.0 + 3.5 + 4.5 = 10점 만점

  // === 등급 결정 (백분율 기반) ===
  const percentage = (totalScore / maxScore) * 100;

  if (percentage >= 80) {
    // 우수 등급: 80% 이상 - 모든 지표가 높은 수준
    return {
      grade: "우수",
      icon: <MdStar />,
      description: `매우 높은 지식 추출 효율성\n• 노드 밀도: ${nodeDensity} (${
        nodeDensity >= 2.0 ? "높음" : "보통"
      })\n• 엣지 밀도: ${edgeDensity} (${
        edgeDensity >= 4.0 ? "높음" : "보통"
      })\n• 평균 연결도: ${avgDegree} (${avgDegree >= 4.5 ? "높음" : "보통"})`,
      score: totalScore.toFixed(1),
    };
  } else if (percentage >= 60) {
    // 양호 등급: 60-79% - 대부분의 지표가 보통 이상
    return {
      grade: "양호",
      icon: <MdTrendingUp />,
      description: `좋은 지식 추출 효율성\n• 노드 밀도: ${nodeDensity} (${
        nodeDensity >= 1.0 ? "보통" : "낮음"
      })\n• 엣지 밀도: ${edgeDensity} (${
        edgeDensity >= 2.0 ? "보통" : "낮음"
      })\n• 평균 연결도: ${avgDegree} (${avgDegree >= 3.0 ? "보통" : "낮음"})`,
      score: totalScore.toFixed(1),
    };
  } else if (percentage >= 40) {
    // 보통 등급: 40-59% - 일부 지표 개선 필요
    return {
      grade: "보통",
      icon: <MdRemove />,
      description: `보통 수준의 지식 추출 효율성\n• 노드 밀도: ${nodeDensity} (${
        nodeDensity >= 0.5 ? "낮음" : "매우 낮음"
      })\n• 엣지 밀도: ${edgeDensity} (${
        edgeDensity >= 1.0 ? "낮음" : "매우 낮음"
      })\n• 평균 연결도: ${avgDegree} (${
        avgDegree >= 2.0 ? "낮음" : "매우 낮음"
      })`,
      score: totalScore.toFixed(1),
    };
  } else {
    // 미흡 등급: 40% 미만 - 대부분의 지표 개선 필요
    return {
      grade: "미흡",
      icon: <MdTrendingDown />,
      description: `낮은 지식 추출 효율성\n• 노드 밀도: ${nodeDensity} (매우 낮음)\n• 엣지 밀도: ${edgeDensity} (매우 낮음)\n• 평균 연결도: ${avgDegree} (매우 낮음)`,
      score: totalScore.toFixed(1),
    };
  }
}

/**
 * 개선된 평균 연결도 계산 함수
 * @param {number} nodesCount - 노드 수
 * @param {number} edgesCount - 엣지 수
 * @param {boolean} isDirected - 방향성 그래프 여부
 * @returns {number} 평균 연결도
 */
function calculateAverageDegree(nodesCount, edgesCount, isDirected = false) {
  if (nodesCount === 0) return 0;

  if (isDirected) {
    // 방향성 그래프: 각 노드의 진입/진출 차수 평균
    return edgesCount / nodesCount;
  } else {
    // 무방향 그래프: 각 노드의 연결 개수 평균
    return (2 * edgesCount) / nodesCount;
  }
}

/**
 * 그래프 타입 감지 함수 (간단한 추정)
 * @param {number} nodesCount - 노드 수
 * @param {number} edgesCount - 엣지 수
 * @returns {string} 그래프 타입 ('directed' 또는 'undirected')
 */
function detectGraphType(nodesCount, edgesCount) {
  if (nodesCount < 2) return "undirected";

  const maxPossibleEdges = (nodesCount * (nodesCount - 1)) / 2;
  const density = edgesCount / maxPossibleEdges;

  // 밀도가 낮으면 방향성일 가능성이 높음
  return density < 0.3 ? "directed" : "undirected";
}

/**
 * 향상된 연결도 보너스 점수 계산
 * @param {number} avgDegree - 평균 연결도
 * @param {number} nodesCount - 노드 수
 * @param {number} edgesCount - 엣지 수
 * @returns {number} 보너스 점수
 */
function calculateConnectionBonus(avgDegree, nodesCount, edgesCount) {
  let bonus = 0;

  // 1. 기본 연결도 보너스 (기존 로직 개선)
  if (avgDegree > 2.0) {
    // 비선형 보너스: 연결도가 높을수록 더 큰 보너스
    const baseBonus = Math.pow(avgDegree - 2.0, 1.5);
    bonus += Math.min(baseBonus, 3.0); // 최대 3점까지 확장
  }

  // 2. 네트워크 응집도 보너스
  if (nodesCount > 1) {
    const clusteringCoefficient = calculateClusteringCoefficient(
      nodesCount,
      edgesCount
    );
    if (clusteringCoefficient > 0.6) {
      bonus += 1.0; // 높은 응집도에 대한 추가 보너스
    }
  }

  // 3. 연결 균형성 보너스
  const connectionBalance = calculateConnectionBalance(nodesCount, edgesCount);
  if (connectionBalance > 0.7) {
    bonus += 0.5; // 균형잡힌 연결 구조에 대한 보너스
  }

  return Math.min(bonus, 4.0); // 최대 4점까지 확장
}

/**
 * 응집도 계수 계산 (간단한 추정)
 * @param {number} nodesCount - 노드 수
 * @param {number} edgesCount - 엣지 수
 * @returns {number} 응집도 계수 (0-1)
 */
function calculateClusteringCoefficient(nodesCount, edgesCount) {
  if (nodesCount < 3) return 0;

  const maxPossibleEdges = (nodesCount * (nodesCount - 1)) / 2;
  const actualDensity = edgesCount / maxPossibleEdges;

  // 실제 밀도를 응집도로 근사 (더 정확한 계산은 백엔드에서 필요)
  return Math.min(actualDensity * 1.5, 1.0);
}

/**
 * 연결 균형성 계산
 * @param {number} nodesCount - 노드 수
 * @param {number} edgesCount - 엣지 수
 * @returns {number} 연결 균형성 (0-1)
 */
function calculateConnectionBalance(nodesCount, edgesCount) {
  if (nodesCount === 0) return 0;

  const avgConnections = edgesCount / nodesCount;
  const maxConnections = nodesCount - 1;

  // 연결 수의 균형성 (간단한 추정)
  const balance = 1.0 - avgConnections / maxConnections;
  return Math.max(balance, 0);
}

/**
 * 연결 품질 가중치 계산
 * @param {number} avgDegree - 평균 연결도
 * @param {number} nodesCount - 노드 수
 * @returns {number} 품질 가중치
 */
function calculateQualityMultiplier(avgDegree, nodesCount) {
  let multiplier = 1.0;

  // 연결도가 너무 낮거나 높을 때 페널티
  if (avgDegree < 1.0) {
    multiplier *= 0.8; // 연결 부족 페널티
  } else if (avgDegree > nodesCount * 0.8) {
    multiplier *= 0.9; // 과도한 연결 페널티
  }

  // 노드 수에 따른 가중치 조정
  if (nodesCount >= 10) {
    multiplier *= 1.1; // 복잡한 네트워크 보너스
  }

  return multiplier;
}

/**
 * 그래프 복잡성 평가
 * @param {number} nodesCount - 노드 수
 * @param {number} edgesCount - 엣지 수
 * @param {number} avgDegree - 평균 연결도
 * @returns {object} 복잡성 정보
 */
function calculateGraphComplexity(nodesCount, edgesCount, avgDegree) {
  const complexity = {
    level: "simple",
    score: 0,
    description: "",
  };

  // 노드 수 기준 (사용자 요청 기준)
  if (nodesCount >= 200) complexity.level = "highly_complex";
  else if (nodesCount >= 50) complexity.level = "complex";
  else if (nodesCount >= 10) complexity.level = "moderate";
  else complexity.level = "simple";

  // 연결도 기준
  if (avgDegree >= 4.0) complexity.level = "highly_connected";
  else if (avgDegree >= 2.5) complexity.level = "well_connected";
  else if (avgDegree >= 1.5) complexity.level = "moderately_connected";
  else complexity.level = "poorly_connected";

  // 복잡성 점수 계산
  complexity.score = nodesCount * 0.3 + edgesCount * 0.4 + avgDegree * 0.3;

  // 복잡성 수준별 설명 추가
  switch (complexity.level) {
    case "highly_complex":
      complexity.description = "매우 복잡한 지식 네트워크 (200개 이상 노드)";
      break;
    case "complex":
      complexity.description = "복잡한 지식 네트워크 (50-199개 노드)";
      break;
    case "moderate":
      complexity.description = "보통 수준 지식 네트워크 (10-49개 노드)";
      break;
    case "simple":
      complexity.description = "단순한 지식 네트워크 (10개 미만 노드)";
      break;
    default:
      complexity.description = "기본 지식 네트워크";
  }

  return complexity;
}

/**
 * 지식 그래프 현황 상태바 컴포넌트
 *
 * 점수 계산 시스템:
 *
 * 1. 텍스트 점수 (Text Score) - 원본 데이터 규모
 *    - 기준: 1KB당 1점, 최소 1점 보장
 *    - 의미: 입력된 텍스트의 양적 규모를 나타내는 기준점
 *    - 계산: Math.max(텍스트크기(KB), 1)
 *    - 예시: 800B(0.78KB) → 1점, 2KB → 2점, 5KB → 5점
 *    - 특징: 텍스트가 많을수록 더 많은 정보를 담고 있다고 가정
 *    - 한계: 텍스트 품질(의미 밀도)은 반영하지 않음
 *    - 향후 개선: 의미 기반 청킹 도입 시 문장 수, 명사 개수 등을 보조 지표로 활용
 *
 * 2. 노드 점수 (Node Score) - 핵심 개념 추출 능력
 *    - 기준: 노드 1개당 1.5점 (중간 가중치)
 *    - 의미: 텍스트에서 추출된 핵심 개념/주제의 수량과 품질
 *    - 계산: 노드수 × 1.5
 *    - 예시: 5개 노드 → 7.5점, 10개 노드 → 15점
 *    - 중요성: 노드는 지식 그래프의 핵심 구성요소
 *    - 해석: 높을수록 텍스트에서 더 많은 핵심 개념을 발견했다는 의미
 *    - 특징: 연결성이 더 중요하므로 중간 가중치 적용
 *
 * 3. 엣지 점수 (Edge Score) - 지식 연결성 및 관계성
 *    - 기준: 엣지 1개당 2점 (높은 가중치) + 연결도 보너스
 *    - 의미: 노드 간의 관계와 연결성을 나타내는 지표
 *    - 계산: (엣지수 × 2) + 연결도 보너스(최대 2점)
 *    - 예시: 7개 엣지 → 14점, 15개 엣지 → 30점
 *    - 중요성: LLM 질의응답에서 가장 중요한 요소
 *    - 보너스: 연결도가 높을수록 추가 점수 (평균 연결도 > 2일 때)
 *    - 특징: 지식 네트워크의 응집도와 질적 수준을 반영
 *
 * 4. 효율성 지표 (Efficiency Metrics) - 질적 성능 평가
 *    - 노드 밀도: 텍스트 1KB당 추출된 노드 수 (개념 추출 효율성)
 *    - 엣지 밀도: 텍스트 1KB당 추출된 관계 수 (관계 발견 효율성)
 *    - 평균 연결도: 노드당 평균 연결 개수 (지식 네트워크 응집도)
 *    - 지식 추출 성능 지수: 종합적인 지식 추출 효율성 (최종 등급)
 *
 * 5. 효율 점수 등급 기준 (노드 밀도, 엣지 밀도, 평균 연결도 기반):
 *    - 우수 (80% 이상): 매우 높은 효율성, 모든 지표가 높은 수준
 *      → 적은 텍스트에서 많은 지식을 추출하고, 잘 연결된 지식 네트워크 구축
 *    - 양호 (60-79%): 좋은 효율성, 대부분의 지표가 보통 이상
 *      → 비교적 효율적인 지식 추출과 적절한 연결성 확보
 *    - 보통 (40-59%): 보통 수준, 일부 지표 개선 필요
 *      → 기본적인 지식 추출은 되지만 효율성 향상 여지 있음
 *    - 미흡 (40% 미만): 낮은 효율성, 대부분의 지표 개선 필요
 *      → 지식 추출 효율성이 낮고, 연결성도 부족한 상태
 *
 * 점수 계산의 핵심 원칙:
 * - 텍스트 기반: 원본 데이터의 규모를 기준으로 정규화
 * - 개념 중심: 노드(개념)에 적절한 가중치 부여
 * - 관계 중요: 엣지(관계)에 높은 가중치로 연결성 강조
 * - 효율성 고려: 양적 지표뿐만 아니라 질적 효율성도 종합 평가
 * - 종합 평가: 노드 밀도(25%), 엣지 밀도(25%), 평균 연결도(50%)로 가중 평균
 * - 연결도 보너스: 잘 연결된 지식 네트워크에 대한 추가 인센티브
 *
 * @param {number} textLength - 텍스트 총 길이 (바이트)
 * @param {number} nodesCount - 추출된 노드 수
 * @param {number} edgesCount - 추출된 엣지(관계) 수
 * @returns {JSX.Element} 지식 그래프 현황 상태바
 */
function KnowledgeGraphStatusBar({ textLength, nodesCount, edgesCount }) {
  // UI 상태 관리
  const [collapsed, setCollapsed] = useState(true);
  const [tooltipPosition, setTooltipPosition] = useState({});

  // === 기본 계산값들 ===
  const textKB = textLength / 1024; // 텍스트를 KB 단위로 변환 (1KB = 1024바이트)
  const safeTextKB = textKB > 0 ? textKB : 1; // 0으로 나누기 방지용 안전값 (최소 1KB로 설정)

  // === 점수 계산 시스템 ===

  //   텍스트 점수 계산 (Text Score)
  // - 기준: 1KB당 1점, 최소 1점 보장
  // - 논리: 텍스트 양이 많을수록 더 많은 정보를 담고 있음
  // - 예시: 800B(0.78KB) → 1점, 2048B(2KB) → 2점, 5120B(5KB) → 5점
  // - 계산: Math.max(텍스트크기(KB), 1) - 0KB일 때도 최소 1점 보장
  //
  // ⚠️ 한계점: 텍스트 품질(의미 밀도)을 반영하지 않음
  // - 동일한 1KB라도 의미 밀도(정보량)가 다른 텍스트가 존재
  // - 예시: PPT 슬라이드 5KB vs 논문 초록 5KB → 정보 밀도 차이가 큼
  // - 향후 개선 방향: 의미 기반 청킹 도입 시 문장 수, 명사 개수, 개체 수 등을
  //   보조 지표로 활용하여 의미 기반 텍스트 점수로 확장 가능
  const textScore = textLength > 0 ? Math.max(textKB, 1).toFixed(2) : "0.00";

  //   노드 점수 계산 (Node Score)
  // - 기준: 노드 1개당 1.5점 (중간 가중치)
  // - 논리: 노드는 핵심 개념/주제를 나타내지만, 연결성이 더 중요
  // - 예시: 5개 노드 → 7.5점, 10개 노드 → 15점
  // - 계산: 노드수 × 1.5 - 핵심 개념의 수량과 품질을 반영
  // - 특징: 지식 그래프의 기본 구성요소이지만, 연결성보다는 낮은 가중치
  const nodeScore = (nodesCount * 1.5).toFixed(2);

  //   엣지 점수 계산 (Edge Score) - 연결성 중심 (개선된 버전)
  // - 기준: 엣지 1개당 2점 (높은 가중치)
  // - 논리: 엣지는 지식 간 연결을 나타내므로 LLM 질의응답에서 가장 중요
  // - 개선된 평균 연결도 계산: 그래프 타입을 고려한 정확한 계산
  // - 향상된 보너스 시스템: 연결도, 응집도, 균형성을 종합적으로 평가
  // - 연결 품질 가중치: 과도한 연결이나 연결 부족에 대한 페널티 적용
  // - 예시: 7개 엣지 + 연결도 3.5 + 응집도 보너스 → 14점 + 2.5점 + 1.0점 = 17.5점
  // - 계산: (엣지수 × 2) + 향상된 보너스(최대 4점) × 품질 가중치
  // - 특징: 지식 네트워크의 응집도, 균형성, 질적 수준을 종합적으로 반영하는 핵심 지표

  // 그래프 타입 감지 및 정확한 평균 연결도 계산
  const graphType = detectGraphType(nodesCount, edgesCount);
  const isDirected = graphType === "directed";
  const connectionAvgDegree = calculateAverageDegree(
    nodesCount,
    edgesCount,
    isDirected
  );

  // 향상된 보너스 점수 계산
  const enhancedBonus = calculateConnectionBonus(
    connectionAvgDegree,
    nodesCount,
    edgesCount
  );

  // 연결 품질 가중치 계산
  const qualityMultiplier = calculateQualityMultiplier(
    connectionAvgDegree,
    nodesCount
  );

  // 최종 엣지 점수 계산
  const edgeScore = (
    (edgesCount * 2 + enhancedBonus) *
    qualityMultiplier
  ).toFixed(2);

  // 그래프 복잡성 정보 (디버깅 및 향후 확장용)
  const graphComplexity = calculateGraphComplexity(
    nodesCount,
    edgesCount,
    connectionAvgDegree
  );

  // 표시용 텍스트 크기 (사용자 친화적 형태)
  const textDisplay = formatBytes(textLength);

  // === 효율성 지표 계산 ===

  //   노드 밀도 (Node Density) - 개념 추출 효율성
  // - 공식: 노드 수 / 텍스트 KB
  // - 의미: 텍스트 1KB당 추출된 핵심 개념의 수
  // - 높을수록: 텍스트에서 더 많은 개념을 추출했다는 의미
  // - 예시: 5개 노드 / 2KB = 2.5 (1KB당 2.5개 개념)
  // - 해석: 높을수록 텍스트의 의미 밀도가 높고, 핵심 개념을 잘 추출했다는 의미
  // - 특징: 텍스트 길이에 관계없이 일관된 기준으로 개념 추출 능력을 평가
  const nodeDensity = (nodesCount / safeTextKB).toFixed(2);

  //   엣지 밀도 (Edge Density) - 관계 발견 효율성
  // - 공식: 엣지 수 / 텍스트 KB
  // - 의미: 텍스트 1KB당 추출된 관계의 수
  // - 높을수록: 텍스트에서 더 많은 관계를 발견했다는 의미
  // - 예시: 7개 엣지 / 2KB = 3.5 (1KB당 3.5개 관계)
  // - 해석: 높을수록 텍스트에서 개념 간의 연결성을 잘 파악했다는 의미
  // - 특징: 단순한 개념 나열이 아닌, 구조화된 지식 네트워크 구축 능력을 평가
  const edgeDensity = (edgesCount / safeTextKB).toFixed(2);

  //   평균 연결도 (Average Degree) - 지식 네트워크 응집도 (개선된 버전)
  // - 공식: 그래프 타입에 따라 다름
  //   • 무방향 그래프: (2 × 엣지 수) ÷ 노드 수
  //   • 방향성 그래프: 엣지 수 ÷ 노드 수
  // - 의미: 노드당 평균 연결 개수 (그래프 이론의 degree 개념)
  // - 높을수록: 노드들이 더 많이 연결되어 있다는 의미
  // - 예시: 무방향 그래프에서 (2 × 7개 엣지) ÷ 5개 노드 = 2.8 (노드당 평균 2.8개 연결)
  // - 해석: 높을수록 지식이 잘 연결되어 있고, 질의응답 시 관련 정보를 쉽게 찾을 수 있음
  // - 특징: 지식 네트워크의 응집도와 질적 수준을 나타내는 핵심 지표
  // - 기준: 2.0 이상이면 적절한 연결성, 3.0 이상이면 높은 응집도
  // - 개선사항: 그래프 타입을 자동 감지하여 더 정확한 계산 수행
  const avgDegree = connectionAvgDegree.toFixed(2);

  //   지식 추출 성능 지수 (Knowledge Extraction Performance Index) - 종합 효율성
  // - 공식: (노드점수 + 엣지점수) / 텍스트점수
  // - 의미: 텍스트 대비 지식 추출의 종합적인 효율성
  // - 높을수록: 적은 텍스트에서 많은 지식을 추출했다는 의미
  // - 예시: (10점 + 7점) / 2점 = 8.5 (텍스트 대비 8.5배 효율적)
  // - 해석: 높을수록 텍스트를 효율적으로 활용하여 풍부한 지식 네트워크를 구축했다는 의미
  // - 특징: 모든 점수를 종합하여 시스템의 전반적인 지식 추출 성능을 평가
  // - 기준: 5.0 이상이면 우수, 3.0-4.9면 양호, 1.5-2.9면 보통, 1.5 미만이면 미흡
  const yieldScore =
    parseFloat(textScore) > 0
      ? (
          (parseFloat(nodeScore) + parseFloat(edgeScore)) /
          parseFloat(textScore)
        ).toFixed(2)
      : "0.00";

  // === 효율 점수 등급 계산 (새로운 논리적 기준) ===
  // 노드나 엣지가 없으면 0점 처리 - 지식 추출이 전혀 되지 않은 경우
  const efficiencyGrade =
    nodesCount === 0 && edgesCount === 0
      ? {
          grade: "미흡",
          icon: <MdTrendingDown />,
          description:
            "지식 추출 없음\n• 노드: 0개\n• 엣지: 0개\n• 평균 연결도: 0.0",
          score: "0.0",
        }
      : getEfficiencyGrade(
          parseFloat(nodeDensity),
          parseFloat(edgeDensity),
          parseFloat(avgDegree)
        );
  // getEfficiencyGrade 함수는 노드 밀도(25%), 엣지 밀도(25%), 평균 연결도(50%)를
  // 가중 평균하여 종합적인 효율성을 평가하고 등급을 결정합니다.

  // === 마우스 이벤트 핸들러 ===
  const handleTooltipMouseEnter = (e) => {
    const position = calculateTooltipPosition(e.currentTarget, e);
    setTooltipPosition(position);
  };

  const handleTooltipMouseLeave = () => {
    setTooltipPosition({});
  };

  return (
    <div
      className={`source-quota-bar technical with-strong-border ${
        !collapsed ? "expanded" : ""
      }`}
    >
      {/* === 헤더 영역 === */}
      <div
        className="quota-label main-title"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* 제목 */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>Graph Metrics</span>
        </div>

        {/* 접기/펼치기 토글 버튼 */}
        <span
          className="collapse-toggle"
          style={{
            fontSize: "1.5em",
            userSelect: "none",
            display: "flex",
            alignItems: "center",
          }}
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

      {/* === 지식 그래프 분석 가이드 === */}
      <div
        className="knowledge-graph-guide"
        style={{
          borderRadius: "8px",
          padding: "16px 20px",
          margin: "12px 0",
          background: "#ffffff",
          border: "1px solid #dee2e6",
          fontSize: "0.9em",
          lineHeight: "1.5",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
            color: "#495057",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: "700",
                color: "#212529",
                marginBottom: "12px",
                fontSize: "1.05em",
              }}
            >
              지식 그래프 품질 평가
            </div>

            <div
              style={{
                color: "#6c757d",
                fontSize: "0.9em",
                marginBottom: "16px",
                lineHeight: "1.6",
              }}
            >
              텍스트에서 추출된 지식의 구조적 품질을 노드 밀도, 엣지 밀도, 평균
              연결도를 통해 종합적으로 평가합니다.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
                fontSize: "0.85em",
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  padding: "12px",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontWeight: "600",
                    color: "#495057",
                    marginBottom: "8px",
                  }}
                >
                  등급 기준
                </div>
                <div style={{ color: "#6c757d", fontSize: "0.9em" }}>
                  <div style={{ marginBottom: "2px" }}>• 우수: 8.0-10.0점</div>
                  <div style={{ marginBottom: "2px" }}>• 양호: 6.0-7.9점</div>
                  <div style={{ marginBottom: "2px" }}>• 보통: 4.0-5.9점</div>
                  <div style={{ marginBottom: "2px" }}>• 미흡: 4.0점 미만</div>
                </div>
              </div>
              <div
                style={{
                  background: "#ffffff",
                  padding: "12px",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontWeight: "600",
                    color: "#495057",
                    marginBottom: "8px",
                  }}
                >
                  점수 구성
                </div>
                <div style={{ color: "#6c757d", fontSize: "0.9em" }}>
                  <div style={{ marginBottom: "2px" }}>
                    • 노드 점수: 1.5점/개
                  </div>
                  <div style={{ marginBottom: "2px" }}>
                    • 엣지 점수: 2.0점/개 + 보너스
                  </div>
                  <div style={{ marginBottom: "2px" }}>
                    • 향상된 보너스: 최대 4점
                  </div>
                  <div style={{ marginBottom: "2px" }}>
                    • 품질 가중치: 연결 품질 반영
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === 상세 메트릭 영역 (접혀있지 않을 때만 표시) === */}
      {!collapsed && (
        <div className="quota-details">
          {/* === 효율성 지표 (기본 표시) === */}

          {/* 노드 밀도 */}
          <div className="data-metric">
            <span className="metric-label">노드 밀도</span>
            <span className="metric-value">{nodeDensity}</span>
            <span
              className="qmark-tooltip"
              onMouseEnter={handleTooltipMouseEnter}
              onMouseLeave={handleTooltipMouseLeave}
            >
              ?
              <Tooltip
                text={"텍스트 1KB당 추출된 노드 수\n예: 2.5 → 1KB당 2.5개 노드"}
                position={tooltipPosition}
              />
            </span>
          </div>

          {/* 엣지 밀도 */}
          <div className="data-metric">
            <span className="metric-label">엣지 밀도</span>
            <span className="metric-value">{edgeDensity}</span>
            <span
              className="qmark-tooltip"
              onMouseEnter={handleTooltipMouseEnter}
              onMouseLeave={handleTooltipMouseLeave}
            >
              ?
              <Tooltip
                text={`텍스트 1KB당 추출된 관계 수\n예: 3.0 → 1KB당 3개 관계\n\n개선된 보너스 시스템:\n• 연결도 보너스: 최대 3점\n• 응집도 보너스: 최대 1점\n• 균형성 보너스: 최대 0.5점\n• 총 최대 4점 보너스`}
                position={tooltipPosition}
              />
            </span>
          </div>

          {/* 평균 연결도 */}
          <div className="data-metric">
            <span className="metric-label">평균 연결도</span>
            <span className="metric-value">{avgDegree}</span>
            <span
              className="qmark-tooltip"
              onMouseEnter={handleTooltipMouseEnter}
              onMouseLeave={handleTooltipMouseLeave}
            >
              ?
              <Tooltip
                text={`그래프 타입: ${
                  graphType === "directed" ? "방향성" : "무방향"
                }\n노드당 평균 연결 개수\n\n연결 품질 평가:\n• ${
                  avgDegree >= 4.0
                    ? "매우 높음"
                    : avgDegree >= 2.5
                    ? "높음"
                    : avgDegree >= 1.5
                    ? "보통"
                    : "낮음"
                }\n• 복잡성: ${
                  graphComplexity.level === "highly_complex"
                    ? "매우 복잡 (200+ 노드)"
                    : graphComplexity.level === "complex"
                    ? "복잡 (50-199 노드)"
                    : graphComplexity.level === "moderate"
                    ? "보통 (10-49 노드)"
                    : "단순 (<10 노드)"
                }`}
                position={tooltipPosition}
              />
            </span>
          </div>

          {/* 향상된 엣지 점수 정보 */}
          <div className="data-metric">
            <span className="metric-label">엣지 점수 상세</span>
            <span className="metric-value">{edgeScore}</span>
            <span
              className="qmark-tooltip"
              onMouseEnter={handleTooltipMouseEnter}
              onMouseLeave={handleTooltipMouseLeave}
            >
              ?
              <Tooltip
                text={`기본 점수: ${(edgesCount * 2).toFixed(
                  1
                )}점\n보너스: +${enhancedBonus.toFixed(
                  1
                )}점\n품질 가중치: ×${qualityMultiplier.toFixed(
                  2
                )}\n\n보너스 구성:\n• 연결도: ${Math.min(
                  Math.pow(connectionAvgDegree - 2, 1.5),
                  3.0
                ).toFixed(1)}점\n• 응집도: ${
                  calculateClusteringCoefficient(nodesCount, edgesCount) > 0.6
                    ? "1.0"
                    : "0.0"
                }점\n• 균형성: ${
                  calculateConnectionBalance(nodesCount, edgesCount) > 0.7
                    ? "0.5"
                    : "0.0"
                }점`}
                position={tooltipPosition}
              />
            </span>
          </div>

          {/* 지식 추출 성능 지수 (강조 스타일 + 등급 표시) */}
          <div className="data-metric total">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flex: 1,
              }}
            >
              <span className="metric-label">지식 성능 지수</span>
              <span className="metric-value">{efficiencyGrade.score}/10</span>
              <span
                className="qmark-tooltip"
                onMouseEnter={handleTooltipMouseEnter}
                onMouseLeave={handleTooltipMouseLeave}
              >
                ?
                <Tooltip
                  text={`노드(1.5점/개) + 엣지(2.0점/개 + 보너스) + 품질 가중치\n텍스트 대비 지식 추출 효율성\n\n개선된 평가 시스템:\n• 그래프 타입 자동 감지\n• 연결 품질 가중치 적용\n• 종합적 보너스 시스템`}
                  position={tooltipPosition}
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
