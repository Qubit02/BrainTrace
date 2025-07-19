import React, { useEffect, useState, useRef } from 'react';
import HighlightPopup from '../HighlightPopup';
import './Viewer.css';
import { FaArrowLeftLong, FaMinus, FaPlus } from "react-icons/fa6";
import { TbRefresh } from "react-icons/tb";
import { getMemo } from '../../../../../api/memos';

export default function GenericViewer({ type, fileUrl, memoId, onBack }) {
    const [content, setContent] = useState('');
    const [popup, setPopup] = useState(null);
    const [fontSize, setFontSize] = useState(16);
    const [highlights, setHighlights] = useState([]);
    const containerRef = useRef(null);

    // 범위 겹침 여부 판별 함수
    const isOverlapping = (start1, end1, start2, end2) => {
        return Math.max(start1, start2) < Math.min(end1, end2);
    };

    // 파일/메모 불러오기 및 하이라이트 불러오기
    useEffect(() => {
        if (type === 'memo') {
            getMemo(memoId)
                .then(memo => setContent(memo.memo_text))
                .catch(() => setContent('[메모를 불러올 수 없습니다]'));
            const saved = localStorage.getItem(`highlight:memo:${memoId}`);
            if (saved) setHighlights(JSON.parse(saved));
        } else {
            fetch(fileUrl)
                .then(res => res.text())
                .then(text => setContent(text))
                .catch(() => setContent('[파일을 불러올 수 없습니다]'));
            const saved = localStorage.getItem(`highlight:${fileUrl}`);
            if (saved) setHighlights(JSON.parse(saved));
        }
    }, [type, fileUrl, memoId]);

    // 텍스트 선택 시 팝업 표시
    const onTextSelection = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.toString()) return;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const preRange = range.cloneRange();
        preRange.selectNodeContents(containerRef.current);
        preRange.setEnd(range.startContainer, range.startOffset);
        const rawStart = preRange.toString().length;
        const start = Math.max(0, rawStart - 2);
        const end = start + selection.toString().length;
        setPopup({
            position: { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY },
            range,
            text: selection.toString(),
            start,
            end,
        });
    };

    // 하이라이트 추가 및 기존 겹침 제거 후 저장
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
        if (type === 'memo') {
            localStorage.setItem(`highlight:memo:${memoId}`, JSON.stringify(updated));
        } else {
            localStorage.setItem(`highlight:${fileUrl}`, JSON.stringify(updated));
        }
        setPopup(null);
    };

    // 하이라이트 개별 삭제
    const deleteHighlight = (idToDelete) => {
        const updated = highlights.filter(h => h.id !== idToDelete);
        setHighlights(updated);
        if (type === 'memo') {
            localStorage.setItem(`highlight:memo:${memoId}`, JSON.stringify(updated));
        } else {
            localStorage.setItem(`highlight:${fileUrl}`, JSON.stringify(updated));
        }
        setPopup(null);
    };

    // 하이라이트 렌더링
    const renderHighlightedContent = () => {
        if (!highlights.length) return content;
        const elements = [];
        let lastIndex = 0;
        const sorted = [...highlights].sort((a, b) => a.start - b.start);
        sorted.forEach((h, i) => {
            if (lastIndex < h.start) {
                elements.push(
                    <span key={`plain-${i}`}>{content.slice(lastIndex, h.start)}</span>
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

    // 선택 텍스트 복사
    const copyText = () => {
        if (popup) {
            navigator.clipboard.writeText(popup.text);
            setPopup(null);
            window.getSelection().removeAllRanges();
        }
    };

    // 전체 하이라이트 초기화
    const clearHighlights = () => {
        setHighlights([]);
        if (type === 'memo') {
            localStorage.removeItem(`highlight:memo:${memoId}`);
        } else {
            localStorage.removeItem(`highlight:${fileUrl}`);
        }
    };

    return (
        <div className="viewer-container">
            {/* 상단 바: 뒤로가기, 글꼴 크기 조절, 초기화 */}
            <div className="viewer-header">
                <FaArrowLeftLong onClick={onBack} style={{ cursor: 'pointer', fontSize: '18px', color: '#333' }} />
                <div className="viewer-controls">
                    <FaMinus className="viewer-button" onClick={() => setFontSize(prev => Math.max(prev - 2, 12))} />
                    <FaPlus className="viewer-button" onClick={() => setFontSize(prev => Math.min(prev + 2, 48))} />
                    <span className="viewer-fontsize">{fontSize}px</span>
                    <TbRefresh className="viewer-button" onClick={clearHighlights} title="하이라이트 모두 지우기" />
                </div>
            </div>

            {/* 텍스트 콘텐츠 영역 */}
            <div className="viewer-content" ref={containerRef} onMouseUp={onTextSelection}>
                {/* 하이라이트 팝업 표시 */}
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

                {/* 텍스트 본문 렌더링 */}
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