// src/components/panels/FileView.jsx
import React, { useState, useEffect, useRef } from 'react'
import { pdfjs } from 'react-pdf';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
import './SourcePanel.css';
import './FileView.css';
import FileIcon from './FileIcon'
import { TiUpload } from 'react-icons/ti'
import { GoPencil } from 'react-icons/go';
import { RiDeleteBinLine } from 'react-icons/ri';
import { processText, deleteDB } from '../../../../api/graphApi';
import ConfirmDialog from '../../common/ConfirmDialog';
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { AiOutlineNodeIndex } from "react-icons/ai";
import {
  getPdfsByBrain,
  getTextfilesByBrain,
  getMemosByBrain,
  setMemoAsSource,
  getNodesBySourceId,
  getMDFilesByBrain
} from '../../../../api/backend';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import fileHandlers from './fileHandlers/fileHandlers';
import deleteHandlers from './fileHandlers/deleteHandlers';
import nameUpdateHandlers from './fileHandlers/nameUpdateHandlers';
import fileMetaExtractors from './fileHandlers/fileMetaExtractors';
// import GenericViewer from './viewer/GenericViewer'; // 더 이상 사용하지 않으므로 주석처리

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * 메모 텍스트를 그래프 지식으로 변환하는 함수
 * @param {string} content - 메모 내용
 * @param {string|number} sourceId - 메모 ID
 * @param {string|number} brainId - 브레인 ID
 */
async function processMemoTextAsGraph(content, sourceId, brainId) {
  if (!content || content.trim() === "") {
    console.warn("📭 메모 내용이 비어 있어 그래프를 생성하지 않습니다.");
    return;
  }
  try {
    const response = await processText(content, String(sourceId), String(brainId));
    console.log("✅ 그래프 생성 완료:", response);
  } catch (error) {
    console.error("❌ 그래프 생성 실패:", error);
  }
}

/**
 * 파일 뷰 컴포넌트
 * 파일 목록 표시, 드래그 앤 드롭, 업로드 큐 관리 등을 담당
 */
export default function FileView({
  brainId,                    // 현재 브레인 ID
  files = [],                 // 파일 목록 (PDF, TXT, MEMO)
  onOpenFile = () => { },     // 파일 열기 콜백
  setFileMap = () => { },     // fileMap 상태 업데이트 함수
  refreshTrigger,             // 파일 목록 새로고침 트리거
  onGraphRefresh,             // 그래프 새로고침 콜백
  onSourceCountRefresh,       // 소스 개수 새로고침 콜백
  onFocusNodeNamesUpdate,     // 포커스 노드 이름 업데이트 콜백
  filteredSourceIds,          // 검색 필터링된 소스 ID 목록
  searchText,                 // 검색 텍스트
  onFileUploaded              // 파일 업로드 완료 시 호출할 콜백
}) {
  // === 상태 관리 ===
  const [selectedFile, setSelectedFile] = useState(null)        // 현재 선택된 파일 ID
  const [isDrag, setIsDrag] = useState(false)                   // 드래그 중 여부
  const [menuOpenId, setMenuOpenId] = useState(null);           // 열린 메뉴의 파일 ID
  const [editingId, setEditingId] = useState(null);             // 이름 편집 중인 파일 ID
  const [tempName, setTempName] = useState('');                 // 임시 파일명 (편집용)
  const [fileToDelete, setFileToDelete] = useState(null);       // 삭제할 파일 정보
  const [uploadQueue, setUploadQueue] = useState([]);           // 업로드/변환 대기 큐
  const [isProcessing, setIsProcessing] = useState(false);      // 변환 작업 진행 중 여부
  const [isDeleting, setIsDeleting] = useState(false);          // 삭제 작업 진행 중 여부

  // === 파일 목록 처리 ===
  // 검색 필터링된 파일 목록 계산
  const displayedFiles = filteredSourceIds
    ? files.filter(f => {
      const id = f.memo_id || f.pdf_id || f.txt_id || f.md_id;
      return filteredSourceIds.includes(String(id));
    })
    : files;

  // 파일 구조를 FileView에서 사용하는 형태로 변환
  const processedFiles = displayedFiles.map(f =>
    fileMetaExtractors[f.type] ? fileMetaExtractors[f.type](f) : f
  );

  // 업로드 중인 파일의 고유 key 목록
  const uploadingKeys = uploadQueue.map(item => item.key);

  // processedFiles에 key를 임시로 부여 (name, size, type 기준으로 생성)
  const processedFilesWithKey = processedFiles.map(f => {
    const uploadKey = `${f.name}-${f.size || ''}-${f.type}`;
    return { ...f, _uploadKey: uploadKey };
  });

  // 업로드 중인 파일의 key와 일치하는 파일은 목록에서 제외
  const visibleFiles = processedFilesWithKey.filter(f => !uploadingKeys.includes(f._uploadKey));

  /**
   * 변환 작업 함수: 큐에서 하나씩 꺼내서 처리
   * createFileByType 함수를 호출하여 실제 파일 업로드와 그래프 변환을 수행합니다.
   * 성공하면 fileMap을 업데이트하고, onFileUploaded 콜백을 호출합니다.
   * 마지막에 큐에서 해당 파일을 제거합니다.
   */
  const processNextInQueue = async () => {
    if (uploadQueue.length === 0) return;
    setIsProcessing(true);
    const file = uploadQueue[0];
    try {
      if (file.filetype === 'memo' && file.memoId && file.memoContent) {
        // 메모를 소스로 변환
        await setMemoAsSource(file.memoId);
        await processMemoTextAsGraph(file.memoContent, file.memoId, brainId);
        if (onGraphRefresh) onGraphRefresh();
        if (onSourceCountRefresh) onSourceCountRefresh();
        if (onFileUploaded) await onFileUploaded();
      } else {
        // 실제 파일 업로드 및 그래프 생성
        const ext = file.filetype;
        const f = file.fileObj;
        const result = await createFileByType(f);
        if (!result) throw new Error('유효하지 않은 파일');
        setFileMap(prev => ({
          ...prev,
          [result.id]: result.meta,
        }));
        if (onGraphRefresh) onGraphRefresh();
        if (onSourceCountRefresh) onSourceCountRefresh();
        if (onFileUploaded) await onFileUploaded();
      }
    } catch (err) {
      console.error('파일 업로드 실패:', err);
    } finally {
      // 큐에서 제거
      setUploadQueue(q => q.slice(1));
      setIsProcessing(false);
    }
  };

  // === useEffect 훅들 ===
  // 큐에 변화가 생길 때마다 자동으로 다음 파일 처리
  useEffect(() => {
    if (uploadQueue.length > 0 && !isProcessing) {
      processNextInQueue(); // uploadQueue에 파일이 추가되면 processNextInQueue 함수가 자동으로 호출
    }
  }, [uploadQueue, isProcessing]);

  // 브레인 ID나 refreshTrigger가 변경될 때 파일 목록 새로고침
  useEffect(() => {
    refresh();
  }, [brainId, refreshTrigger]);

  // 메뉴 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const closeMenu = () => setMenuOpenId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  /**
   * 파일 목록 새로고침 함수
   * 서버에서 최신 파일 목록을 가져와서 fileMap을 업데이트
   */
  const refresh = async () => {
    if (!brainId) return;
    try {
      // 1) 브레인 기준 전체 파일 조회
      const [pdfs, txts, memos, mds] = await Promise.all([
        getPdfsByBrain(brainId),
        getTextfilesByBrain(brainId),
        getMemosByBrain(brainId),
        getMDFilesByBrain(brainId),
      ]);
      // 2) fileMap 갱신 - 각 파일 ID를 키로 하여 메타데이터를 빠르게 참조 가능하게 구성
      setFileMap(prev => {
        const m = { ...prev };
        pdfs.forEach(p => { m[p.pdf_id] = p; });
        txts.forEach(t => { m[t.txt_id] = t; });
        memos.forEach(memo => { m[memo.memo_id] = memo; });
        mds.forEach(md => { m[md.md_id] = md; });
        return m;
      });
    } catch (err) {
      console.error('파일 목록 로딩 실패:', err);
    }
  };

  /**
   * 파일을 업로드하고 그래프를 생성하는 함수
   * @param {File} f - 업로드할 파일 객체
   * @returns {Object|null} 업로드 결과 또는 null
   */
  const createFileByType = async (f) => {
    if (!f || !f.name) {
      console.warn('createFileByType: 파일 객체가 유효하지 않습니다.', f);
      return null;
    }
    const ext = f.name.split('.').pop().toLowerCase();
    if (fileHandlers[ext]) {
      return await fileHandlers[ext](f, brainId);
    } else {
      console.warn(`❌ 지원되지 않는 파일 형식: .${ext}`);
      toast.error('지원되지 않는 파일 형식입니다. 소스를 추가할 수 없습니다.');
      return null;
    }
  }

  /**
   * 소스를 삭제하는 함수
   * @param {Object} f - 삭제할 파일 정보
   */
  const handleDelete = async f => {
    try {
      // 삭제할 파일 정보 로그는 개발 시에만 필요하므로 제거
      // 1) 벡터 DB 및 지식 그래프 DB에서 해당 소스 삭제
      try {
        await deleteDB(brainId, f.id);
        console.log('✅ 벡터 DB 및 그래프 DB 삭제 성공');
      } catch (dbError) {
        console.error('⚠️ 벡터/그래프 DB 삭제 실패 (계속 진행):', dbError);
      }

      // 2) 실제 파일 삭제 (파일 시스템 또는 DB에서)
      let deleted = false;
      if (deleteHandlers[f.filetype]) {
        deleted = await deleteHandlers[f.filetype](f.id);
      } else {
        throw new Error('지원하지 않는 파일 타입');
      }
      // 삭제 실패 시 에러 처리
      if (!deleted) {
        throw new Error(`${f.filetype} 파일 삭제 실패`);
      }
      // 3) 그래프 뷰 새로고침
      if (onGraphRefresh) {
        onGraphRefresh();
      }
      // 4) 소스 개수 새로고침
      if (onSourceCountRefresh) {
        onSourceCountRefresh();
      }
      // 5) 파일 목록 다시 로드
      await refresh();
    } catch (e) {
      console.error('❌ 삭제 실패:', e);
      alert('삭제 실패');
    }
  };

  /**
   * 소스 이름을 변경하는 함수
   * @param {Object} f - 이름을 변경할 파일 정보
   */
  const handleNameChange = async (f) => {
    const newName = tempName.trim();
    if (!newName || newName === f.name) {
      setEditingId(null);
      return;
    }
    try {
      if (nameUpdateHandlers[f.filetype]) {
        await nameUpdateHandlers[f.filetype](f.id, newName, brainId);
      } else {
        throw new Error('지원하지 않는 파일 타입');
      }
      // 2) 파일 목록 갱신
      await refresh();
    } catch (e) {
      alert('이름 변경 실패');
    } finally {
      setEditingId(null); // 편집 모드 해제
    }
  };

  /**
   * 삭제 확인 모달을 띄우기 위해 삭제할 파일 지정
   * @param {Object} f - 삭제할 파일 정보
   */
  const openDeleteConfirm = (f) => {
    setFileToDelete(f);     // 삭제할 파일 정보 저장
    setMenuOpenId(null);    // ⋮ 메뉴 닫기
  };

  /**
   * 파일 드롭 시 처리하는 로직 (메모 → 소스 변환 또는 외부 파일 업로드)
   * 드롭된 파일들을 uploadQueue에 추가합니다.
   * @param {DragEvent} e - 드롭 이벤트
   */
  const handleDrop = async e => {
    e.preventDefault();
    e.stopPropagation();
    setIsDrag(false); // 드래그 상태 해제
    // 메모 드래그 처리 (메모 → 소스로 전환)
    const memoData = e.dataTransfer.getData('application/json-memo');
    if (memoData) {
      const { id, name, content } = JSON.parse(memoData);
      const key = `${name}-${content.length}-memo`;
      // (1) 큐에 추가
      setUploadQueue(q => [
        ...q,
        {
          key,
          name,
          filetype: 'memo',
          size: content.length,
          status: 'processing',
          memoId: id,
          memoContent: content
        }
      ]);
      // (2) 변환 작업은 큐 처리 로직에서 처리
      return;
    }
    // 외부 파일 드래그 앤 드롭 (pdf, txt, md 허용)
    const dropped = Array.from(e.dataTransfer.files); // 드래그한 파일 배열로 변환
    if (!dropped.length) return; // 비어 있으면 종료
    // dropped 파일들을 큐에 모두 추가 (fileObj 포함)
    const newQueueItems = dropped
      .filter(file => ['pdf', 'txt', 'md'].includes(file.name.split('.').pop().toLowerCase()))
      .map(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        const uploadKey = `${file.name}-${file.size}-${ext}`;
        return {
          key: uploadKey,
          name: file.name,
          filetype: ext,
          size: file.size,
          status: 'processing',
          fileObj: file // 항상 fileObj 포함
        };
      });
    if (newQueueItems.length > 0) {
      setUploadQueue(q => [...q, ...newQueueItems]);
    }
  }

  // === 기존 목록/업로드 UI ===
  return (
    <div
      className={`file-explorer modern-explorer${isDrag ? ' drag-over' : ''}`}
      onDragEnter={e => { e.preventDefault(); setIsDrag(true); }}
      onDragLeave={e => { e.preventDefault(); setIsDrag(false); }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* 드래그 중 배경 표시 */}
      {isDrag && (
        <div className="drop-overlay">
          <div className="drop-icon">
            <TiUpload />
          </div>
        </div>
      )}
      {/* 업로드 진행 표시 */}
      {uploadQueue.map(item => (
        <div key={item.key} className="file-item uploading">
          <FileIcon fileName={item.name} />
          <span className="file-name">{item.name}</span>
          {item.status === 'processing' && (
            <span className="upload-status" style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
              <span style={{ marginLeft: 4 }}>그래프 변환 중</span>
              <AiOutlineLoading3Quarters className="loading-spinner" />
            </span>
          )}
        </div>
      ))}
      {/* 소스패널에 파일들 렌더링 */}
      {visibleFiles.map(f => {
        return (
          <div
            key={`${f.filetype}-${f.id}`}
            className={`file-item ${selectedFile === f.id ? 'selected' : ''}`}
            draggable
            onDragStart={e =>
              e.dataTransfer.setData(
                'application/json',
                JSON.stringify({ id: f.id, filetype: f.filetype })
              )
            }
            onClick={() => {
              setSelectedFile(f.id);
              onOpenFile(f.id, f.filetype);
            }}
          >
            <FileIcon fileName={f.name} />
            {/* ✏️ 이름 변경 입력창 */}
            {editingId === f.id ? (
              <input
                autoFocus
                className="rename-input"
                defaultValue={f.name}
                onChange={e => setTempName(e.target.value)}
                onBlur={() => handleNameChange(f)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleNameChange(f);
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <span className="file-name">{f.name}</span>
            )}
            {/* ⋮ 메뉴 버튼 */}
            <div
              className="file-menu-button"
              onClick={e => {
                e.stopPropagation();
                setMenuOpenId(prev => (prev === f.id ? null : f.id));
              }}
            >
              ⋮
              {menuOpenId === f.id && (
                <div className="file-menu-popup" onClick={e => e.stopPropagation()}>
                  <div
                    className="popup-item"
                    onClick={async () => {
                      try {
                        const names = await getNodesBySourceId(f.id, brainId);
                        if (onFocusNodeNamesUpdate) {
                          onFocusNodeNamesUpdate(names);
                        }
                      } catch (err) {
                        console.error('노드 조회 실패:', err);
                        alert('해당 소스에서 생성된 노드를 가져오지 못했습니다.');
                      }
                      setMenuOpenId(null);
                    }}
                  >
                    <AiOutlineNodeIndex size={17} style={{ marginRight: 1 }} />
                    노드 보기
                  </div>
                  <div
                    className="popup-item"
                    onClick={() => {
                      setEditingId(f.id);
                      setTempName(f.name);
                      setMenuOpenId(null);
                    }}
                  >
                    <GoPencil size={14} style={{ marginRight: 4 }} /> 소스 이름 바꾸기
                  </div>
                  <div className="popup-item" onClick={() => openDeleteConfirm(f)}>
                    <RiDeleteBinLine size={14} style={{ marginRight: 4 }} /> 소스 삭제
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {/* 파일이 하나도 없을 때 */}
      {processedFiles.length === 0 && (!searchText || searchText.trim() === '') && (
        <div className="empty-state">
          <p className="empty-sub">
            이 영역에 파일을 <strong>드래그해서 추가</strong>해보세요!
          </p>
        </div>
      )}
      {/* 검색 결과가 없을 때 */}
      {filteredSourceIds && processedFiles.length === 0 && (
        <div className="empty-state">
          <p className="empty-sub">검색 결과가 없습니다.</p>
        </div>
      )}
      {/* 삭제 확인 모달 */}
      {fileToDelete && (
        <ConfirmDialog
          message={`"${fileToDelete.name}" 소스를 삭제하시겠습니까?`}
          onCancel={() => {
            if (!isDeleting) setFileToDelete(null);
          }}
          onOk={async () => {
            setIsDeleting(true); // 로딩 시작
            await handleDelete(fileToDelete);
            setIsDeleting(false); // 로딩 종료
            setFileToDelete(null); // 모달 닫기
          }}
          isLoading={isDeleting}
        />
      )}
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar={true} />
    </div>
  )
}
