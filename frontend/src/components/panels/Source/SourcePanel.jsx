import React, { useState, useEffect, useRef } from 'react';
import {
  getPdfsByBrain,
  getTextfilesByBrain,
  getSimilarSourceIds,
  getSourceMemosByBrain
} from '../../../../api/backend';

import FileView from './FileView';
import PDFViewer from './viewer/PDFViewer';
import TxtViewer from './viewer/TxtViewer';
import MemoViewer from './viewer/MemoViewer';
import SourceUploadModal from './SourceUploadModal';
import SourceQuotaBar from './SourceQuotaBar';
import toggleIcon from '../../../assets/icons/toggle-view.png';
import './SourcePanel.css';
import '../styles/PanelToggle.css';
import '../styles/Scrollbar.css';

import { TbCylinderPlus } from "react-icons/tb";
import { TbFolderPlus } from "react-icons/tb";
import fileHandlers from './fileHandlers/fileHandlers';

/**
 * 소스 패널 컴포넌트
 * 파일 목록 관리, 업로드, 검색, 뷰어 등을 담당하는 메인 패널
 */
export default function SourcePanel({
  activeProject,              // 현재 활성화된 프로젝트 ID
  collapsed,                  // 패널 접힘 상태
  setCollapsed,               // 패널 접힘 상태 설정 함수
  setIsSourceOpen,            // 소스 패널 열림 상태 설정 함수
  onBackFromPDF,              // PDF에서 뒤로가기 콜백
  onGraphRefresh,             // 그래프 새로고침 콜백
  onFocusNodeNamesUpdate,     // 포커스 노드 이름 업데이트 콜백
  focusSource,                // 포커스할 소스 정보
  onSourceCountChange,        // 소스 개수 변경 콜백
  onReady                     // 준비 완료 콜백
}) {

  // === DOM 참조 ===
  const panelRef = useRef();                           // 패널 DOM 참조 (리사이징 감지용)
  const searchInputRef = useRef(null);                 // 검색 input 포커싱용

  // === 기본 상태 관리 ===
  const [panelWidth, setPanelWidth] = useState(0);     // 현재 패널 너비
  const [fileMap, setFileMap] = useState({});          // file_id → file 메타데이터 매핑

  // === 파일 뷰어 상태 ===
  const [openedPDF, setOpenedPDF] = useState(null);    // 열람 중인 PDF
  const [openedTXT, setOpenedTXT] = useState(null);    // 열람 중인 텍스트
  const [openedMemo, setOpenedMemo] = useState(null);  // 열람 중인 메모 상태

  // === 소스 관련 상태 ===
  const [showUploadModal, setShowUploadModal] = useState(false);  // 업로드 모달 표시 여부
  const [uploadKey, setUploadKey] = useState(0);       // 리렌더 트리거
  const [sourceCount, setSourceCount] = useState(0);   // 총 소스 수

  // === 검색 관련 상태 ===
  const [showSearchInput, setShowSearchInput] = useState(false);  // 검색창 표시 여부
  const [searchText, setSearchText] = useState('');               // 검색 텍스트
  const [filteredSourceIds, setFilteredSourceIds] = useState(null); // 검색 필터링된 id 리스트

  // === 파일 목록 및 포커스 상태 ===
  const [allFiles, setAllFiles] = useState([]);                    // 모든 파일 리스트 (PDF, TXT, MEMO)
  const [localFocusSource, setLocalFocusSource] = useState(null);  // 클릭 포커스 대상
  const [pendingFocusSource, setPendingFocusSource] = useState(null); // 업로드 후 포커스 대상
  const [uploadQueue, setUploadQueue] = useState([]);              // 업로드 진행상황 상태

  // === 반응형 UI 설정 ===
  const PANEL_WIDTH_THRESHOLD_SEARCH = 250;            // 탐색 버튼 텍스트/아이콘 기준
  const PANEL_WIDTH_THRESHOLD_SOURCE = 220;            // 소스 버튼 텍스트/아이콘 기준

  // === useEffect 훅들 ===
  // 소스 개수 재계산 (프로젝트 변경 시)
  useEffect(() => {
    refreshSourceCount();
  }, [activeProject, uploadKey]);

  // 외부에서 특정 소스를 클릭했을 때 처리 (focusSource 업데이트 감지)
  useEffect(() => {
    if (focusSource) {
      console.log("focusSource", focusSource)
      setLocalFocusSource(focusSource); // 최신 클릭 반영
    }
    if (pendingFocusSource) {
      setLocalFocusSource(pendingFocusSource);
      setPendingFocusSource(null);
    }
  }, [focusSource, pendingFocusSource]);

  // 패널 너비 추적용 ResizeObserver 등록
  useEffect(() => {
    if (!panelRef.current) return;
    const ro = new ResizeObserver(() => {
      setPanelWidth(panelRef.current.offsetWidth);
    });
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, []);

  // 프로젝트가 변경되면 모든 파일 로드 (PDF, TXT, Memo)
  useEffect(() => {
    if (activeProject) {
      loadAllFiles();
    }
  }, [activeProject]);

  // 외부에서 특정 소스를 클릭했을 때 해당 파일 열기
  useEffect(() => {
    if (focusSource) {
      console.log("📌 focusSource:", focusSource);

      const targetFile = allFiles.find(file => {
        if (file.type === 'pdf') return file.pdf_id == focusSource.id;
        if (file.type === 'txt') return file.txt_id == focusSource.id;
        if (file.type === 'memo') return file.memo_id == focusSource.id;
        return false;
      });

      if (targetFile) {
        console.log("✅ targetFile found:", targetFile);

        if (targetFile.type === 'pdf') setOpenedPDF(targetFile);
        else if (targetFile.type === 'txt') setOpenedTXT(targetFile);
        else if (targetFile.type === 'memo') setOpenedMemo(targetFile);

        setIsSourceOpen(true);
        setLocalFocusSource(null); // 포커스 초기화
      }
    }
  }, [localFocusSource]);

  // === 핵심 함수들 ===
  /**
   * 모든 소스(PDF, TXT, Memo) 파일들을 비동기로 불러오는 함수
   * 서버에서 파일 목록을 가져와서 allFiles 상태를 업데이트
   */
  const loadAllFiles = async () => {
    try {
      const [pdfs, txts, memos] = await Promise.all([
        getPdfsByBrain(activeProject),
        getTextfilesByBrain(activeProject),
        getSourceMemosByBrain(activeProject)
      ]);

      const merged = [
        ...pdfs.map(pdf => ({ ...pdf, title: pdf.pdf_title, type: 'pdf' })),
        ...txts.map(txt => ({ ...txt, title: txt.txt_title, type: 'txt' })),
        ...memos.map(memo => ({ ...memo, title: memo.memo_title, type: 'memo' }))
      ];

      setAllFiles(merged);
      setUploadKey(k => k + 1); // 강제 리렌더링 트리거
      onReady?.();
    } catch (e) {
      setAllFiles([]);
      setUploadKey(k => k + 1);
      onReady?.();
    }
  };

  /**
   * 소스 개수 계산 함수
   * 현재 프로젝트의 총 소스 개수를 계산하여 상태 업데이트
   */
  const refreshSourceCount = async () => {
    if (!activeProject) return;
    try {
      const [pdfs, txts, memos] = await Promise.all([
        getPdfsByBrain(activeProject),
        getTextfilesByBrain(activeProject),
        getSourceMemosByBrain(activeProject),
      ]);

      const totalCount = pdfs.length + txts.length + memos.length;

      setSourceCount(totalCount);
      onSourceCountChange?.(totalCount);
    } catch (e) {
      console.error('소스 카운트 오류', e);
      setSourceCount(0);
    }
  };

  /**
   * 열린 파일 뷰어를 닫는 함수
   * 모든 뷰어 상태를 초기화하고 소스 패널을 닫음
   */
  const closeSource = () => {
    setOpenedPDF(null);
    setOpenedTXT(null);
    setOpenedMemo(null);
    setIsSourceOpen(false);
    onBackFromPDF?.();
  };

  return (
    <div
      ref={panelRef}
      className={`panel-container modern-panel ${collapsed ? 'collapsed' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* ───── 사이드패널 상단 헤더 영역 ───── */}
      <div
        className="panel-header"
        style={{ justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center' }}
      >
        {!collapsed && <span className="header-title">Source</span>}

        <div className="header-right-icons" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 검색 버튼 토글 */}
          {/* 더 이상 클릭 이벤트 없음, active 클래스 제거 */}

          {/* 사이드패널 접기/펴기 버튼 */}
          <img
            src={toggleIcon}
            alt="Toggle"
            style={{ width: '23px', height: '23px', cursor: 'pointer' }}
            onClick={() => setCollapsed(prev => !prev)}
          />
        </div>
      </div>

      {!collapsed && (
        <>
          <div>
            {/* 소스가 열려있지 않을 때만 표시 */}
            {(!openedPDF && !openedTXT && !openedMemo) && (
              <div className="action-buttons">
                {/* 소스 추가 버튼 (화면 너비에 따라 아이콘/텍스트 토글) */}
                <button
                  className={`pill-button ${panelWidth < PANEL_WIDTH_THRESHOLD_SOURCE ? 'icon-only' : ''}`}
                  onClick={() => setShowUploadModal(true)}
                >
                  {panelWidth < 250
                    ? <TbCylinderPlus size={25} />
                    : <>＋ 소스</>}
                </button>
                {/* 탐색 버튼 (화면 너비에 따라 아이콘/텍스트 토글) */}
                <button
                  className={`pill-button${showSearchInput ? ' active' : ''} ${panelWidth < PANEL_WIDTH_THRESHOLD_SEARCH ? 'icon-only' : ''}`}
                  onClick={() => {
                    setShowSearchInput(prev => {
                      const next = !prev;
                      if (next) {
                        setTimeout(() => {
                          searchInputRef.current?.focus();
                        }, 0);
                      } else {
                        setFilteredSourceIds(null);
                        setSearchText('');
                      }
                      return next;
                    });
                  }}
                >
                  {panelWidth < 250
                    ? <TbFolderPlus size={25} />
                    : <>＋ 탐색</>}
                </button>
              </div>
            )}

          </div>

          {/* 검색창 표시 여부에 따라 입력창 렌더링 */}
          {showSearchInput && (
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!searchText.trim()) return;
                try {
                  const res = await getSimilarSourceIds(searchText, activeProject);
                  const ids = (res.source_ids || []).map(id => String(id)); // 문자열로 강제 변환
                  console.log("ids : ", ids);
                  setFilteredSourceIds(ids);
                } catch (err) {
                  console.error('검색 실패:', err);
                  alert('검색 중 오류 발생');
                }
              }}
              style={{ padding: '10px 16px' }}
            >
              <style>
                {`input::placeholder { color: #888; }`}
              </style>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="설명이나 키워드를 입력하세요"
                value={searchText}
                onChange={e => {
                  const text = e.target.value;
                  setSearchText(text);
                  if (text.trim() === '') {
                    setFilteredSourceIds(null); // 검색어 지워졌을 때 전체 보여주기
                  }
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  backgroundColor: '#f9f9f9',
                  color: 'black'
                }}
              />
            </form>
          )}

          {/* === 메인 콘텐츠 영역 === */}
          <div className="panel-content" style={{ flexGrow: 1, overflow: 'auto' }}>
            {openedPDF ? (
              // PDF 뷰어
              <div className="pdf-viewer-wrapper" style={{ height: '100%' }}>
                <PDFViewer
                  file={`http://localhost:8000/${openedPDF.pdf_path}`}
                  containerWidth={panelWidth}
                  onBack={closeSource}
                />
              </div>
            ) : openedTXT ? (
              // TXT 뷰어
              <div className="pdf-viewer-wrapper" style={{ height: '100%' }}>
                <TxtViewer
                  fileUrl={`http://localhost:8000/${openedTXT.txt_path}`}
                  onBack={closeSource}
                />
              </div>
            ) : openedMemo ? (
              // MEMO 뷰어
              <div className="pdf-viewer-wrapper" style={{ height: '100%' }}>
                <MemoViewer memoId={openedMemo.memo_id} onBack={closeSource} />
              </div>
            ) : (
              // 파일 목록 뷰 (FileView 컴포넌트)
              <FileView
                brainId={activeProject}
                files={allFiles}
                onOpenPDF={file => {
                  setOpenedPDF(file);
                  setIsSourceOpen(true);
                }}
                onOpenTXT={file => {
                  setOpenedTXT(file);
                  setIsSourceOpen(true);
                }}
                onOpenMEMO={file => {
                  setOpenedMemo(file);
                  setIsSourceOpen(true);
                }}
                fileMap={fileMap}
                setFileMap={setFileMap}
                refreshTrigger={uploadKey}
                onGraphRefresh={() => {
                  onGraphRefresh?.();
                  refreshSourceCount();
                  loadAllFiles();
                }}
                onFocusNodeNamesUpdate={onFocusNodeNamesUpdate}
                filteredSourceIds={filteredSourceIds}
                searchText={searchText}
                focusSource={localFocusSource}
                uploadQueue={uploadQueue}
                setUploadQueue={setUploadQueue}
                onFileUploaded={loadAllFiles} // 파일 업로드 완료 시 목록 즉시 갱신
              />
            )
            }
          </div >
        </>
      )}

      {/* === 소스 업로드 모달 === */}
      <SourceUploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={async filePaths => {
          try {
            console.log('[소스업로드] 전달받은 파일 경로:', filePaths);
            if (!filePaths || filePaths.length === 0) return;
            let fileObjs = [];
            if (window.api && window.api.readFilesAsBuffer) {
              const filesData = await window.api.readFilesAsBuffer(filePaths);
              console.log('[소스업로드] readFilesAsBuffer 결과:', filesData);
              fileObjs = filesData.map(fd => new File([new Uint8Array(fd.buffer)], fd.name));
              console.log('[소스업로드] File 객체:', fileObjs);
            } else {
              alert('Electron 파일 읽기 기능이 필요합니다.');
              return;
            }
            const uploadedFiles = [];
            for (const f of fileObjs) {
              const ext = f.name.split('.').pop().toLowerCase();
              if (!['pdf', 'txt', 'memo'].includes(ext)) continue;
              const key = `${f.name}-${Date.now()}`;
              setUploadQueue(q => [...q, { key, name: f.name, filetype: ext, status: 'processing' }]);
              try {
                console.log(`[소스업로드] fileHandlers[${ext}] 업로드 시작:`, f);
                const result = await fileHandlers[ext](f, activeProject);
                console.log(`[소스업로드] fileHandlers[${ext}] 업로드 결과:`, result);
                if (result && result.meta) uploadedFiles.push(result.meta);
              } catch (err) {
                console.error(`[소스업로드] ${f.name} 업로드 실패:`, err);
                alert(f.name + ' 업로드 실패: ' + err.message);
              } finally {
                setUploadQueue(q => q.filter(item => item.key !== key));
              }
            }
            console.log('[소스업로드] 업로드된 파일 메타:', uploadedFiles);
            // 업로드/그래프 변환이 끝나면 파일 목록, 그래프, fileMap, uploadKey 모두 즉시 갱신
            await loadAllFiles();
            setUploadKey(k => k + 1);
            setFileMap(prev => {
              const m = { ...prev };
              uploadedFiles.forEach(file => {
                if (file.pdf_id) m[file.pdf_id] = file;
                else if (file.txt_id) m[file.txt_id] = file;
                else if (file.memo_id) m[file.memo_id] = file;
              });
              return m;
            });
            onGraphRefresh?.();
            if (uploadedFiles.length > 0) {
              const last = uploadedFiles[uploadedFiles.length - 1];
              if (last.pdf_id) setPendingFocusSource({ id: last.pdf_id, type: 'pdf' });
              else if (last.txt_id) setPendingFocusSource({ id: last.txt_id, type: 'txt' });
              else if (last.memo_id) setPendingFocusSource({ id: last.memo_id, type: 'memo' });
            }
            setShowUploadModal(false);
          } catch (e) {
            console.error('[소스업로드] 전체 업로드 실패:', e);
            alert('파일 업로드 실패');
          }
        }}
      />
      {!collapsed && <SourceQuotaBar current={sourceCount} max={50} />}
    </div >
  );
}
