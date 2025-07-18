// src/components/panels/SourceUploadModal.jsx
import React, { useState, useEffect } from 'react';
import './SourceUploadModal.css';
import { IoCloudUploadOutline } from "react-icons/io5";
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import FileIcon from './FileIcon';

function SourceUploadModal({ visible, onClose, onUpload, onGraphRefresh, brainId = null, currentCount = 0 }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (visible) setClosing(false);
  }, [visible]);

  if (!visible) return null;

  // Electron 파일 탐색기 호출
  const handleLocalFileSelect = async () => {
    if (window.api && window.api.openFileDialog) {
      const filePaths = await window.api.openFileDialog();
      if (filePaths && filePaths.length > 0) {
        setSelectedFiles(filePaths);
      }
    } else {
      alert('Electron 환경이 아닙니다.');
    }
  };

  // 업로드 버튼 클릭 시 파일 경로만 onUpload로 넘김
  const handleUpload = async () => {
    setUploading(true);
    try {
      onUpload && onUpload(selectedFiles);
      setClosing(true);
      setTimeout(() => {
        setSelectedFiles([]);
        setUploading(false);
        onClose();
      }, 300);
    } catch (e) {
      alert('업로드 중 오류 발생: ' + e.message);
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="upload-modal local-only" onClick={e => e.stopPropagation()}>
        <h2>로컬 파일에서 소스 추가</h2>
        <p className="description">
          PDF, TXT 파일을 선택해 지식그래프에 연결하세요.<br/>
          <span className="sub">(여러 파일을 한 번에 선택할 수 있습니다.)</span>
        </p>
        <div className="center-upload-area">
          <div className="upload-icon-large">
            <IoCloudUploadOutline size={64} />
          </div>
          <button className="select-file-btn" onClick={handleLocalFileSelect} disabled={uploading}>
            파일 선택
          </button>
        </div>
        {selectedFiles.length > 0 && (
          <div className="selected-file-list">
            {selectedFiles.map((file, idx) => (
              <div key={file} className="selected-file-item">
                <FileIcon fileName={file} />
                <span className="file-name">{file.split(/[\\/]/).pop()}</span>
              </div>
            ))}
          </div>
        )}
        {selectedFiles.length > 0 && (
          <button className="upload-btn" onClick={handleUpload} disabled={uploading}>
            {uploading ? (
              <><AiOutlineLoading3Quarters className="loading-spinner" /> 업로드 중...</>
            ) : '업로드'}
          </button>
        )}
        {closing && <div className="closing-overlay" />}
      </div>
    </div>
  );
}

export default SourceUploadModal;
