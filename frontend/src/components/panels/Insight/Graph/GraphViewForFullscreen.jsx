// GraphViewForFullscreen.jsx - 반발력, 링크거리, 링크장력 3개만 구현

import React, { useState, useEffect, useCallback } from 'react';
import GraphView from './GraphView';
import './GraphViewForFullscreen.css';
import { FiSearch, FiX, FiSun, FiMoon, FiSettings, FiRefreshCw, FiMapPin } from 'react-icons/fi';

function GraphViewForFullscreen(props) {
    const { isFullscreen = true, ...restProps } = props;
    const [allNodes, setAllNodes] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [localReferencedNodes, setLocalReferencedNodes] = useState(props.referencedNodes || []);
    const [showAdvancedControls, setShowAdvancedControls] = useState(false);
    const [graphStats, setGraphStats] = useState({ nodes: 0, links: 0 });
    const [newlyAddedNodes, setNewlyAddedNodes] = useState([]);
    const [clearTrigger, setClearTrigger] = useState(0);

    // 다크모드 상태
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('graphDarkMode');
        return saved ? JSON.parse(saved) : false;
    });

    // 상단에 색상 변수 선언
    const ICON_COLOR = isDarkMode ? 'white' : 'black';

    // ✅ 핵심 커스터마이징 + 3개 물리 설정
    const [graphSettings, setGraphSettings] = useState(() => {
        const saved = localStorage.getItem('graphSettings_fullscreen');
        return saved ? JSON.parse(saved) : {
            nodeSize: 6,                // 노드 크기
            linkWidth: 1,               // 링크 두께
            textZoomThreshold: 0.5,     // 텍스트 표시 시작점
            // ✅ 3개 물리 설정 (0-100 범위)
            repelStrength: 50,          // 반발력
            linkDistance: 50,           // 링크 거리
            linkStrength: 50,           // 링크 장력
        };
    });

    // 설정 변경 시 localStorage에 저장
    useEffect(() => {
        localStorage.setItem('graphSettings_fullscreen', JSON.stringify(graphSettings));
    }, [graphSettings]);

    // 다크모드 토글 함수
    const toggleDarkMode = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        localStorage.setItem('graphDarkMode', JSON.stringify(newMode));
    };

    // GraphView에서 그래프 데이터 업데이트 시 처리
    const handleGraphDataUpdate = useCallback((graphData) => {
        if (graphData && graphData.nodes) {
            setAllNodes(graphData.nodes.map(node => node.name));
            setGraphStats({
                nodes: graphData.nodes.length,
                links: graphData.links?.length || 0
            });
        }
        if (props.onGraphDataUpdate) {
            props.onGraphDataUpdate(graphData);
        }
    }, [props.onGraphDataUpdate]);

    const handleNewlyAddedNodes = useCallback((nodeNames) => {
        console.log('🆕 풀스크린에서 새로 추가된 노드 감지:', nodeNames);
        setNewlyAddedNodes(nodeNames || []);
    }, []);

    useEffect(() => {
        setLocalReferencedNodes(props.referencedNodes || []);
    }, [props.referencedNodes]);

    const handleSearch = useCallback((query) => {
        if (!query.trim() || allNodes.length === 0) {
            setLocalReferencedNodes(props.referencedNodes || []);
            return;
        }

        const searchTerms = query.toLowerCase().split(/\s+/);
        const matchingNodes = allNodes.filter(nodeName =>
            searchTerms.some(term =>
                nodeName.toLowerCase().includes(term)
            )
        );

        setLocalReferencedNodes(matchingNodes);
    }, [allNodes, props.referencedNodes]);

    const handleSearchInput = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        handleSearch(query);
    };

    const clearSearch = () => {
        console.log('🧹 검색 및 하이라이트 해제');
        setSearchQuery('');
        setLocalReferencedNodes([]);
        setNewlyAddedNodes([]);
        setClearTrigger(prev => prev + 1);

        if (props.onClearHighlights) {
            props.onClearHighlights();
        } else {
            localStorage.setItem('graphStateSync', JSON.stringify({
                brainId: props.brainId,
                action: 'clear_highlights_from_fullscreen',
                timestamp: Date.now()
            }));
        }
    };

    // 키보드 단축키
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('fullscreen-node-search')?.focus();
            }
            if (e.key === 'Escape') {
                clearSearch();
                document.getElementById('fullscreen-node-search')?.blur();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setShowAdvancedControls(prev => !prev);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                toggleDarkMode();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDarkMode]);

    return (
        <div className={`graph-fullscreen-container ${isDarkMode ? 'dark-mode' : ''}`}>
            <GraphView
                {...restProps}
                isFullscreen={isFullscreen}
                fromFullscreen={true}
                referencedNodes={localReferencedNodes}
                onGraphDataUpdate={handleGraphDataUpdate}
                onNewlyAddedNodes={handleNewlyAddedNodes}
                externalShowReferenced={localReferencedNodes.length === 0 ? false : undefined}
                externalShowFocus={localReferencedNodes.length === 0 ? false : undefined}
                externalShowNewlyAdded={newlyAddedNodes.length === 0 ? false : undefined}
                clearTrigger={clearTrigger}
                isDarkMode={isDarkMode}
                // ✅ 커스터마이징 props 전달
                customNodeSize={graphSettings.nodeSize}
                customLinkWidth={graphSettings.linkWidth}
                textDisplayZoomThreshold={graphSettings.textZoomThreshold}
                // ✅ 3개 물리 설정 전달
                repelStrength={graphSettings.repelStrength}
                linkDistance={graphSettings.linkDistance}
                linkStrength={graphSettings.linkStrength}
            />

            <div className="fullscreen-overlay">
                <div className="fullscreen-toolbar">
                    <div className="toolbar-left">
                        <div className="fullscreen-search-container">
                            <div className="fullscreen-search-input-wrapper">
                                <FiSearch style={{ marginRight: 4, fontSize: 18, verticalAlign: 'middle', color: ICON_COLOR }} />
                                <input
                                    id="fullscreen-node-search"
                                    type="text"
                                    placeholder="노드 검색 (⌘F)"
                                    value={searchQuery}
                                    onChange={handleSearchInput}
                                    className="fullscreen-search-input"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={clearSearch}
                                        className="fullscreen-clear-search-btn"
                                        title="검색 초기화"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <FiX color={ICON_COLOR} />
                                    </button>
                                )}
                            </div>
                            {searchQuery && (
                                <div className="fullscreen-search-results">
                                    {localReferencedNodes.length}개 노드 발견
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="toolbar-right">
                        <button
                            onClick={toggleDarkMode}
                            className="fullscreen-control-btn darkmode-toggle"
                            title={`${isDarkMode ? '라이트' : '다크'}모드 (⌘D)`}
                        >
                            <span className="fullscreen-btn-icon">
                                {isDarkMode ? <FiSun color={ICON_COLOR} /> : <FiMoon color={ICON_COLOR} />}
                            </span>
                            <span className="btn-text">
                                {isDarkMode ? '라이트' : '다크'}
                            </span>
                        </button>

                        <button
                            onClick={() => setShowAdvancedControls(prev => !prev)}
                            className={`fullscreen-control-btn advanced-toggle ${showAdvancedControls ? 'active' : ''}`}
                            title="고급 컨트롤 토글 (⌘K)"
                        >
                            <span className="fullscreen-btn-icon"><FiSettings color={ICON_COLOR} /></span>
                            <span className="btn-text">고급</span>
                        </button>

                        <button
                            onClick={() => {
                                if (props.onRefresh) {
                                    props.onRefresh();
                                } else {
                                    localStorage.setItem('graphStateSync', JSON.stringify({
                                        brainId: props.brainId,
                                        action: 'refresh_from_fullscreen',
                                        timestamp: Date.now()
                                    }));
                                }
                            }}
                            className="fullscreen-control-btn refresh-btn"
                            title="그래프 새로고침"
                        >
                            <span className="fullscreen-btn-icon"><FiRefreshCw color={ICON_COLOR} /></span>
                            <span className="btn-text">새로고침</span>
                        </button>

                        {(localReferencedNodes.length > 0 ||
                            (props.focusNodeNames && props.focusNodeNames.length > 0) ||
                            newlyAddedNodes.length > 0) && (
                                <button
                                    onClick={clearSearch}
                                    className="fullscreen-control-btn fullscreen-clear-btn"
                                    title="하이라이트 해제"
                                >
                                    <span className="fullscreen-btn-icon"><FiX color={ICON_COLOR} /></span>
                                    <span className="btn-text">해제</span>
                                </button>
                            )}
                    </div>
                </div>

                {showAdvancedControls && (
                    <div className="fullscreen-advanced-controls-panel">
                        <div className="fullscreen-panel-header">
                            <h4>그래프 설정</h4>
                            <button
                                onClick={() => setShowAdvancedControls(false)}
                                className="fullscreen-close-panel-btn"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="fullscreen-panel-content">
                            <div className="fullscreen-control-group">
                                <label>그래프 통계</label>
                                <div className="fullscreen-stats-grid">
                                    <div className="fullscreen-stat-item">
                                        <span className="fullscreen-stat-label">노드</span>
                                        <span className="fullscreen-stat-value">{graphStats.nodes}</span>
                                    </div>
                                    <div className="fullscreen-stat-item">
                                        <span className="fullscreen-stat-label">연결</span>
                                        <span className="fullscreen-stat-value">{graphStats.links}</span>
                                    </div>
                                    <div className="fullscreen-stat-item">
                                        <span className="fullscreen-stat-label">하이라이트</span>
                                        <span className="fullscreen-stat-value">{localReferencedNodes.length}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 표시 설정 */}
                            <div className="fullscreen-control-group">
                                <label>표시 설정</label>
                                <div className="fullscreen-slider-container">
                                    {/* 노드 크기 */}
                                    <div className="fullscreen-slider-item">
                                        <span className="fullscreen-slider-label">노드 크기</span>
                                        <input
                                            type="range"
                                            min="3"
                                            max="12"
                                            step="0.5"
                                            value={graphSettings.nodeSize}
                                            onChange={(e) => setGraphSettings(prev => ({
                                                ...prev,
                                                nodeSize: parseFloat(e.target.value)
                                            }))}
                                            className="fullscreen-slider"
                                        />
                                        <span className="fullscreen-slider-value">{graphSettings.nodeSize}</span>
                                    </div>

                                    {/* 링크 두께 */}
                                    <div className="fullscreen-slider-item">
                                        <span className="fullscreen-slider-label">링크 두께</span>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="4"
                                            step="0.1"
                                            value={graphSettings.linkWidth}
                                            onChange={(e) => setGraphSettings(prev => ({
                                                ...prev,
                                                linkWidth: parseFloat(e.target.value)
                                            }))}
                                            className="fullscreen-slider"
                                        />
                                        <span className="fullscreen-slider-value">{graphSettings.linkWidth}</span>
                                    </div>

                                    {/* 텍스트 표시 */}
                                    <div className="fullscreen-slider-item">
                                        <span className="fullscreen-slider-label">텍스트 표시</span>
                                        <input
                                            type="range"
                                            min="0.05"
                                            max="2"
                                            step="0.1"
                                            value={graphSettings.textZoomThreshold}
                                            onChange={(e) => setGraphSettings(prev => ({
                                                ...prev,
                                                textZoomThreshold: parseFloat(e.target.value)
                                            }))}
                                            className="fullscreen-slider"
                                        />
                                        <span className="fullscreen-slider-value">{graphSettings.textZoomThreshold}x</span>
                                    </div>
                                </div>
                            </div>

                            {/* ✅ 3개 물리 설정 */}
                            <div className="fullscreen-control-group">
                                <label>물리 설정</label>
                                <div className="fullscreen-slider-container">
                                    {/* 반발력 */}
                                    <div className="fullscreen-slider-item">
                                        <span className="fullscreen-slider-label">반발력</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            value={graphSettings.repelStrength}
                                            onChange={(e) => setGraphSettings(prev => ({
                                                ...prev,
                                                repelStrength: parseInt(e.target.value)
                                            }))}
                                            className="fullscreen-slider"
                                        />
                                        <span className="fullscreen-slider-value">{graphSettings.repelStrength}%</span>
                                    </div>

                                    {/* 링크 거리 */}
                                    <div className="fullscreen-slider-item">
                                        <span className="fullscreen-slider-label">링크 거리</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            value={graphSettings.linkDistance}
                                            onChange={(e) => setGraphSettings(prev => ({
                                                ...prev,
                                                linkDistance: parseInt(e.target.value)
                                            }))}
                                            className="fullscreen-slider"
                                        />
                                        <span className="fullscreen-slider-value">{graphSettings.linkDistance}%</span>
                                    </div>

                                    {/* 링크 장력 */}
                                    <div className="fullscreen-slider-item">
                                        <span className="fullscreen-slider-label">링크 장력</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            value={graphSettings.linkStrength}
                                            onChange={(e) => setGraphSettings(prev => ({
                                                ...prev,
                                                linkStrength: parseInt(e.target.value)
                                            }))}
                                            className="fullscreen-slider"
                                        />
                                        <span className="fullscreen-slider-value">{graphSettings.linkStrength}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="fullscreen-control-group">
                                <label>테마 설정</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={toggleDarkMode}
                                        className="fullscreen-control-btn darkmode-toggle"
                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                    >
                                        {isDarkMode ? '☀️ 라이트모드' : '🌙 다크모드'}
                                    </button>
                                </div>
                            </div>

                            <div className="fullscreen-control-group">
                                <label>빠른 액션</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => {
                                            console.log('🔄 고급 패널에서 새로고침');
                                            if (props.onRefresh) {
                                                props.onRefresh();
                                            }
                                        }}
                                        className="fullscreen-control-btn"
                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                    >
                                        🔄 새로고침
                                    </button>

                                    {(localReferencedNodes.length > 0 ||
                                        (props.focusNodeNames && props.focusNodeNames.length > 0) ||
                                        newlyAddedNodes.length > 0) && (
                                            <button
                                                onClick={clearSearch}
                                                className="fullscreen-control-btn fullscreen-clear-btn"
                                                style={{ fontSize: '12px', padding: '6px 12px' }}
                                            >
                                                ✕ 해제
                                            </button>
                                        )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="fullscreen-statusbar">
                    <div className="fullscreen-status-left">
                        {(localReferencedNodes.length > 0 || newlyAddedNodes.length > 0) && (
                            <div className="fullscreen-highlighted-nodes">
                                <span className="fullscreen-status-icon"><FiMapPin color={ICON_COLOR} /></span>
                                <span className="fullscreen-status-text">
                                    {props.focusNodeNames && props.focusNodeNames.length > 0 ? '포커스' :
                                        newlyAddedNodes.length > 0 ? '새로 추가' : '하이라이트'}:
                                    {(localReferencedNodes.length > 0 ? localReferencedNodes : newlyAddedNodes).slice(0, 3).join(', ')}
                                    {((localReferencedNodes.length > 0 ? localReferencedNodes : newlyAddedNodes).length > 3) &&
                                        ` 외 ${(localReferencedNodes.length > 0 ? localReferencedNodes : newlyAddedNodes).length - 3}개`}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="fullscreen-status-right">
                        <div className="fullscreen-keyboard-shortcuts">
                            <span className="fullscreen-shortcut">⌘F</span>
                            <span className="fullscreen-shortcut">⌘D</span>
                            <span className="fullscreen-shortcut">⌘K</span>
                            <span className="fullscreen-shortcut">ESC</span>
                            <span className="fullscreen-shortcut-desc">더블클릭으로 이동</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GraphViewForFullscreen;