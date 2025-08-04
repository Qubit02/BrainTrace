import React, { useEffect } from 'react';
import { useState, useCallback } from 'react';

// 하이라이팅 데이터 삭제 유틸리티 함수
export const clearHighlightingData = (type, fileUrl, memoId, docxId, pdfId, txtId, mdId) => {
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
    
    keysToDelete.forEach(key => {
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

// 출처보기 전용 하이라이팅 훅
const useSourceViewHighlighting = (highlightingInfo) => {
    const [highlights, setHighlights] = useState([]);
    
    useEffect(() => {
        if (highlightingInfo?.highlightedRanges) {
            const autoHighlights = highlightingInfo.highlightedRanges.map((range, index) => ({
                id: `auto-highlight-${index}`,
                ...range,
                color: range.type === 'exact' ? '#E8E8E8' : '#D3D3D3', // 회색 배경
                source: 'original-sentence'
            }));
            setHighlights(autoHighlights);
        } else {
            setHighlights([]);
        }
    }, [highlightingInfo]);
    
    return { highlights, setHighlights };
};

// 메인 하이라이팅 커스텀 훅
export const useHighlighting = (type, fileUrl, memoId, docxId, pdfId, txtId, mdId, isFromSourceView = false, highlightingInfo = null) => {
    const [highlights, setHighlights] = useState([]);
    const [popup, setPopup] = useState(null);

    // 출처보기 모드일 때는 전용 훅 사용
    const sourceViewHighlights = useSourceViewHighlighting(highlightingInfo);
    
    // 출처보기 모드일 때는 전용 하이라이트 사용
    const currentHighlights = isFromSourceView ? sourceViewHighlights.highlights : highlights;
    const setCurrentHighlights = isFromSourceView ? sourceViewHighlights.setHighlights : setHighlights;

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
        if (isFromSourceView) {
            return; // 출처보기에서는 로컬 저장소 사용 안함
        }
        
        try {
            const storageKey = getStorageKey();
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                setHighlights(JSON.parse(saved));
            }
        } catch (error) {
            console.error('하이라이트 로드 실패:', error);
        }
    }, [getStorageKey, isFromSourceView]);

    // 하이라이트 저장 함수
    const saveHighlights = useCallback((highlightsToSave) => {
        if (isFromSourceView) {
            return; // 출처보기에서는 저장하지 않음
        }
        
        try {
            const storageKey = getStorageKey();
            if (highlightsToSave.length === 0) {
                localStorage.removeItem(storageKey);
            } else {
                localStorage.setItem(storageKey, JSON.stringify(highlightsToSave));
            }
        } catch (error) {
            console.error('하이라이트 저장 실패:', error);
        }
    }, [getStorageKey, isFromSourceView]);

    // 하이라이트 추가 및 기존 겹침 제거 후 저장
    const addHighlight = useCallback((color) => {
        if (!popup || isFromSourceView) return;
        
        const { text, start, end } = popup;
        setHighlights(prevHighlights => {
            const filtered = prevHighlights.filter(h => !isOverlapping(start, end, h.start, h.end));
            const newHighlight = {
                id: Date.now(),
                start,
                end,
                text,
                color
            };
            const updated = [...filtered, newHighlight];
            saveHighlights(updated);
            return updated;
        });
        setPopup(null);
    }, [popup, isOverlapping, saveHighlights, isFromSourceView]);

    // 프로그램적으로 하이라이트 추가 (원본 문장 하이라이팅용)
    const addHighlightProgrammatically = useCallback((highlightData) => {
        if (isFromSourceView) {
            // 출처보기에서는 전용 하이라이트에 추가
            const { start, end, text, color, id, source } = highlightData;
            setCurrentHighlights(prevHighlights => {
                const filtered = prevHighlights.filter(h => !isOverlapping(start, end, h.start, h.end));
                const newHighlight = {
                    id: id || Date.now(),
                    start,
                    end,
                    text,
                    color,
                    source
                };
                return [...filtered, newHighlight];
            });
        } else {
            // 일반 모드에서는 기존 로직 사용
            const { start, end, text, color, id, source } = highlightData;
            setHighlights(prevHighlights => {
                const filtered = prevHighlights.filter(h => !isOverlapping(start, end, h.start, h.end));
                const newHighlight = {
                    id: id || Date.now(),
                    start,
                    end,
                    text,
                    color,
                    source
                };
                const updated = [...filtered, newHighlight];
                saveHighlights(updated);
                return updated;
            });
        }
    }, [isOverlapping, saveHighlights, isFromSourceView, setCurrentHighlights]);

    // 하이라이트 개별 삭제
    const deleteHighlight = useCallback((idToDelete) => {
        if (isFromSourceView) {
            setCurrentHighlights(prevHighlights => 
                prevHighlights.filter(h => h.id !== idToDelete)
            );
        } else {
            setHighlights(prevHighlights => {
                const updated = prevHighlights.filter(h => h.id !== idToDelete);
                saveHighlights(updated);
                return updated;
            });
        }
        setPopup(null);
    }, [saveHighlights, isFromSourceView, setCurrentHighlights]);

    // 전체 하이라이트 초기화
    const clearHighlights = useCallback(() => {
        if (isFromSourceView) {
            setCurrentHighlights([]);
        } else {
            setHighlights([]);
            saveHighlights([]);
        }
    }, [saveHighlights, isFromSourceView, setCurrentHighlights]);

    // 텍스트 선택 시 팝업 표시
    const onTextSelection = useCallback((containerRef) => {
        if (isFromSourceView) return; // 출처보기에서는 텍스트 선택 비활성화
        
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
        
        // 팝업 위치 계산
        const popupX = rect.left + window.scrollX;
        const popupY = rect.bottom + window.scrollY + 10;
        
        setPopup({
            position: { x: popupX, y: popupY },
            range,
            text: selection.toString(),
            start,
            end,
        });
    }, [isFromSourceView]);

    // 선택 이벤트 핸들러
    const handleSelection = useCallback((containerRef) => {
        if (isFromSourceView) return; // 출처보기에서는 텍스트 선택 비활성화
        
        setTimeout(() => {
            onTextSelection(containerRef);
        }, 100);
    }, [onTextSelection, isFromSourceView]);

    // 하이라이트 렌더링
    const renderHighlightedContent = useCallback((content, onHighlightClick) => {
        if (!currentHighlights.length) {
            return content;
        }
        
        const elements = [];
        let lastIndex = 0;
        const sorted = [...currentHighlights].sort((a, b) => a.start - b.start);
        
        sorted.forEach((h, i) => {
            if (lastIndex < h.start) {
                elements.push(
                    <span key={`plain-${i}`}>{content.slice(lastIndex, h.start)}</span>
                );
            }
            
            const isAutoHighlight = h.id && String(h.id).startsWith('auto-highlight-');
            
            elements.push(
                <span
                    key={`highlight-${i}`}
                    style={{
                        backgroundColor: isAutoHighlight ? '#E8E8E8' : h.color, // 출처보기 하이라이트는 회색
                        borderRadius: '6px',
                        padding: isAutoHighlight ? '2px 4px' : '0 2px',
                        cursor: isFromSourceView ? 'default' : (onHighlightClick ? 'pointer' : 'default'),
                        fontWeight: isAutoHighlight ? '700' : 'normal', // 더 굵게
                        fontSize: isAutoHighlight ? 'inherit' : 'inherit', // 원래 크기
                        color: isAutoHighlight ? '#1a1a1a' : 'inherit', // 더 진한 텍스트 색상
                        textShadow: isAutoHighlight ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', // 텍스트 그림자
                        boxShadow: isAutoHighlight ? '0 2px 4px rgba(128, 128, 128, 0.3)' : 'none', // 회색 박스 그림자
                        border: isAutoHighlight ? '1px solid #C0C0C0' : 'none', // 회색 테두리
                        display: isAutoHighlight ? 'inline-block' : 'inline',
                        lineHeight: isAutoHighlight ? '1.4' : 'inherit',
                        letterSpacing: isAutoHighlight ? '0.5px' : 'normal',
                    }}
                    onClick={(e) => {
                        if (isFromSourceView) return; // 출처보기에서는 클릭 비활성화
                        
                        e.stopPropagation();
                        
                        if (!onHighlightClick) return;
                        
                        const result = onHighlightClick(h);
                        if (result === false) return;
                        
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
    }, [currentHighlights, isFromSourceView]);

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
        addHighlightProgrammatically,
        deleteHighlight,
        clearHighlights,
        onTextSelection,
        handleSelection,
        renderHighlightedContent,
        copyText,
        loadHighlights
    };
};

// 기존 함수명 유지를 위한 별칭 (하위 호환성)
export const Highlighting = useHighlighting; 