// src/components/panels/MemoViewer.jsx
import React, { useEffect, useState, useRef } from 'react';
import HighlightPopup from '../HighlightPopup';
import './Viewer.css';
import { FaArrowLeftLong, FaMinus, FaPlus } from "react-icons/fa6";
import { TbRefresh } from "react-icons/tb";
import { getMemo } from '../../../../../../backend/api/memos';

export default function MemoViewer({ memoId, onBack }) {
    const [content, setContent] = useState('');         // 텍스트 내용
    const [popup, setPopup] = useState(null);           // 팝업 정보
    const [fontSize, setFontSize] = useState(16);       // 폰트 크기
    const [highlights, setHighlights] = useState([]);   // 하이라이트 목록
    const containerRef = useRef(null);                  // 텍스트 컨테이너 ref

    // 겹치는 범위 판별 함수
    const isOverlapping = (start1, end1, start2, end2) => {
        return Math.max(start1, start2) < Math.min(end1, end2);
    };

    // 1. 메모 내용과 하이라이트 불러오기
    useEffect(() => {
        const fetchMemo = async () => {
            try {
                const memo = await getMemo(memoId);
                setContent(memo.memo_text);
                const saved = localStorage.getItem(`highlight:memo:${memoId}`);
                if (saved) {
                    setHighlights(JSON.parse(saved));
                }
            } catch (err) {
                console.error("메모 불러오기 실패", err);
                setContent('[메모를 불러올 수 없습니다]');
            }
        };
        fetchMemo();
    }, [memoId]);

    // 2. 텍스트 선택 시 팝업 표시
    const onTextSelection = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.toString()) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const preRange = range.cloneRange();
        preRange.selectNodeContents(containerRef.current);
        preRange.setEnd(range.startContainer, range.startOffset);

        const rawStart = preRange.toString().length;
        const start = Math.max(0, rawStart - 2);  // 선택 위치 보정
        const end = start + selection.toString().length;

        setPopup({
            position: { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY },
            range,
            text: selection.toString(),
            start,
            end,
        });
    };

    // 3. 하이라이트 추가 및 중복 제거
    const addHighlight = (color) => {
        if (!popup) return;
        const { text, start, end } = popup;

        const filtered = highlights.filter(h => !isOverlapping(start, end, h.start, h.end));

        const newHighlight = {
            id: Date.now(),
            start,
            end,
            text,
            color
        };
        const updated = [...filtered, newHighlight];
        setHighlights(updated);
        localStorage.setItem(`highlight:memo:${memoId}`, JSON.stringify(updated));
        setPopup(null);
    };

    // 4. 하이라이트 개별 삭제
    const deleteHighlight = (idToDelete) => {
        const updated = highlights.filter(h => h.id !== idToDelete);
        setHighlights(updated);
        localStorage.setItem(`highlight:memo:${memoId}`, JSON.stringify(updated));
        setPopup(null);
    };

    // 5. 하이라이트 렌더링
    const renderHighlightedContent = () => {
        if (!highlights.length) return content;

        const elements = [];
        let lastIndex = 0;

        const sorted = [...highlights].sort((a, b) => a.start - b.start);
        sorted.forEach((h, i) => {
            if (lastIndex < h.start) {
                elements.push(
                    <span key={`plain-${i}`}>
                        {content.slice(lastIndex, h.start)}
                    </span>
                );
            }

            elements.push(
                <span
                    key={`highlight-${i}`}
                    style={{
                        backgroundColor: h.color,
                        borderRadius: '4px',
                        padding: '0 2px',
                        cursor: 'pointer',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.target.getBoundingClientRect();
                        setPopup({
                            position: { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY },
                            text: h.text,
                            highlightId: h.id,
                            isExistingHighlight: true,
                        });
                    }}
                >
                    {content.slice(h.start, h.end)}
                </span>
            );
            lastIndex = h.end;
        });

        if (lastIndex < content.length) {
            elements.push(
                <span key="last">{content.slice(lastIndex)}</span>
            );
        }

        return elements;
    };

    // 6. 복사 기능
    const copyText = () => {
        if (popup) {
            navigator.clipboard.writeText(popup.text);
            setPopup(null);
            window.getSelection().removeAllRanges();
        }
    };

    // 7. 전체 하이라이트 초기화
    const clearHighlights = () => {
        setHighlights([]);
        localStorage.removeItem(`highlight:memo:${memoId}`);
    };

    return (
        <div className="viewer-container">
            {/* 상단 컨트롤바 */}
            <div className="viewer-header">
                <FaArrowLeftLong onClick={onBack} style={{ cursor: 'pointer', fontSize: '18px', color: '#333' }} />
                <div className="viewer-controls">
                    <FaMinus className="viewer-button" onClick={() => setFontSize(prev => Math.max(prev - 2, 12))} />
                    <FaPlus className="viewer-button" onClick={() => setFontSize(prev => Math.min(prev + 2, 48))} />
                    <span className="viewer-fontsize">{fontSize}px</span>
                    <TbRefresh className="viewer-button" onClick={clearHighlights} title="하이라이트 모두 지우기" />
                </div>
            </div>

            {/* 본문 렌더링 */}
            <div className="viewer-content" ref={containerRef} onMouseUp={onTextSelection}>
                {popup && (
                    <HighlightPopup
                        position={popup.position}
                        containerRef={containerRef}
                        onSelectColor={addHighlight}
                        onCopyText={copyText}
                        onClose={() => {
                            setPopup(null);
                        }}
                        onDeleteHighlight={deleteHighlight}
                        isExistingHighlight={popup?.isExistingHighlight}
                        highlightId={popup?.highlightId}
                    />
                )}

                <div
                    className="viewer-pre"
                    style={{
                        fontSize: `${fontSize}px`,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit',
                        userSelect: 'text',
                    }}
                >
                    {renderHighlightedContent()}
                </div>
            </div>
        </div>
    );
}
