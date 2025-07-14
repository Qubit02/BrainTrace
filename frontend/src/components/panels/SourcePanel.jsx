import React, { useState, useEffect, useRef } from 'react';
import {
  getPdfsByBrain,
  getTextfilesByBrain,
  getSimilarSourceIds,
  getSourceMemosByBrain
} from '../../../../backend/api/backend';
import FileView from '../panels/FileView';
import PDFViewer from '../panels/PDFViewer';
import TxtViewer from '../panels/TxtViewer';
import MemoViewer from '../panels/MemoViewer';
import SourceUploadModal from '../panels/SourceUploadModal';
import SourceQuotaBar from '../panels/SourceQuotaBar';
import toggleIcon from '../../assets/icons/toggle-view.png';
import './styles/Common.css';
import './styles/SourcePanel.css';
import './styles/PanelToggle.css';
import './styles/Scrollbar.css';

import { TbCylinderPlus } from "react-icons/tb";
import { TbFolderPlus } from "react-icons/tb";
import { IoMdSearch } from "react-icons/io";

export default function SourcePanel({
  activeProject,
  collapsed,
  setCollapsed,
  setIsSourceOpen,
  onBackFromPDF,
  onGraphRefresh,
  onFocusNodeNamesUpdate,
  focusSource,
  onSourceCountChange
}) {

  // SourcePanel 상태 및 참조값
  const panelRef = useRef();                           // 패널 DOM 참조 (리사이징 감지용)
  const searchInputRef = useRef(null);                 // 검색 input 포커싱용

  const [panelWidth, setPanelWidth] = useState(0);     // 현재 패널 너비
  const [fileMap, setFileMap] = useState({});          // file_id → file 메타데이터 매핑

  // 열람 중인 파일 상태
  const [openedPDF, setOpenedPDF] = useState(null);    // 열람 중인 PDF
  const [openedTXT, setOpenedTXT] = useState(null);    // 열람 중인 텍스트
  const [openedMemo, setOpenedMemo] = useState(null);  // 열람 중인 메모 상태

  // 소스 관련 정보
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadKey, setUploadKey] = useState(0);       // 리렌더 트리거
  const [sourceCount, setSourceCount] = useState(0);   // 총 소스 수

  // 검색 관련
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredSourceIds, setFilteredSourceIds] = useState(null); // 검색 필터링된 id 리스트

  // 모든 파일 리스트 (파일/메모 클릭 시 참고용)
  const [allFiles, setAllFiles] = useState([]);
  const [localFocusSource, setLocalFocusSource] = useState(null);   // 클릭 포커스 대상

  // 반응형 UI 임계값 설정 (너비 기준 버튼 표시 여부)
  const PANEL_WIDTH_THRESHOLD_SEARCH = 250;            // 탐색 버튼 텍스트/아이콘 기준
  const PANEL_WIDTH_THRESHOLD_SOURCE = 220;            // 소스 버튼 텍스트/아이콘 기준

  useEffect(() => {
    refreshSourceCount(); // 소스 수 재계산
  }, [activeProject, uploadKey]);

  useEffect(() => { // 외부에서 특정 소스를 클릭했을 때 처리 (focusSource 업데이트 감지)
    if (focusSource) {
      console.log("focusSource", focusSource)
      setLocalFocusSource(focusSource); // 최신 클릭 반영
    }
  }, [focusSource]);

  useEffect(() => { // 패널 너비 추적용 ResizeObserver 등록
    if (!panelRef.current) return;
    const ro = new ResizeObserver(() => {
      setPanelWidth(panelRef.current.offsetWidth);
    });
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { // 프로젝트가 변경되면 모든 파일 로드 (PDF, TXT, Memo)
    if (activeProject) {
      loadAllFiles();
    }
  }, [activeProject]);

  // 모든 소스(PDF, TXT, Memo) 파일들을 비동기로 불러오는 함수
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
    } catch (e) {
      console.error('❌ 파일 목록 로딩 실패:', e);
      setAllFiles([]);
    }
  };

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

  // 소스 개수 계산
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
          <div
            className={`search-icon-container ${showSearchInput ? 'active' : ''}`}
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
            {!collapsed && (<IoMdSearch size={19} style={{ cursor: 'pointer' }} />)}
          </div>

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
                  className={`pill-button ${panelWidth < PANEL_WIDTH_THRESHOLD_SEARCH ? 'icon-only' : ''}`}
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
                  // 소스 수 갱신
                  refreshSourceCount();
                  // 파일 목록도 새로고침
                  loadAllFiles();
                }}
                onFocusNodeNamesUpdate={onFocusNodeNamesUpdate}
                filteredSourceIds={filteredSourceIds}
              />
            )
            }
          </div >
        </>
      )}

      <SourceUploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={async uploadedFiles => {
          try {
            // PDF, TXT, Memo 전체 파일 새로 불러오기
            await loadAllFiles();
            setUploadKey(k => k + 1);

            // fileMap에 ID별 메타데이터 매핑
            setFileMap(prev => {
              const m = { ...prev };
              uploadedFiles.forEach(file => {
                if (file.pdf_id) m[file.pdf_id] = file;
                else if (file.txt_id) m[file.txt_id] = file;
                else if (file.memo_id) m[file.memo_id] = file;
              });
              return m;
            });

            setShowUploadModal(false);
          } catch (e) {
            console.error(e);
            alert('파일 업로드 실패');
          }
        }}
        onGraphRefresh={onGraphRefresh}
        brainId={activeProject}
        currentCount={sourceCount}
      />
      {!collapsed && <SourceQuotaBar current={sourceCount} max={50} />}
    </div >
  );
}
