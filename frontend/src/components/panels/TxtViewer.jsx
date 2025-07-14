import React, { useEffect, useState, useRef } from 'react';
import HighlightPopup from './HighlightPopup';
import './styles/Viewer.css';
import { FaArrowLeftLong, FaMinus, FaPlus } from "react-icons/fa6";
import { TbRefresh } from "react-icons/tb";

export default function TxtViewer({ fileUrl, onBack }) {

    const [content, setContent] = useState(''); // 텍스트 파일 내용
    const [popup, setPopup] = useState(null);   // 하이라이트 팝업 정보
    const [fontSize, setFontSize] = useState(16); // 글꼴 크기 조절
    const [highlights, setHighlights] = useState([]); // 하이라이트 리스트
    const containerRef = useRef(null); // 콘텐츠 영역 ref

    // 범위 겹침 여부 판별 함수
    const isOverlapping = (start1, end1, start2, end2) => {
        return Math.max(start1, start2) < Math.min(end1, end2);
    };

    // 1. 파일 및 하이라이트 불러오기
    useEffect(() => {
        fetch(fileUrl)
            .then(res => res.text())
            .then(text => {
                setContent(text);
                const saved = localStorage.getItem(`highlight:${fileUrl}`);
                if (saved) {
                    try {
                        setHighlights(JSON.parse(saved));
                    } catch (e) {
                        console.warn("하이라이트 불러오기 실패", e);
                    }
                }
            })
            .catch(err => {
                console.error("TXT 파일 로드 실패", err);
                setContent('[텍스트 파일을 불러올 수 없습니다]');
            });
    }, [fileUrl]);

    // 2. 텍스트 선택 시 팝업 표시
    const onTextSelection = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.toString()) return;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // 시작 인덱스를 계산하기 위해 선택 전까지의 텍스트 길이를 측정
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

    // 3. 하이라이트 추가 및 기존 겹침 제거 후 저장
    const addHighlight = (color) => {
        if (!popup) return;
        const { text, start, end } = popup;

        // 기존 highlight 중 겹치는 것 제거
        const filtered = highlights.filter(h => !isOverlapping(start, end, h.start, h.end));

        // 새 하이라이팅 추가
        const newHighlight = {
            id: Date.now(), // 고유 ID
            start,
            end,
            text,
            color
        };
        const updated = [...filtered, newHighlight];

        // 3. 업데이트 반영
        setHighlights(updated);
        localStorage.setItem(`highlight:${fileUrl}`, JSON.stringify(updated));
        setPopup(null);
    };

    // 4. 특정 하이라이트 제거
    const deleteHighlight = (idToDelete) => {
        const updated = highlights.filter(h => h.id !== idToDelete);
        setHighlights(updated);
        localStorage.setItem(`highlight:${fileUrl}`, JSON.stringify(updated));
        setPopup(null);
    };

    // 5. 하이라이트된 콘텐츠 렌더링
    const renderHighlightedContent = () => {
        if (!highlights.length) return content;

        const elements = [];
        let lastIndex = 0;

        const sorted = [...highlights].sort((a, b) => a.start - b.start);
        sorted.forEach((h, i) => {
            // 일반 텍스트 영역 추가
            if (lastIndex < h.start) {
                elements.push(
                    <span key={`plain-${i}`}>
                        {content.slice(lastIndex, h.start)}
                    </span>
                );
            }

            // 하이라이트 영역 추가
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

        // 마지막 남은 일반 텍스트 추가
        if (lastIndex < content.length) {
            elements.push(
                <span key="last">{content.slice(lastIndex)}</span>
            );
        }

        return elements;
    };

    // 6. 선택 텍스트 복사
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
        localStorage.removeItem(`highlight:${fileUrl}`);
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
                        highlightId={popup?.highlightId} />
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
