import React, { useEffect, useState, useRef } from 'react';
import HighlightPopup from '../HighlightPopup';
import { Highlighting } from './Highlighting.jsx';
import './Viewer.css';
import { FaArrowLeftLong, FaMinus, FaPlus } from "react-icons/fa6";
import { TbRefresh } from "react-icons/tb";
import { getDocxFile, getMemo, getPdf, getTextFile, getMDFile } from '../../../../../api/backend';

export default function GenericViewer({ type, fileUrl, memoId, onBack, title, docxId, pdfId, txtId, mdId }) {
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
    } = Highlighting(type, fileUrl, memoId, docxId, pdfId, txtId, mdId);



    // 파일/메모 불러오기 및 하이라이트 불러오기
    useEffect(() => {
        const loadContent = async () => {
            try {
                switch (type) {
                    case 'docx':
                        if (!docxId) {
                            setContent('[docx_id가 제공되지 않았습니다]');
                            return;
                        }
                        const docxData = await getDocxFile(docxId);
                        setContent(docxData.docx_text || '[텍스트를 불러올 수 없습니다]');
                        break;
                    
                    case 'memo':
                        const memoData = await getMemo(memoId);
                        setContent(memoData.memo_text || '[메모를 불러올 수 없습니다]');
                        break;
                    
                    case 'pdf':
                        if (!pdfId) {
                            setContent('[pdf_id가 제공되지 않았습니다]');
                            return;
                        }
                        const pdfData = await getPdf(pdfId);
                        setContent(pdfData.pdf_text || '[텍스트를 불러올 수 없습니다]');
                        break;
                    
                    case 'txt':
                        if (!txtId) {
                            setContent('[txt_id가 제공되지 않았습니다]');
                            return;
                        }
                        const txtData = await getTextFile(txtId);
                        setContent(txtData.txt_text || '[텍스트를 불러올 수 없습니다]');
                        break;
                    
                    case 'md':
                        if (!mdId) {
                            setContent('[md_id가 제공되지 않았습니다]');
                            return;
                        }
                        const mdData = await getMDFile(mdId);
                        setContent(mdData.md_text || '[텍스트를 불러올 수 없습니다]');
                        break;
                    
                    default:
                        // 기존 방식으로 파일 시스템에서 읽기 (fallback)
                        const response = await fetch(fileUrl);
                        const text = await response.text();
                        setContent(text);
                        break;
                }
            } catch (error) {
                console.error('파일 내용 로딩 실패:', error);
                setContent('[파일을 불러올 수 없습니다]');
            }
        };

        loadContent();
        
        // 하이라이트 불러오기
        loadHighlights();
    }, [type, fileUrl, memoId, docxId, pdfId, txtId, mdId, loadHighlights]);

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