// src/components/panels/SourceUploadModal.jsx
import React, { useState, useRef } from 'react';
import './SourceUploadModal.css';
import { IoCloudUploadOutline } from "react-icons/io5";
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import FileIcon from './FileIcon';
import {
  uploadPdfs, createTextFile, createTextToGraph
} from '../../../../../backend/api/backend';

//import { pdfjs } from 'pdfjs-dist';
//import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
import SourceQuotaBar from './SourceQuotaBar';
//pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * 소스 업로드 모달 컴포넌트
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 콜백
 * @param {function} onUpload - 업로드 완료 콜백
 * @param {function} onGraphRefresh - 그래프 새로고침 콜백
 * @param {string|null} brainId - 브레인 ID
 * @param {number} currentCount - 현재 업로드된 소스 개수
 */
function SourceUploadModal({ visible, onClose, onUpload, onGraphRefresh, brainId = null, currentCount = 0 }) {
  // 상태 관리
  const [dragOver, setDragOver] = useState(false); // 드래그 상태
  const [uploadQueue, setUploadQueue] = useState([]); // 업로드 대기열
  const [closing, setClosing] = useState(false); // 모달 닫힘 애니메이션
  const fileInputRef = useRef(); // 파일 input ref

  if (!visible) return null;

  /**
   * 파일 확장자에 따라 업로드 및 그래프 변환 처리
   * @param {File} file - 업로드할 파일
   * @param {string|null} folderId - 폴더 ID
   * @returns {Promise<{id, filetype, meta}>}
   */
  const createFileByType = async (file, folderId) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const common = { folder_id: folderId, type: ext, brain_id: brainId };

    if (ext === 'pdf') {
      // PDF 업로드 및 텍스트 추출 후 그래프 변환
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
      // 텍스트 파일 업로드 및 그래프 변환
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
      // 기타 파일은 업로드 불가 처리
      throw new Error('지원하지 않는 파일 형식입니다. (PDF, TXT만 가능)');
    }
  };

  /**
   * 여러 파일 업로드 및 그래프 변환 처리
   * @param {File[]} files
   */
  const uploadFiles = files => {
    // 업로드 대기열 생성
    const queue = files.map(f => ({
      key: `${f.name}-${Date.now()}`,
      file: f,
      status: 'processing'
    }));
    setUploadQueue(queue);

    const results = [];

    // 각 파일별 업로드 및 변환 처리
    const promises = queue.map(async item => {
      try {
        const res = await createFileByType(item.file, folderId);
        results.push(res.meta); // 메타 저장
        setUploadQueue(q =>
          q.map(x => x.key === item.key ? { ...x, status: 'done' } : x)
        );
      } catch (err) {
        // 업로드 실패 시 상태 및 알림 처리
        setUploadQueue(q =>
          q.map(x => x.key === item.key ? { ...x, status: 'error', error: err.message } : x)
        );
        alert(err.message);
      }
    });

    // 모든 업로드 완료 후 콜백 및 상태 초기화
    Promise.all(promises).then(() => {
      onGraphRefresh && onGraphRefresh();
      onUpload && onUpload(results);
      setClosing(true);
      setTimeout(() => {
        setUploadQueue([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = null; // 동일한 파일 다시 선택 가능하게
        }
        onClose();
      }, 300);
    });
  };

  // 드래그 앤 드롭 파일 업로드 처리
  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  // 파일 선택 업로드 처리
  const handleSelect = e => {
    uploadFiles(Array.from(e.target.files));
  };

  // UI 렌더링
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="upload-modal" onClick={e => e.stopPropagation()}>
        <h2>소스 추가</h2>
        <p className="description">
          소스를 추가하면 지식그래프에 자동 연결되어, 문맥을 이해하는 답변을 받을 수 있어요.
        </p>

        {/* 업로드 진행 상태 표시 */}
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
            {/* 파일 선택/드래그 앤 드롭 영역 */}
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
            {/* 기타 소스 옵션 버튼 */}
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

        {/* 닫힘 애니메이션 오버레이 */}
        {closing && <div className="closing-overlay" />}
      </div>
    </div>
  );
}

export default SourceUploadModal;
