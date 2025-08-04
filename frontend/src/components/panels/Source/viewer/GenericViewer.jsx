import React, { useEffect, useState, useRef, useCallback } from 'react';
import HighlightPopup from './HighlightPopup.jsx';
import { useHighlighting } from './Highlighting.jsx';
import './Viewer.css';
import { FaArrowLeftLong, FaMinus, FaPlus } from "react-icons/fa6";
import { TbRefresh } from "react-icons/tb";
import { MdOutlineSource } from "react-icons/md";
import { getDocxFile, getMemo, getPdf, getTextFile, getMDFile } from '../../../../../api/backend';

export default function GenericViewer({ type, fileUrl, memoId, onBack, title, docxId, pdfId, txtId, mdId, highlightingInfo }) {
    const [content, setContent] = useState('');
    const [fontSize, setFontSize] = useState(16);
    const containerRef = useRef(null);

    // 출처보기를 통해 들어온 경우인지 확인 (highlightingInfo가 있으면 출처보기)
    const isFromSourceView = !!highlightingInfo;

    // 하이라이팅 훅 사용 - highlightingInfo를 전달하여 출처보기 모드 지원
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
    } = useHighlighting(type, fileUrl, memoId, docxId, pdfId, txtId, mdId, isFromSourceView, highlightingInfo);

    // 파일/메모 불러오기
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
    }, [type, fileUrl, memoId, docxId, pdfId, txtId, mdId]);

    // 출처보기가 아닌 경우에만 기존 하이라이트 불러오기
    useEffect(() => {
        if (!isFromSourceView) {
            loadHighlights();
        }
    }, [isFromSourceView, loadHighlights]);

    // 모든 모드에서 텍스트 선택 활성화
    const handleTextSelection = useCallback((containerRef) => {
        handleSelection(containerRef);
    }, [handleSelection]);

    // 출처보기를 통해 들어온 경우 하이라이트 클릭 비활성화
    const handleHighlightClick = useCallback((highlight) => {
        if (isFromSourceView) {
            return; // 출처보기에서는 하이라이트 클릭 기능 비활성화
        }
    }, [isFromSourceView]);

    return (
        <div className="viewer-container" data-file-type={type} data-source-view={isFromSourceView}>
            {/* 상단 바: 뒤로가기, 제목, 글꼴 크기 조절, 초기화 */}
            <div className="viewer-header viewer-header-container">
                <FaArrowLeftLong 
                    onClick={onBack} 
                    className={`viewer-back-button ${type === 'md' ? 'md' : ''}`}
                />
                
                {/* 제목을 헤더 가운데에 표시 */}
                <div className="viewer-title-header">
                    <span className="viewer-title-text">{title}</span>
                </div>
                
                <div className="viewer-controls viewer-controls-container">
                    <FaMinus className="viewer-button" onClick={() => setFontSize(prev => Math.max(prev - 2, 12))} />
                    <FaPlus className="viewer-button" onClick={() => setFontSize(prev => Math.min(prev + 2, 48))} />
                    <span className="viewer-fontsize">{fontSize}px</span>
                    {/* 출처보기가 아닌 경우에만 하이라이트 초기화 버튼 표시 */}
                    {!isFromSourceView && (
                        <TbRefresh className="viewer-button" onClick={clearHighlights} title="하이라이트 모두 지우기" />
                    )}
                </div>
            </div>

            {/* 텍스트 콘텐츠 영역 */}
            <div className="viewer-content" ref={containerRef}>
                {/* 출처보기 안내 메시지 */}
                {isFromSourceView && (
                    <div className="source-view-notice">
                        <MdOutlineSource className="source-view-notice-icon" />
                        <span className="source-view-notice-text">
                            이 소스는 <strong>출처보기</strong>를 통해 열렸습니다. 
                            하이라이트된 부분이 답변의 근거가 되는 내용입니다.
                        </span>
                    </div>
                )}

                {/* 하이라이트 팝업 표시 - 출처보기가 아닌 경우에만 */}
                {popup && !isFromSourceView && (
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
                    className="viewer-pre viewer-text-content"
                    style={{
                        fontSize: `${fontSize}px`,
                        userSelect: 'text', // 모든 모드에서 텍스트 선택 활성화
                        cursor: 'text', // 모든 모드에서 텍스트 커서
                    }}
                    onSelect={() => handleTextSelection(containerRef)}
                    onMouseUp={() => handleTextSelection(containerRef)}
                >
                    {renderHighlightedContent(content, handleHighlightClick)}
                </div>
            </div>
        </div>
    );
} 