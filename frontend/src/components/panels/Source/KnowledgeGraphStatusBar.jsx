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
 * - 지식 효율 점수 등급 시스템 (우수/양호/보통/미흡)
 */

import React, { useState } from 'react';
import { MdExpandMore, MdExpandLess, MdInfoOutline, MdStar, MdTrendingUp, MdTrendingDown, MdRemove } from 'react-icons/md';
import './KnowledgeGraphStatusBar.css';

/**
 * 툴팁 컴포넌트
 * @param {string} text - 툴팁에 표시할 텍스트
 * @param {object} position - 툴팁 위치 정보 (선택사항)
 * @returns {JSX.Element} 툴팁 요소
 */
function Tooltip({ text, position = null }) {
    if (position) {
        // 동적 위치 계산이 필요한 경우 (지식 효율 점수)
        const tooltipStyle = {
            position: 'absolute',
            left: position.left || 'auto',
            right: position.right || 'auto',
            top: position.top || '-40px',
            bottom: position.bottom || 'auto',
            transform: 'none',
            minWidth: '170px',
            maxWidth: '220px',
            background: '#fff',
            color: '#111',
            border: '1px solid #e0e0e0',
            borderRadius: '7px',
            boxShadow: '0 2px 8px 0 rgba(60, 60, 60, 0.10)',
            fontSize: '0.97em',
            fontWeight: '400',
            padding: '8px 13px',
            whiteSpace: 'normal',
            zIndex: 2147483647,
            pointerEvents: 'none',
            transition: 'opacity 0.18s ease'
        };

        return <span className="custom-tooltip" style={tooltipStyle}>{text}</span>;
    } else {
        // 기존 CSS 스타일 사용 (노드 밀도, 엣지 밀도, 평균 연결도)
        return <span className="custom-tooltip">{text}</span>;
    }
}

/**
 * 툴팁 위치 계산 함수
 * @param {HTMLElement} element - 툴팁을 표시할 요소
 * @returns {object} 툴팁 위치 정보
 */
function calculateTooltipPosition(element) {
    if (!element) return { top: '-40px', right: '0' };
    
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const tooltipHeight = 40; // 툴팁 예상 높이 조정
    const tooltipWidth = 220; // 툴팁 예상 너비
    
    let position = {};
    
    // 위쪽 공간이 부족한 경우 아래쪽에 표시
    if (rect.top < tooltipHeight) {
        position.bottom = '-40px';
        position.top = 'auto';
    } else {
        position.top = '-40px';
        position.bottom = 'auto';
    }
    
    // 오른쪽 공간이 부족한 경우 왼쪽에 표시
    if (rect.right + tooltipWidth > viewportWidth) {
        position.left = '0';
        position.right = 'auto';
    } else {
        position.right = '0';
        position.left = 'auto';
    }
    
    return position;
}

/**
 * 바이트 단위를 사람이 읽기 쉬운 형태로 변환
 * @param {number} bytes - 바이트 수
 * @returns {string} 변환된 문자열 (예: "1.5KB", "2.3MB")
 */
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
}

/**
 * 지식 효율 점수 등급 계산 (노드 밀도, 엣지 밀도, 평균 연결도 기반)
 * @param {number} nodeDensity - 노드 밀도 (노드 수 / 텍스트 KB)
 * @param {number} edgeDensity - 엣지 밀도 (엣지 수 / 텍스트 KB)
 * @param {number} avgDegree - 평균 연결도 (2 × 엣지 수 / 노드 수)
 * @returns {object} 등급 정보 (grade, icon, description, score)
 */
function getEfficiencyGrade(nodeDensity, edgeDensity, avgDegree) {
    // === 논리적 기준 분석 (엣지 중심 평가) ===
    // 
    // 1. 노드 밀도 기준:
    //    - 0.5 미만: 매우 낮음 (텍스트 대비 개념 추출 부족)
    //    - 0.5-1.0: 낮음 (개선 필요)
    //    - 1.0-2.0: 보통 (적절한 수준)
    //    - 2.0-3.0: 높음 (좋은 추출)
    //    - 3.0 이상: 매우 높음 (우수한 추출)
    //
    // 2. 엣지 밀도 기준 (매우 엄격):
    //    - 1.0 미만: 매우 낮음 (관계 추출 부족)
    //    - 1.0-2.0: 낮음 (개선 필요)
    //    - 2.0-4.0: 보통 (적절한 수준)
    //    - 4.0-6.0: 높음 (좋은 관계 추출)
    //    - 6.0 이상: 매우 높음 (우수한 관계 추출)
    //
    // 3. 평균 연결도 기준 (매우 엄격):
    //    - 2.0 미만: 매우 낮음 (노드 간 연결 부족)
    //    - 2.0-3.0: 낮음 (개선 필요)
    //    - 3.0-4.5: 보통 (적절한 연결)
    //    - 4.5-6.0: 높음 (좋은 연결)
    //    - 6.0 이상: 매우 높음 (우수한 연결)
    
    // === 종합 점수 계산 (10점 만점) ===
    let totalScore = 0;
    let maxScore = 0;
    
    // 노드 밀도 점수 (최대 2.0점) - 중요도 감소
    let nodeScore = 0;
    if (nodeDensity >= 3.0) nodeScore = 2.0;
    else if (nodeDensity >= 2.0) nodeScore = 1.5;
    else if (nodeDensity >= 1.0) nodeScore = 1.0;
    else if (nodeDensity >= 0.5) nodeScore = 0.5;
    else nodeScore = 0.0;
    
    // 엣지 밀도 점수 (최대 3.5점) - 중요도 증가
    let edgeScore = 0;
    if (edgeDensity >= 6.0) edgeScore = 3.5;
    else if (edgeDensity >= 4.0) edgeScore = 2.5;
    else if (edgeDensity >= 2.0) edgeScore = 1.5;
    else if (edgeDensity >= 1.0) edgeScore = 0.5;
    else edgeScore = 0.0;
    
    // 평균 연결도 점수 (최대 4.5점) - 가장 중요
    let degreeScore = 0;
    if (avgDegree >= 6.0) degreeScore = 4.5;
    else if (avgDegree >= 4.5) degreeScore = 3.5;
    else if (avgDegree >= 3.0) degreeScore = 2.5;
    else if (avgDegree >= 2.0) degreeScore = 1.0;
    else degreeScore = 0.0;
    
    totalScore = nodeScore + edgeScore + degreeScore;
    maxScore = 10.0; // 2.0 + 3.5 + 4.5
    
    // === 등급 결정 ===
    const percentage = (totalScore / maxScore) * 100;
    
    if (percentage >= 80) {
        return {
            grade: '우수',
            icon: <MdStar />,
            description: `매우 높은 지식 추출 효율성\n• 노드 밀도: ${nodeDensity} (${nodeDensity >= 2.0 ? '높음' : '보통'})\n• 엣지 밀도: ${edgeDensity} (${edgeDensity >= 4.0 ? '높음' : '보통'})\n• 평균 연결도: ${avgDegree} (${avgDegree >= 4.5 ? '높음' : '보통'})`,
            score: totalScore.toFixed(1)
        };
    } else if (percentage >= 60) {
        return {
            grade: '양호',
            icon: <MdTrendingUp />,
            description: `좋은 지식 추출 효율성\n• 노드 밀도: ${nodeDensity} (${nodeDensity >= 1.0 ? '보통' : '낮음'})\n• 엣지 밀도: ${edgeDensity} (${edgeDensity >= 2.0 ? '보통' : '낮음'})\n• 평균 연결도: ${avgDegree} (${avgDegree >= 3.0 ? '보통' : '낮음'})`,
            score: totalScore.toFixed(1)
        };
    } else if (percentage >= 40) {
        return {
            grade: '보통',
            icon: <MdRemove />,
            description: `보통 수준의 지식 추출 효율성\n• 노드 밀도: ${nodeDensity} (${nodeDensity >= 0.5 ? '낮음' : '매우 낮음'})\n• 엣지 밀도: ${edgeDensity} (${edgeDensity >= 1.0 ? '낮음' : '매우 낮음'})\n• 평균 연결도: ${avgDegree} (${avgDegree >= 2.0 ? '낮음' : '매우 낮음'})`,
            score: totalScore.toFixed(1)
        };
    } else {
        return {
            grade: '미흡',
            icon: <MdTrendingDown />,
            description: `낮은 지식 추출 효율성\n• 노드 밀도: ${nodeDensity} (매우 낮음)\n• 엣지 밀도: ${edgeDensity} (매우 낮음)\n• 평균 연결도: ${avgDegree} (매우 낮음)`,
            score: totalScore.toFixed(1)
        };
    }
}

/**
 * 지식 그래프 현황 상태바 컴포넌트
 * 
 * 점수 계산 시스템:
 * 
 * 1. 텍스트 점수 (Text Score)
 *    - 기준: 1KB당 1점, 최소 1점
 *    - 논리: 텍스트 양이 많을수록 더 많은 정보를 담고 있음
 *    - 예시: 800B → 1점, 2048B → 2점, 5120B → 5점
 *    - 목적: 원본 데이터의 규모를 반영
 * 
 * 2. 노드 점수 (Node Score)
 *    - 기준: 노드 1개당 2점 (높은 가중치)
 *    - 논리: 노드는 핵심 개념/주제를 나타내므로 가장 중요한 지식 구성요소
 *    - 예시: 5개 노드 → 10점, 10개 노드 → 20점
 *    - 목적: 추출된 지식의 핵심 개념 수를 반영
 * 
 * 3. 엣지 점수 (Edge Score)
 *    - 기준: 엣지 1개당 1점 (기본 가중치)
 *    - 논리: 엣지는 노드 간 관계를 나타내므로 기본적인 지식 연결성
 *    - 예시: 7개 엣지 → 7점, 15개 엣지 → 15점
 *    - 목적: 추출된 지식 간의 연결성을 반영
 * 
 * 4. 효율성 지표 (Efficiency Metrics)
 *    - 노드 밀도: 텍스트 1KB당 추출된 노드 수
 *    - 엣지 밀도: 텍스트 1KB당 추출된 관계 수
 *    - 평균 연결도: 노드당 평균 연결 개수 (2 × 엣지수 / 노드수)
 *    - 지식 효율 점수: (노드점수 + 엣지점수) / 텍스트점수
 * 
 * 5. 효율 점수 등급 기준 (노드 밀도, 엣지 밀도, 평균 연결도 기반):
 *    - 우수 (80% 이상): 매우 높은 효율성, 모든 지표가 높은 수준
 *    - 양호 (60-79%): 좋은 효율성, 대부분의 지표가 보통 이상
 *    - 보통 (40-59%): 보통 수준, 일부 지표 개선 필요
 *    - 미흡 (40% 미만): 낮은 효율성, 대부분의 지표 개선 필요
 * 
 * 점수 계산의 원칙:
 * - 텍스트 기반: 원본 데이터의 규모를 기준으로 함
 * - 개념 중심: 노드(개념)에 높은 가중치 부여
 * - 관계 중요: 엣지(관계)도 지식의 중요한 구성요소
 * - 효율성 고려: 단순 양적 지표뿐만 아니라 질적 효율성도 평가
 * - 종합 평가: 노드 밀도(25%), 엣지 밀도(25%), 평균 연결도(50%)로 가중 평균
 * 
 * @param {number} textLength - 텍스트 총 길이 (바이트)
 * @param {number} nodesCount - 추출된 노드 수
 * @param {number} edgesCount - 추출된 엣지(관계) 수
 * @returns {JSX.Element} 지식 그래프 현황 상태바
 */
function KnowledgeGraphStatusBar({ textLength, nodesCount, edgesCount }) {
    // UI 상태 관리
    const [collapsed, setCollapsed] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({});
    
    // === 기본 계산값들 ===
    const textKB = textLength / 1024;  // 텍스트를 KB 단위로 변환 (1KB = 1024바이트)
    const safeTextKB = textKB > 0 ? textKB : 1;  // 0으로 나누기 방지용 안전값 (최소 1KB로 설정)

    // === 점수 계산 시스템 ===
    
    //   텍스트 점수 계산
    // - 기준: 1KB당 1점, 최소 1점 보장
    // - 논리: 텍스트 양이 많을수록 더 많은 정보를 담고 있음
    // - 예시: 800B(0.78KB) → 1점, 2048B(2KB) → 2점, 5120B(5KB) → 5점
    // 
    // ⚠️ 한계점: 텍스트 품질(의미 밀도)을 반영하지 않음
    // - 동일한 1KB라도 의미 밀도(정보량)가 다른 텍스트가 존재
    // - 예시: PPT 슬라이드 5KB vs 논문 초록 5KB → 정보 밀도 차이가 큼
    // - 향후 개선 방향: 의미 기반 청킹 도입 시 문장 수, 명사 개수, 개체 수 등을 
    //   보조 지표로 활용하여 의미 기반 텍스트 점수로 확장 가능
    const textScore = textLength > 0 ? Math.max(textKB, 1).toFixed(2) : '0.00';
    
    //   노드 점수 계산
    // - 기준: 노드 1개당 1.5점 (중간 가중치)
    // - 논리: 노드는 핵심 개념/주제를 나타내지만, 연결성이 더 중요
    // - 예시: 5개 노드 → 7.5점, 10개 노드 → 15점
    const nodeScore = (nodesCount * 1.5).toFixed(2);
    
    //   엣지 점수 계산 (연결성 중심)
    // - 기준: 엣지 1개당 2점 (높은 가중치)
    // - 논리: 엣지는 지식 간 연결을 나타내므로 LLM 질의응답에서 가장 중요
    // - 평균 연결도 보정: 연결도가 높을수록 추가 점수
    // - 예시: 7개 엣지 → 14점, 15개 엣지 → 30점
    const connectionAvgDegree = nodesCount > 0 ? (2 * edgesCount) / nodesCount : 0;
    const connectionBonus = connectionAvgDegree > 2 ? Math.min(connectionAvgDegree - 2, 2) : 0; // 최대 2점 보너스
    const edgeScore = (edgesCount * 2 + connectionBonus).toFixed(2);
    
    // 표시용 텍스트 크기 (사용자 친화적 형태)
    const textDisplay = formatBytes(textLength);

    // === 효율성 지표 계산 ===
    
    //   노드 밀도 (Node Density)
    // - 공식: 노드 수 / 텍스트 KB
    // - 의미: 텍스트 1KB당 추출된 핵심 개념의 수
    // - 높을수록: 텍스트에서 더 많은 개념을 추출했다는 의미
    // - 예시: 5개 노드 / 2KB = 2.5 (1KB당 2.5개 개념)
    const nodeDensity = (nodesCount / safeTextKB).toFixed(2);
    
    //   엣지 밀도 (Edge Density)
    // - 공식: 엣지 수 / 텍스트 KB
    // - 의미: 텍스트 1KB당 추출된 관계의 수
    // - 높을수록: 텍스트에서 더 많은 관계를 발견했다는 의미
    // - 예시: 7개 엣지 / 2KB = 3.5 (1KB당 3.5개 관계)
    const edgeDensity = (edgesCount / safeTextKB).toFixed(2);
    
    //   평균 연결도 (Average Degree)
    // - 공식: (2 × 엣지 수) / 노드 수
    // - 의미: 노드당 평균 연결 개수 (그래프 이론의 degree 개념)
    // - 높을수록: 노드들이 더 많이 연결되어 있다는 의미
    // - 예시: (2 × 7개 엣지) / 5개 노드 = 2.8 (노드당 평균 2.8개 연결)
    const avgDegree = nodesCount > 0 ? ((2 * edgesCount) / nodesCount).toFixed(2) : '0.00';
    
    //   지식 효율 점수 (Knowledge Efficiency Score)
    // - 공식: (노드점수 + 엣지점수) / 텍스트점수
    // - 의미: 텍스트 대비 지식 추출의 효율성
    // - 높을수록: 적은 텍스트에서 많은 지식을 추출했다는 의미
    // - 예시: (10점 + 7점) / 2점 = 8.5 (텍스트 대비 8.5배 효율적)
    const yieldScore = parseFloat(textScore) > 0 ? ((parseFloat(nodeScore) + parseFloat(edgeScore)) / parseFloat(textScore)).toFixed(2) : '0.00';

    // === 효율 점수 등급 계산 (새로운 논리적 기준) ===
    // 노드나 엣지가 없으면 0점 처리
    const efficiencyGrade = (nodesCount === 0 && edgesCount === 0) 
        ? {
            grade: '미흡',
            icon: <MdTrendingDown />,
            description: '지식 추출 없음\n• 노드: 0개\n• 엣지: 0개\n• 평균 연결도: 0.0',
            score: '0.0'
        }
        : getEfficiencyGrade(parseFloat(nodeDensity), parseFloat(edgeDensity), parseFloat(avgDegree));

    // === 마우스 이벤트 핸들러 ===
    const handleTooltipMouseEnter = (e) => {
        const position = calculateTooltipPosition(e.currentTarget);
        setTooltipPosition(position);
    };

    return (
        <div className={`source-quota-bar technical with-strong-border ${!collapsed ? 'expanded' : ''}`}>
            {/* === 헤더 영역 === */}
            <div className="quota-label main-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* 제목 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Graph Metrics</span>
                </div>
                
                {/* 접기/펼치기 토글 버튼 */}
                <span
                    className="collapse-toggle"
                    style={{ fontSize: '1.5em', userSelect: 'none', display: 'flex', alignItems: 'center' }}
                    onClick={e => { 
                        e.stopPropagation(); 
                        setCollapsed(c => !c); 
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={collapsed ? '펼치기' : '접기'}
                >
                    {collapsed ? <MdExpandLess /> : <MdExpandMore />}
                </span>
            </div>
            
            {/* === 지식 그래프 분석 가이드 === */}
            <div className="knowledge-graph-guide" style={{
                borderRadius: '8px',
                padding: '16px 20px',
                margin: '12px 0',
                background: '#ffffff',
                border: '1px solid #dee2e6',
                fontSize: '0.9em',
                lineHeight: '1.5'
            }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '16px',
                    color: '#495057'
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ 
                            fontWeight: '700', 
                            color: '#212529',
                            marginBottom: '12px',
                            fontSize: '1.05em'
                        }}>
                            지식 그래프 품질 평가
                        </div>
                        
                        <div style={{ 
                            color: '#6c757d',
                            fontSize: '0.9em',
                            marginBottom: '16px',
                            lineHeight: '1.6'
                        }}>
                            텍스트에서 추출된 지식의 구조적 품질을 노드 밀도, 엣지 밀도, 평균 연결도를 통해 종합적으로 평가합니다.
                        </div>
                        
                        <div style={{ 
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '20px',
                            fontSize: '0.85em'
                        }}>
                            <div style={{ 
                                background: '#ffffff',
                                padding: '12px',
                                borderRadius: '6px',
                            }}>
                                <div style={{ fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
                                    등급 기준
                                </div>
                                <div style={{ color: '#6c757d', fontSize: '0.9em' }}>
                                    <div style={{ marginBottom: '2px' }}>• 우수: 8.0-10.0점</div>
                                    <div style={{ marginBottom: '2px' }}>• 양호: 6.0-7.9점</div>
                                    <div style={{ marginBottom: '2px' }}>• 보통: 4.0-5.9점</div>
                                    <div style={{ marginBottom: '2px' }}>• 미흡: 4.0점 미만</div>
                                </div>
                            </div>
                            <div style={{ 
                                background: '#ffffff',
                                padding: '12px',
                                borderRadius: '6px',
                            }}>
                                <div style={{ fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
                                    점수 구성
                                </div>
                                <div style={{ color: '#6c757d', fontSize: '0.9em' }}>
                                    <div style={{ marginBottom: '2px' }}>• 노드 점수: 1.5점/개</div>
                                    <div style={{ marginBottom: '2px' }}>• 엣지 점수: 2.0점/개</div>
                                    <div style={{ marginBottom: '2px' }}>• 연결도 보너스: +2점</div>
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
                        <span className="qmark-tooltip">
                            ?
                            <Tooltip text={"텍스트 1KB당 추출된 노드 수\n예: 2.5 → 1KB당 2.5개 노드"} />
                        </span>
                    </div>
                    
                    {/* 엣지 밀도 */}
                    <div className="data-metric">
                        <span className="metric-label">엣지 밀도</span>
                        <span className="metric-value">{edgeDensity}</span>
                        <span className="qmark-tooltip">
                            ?
                            <Tooltip text={"텍스트 1KB당 추출된 관계 수\n예: 3.0 → 1KB당 3개 관계"} />
                        </span>
                    </div>
                    
                    {/* 평균 연결도 */}
                    <div className="data-metric">
                        <span className="metric-label">평균 연결도</span>
                        <span className="metric-value">{avgDegree}</span>
                        <span className="qmark-tooltip">
                            ?
                            <Tooltip text={"(2 × 엣지 수) ÷ 노드 수\n노드 당 평균 연결 개수\n높을수록 연결도 보너스 점수"} />
                        </span>
                    </div>
                    
                    {/* 지식 효율 점수 (강조 스타일 + 등급 표시) */}
                    <div className="data-metric total">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <span className="metric-label">지식 효율 점수</span>
                            <span className="metric-value">
                                {efficiencyGrade.score}/10
                            </span>
                            <span className="qmark-tooltip">
                                ?
                                <Tooltip text={"노드(1.5점/개) + 엣지(2.0점/개) + 연결도 보너스\n텍스트 대비 지식 추출 효율성"} />
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default KnowledgeGraphStatusBar;
