import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FaArrowLeftLong, FaPlus, FaMinus } from "react-icons/fa6";
import './Viewer.css';

// PDF.js worker 설정
import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const PDFViewer = ({ file, containerWidth, onBack, title }) => {
  const [numPages, setNumPages] = useState(null);         // 총 페이지 수
  const [scale, setScale] = useState(1.5);                // PDF 확대 비율
  const viewerRef = useRef(null);                         // 뷰어 DOM 참조
  const hasUserScaled = useRef(false);                    // 사용자 확대/축소 여부 플래그

  // PDF 뷰어 너비(containerWidth)가 변경될 때 scale 자동 조정
  useEffect(() => {
    if (containerWidth > 0 && !hasUserScaled.current) {
      const newScale = Math.max(containerWidth / 800, 1);
      setScale(newScale); // 사용자 확대/축소하지 않은 경우에만 적용
    }
  }, [containerWidth]);

  // PDF 로드 완료 시 총 페이지 수 설정
  const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);

  // 확대 버튼 클릭
  const handleZoomIn = () => {
    hasUserScaled.current = true;
    setScale(prev => Math.min(prev + 0.2, 3));
  };

  // 축소 버튼 클릭
  const handleZoomOut = () => {
    hasUserScaled.current = true;
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 컨트롤바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          padding: '10px 16px',
          borderBottom: '1px solid #ddd',
          position: 'relative',
        }}
      >
        <FaArrowLeftLong
          onClick={onBack}
          style={{
            cursor: 'pointer',
            fontSize: '18px',
            color: '#333',
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 20, color: '#222', textAlign: 'center', flex: 1 }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}>
          <FaMinus onClick={handleZoomOut} style={iconStyle} />
          <FaPlus onClick={handleZoomIn} style={iconStyle} />
          <span style={{ fontSize: '14px', minWidth: '40px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>

      {/* PDF 문서 렌더링 영역 */}
      <div
        style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
        ref={viewerRef}
      >
        <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
          {Array.from({ length: numPages }, (_, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              scale={scale}
              renderTextLayer={false}          // 텍스트 선택 비활성화
              renderAnnotationLayer={false}   // 주석 비활성화
            />
          ))}
        </Document>
      </div>
    </div>
  );
};

const iconStyle = {
  cursor: 'pointer',
  fontSize: '16px',
  color: '#333',
  borderRadius: '4px',
  padding: '2px',
  border: '1px solid #ccc',
  backgroundColor: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

export default PDFViewer;
