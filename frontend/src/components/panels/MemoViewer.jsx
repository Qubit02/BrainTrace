// src/components/panels/MemoViewer.jsx
import React, { useEffect, useState, useRef } from 'react';
import HighlightPopup from './HighlightPopup';
import './styles/Viewer.css';
import { FaArrowLeftLong, FaMinus, FaPlus } from "react-icons/fa6";
import { getMemo } from '../../../../backend/services/backend';

export default function MemoViewer({ memoId, onBack }) {
    const [content, setContent] = useState('');
    const [popup, setPopup] = useState(null);
    const [fontSize, setFontSize] = useState(16);
    const containerRef = useRef(null);

    useEffect(() => {
        const fetchMemo = async () => {
            try {
                const memo = await getMemo(memoId);
                setContent(memo.memo_text);
            } catch (err) {
                console.error("메모 로딩 실패", err);
                setContent('[메모를 불러올 수 없습니다]');
            }
        };
        fetchMemo();
    }, [memoId]);

    const onTextSelection = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.toString()) return;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setPopup({
            position: { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY },
            range,
            text: selection.toString()
        });
    };

    const addHighlight = (color) => {
        if (!popup) return;
        const span = document.createElement('span');
        span.style.backgroundColor = color;
        span.style.borderRadius = '4px';
        span.style.padding = '0 2px';
        span.textContent = popup.text;
        popup.range.deleteContents();
        popup.range.insertNode(span);
        setPopup(null);
        window.getSelection().removeAllRanges();
    };

    const copyText = () => {
        if (popup) {
            navigator.clipboard.writeText(popup.text);
            setPopup(null);
            window.getSelection().removeAllRanges();
        }
    };

    return (
        <div className="viewer-container">
            <div className="viewer-header">
                <FaArrowLeftLong onClick={onBack} style={{ cursor: 'pointer', fontSize: '18px', color: '#333' }} />
                <div className="viewer-controls">
                    <FaMinus className="viewer-button" onClick={() => setFontSize(prev => Math.max(prev - 2, 12))} />
                    <FaPlus className="viewer-button" onClick={() => setFontSize(prev => Math.min(prev + 2, 48))} />
                    <span className="viewer-fontsize">{fontSize}px</span>
                </div>
            </div>

            <div className="viewer-content" ref={containerRef} onMouseUp={onTextSelection}>
                {popup && (
                    <HighlightPopup
                        position={popup.position}
                        containerRef={containerRef}
                        onSelectColor={addHighlight}
                        onCopyText={copyText}
                        onClose={() => {
                            setPopup(null);
                            window.getSelection().removeAllRanges();
                        }}
                    />
                )}
                <pre className="viewer-pre" style={{ fontSize: `${fontSize}px` }}>
                    {content}
                </pre>
            </div>
        </div>
    );
}
