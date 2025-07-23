import React, { useState, useRef, useEffect } from 'react';
import GraphView from './GraphView';
import { MdFullscreen, MdClose, MdOutlineSearch } from 'react-icons/md';
import { PiMagicWand } from "react-icons/pi";
import './GraphViewWithModal.css';

export default function GraphViewWithModal({
    brainId,
    height,
    referencedNodes,
    focusNodeNames,
    graphRefreshTrigger,
    onGraphDataUpdate,
    onGraphReady,
    onClearReferencedNodes,
    onClearFocusNodes,
    onClearNewlyAddedNodes
}) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const modalRef = useRef(null);
    const offset = useRef({ x: 0, y: 0 });
    const timelapseFunctionRef = useRef(null);

    // 팝업 관련 상태들 (GraphView에서 이동)
    const [showNewlyAdded, setShowNewlyAdded] = useState(false);
    const [newlyAddedNodeNames, setNewlyAddedNodeNames] = useState([]);
    const [showReferenced, setShowReferenced] = useState(true);
    const [showFocus, setShowFocus] = useState(true);
    const [showSearch, setShowSearch] = useState(false);

    // ✅ GraphView 내부 상태를 제어하기 위한 콜백 함수들
    const [graphViewCallbacks, setGraphViewCallbacks] = useState({});

    // referencedNodes를 state로 관리
    const [referencedNodesState, setReferencedNodesState] = useState(referencedNodes || []);

    // GraphView의 상태 감지를 위한 useEffect들
    useEffect(() => {
        // graphRefreshTrigger 변화 감지하여 새로 추가된 노드 표시
        if (graphRefreshTrigger) {
            // 이 로직은 GraphView 내부에서 처리되므로 여기서는 기본 설정만
            setShowNewlyAdded(false);
            setNewlyAddedNodeNames([]);

            setShowReferenced(false);
            setReferencedNodesState([]);
            setShowFocus(false);
        }
    }, [graphRefreshTrigger]);

    useEffect(() => {
        setReferencedNodesState(referencedNodes || []);
    }, [referencedNodes]);

    // ✅ 수정: focusNodeNames 변화 감지 - 안전한 의존성 배열 사용
    useEffect(() => {
        console.log('🎯 focusNodeNames 변화 감지:', focusNodeNames);
        if (focusNodeNames && focusNodeNames.length > 0) {
            console.log('✅ showFocus를 true로 설정');
            setShowFocus(true);
        }
    }, [focusNodeNames]);

    // ESC로 닫기
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsFullscreen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 외부 창 열기 함수 개선
    const openExternalGraphWindow = () => {
        const params = new URLSearchParams({
            brainId: brainId
        });

        if (referencedNodes && referencedNodes.length > 0) {
            params.set('referencedNodes', encodeURIComponent(JSON.stringify(referencedNodes)));
        }

        if (focusNodeNames && focusNodeNames.length > 0) {
            params.set('focusNodeNames', encodeURIComponent(JSON.stringify(focusNodeNames)));
        }

        if (onGraphDataUpdate) {
            params.set('nodeCount', onGraphDataUpdate.nodes?.length || 0);
        }

        const url = `${window.location.origin}/graph-view?${params.toString()}`;

        const newWindow = window.open(
            url,
            '_blank',
            'width=1200,height=800,scrollbars=no,resizable=yes'
        );

        const handleMessage = (event) => {
            if (event.source === newWindow) {
                console.log('Message from standalone window:', event.data);
            }
        };

        window.addEventListener('message', handleMessage);

        const checkClosed = setInterval(() => {
            if (newWindow.closed) {
                window.removeEventListener('message', handleMessage);
                clearInterval(checkClosed);
            }
        }, 1000);
    };

    // 타임랩스 실행 함수
    const handleTimelapse = () => {
        if (timelapseFunctionRef.current && timelapseFunctionRef.current.startTimelapse) {
            timelapseFunctionRef.current.startTimelapse();
        }
    };

    // ✅ GraphView와 상태 동기화를 위한 콜백 함수들
    const handleGraphViewReady = (callbacks) => {
        console.log('📡 GraphView 콜백 등록:', Object.keys(callbacks));
        setGraphViewCallbacks(callbacks);
    };

    // ✅ GraphView에서 새로 추가된 노드 정보를 받는 함수
    const handleNewlyAddedNodes = (nodeNames) => {
        console.log('🆕 새로 추가된 노드들:', nodeNames);
        if (nodeNames && nodeNames.length > 0) {
            setNewlyAddedNodeNames(nodeNames);
            setShowNewlyAdded(true);
        }
    };

    return (
        <div className="graph-view-wrapper">
            <div className="graph-with-button">
                <GraphView
                    brainId={brainId}
                    height={height}
                    referencedNodes={referencedNodesState}
                    focusNodeNames={focusNodeNames}
                    onTimelapse={timelapseFunctionRef}
                    graphRefreshTrigger={graphRefreshTrigger}
                    onGraphDataUpdate={onGraphDataUpdate}
                    onGraphReady={onGraphReady}
                    isFullscreen={isFullscreen}
                    externalShowReferenced={showReferenced}
                    externalShowFocus={showFocus}
                    externalShowNewlyAdded={showNewlyAdded}
                    onGraphViewReady={handleGraphViewReady}
                    onNewlyAddedNodes={handleNewlyAddedNodes}
                    onClearReferencedNodes={onClearReferencedNodes}
                    onClearFocusNodes={onClearFocusNodes}
                    onClearNewlyAddedNodes={onClearNewlyAddedNodes}
                    showSearch={showSearch}
                />

                {/* 타임랩스 버튼 */}
                <div className="timelapse-button-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    {/* 검색 아이콘 - 타임랩스  */}
                    <button
                        className={`graph-search-toggle-btn${showSearch ? ' active' : ''}`}
                        onClick={() => setShowSearch(v => !v)}
                        title="노드 검색"
                    >
                        <MdOutlineSearch size={21} color="#222" />
                    </button>

                    <div
                        className="timelapse-button"
                        onClick={handleTimelapse}
                        title="Start timelapse animation"
                    >
                        <PiMagicWand size={21} color="black" />
                    </div>
                </div>

                {/* 전체화면 버튼 */}
                <button className="fullscreen-btn" onClick={openExternalGraphWindow}>
                    {!isFullscreen && (<MdFullscreen size={22} color='black' title='전체화면' />)}
                </button>
            </div>
        </div>
    );
}