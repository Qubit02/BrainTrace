import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import HighlightPopup from './HighlightPopup';
//import 'react-pdf/dist/esm/Page/TextLayer.css';
//import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import { FaArrowLeftLong } from "react-icons/fa6";
import { FaPlus } from "react-icons/fa6";
import { FaMinus } from "react-icons/fa6";

import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const PDFViewer = ({ file, containerWidth, onBack }) => {
  const [numPages, setNumPages] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [popup, setPopup] = useState(null);
  const viewerRef = useRef(null);
  const [scale, setScale] = useState(1.5);

  useEffect(() => {
    if (containerWidth > 0) {
      const newScale = Math.max(containerWidth / 800, 1);
      setScale(newScale);
    }
  }, [containerWidth]);

  const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);

  const onTextSelection = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (selection.toString().length === 0) return;

    const rect = range.getBoundingClientRect();

    setPopup({
      position: { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY },
      range,
      text: selection.toString(),
    });
  };

  const addHighlight = (color) => {
    if (!popup) return;

    const rects = Array.from(popup.range.getClientRects());
    let container = popup.range.startContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }

    const pageDiv = container.closest('.react-pdf__Page');
    if (!pageDiv) return;

    const pageNumber = parseInt(pageDiv.getAttribute('data-page-number'), 10);
    const canvas = pageDiv.querySelector('canvas');
    const canvasRect = canvas.getBoundingClientRect();

    const scaledPositions = rects.map(rect => ({
      x1: (rect.left - canvasRect.left) / canvasRect.width,
      y1: (rect.top - canvasRect.top) / canvasRect.height,
      x2: ((rect.left + rect.width) - canvasRect.left) / canvasRect.width,
      y2: ((rect.top + rect.height) - canvasRect.top) / canvasRect.height,
    }));

    setHighlights(prev => [
      ...prev,
      { page: pageNumber, positions: scaledPositions, color }
    ]);

    setPopup(null);
    window.getSelection().removeAllRanges();
  };

  const copyText = () => {
    if (!popup) return;
    navigator.clipboard.writeText(popup.text);
    setPopup(null);
    window.getSelection().removeAllRanges();
  };
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'white',
          padding: '10px 16px',
          borderBottom: '1px solid #ddd'
        }}
      >
        {/* ← 뒤로가기 아이콘 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FaArrowLeftLong
            onClick={onBack}
            style={{
              cursor: 'pointer',
              fontSize: '18px',
              color: '#333'
            }}
          />
        </div>

        {/* 확대/축소 아이콘 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FaMinus
            onClick={() => setScale(prev => Math.max(prev - 0.2, 0.5))}
            style={{
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
            }}
          />
          <FaPlus
            onClick={() => setScale(prev => Math.min(prev + 0.2, 3))}
            style={{
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
            }}
          />
          <span style={{ fontSize: '14px', minWidth: '40px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>


      {/* 🔽 PDF 문서 렌더링 영역 */}
      <div
        onMouseUp={onTextSelection}
        style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
        ref={viewerRef}
      >
        {popup && (
          <HighlightPopup
            position={popup.position}
            containerRef={viewerRef}
            onSelectColor={addHighlight}
            onCopyText={copyText}
            onClose={() => {
              setPopup(null);
              window.getSelection().removeAllRanges();
            }}
          />
        )}

        <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
          {Array.from({ length: numPages }, (_, index) => (
            <div key={`page_${index + 1}`} style={{ position: 'relative' }}>
              <Page
                pageNumber={index + 1}
                scale={scale}
                renderTextLayer={false} // ✅ 텍스트 레이어 비활성화
                renderAnnotationLayer={false} // ✅ 주석 레이어 비활성화
              />
              {highlights
                .filter(h => h.page === index + 1)
                .flatMap((h, idx) => h.positions.map((pos, innerIdx) => {
                  const pageDiv = viewerRef.current?.querySelector(`.react-pdf__Page[data-page-number="${h.page}"]`);
                  const canvas = pageDiv?.querySelector('canvas');
                  const canvasRect = canvas?.getBoundingClientRect();
                  if (!canvasRect) return null;
                  return (
                    <div
                      key={`${idx}-${innerIdx}`}
                      style={{
                        position: 'absolute',
                        left: `${pos.x1 * canvasRect.width}px`,
                        top: `${pos.y1 * canvasRect.height}px`,
                        width: `${(pos.x2 - pos.x1) * canvasRect.width}px`,
                        height: `${(pos.y2 - pos.y1) * canvasRect.height}px`,
                        backgroundColor: h.color,
                        opacity: 0.5,
                        borderRadius: '4px',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                }))}
            </div>
          ))}
        </Document>
      </div>
    </div>
  );

};

export default PDFViewer;
