// src/components/panels/SourceUploadModal.jsx
import React, { useState, useRef } from 'react';
import './styles/SourceUploadModal.css';
import { IoCloudUploadOutline } from "react-icons/io5";
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import FileIcon from './FileIcon';
import {
  uploadPdfs, createTextFile, createTextToGraph
} from '../../../../backend/api/backend';
import { pdfjs } from 'react-pdf';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
import SourceQuotaBar from './SourceQuotaBar';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

function SourceUploadModal({ visible, onClose, onUpload, onGraphRefresh, folderId = null, brainId = null, currentCount = 0 }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [closing, setClosing] = useState(false);
  const fileInputRef = useRef();

  if (!visible) return null;

  const createFileByType = async (file, folderId) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const common = { folder_id: folderId, type: ext, brain_id: brainId };

    if (ext === 'pdf') {
      const [meta] = await uploadPdfs([file], folderId, brainId);
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let content = '';
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        content += textContent.items.map(item => item.str).join(' ') + '\n\n';
      }
      await createTextToGraph({
        text: content,
        brain_id: String(brainId),
        source_id: String(meta.pdf_id)
      });
      return { id: meta.pdf_id, filetype: 'pdf', meta };
    } else if (ext === 'txt') {
      const res = await createTextFile({
        ...common,
        txt_title: file.name,
        txt_path: file.name
      });
      const content = await file.text();
      await createTextToGraph({
        text: content,
        brain_id: String(brainId),
        source_id: String(res.txt_id)
      });
      return { id: res.txt_id, filetype: 'txt', meta: res };
    } else {
      const res = await createTextFile({
        ...common,
        txt_title: file.name,
        txt_path: file.name
      });
      return { id: res.txt_id, filetype: 'txt', meta: res };
    }
  };

  const uploadFiles = files => {
    const queue = files.map(f => ({
      key: `${f.name}-${Date.now()}`,
      file: f,
      status: 'processing'
    }));
    setUploadQueue(queue);

    const results = [];

    const promises = queue.map(async item => {
      try {
        const res = await createFileByType(item.file, folderId);
        results.push(res.meta); // 메타 저장
        setUploadQueue(q =>
          q.map(x => x.key === item.key ? { ...x, status: 'done' } : x)
        );
      } catch (err) {
        console.error('처리 실패:', err);
      }
    });

    Promise.all(promises).then(() => {
      onGraphRefresh && onGraphRefresh();
      onUpload && onUpload(results);
      setClosing(true);
      setTimeout(() => {
        // 👉 업로드 관련 상태 초기화
        setUploadQueue([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = null; // 동일한 파일 다시 선택 가능하게
        }
        onClose();
      }, 300);
    });
  };

  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const handleSelect = e => {
    uploadFiles(Array.from(e.target.files));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="upload-modal" onClick={e => e.stopPropagation()}>
        <h2>소스 추가</h2>
        <p className="description">
          소스를 추가하면 지식그래프에 자동 연결되어, 문맥을 이해하는 답변을 받을 수 있어요.
        </p>

        {uploadQueue.length > 0 ? (
          <div className="progress-list">
            {uploadQueue.map(item => (
              <div key={item.key} className="progress-item">
                <FileIcon fileName={item.file.name} />
                <span className="file-name">{item.file.name}</span>
                {item.status === 'processing' && (
                  <span className="upload-status">
                    <span className="loading-text">그래프 변환 중</span>
                    <AiOutlineLoading3Quarters className="loading-spinner" />
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleSelect}
            />
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current.click()}
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="upload-icon">
                <IoCloudUploadOutline />
              </div>
              <p>
                업로드할 <span className="highlight">파일을 선택</span>하거나 드래그 앤 드롭하세요.
              </p>
              <p className="file-types">
                지원 형식: PDF, TXT, 오디오(mp3)
              </p>
            </div>
            <div className="source-options">
              <button className="source-button">Google Docs</button>
              <button className="source-button">Google Slides</button>
              <button className="source-button">웹사이트</button>
              <button className="source-button">YouTube</button>
              <button className="source-button">복사된 텍스트</button>
            </div>
            <div className="footer">
              <SourceQuotaBar current={uploadQueue.length + currentCount} max={50} />
            </div>

          </>
        )}

        {closing && <div className="closing-overlay" />}
      </div>
    </div>
  );
}

export default SourceUploadModal;
