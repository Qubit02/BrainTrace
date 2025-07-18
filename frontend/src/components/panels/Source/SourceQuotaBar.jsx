// src/components/SourceQuotaBar.jsx
import React, { useState } from 'react';
import { MdExpandMore, MdExpandLess } from 'react-icons/md';
import './SourceQuotaBar.css';

function Tooltip({ text }) {
    return <span className="custom-tooltip">{text}</span>;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
}

function SourceQuotaBar({ textLength, nodesCount, edgesCount }) {
    const [collapsed, setCollapsed] = useState(false);
    // 텍스트 점수: 1KB(1024B)당 1점, 최소 1점, 소수점 2자리
    const textScore = textLength > 0 ? Math.max((textLength / 1024), 1).toFixed(2) : '0.00';
    const nodeScore = (nodesCount * 2).toFixed(2);
    const edgeScore = (edgesCount * 1).toFixed(2);
    const totalScore = (parseFloat(textScore) + parseFloat(nodeScore) + parseFloat(edgeScore)).toFixed(2);
    const textDisplay = formatBytes(textLength);

    return (
        <div className="source-quota-bar technical with-strong-border">
            <div className="quota-label main-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>지식 그래프 현황</span>
                <span
                    className="collapse-toggle"
                    style={{ fontSize: '1.5em', userSelect: 'none', display: 'flex', alignItems: 'center' }}
                    onClick={e => { e.stopPropagation(); setCollapsed(c => !c); }}
                    tabIndex={0}
                    role="button"
                    aria-label={collapsed ? '펼치기' : '접기'}
                >
                    {collapsed ? <MdExpandLess /> : <MdExpandMore />}
                </span>
            </div>
            {!collapsed && (
                <>
                    <div className="quota-details">
                        <div className="data-metric">
                            <span className="metric-label">텍스트 총량</span>
                            <span className="metric-value">{textDisplay}</span>
                            <span className="metric-score">({textScore}점)</span>
                            <span className="qmark-tooltip">
                                ?
                                <Tooltip text={"문서 내 전체 텍스트 용량 (1KB=1점, 최소 1점)\n예: 800B→1점, 2048B→2점"} />
                            </span>
                        </div>
                        <div className="data-metric">
                            <span className="metric-label">지식 노드</span>
                            <span className="metric-value">{nodesCount}개</span>
                            <span className="metric-score">({nodeScore}점)</span>
                            <span className="qmark-tooltip">
                                ?
                                <Tooltip text={"추출된 지식 노드(개념/주제) 개수 × 2점\n예: 5개→10점"} />
                            </span>
                        </div>
                        <div className="data-metric">
                            <span className="metric-label">관계(엣지)</span>
                            <span className="metric-value">{edgesCount}개</span>
                            <span className="metric-score">({edgeScore}점)</span>
                            <span className="qmark-tooltip">
                                ?
                                <Tooltip text={"노드 간 연결(관계) 개수 × 1점\n예: 7개→7점"} />
                            </span>
                        </div>
                        <div className="data-metric total">
                            <span className="metric-label">지식량 점수</span>
                            <span className="metric-value">{totalScore}점</span>
                            <span className="qmark-tooltip">
                                ?
                                <Tooltip text={"지식량 점수 = 텍스트점수 + 노드점수 + 엣지점수\n(텍스트: 1KB=1점, 노드: 2점/개, 엣지: 1점/개)"} />
                            </span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default SourceQuotaBar;
