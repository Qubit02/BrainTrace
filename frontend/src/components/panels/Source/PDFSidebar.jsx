
import React, { useState } from 'react';
import PDFViewer from './PDFViewer';
import './PDFSidebar.css';

function PDFSidebar() {
  const [openedPDF, setOpenedPDF] = useState(null);

  const [pdfFiles, setPdfFiles] = useState([]);
  const viewerRef = useRef(null);
  const [viewerWidth, setViewerWidth] = useState(0);

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
      file.type === 'application/pdf'
    );
    setPdfFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleDragOver = (e) => e.preventDefault();

  // ✅ PDF 영역 리사이즈 감지
  useEffect(() => {
    if (viewerRef.current) {
      const observer = new ResizeObserver(([entry]) => {
        setViewerWidth(entry.contentRect.width);
      });
      observer.observe(viewerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  return (
    <div className="pdf-sidebar-container" onDrop={handleDrop} onDragOver={handleDragOver}>
      <div className="pdf-sidebar">
        <h3>PDF 목록</h3>
        <ul className="pdf-list">
          {pdfFiles.map((file, index) => (
            <li key={index} className="pdf-item" onClick={() => setOpenedPDF(file)}>
              📄 {file.name}
            </li>
          ))}
        </ul>
      </div>
      <div className="pdf-viewer-area">
        {openedPDF ? (
          <PDFViewer file={openedPDF} containerWidth={viewerWidth} />
        ) : (
          <p className="placeholder-text">왼쪽에서 PDF를 선택하세요</p>
        )}
      </div>
    </div>
  );
}

export default PDFSidebar;
