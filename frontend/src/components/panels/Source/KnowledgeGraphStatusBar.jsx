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
 */

import React, { useState } from 'react';
import { MdExpandMore, MdExpandLess, MdInfoOutline } from 'react-icons/md';
import './KnowledgeGraphStatusBar.css';

/**
 * 툴팁 컴포넌트
 * @param {string} text - 툴팁에 표시할 텍스트
 * @returns {JSX.Element} 툴팁 요소
 */
function Tooltip({ text }) {
    return <span className="custom-tooltip">{text}</span>;
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
 *    - 기준: 노드 1개당 2점
 *    - 논리: 노드는 핵심 개념/주제를 나타내므로 높은 가중치
 *    - 예시: 5개 노드 → 10점, 10개 노드 → 20점
 *    - 목적: 추출된 지식의 핵심 개념 수를 반영
 * 
 * 3. 엣지 점수 (Edge Score)
 *    - 기준: 엣지 1개당 1점
 *    - 논리: 엣지는 노드 간 관계를 나타내므로 기본 가중치
 *    - 예시: 7개 엣지 → 7점, 15개 엣지 → 15점
 *    - 목적: 추출된 지식 간의 연결성을 반영
 * 
 * 4. 효율성 지표 (Efficiency Metrics)
 *    - 노드 밀도: 텍스트 1KB당 추출된 노드 수
 *    - 엣지 밀도: 텍스트 1KB당 추출된 관계 수
 *    - 평균 연결도: 노드당 평균 연결 개수 (2 × 엣지수 / 노드수)
 *    - 지식 효율 점수: (노드점수 + 엣지점수) / 텍스트점수
 * 
 * 점수 계산의 원칙:
 * - 텍스트 기반: 원본 데이터의 규모를 기준으로 함
 * - 개념 중심: 노드(개념)에 높은 가중치 부여
 * - 관계 중요: 엣지(관계)도 지식의 중요한 구성요소
 * - 효율성 고려: 단순 양적 지표뿐만 아니라 질적 효율성도 평가
 * 
 * @param {number} textLength - 텍스트 총 길이 (바이트)
 * @param {number} nodesCount - 추출된 노드 수
 * @param {number} edgesCount - 추출된 엣지(관계) 수
 * @returns {JSX.Element} 지식 그래프 현황 상태바
 */
function KnowledgeGraphStatusBar({ textLength, nodesCount, edgesCount }) {
    // UI 상태 관리
    const [collapsed, setCollapsed] = useState(true);
    const [showBasicMetrics, setShowBasicMetrics] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    
    // === 기본 계산값들 ===
    const textKB = textLength / 1024;  // 텍스트를 KB 단위로 변환 (1KB = 1024바이트)
    const safeTextKB = textKB > 0 ? textKB : 1;  // 0으로 나누기 방지용 안전값 (최소 1KB로 설정)

    // === 점수 계산 시스템 ===
    
    //   텍스트 점수 계산
    // - 기준: 1KB당 1점, 최소 1점 보장
    // - 논리: 텍스트 양이 많을수록 더 많은 정보를 담고 있음
    // - 예시: 800B(0.78KB) → 1점, 2048B(2KB) → 2점, 5120B(5KB) → 5점
    const textScore = textLength > 0 ? Math.max(textKB, 1).toFixed(2) : '0.00';
    
    //   노드 점수 계산
    // - 기준: 노드 1개당 2점 (높은 가중치)
    // - 논리: 노드는 핵심 개념/주제를 나타내므로 가장 중요한 지식 구성요소
    // - 예시: 5개 노드 → 10점, 10개 노드 → 20점
    const nodeScore = (nodesCount * 2).toFixed(2);
    
    //   엣지 점수 계산
    // - 기준: 엣지 1개당 1점 (기본 가중치)
    // - 논리: 엣지는 노드 간 관계를 나타내므로 기본적인 지식 연결성
    // - 예시: 7개 엣지 → 7점, 15개 엣지 → 15점
    const edgeScore = (edgesCount * 1).toFixed(2);
    
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

    // === 마우스 이벤트 핸들러 ===
    const handleMouseEnter = (e) => {
        setShowBasicMetrics(true);
        setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e) => {
        if (showBasicMetrics) {
            setMousePosition({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseLeave = () => {
        setShowBasicMetrics(false);
    };

    return (
        <div className="source-quota-bar technical with-strong-border">
            {/* === 헤더 영역 === */}
            <div className="quota-label main-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* 제목과 정보 아이콘 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Graph Metrics</span>
                    <MdInfoOutline 
                        className="info-icon"
                        style={{ 
                            fontSize: '1.2em', 
                            color: '#888', 
                            cursor: 'pointer',
                            transition: 'color 0.2s ease'
                        }}
                        onMouseEnter={handleMouseEnter}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    />
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
                            <Tooltip text={"(2 × 엣지 수) ÷ 노드 수\n노드 당 평균 연결 개수"} />
                        </span>
                    </div>
                    
                    {/* 지식 효율 점수 (강조 스타일) */}
                    <div className="data-metric total">
                        <span className="metric-label">지식 효율 점수</span>
                        <span className="metric-value">{yieldScore}</span>
                        <span className="qmark-tooltip">
                            ?
                            <Tooltip text={"(노드점수 + 엣지점수) ÷ 텍스트점수\n→ 텍스트 대비 지식 추출 효율"} />
                        </span>
                    </div>
                </div>
            )}

            {/* === 기본 메트릭 말풍선 (마우스 위치에 표시) === */}
            {showBasicMetrics && (
                <div 
                    className="basic-metrics-tooltip"
                    style={{
                        position: 'fixed',
                        left: mousePosition.x + 10,
                        top: mousePosition.y - 100,
                        transform: 'none',
                        zIndex: 10000
                    }}
                >
                    <div className="tooltip-header">기본 메트릭</div>
                    <div className="tooltip-content">
                        <div className="tooltip-metric">
                            <span className="tooltip-label">텍스트 총량:</span>
                            <span className="tooltip-value">{textDisplay}</span>
                        </div>
                        <div className="tooltip-metric">
                            <span className="tooltip-label">지식 노드 수:</span>
                            <span className="tooltip-value">{nodesCount}개</span>
                        </div>
                        <div className="tooltip-metric">
                            <span className="tooltip-label">관계(엣지) 수:</span>
                            <span className="tooltip-value">{edgesCount}개</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default KnowledgeGraphStatusBar;
