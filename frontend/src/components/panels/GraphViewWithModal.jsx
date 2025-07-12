import React, { useState, useRef, useEffect } from 'react';
import GraphView from './GraphView';
import { MdFullscreen, MdClose } from 'react-icons/md';
import { PiMagicWand } from "react-icons/pi";
import './styles/GraphViewWithModal.css';

function GraphViewWithModal(props) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const modalRef = useRef(null);
    const offset = useRef({ x: 0, y: 0 });
    const timelapseFunctionRef = useRef(null);

    // 팝업 관련 상태들 (GraphView에서 이동)
    const [showNewlyAdded, setShowNewlyAdded] = useState(false);
    const [newlyAddedNodeNames, setNewlyAddedNodeNames] = useState([]);
    const [showReferenced, setShowReferenced] = useState(true);
    const [showFocus, setShowFocus] = useState(true);

    // ✅ GraphView 내부 상태를 제어하기 위한 콜백 함수들
    const [graphViewCallbacks, setGraphViewCallbacks] = useState({});

    // GraphView의 상태 감지를 위한 useEffect들
    useEffect(() => {
        // graphRefreshTrigger 변화 감지하여 새로 추가된 노드 표시
        if (props.graphRefreshTrigger) {
            // 이 로직은 GraphView 내부에서 처리되므로 여기서는 기본 설정만
            setShowNewlyAdded(false);
            setNewlyAddedNodeNames([]);
        }
    }, [props.graphRefreshTrigger]);

    useEffect(() => {
        // referencedNodes 변화 감지
        if (props.referencedNodes && props.referencedNodes.length > 0) {
            setShowReferenced(true);
        }
    }, [props.referencedNodes]);

    // ✅ 수정: focusNodeNames 변화 감지 - 안전한 의존성 배열 사용
    useEffect(() => {
        console.log('🎯 focusNodeNames 변화 감지:', props.focusNodeNames);
        if (props.focusNodeNames && props.focusNodeNames.length > 0) {
            console.log('✅ showFocus를 true로 설정');
            setShowFocus(true);
        }
    }, [props.focusNodeNames]);

    // ✅ 수정: 디버깅 로그를 별도 useEffect로 분리하고 조건부 실행
    useEffect(() => {
        // 개발 모드에서만 로그 출력
        if (process.env.NODE_ENV === 'development') {
            console.log('🔍 GraphViewWithModal 상태:', {
                showFocus,
                focusNodeNamesLength: props.focusNodeNames?.length || 0,
                showReferenced,
                referencedNodesLength: props.referencedNodes?.length || 0,
                showNewlyAdded,
                newlyAddedNodesLength: newlyAddedNodeNames?.length || 0
            });
        }
    }, []);

    // ESC로 닫기
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsFullscreen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 모달 바깥 클릭 시 닫기
    const handleBackdropClick = (e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
            setIsFullscreen(false);
        }
    };

    // 모달 드래그
    const handleMouseDown = (e) => {
        const modal = modalRef.current;
        if (!modal) return;

        const rect = modal.getBoundingClientRect();
        offset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };

        modal.style.transform = 'none';
        modal.style.left = `${rect.left}px`;
        modal.style.top = `${rect.top}px`;

        const onMouseMove = (e) => {
            const newLeft = e.clientX - offset.current.x;
            const newTop = e.clientY - offset.current.y;
            modal.style.left = `${newLeft}px`;
            modal.style.top = `${newTop}px`;
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // 리사이즈
    const handleResizeMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const modal = modalRef.current;
        if (!modal) return;

        const startWidth = modal.offsetWidth;
        const startHeight = modal.offsetHeight;
        const startX = e.clientX;
        const startY = e.clientY;

        const onMouseMove = (e) => {
            const newWidth = Math.max(400, startWidth + (e.clientX - startX));
            const newHeight = Math.max(300, startHeight + (e.clientY - startY));
            modal.style.width = `${newWidth}px`;
            modal.style.height = `${newHeight}px`;
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // 외부 창 열기 함수 개선
    const openExternalGraphWindow = () => {
        const brainId = props.brainId || 'default-brain-id';

        const params = new URLSearchParams({
            brainId: brainId
        });

        if (props.referencedNodes && props.referencedNodes.length > 0) {
            params.set('referencedNodes', encodeURIComponent(JSON.stringify(props.referencedNodes)));
        }

        if (props.focusNodeNames && props.focusNodeNames.length > 0) {
            params.set('focusNodeNames', encodeURIComponent(JSON.stringify(props.focusNodeNames)));
        }

        if (props.graphData) {
            params.set('nodeCount', props.graphData.nodes?.length || 0);
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
                    {...props}
                    isFullscreen={isFullscreen}
                    referencedNodes={props.referencedNodes}
                    focusNodeNames={props.focusNodeNames}
                    onTimelapse={timelapseFunctionRef}
                    // ✅ 외부에서 제어할 수 있도록 상태 전달
                    externalShowReferenced={showReferenced}
                    externalShowFocus={showFocus}
                    externalShowNewlyAdded={showNewlyAdded}
                    onGraphViewReady={handleGraphViewReady}
                    // ✅ 새로 추가된 노드 정보를 받는 콜백 추가
                    onNewlyAddedNodes={handleNewlyAddedNodes}
                />

                {/* 타임랩스 버튼 */}
                <div className="timelapse-button-container">
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

                {/* 팝업들 */}
                {/* 추가된 노드 UI 표시 */}
                {showNewlyAdded && newlyAddedNodeNames.length > 0 && (
                    <div className="graph-popup">
                        <span>추가된 노드: {newlyAddedNodeNames.join(', ')}</span>
                        <span className="close-x" onClick={() => {
                            setShowNewlyAdded(false);
                            setNewlyAddedNodeNames([]);
                            // ✅ GraphView 내부 상태도 동기화
                            if (graphViewCallbacks.setShowNewlyAdded) {
                                graphViewCallbacks.setShowNewlyAdded(false);
                            }
                            // ✅ 추가: GraphView 내부의 newlyAddedNodeNames도 초기화
                            if (graphViewCallbacks.setNewlyAddedNodeNames) {
                                graphViewCallbacks.setNewlyAddedNodeNames([]);
                            }
                        }}>×</span>
                    </div>
                )}

                {/* 참고된 노드가 있을 때 정보 표시 */}
                {showReferenced && props.referencedNodes && props.referencedNodes.length > 0 && (
                    <div className="graph-popup">
                        <span>참고된 노드: {props.referencedNodes.join(', ')}</span>
                        <span className="close-x" onClick={() => {
                            console.log('🔥 참고된 노드 강조 해제');
                            setShowReferenced(false);
                            // ✅ GraphView 내부 상태도 동기화
                            if (graphViewCallbacks.setShowReferenced) {
                                graphViewCallbacks.setShowReferenced(false);
                            }
                        }}>×</span>
                    </div>
                )}

                {/* ✅ 수정: 포커스 노드 팝업 - console.log 제거 */}
                {showFocus && Array.isArray(props.focusNodeNames) && props.focusNodeNames.length > 0 && (
                    <div className="graph-popup">
                        <span>소스로 생성된 노드: {props.focusNodeNames.join(', ')}</span>
                        <span
                            className="close-x"
                            onClick={() => {
                                console.log('🔥 포커스 노드 강조 해제');
                                setShowFocus(false);
                                // ✅ GraphView 내부 상태도 동기화
                                if (graphViewCallbacks.setShowFocus) {
                                    graphViewCallbacks.setShowFocus(false);
                                }
                            }}
                        >
                            ×
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default GraphViewWithModal;