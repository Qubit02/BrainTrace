import React, { useEffect, useState, useRef } from 'react';
import HighlightPopup from '../HighlightPopup';
import PDFViewer from './PDFViewer';
import { Highlighting } from './Highlighting.jsx';
import './Viewer.css';
import { FaArrowLeftLong, FaMinus, FaPlus } from "react-icons/fa6";
import { TbRefresh } from "react-icons/tb";
import { getDocxFile, getMemo } from '../../../../../api/backend';

export default function GenericViewer({ type, fileUrl, memoId, onBack, title, docxId }) {
    const [content, setContent] = useState('');
    const [fontSize, setFontSize] = useState(16);
    const containerRef = useRef(null);

    // 하이라이팅 훅 사용
    const {
        popup,
        setPopup,
        addHighlight,
        deleteHighlight,
        clearHighlights,
        handleSelection,
        renderHighlightedContent,
        copyText,
        loadHighlights
    } = Highlighting(type, fileUrl, memoId, docxId);

    // PDF 파일인 경우 PDFViewer 사용
    if (type === 'pdf') {
        return (
            <PDFViewer 
                file={fileUrl} 
                title={title} 
                onBack={onBack}
            />
        );
    }

    // 파일/메모 불러오기 및 하이라이트 불러오기
    useEffect(() => {
        if (type === 'docx') {
            if (!docxId) {
                setContent('[docx_id가 제공되지 않았습니다]');
                return;
            }
            getDocxFile(docxId)
                .then(data => setContent(data.docx_text))
                .catch(() => setContent('[파일을 불러올 수 없습니다]'));
        } else if (type === 'memo') {
            getMemo(memoId)
                .then(memo => setContent(memo.memo_text))
                .catch(() => setContent('[메모를 불러올 수 없습니다]'));
        } else {
            fetch(fileUrl)
                .then(res => res.text())
                .then(text => setContent(text))
                .catch(() => setContent('[파일을 불러올 수 없습니다]'));
        }
        
        // 하이라이트 불러오기
        loadHighlights();
    }, [type, fileUrl, memoId, docxId, loadHighlights]);

    return (
        <div className="viewer-container" data-file-type={type}>
            {/* 상단 바: 뒤로가기, 글꼴 크기 조절, 초기화 */}
            <div className="viewer-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 48 }}>
                <FaArrowLeftLong 
                    onClick={onBack} 
                    style={{ 
                        cursor: 'pointer', 
                        fontSize: '18px', 
                        color: type === 'md' ? 'white' : '#333', 
                        position: 'absolute', 
                        left: 16, 
                        top: '50%', 
                        transform: 'translateY(-50%)' 
                    }} 
                />
                <div className="viewer-controls" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                    <FaMinus className="viewer-button" onClick={() => setFontSize(prev => Math.max(prev - 2, 12))} />
                    <FaPlus className="viewer-button" onClick={() => setFontSize(prev => Math.min(prev + 2, 48))} />
                    <span className="viewer-fontsize">{fontSize}px</span>
                    <TbRefresh className="viewer-button" onClick={clearHighlights} title="하이라이트 모두 지우기" />
                </div>
            </div>

            {/* 텍스트 콘텐츠 영역 */}
            <div className="viewer-content" ref={containerRef}>
                {/* 제목 표시 */}
                <div className="viewer-title-content">
                    <h1 className="viewer-title-text">{title}</h1>
                </div>

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
                    onSelect={() => handleSelection(containerRef)}
                    onMouseUp={() => handleSelection(containerRef)}
                >
                    {renderHighlightedContent(content)}
                </div>
            </div>
        </div>
    );
} 