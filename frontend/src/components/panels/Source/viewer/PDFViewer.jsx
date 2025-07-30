import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FaArrowLeftLong, FaMinus, FaPlus } from "react-icons/fa6";
import './Viewer.css';

// PDF.js worker 설정
import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export default function PDFViewer({ file, title, onBack }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [loading, setLoading] = useState(true);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
        setLoading(false);
    }

    function changePage(offset) {
        setPageNumber(prevPageNumber => {
            const newPageNumber = prevPageNumber + offset;
            if (newPageNumber >= 1 && newPageNumber <= numPages) {
                return newPageNumber;
            }
            return prevPageNumber;
        });
    }

    function previousPage() {
        changePage(-1);
    }

    function nextPage() {
        changePage(1);
    }

    function zoomIn() {
        setScale(prevScale => Math.min(prevScale + 0.2, 3.0));
    }

    function zoomOut() {
        setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
    }

    return (
        <div className="viewer-container" data-file-type="pdf">
            {/* 상단 바: 뒤로가기, 페이지 네비게이션, 줌 컨트롤 */}
            <div className="viewer-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 48 }}>
                <FaArrowLeftLong 
                    onClick={onBack} 
                    style={{ 
                        cursor: 'pointer', 
                        fontSize: '18px', 
                        color: 'white', 
                        position: 'absolute', 
                        left: 16, 
                        top: '50%', 
                        transform: 'translateY(-50%)' 
                    }} 
                />
                
                {/* 페이지 네비게이션 */}
                <div style={{ 
                    position: 'absolute', 
                    left: '50%', 
                    top: '50%', 
                    transform: 'translate(-50%, -50%)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    color: 'white'
                }}>
                    <button 
                        onClick={previousPage} 
                        disabled={pageNumber <= 1}
                        style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer',
                            opacity: pageNumber <= 1 ? 0.5 : 1
                        }}
                    >
                        이전
                    </button>
                    <span style={{ fontSize: '14px' }}>
                        {pageNumber} / {numPages || '?'}
                    </span>
                    <button 
                        onClick={nextPage} 
                        disabled={pageNumber >= numPages}
                        style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: pageNumber >= numPages ? 'not-allowed' : 'pointer',
                            opacity: pageNumber >= numPages ? 0.5 : 1
                        }}
                    >
                        다음
                    </button>
                </div>

                {/* 줌 컨트롤 */}
                <div className="viewer-controls" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                    <FaMinus className="viewer-button" onClick={zoomOut} />
                    <span className="viewer-fontsize" style={{ color: 'white' }}>{Math.round(scale * 100)}%</span>
                    <FaPlus className="viewer-button" onClick={zoomIn} />
                </div>
            </div>

            {/* PDF 콘텐츠 영역 */}
            <div className="viewer-content" style={{ background: '#f5f5f5', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '20px' }}>
                {loading && (
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        height: '200px',
                        color: '#666'
                    }}>
                        PDF를 불러오는 중...
                    </div>
                )}
                
                <Document
                    file={file}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={(error) => {
                        console.error('PDF 로드 오류:', error);
                        setLoading(false);
                    }}
                    loading={
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            height: '200px',
                            color: '#666'
                        }}>
                            PDF를 불러오는 중...
                        </div>
                    }
                    error={
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            height: '200px',
                            color: '#d73a49'
                        }}>
                            PDF를 불러올 수 없습니다.
                        </div>
                    }
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        style={{
                            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                            borderRadius: '4px',
                            background: 'white'
                        }}
                    />
                </Document>
            </div>
        </div>
    );
}
