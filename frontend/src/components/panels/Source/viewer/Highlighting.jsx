import React from 'react';
import { useState, useCallback } from 'react';

// 하이라이팅 데이터 삭제 유틸리티 함수
export const clearHighlightingData = (type, fileUrl, memoId, docxId, pdfId, txtId, mdId) => {
    // 기존 키와 새로운 키 모두 삭제
    const keysToDelete = [];
    
    if (type === 'memo') {
        keysToDelete.push(`highlight:memo:${memoId}`);
    } else if (type === 'docx') {
        keysToDelete.push(`highlight:docx:${docxId}`);
    } else if (type === 'pdf') {
        keysToDelete.push(`highlight:pdf:${pdfId}`);
    } else if (type === 'txt') {
        keysToDelete.push(`highlight:txt:${txtId}`);
    } else if (type === 'md') {
        keysToDelete.push(`highlight:md:${mdId}`);
    } else {
        keysToDelete.push(`highlight:${fileUrl}`);
    }
    
    // 현재 localStorage의 모든 하이라이팅 키 확인
    const allKeys = Object.keys(localStorage);
    const highlightKeys = allKeys.filter(key => key.startsWith('highlight:'));
    
    // 모든 가능한 키를 삭제
    keysToDelete.forEach(key => {
        const existed = localStorage.getItem(key);
        localStorage.removeItem(key);
    });
    
};

// 브레인 삭제 시 모든 하이라이팅 데이터 삭제
export const clearAllHighlightingData = () => {
    const keys = Object.keys(localStorage);
    const highlightKeys = keys.filter(key => key.startsWith('highlight:'));
    
    highlightKeys.forEach(key => {
        localStorage.removeItem(key);
    });
};

export const Highlighting = (type, fileUrl, memoId, docxId, pdfId, txtId, mdId) => {
    const [highlights, setHighlights] = useState([]);
    const [popup, setPopup] = useState(null);

    // 범위 겹침 여부 판별 함수
    const isOverlapping = useCallback((start1, end1, start2, end2) => {
        return Math.max(start1, start2) < Math.min(end1, end2);
    }, []);

    // 하이라이트 저장 키 생성
    const getStorageKey = useCallback(() => {
        if (type === 'memo') {
            return `highlight:memo:${memoId}`;
        } else if (type === 'docx') {
            return `highlight:docx:${docxId}`;
        } else if (type === 'pdf') {
            return `highlight:pdf:${pdfId}`;
        } else if (type === 'txt') {
            return `highlight:txt:${txtId}`;
        } else if (type === 'md') {
            return `highlight:md:${mdId}`;
        } else {
            return `highlight:${fileUrl}`;
        }
    }, [type, fileUrl, memoId, docxId, pdfId, txtId, mdId]);

    // 저장된 하이라이트 불러오기
    const loadHighlights = useCallback(() => {
        const storageKey = getStorageKey();
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            setHighlights(JSON.parse(saved));
        }
    }, [getStorageKey]);

    // 하이라이트 추가 및 기존 겹침 제거 후 저장
    const addHighlight = useCallback((color) => {
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
        
        const storageKey = getStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setPopup(null);
    }, [popup, highlights, isOverlapping, getStorageKey]);

    // 하이라이트 개별 삭제
    const deleteHighlight = useCallback((idToDelete) => {
        const updated = highlights.filter(h => h.id !== idToDelete);
        setHighlights(updated);
        
        const storageKey = getStorageKey();
        if (updated.length === 0) {
            // 하이라이트가 모두 삭제되면 키 자체를 제거
            localStorage.removeItem(storageKey);
        } else {
            // 하이라이트가 남아있으면 업데이트
            localStorage.setItem(storageKey, JSON.stringify(updated));
        }
        setPopup(null);
    }, [highlights, getStorageKey]);

    // 전체 하이라이트 초기화
    const clearHighlights = useCallback(() => {
        setHighlights([]);
        const storageKey = getStorageKey();
        localStorage.removeItem(storageKey);
    }, [getStorageKey]);

    // 텍스트 선택 시 팝업 표시
    const onTextSelection = useCallback((containerRef) => {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.toString().trim()) return;
        
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // 선택된 텍스트가 실제로 viewer-pre 내부에 있는지 확인
        const viewerPre = containerRef.current?.querySelector('.viewer-pre');
        if (!viewerPre || !viewerPre.contains(range.commonAncestorContainer)) {
            return;
        }
        
        const preRange = range.cloneRange();
        preRange.selectNodeContents(viewerPre);
        preRange.setEnd(range.startContainer, range.startOffset);
        const rawStart = preRange.toString().length;
        const start = Math.max(0, rawStart);
        const end = start + selection.toString().length;
        
        // 팝업 위치 계산 개선
        const popupX = rect.left + window.scrollX;
        const popupY = rect.bottom + window.scrollY + 10; // 약간 아래로 이동
        
        setPopup({
            position: { x: popupX, y: popupY },
            range,
            text: selection.toString(),
            start,
            end,
        });
    }, []);

    // 선택 이벤트 핸들러
    const handleSelection = useCallback((containerRef) => {
        setTimeout(() => {
            onTextSelection(containerRef);
        }, 100);
    }, [onTextSelection]);

    // 하이라이트 렌더링
    const renderHighlightedContent = useCallback((content, onHighlightClick) => {
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
                        if (onHighlightClick) {
                            onHighlightClick(h);
                        }
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
    }, [highlights]);

    // 선택 텍스트 복사
    const copyText = useCallback(() => {
        if (popup) {
            navigator.clipboard.writeText(popup.text);
            setPopup(null);
            window.getSelection().removeAllRanges();
        }
    }, [popup]);

    return {
        popup,
        setPopup,
        addHighlight,
        deleteHighlight,
        clearHighlights,
        onTextSelection,
        handleSelection,
        renderHighlightedContent,
        copyText,
        loadHighlights
    };
}; 