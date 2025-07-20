import React, { useState, useEffect, useRef } from 'react';
import {
  getPdfsByBrain,
  getTextfilesByBrain,
  getSimilarSourceIds,
  getSourceMemosByBrain,
  getMDFilesByBrain,
  uploadMDFiles,
  getSourceDataMetrics
} from '../../../../api/backend';

import FileView from './FileView';
import PDFViewer from './viewer/PDFViewer';
import SourceUploadModal from './SourceUploadModal';
import KnowledgeGraphStatusBar from './KnowledgeGraphStatusBar';
import toggleIcon from '../../../assets/icons/toggle-view.png';
import './SourcePanel.css';
import { MdSearch } from "react-icons/md";
import fileHandlers from './fileHandlers/fileHandlers';
import { MdOutlineDriveFolderUpload } from "react-icons/md";
import GenericViewer from './viewer/GenericViewer';

/**
 * 소스 패널 컴포넌트
 * 파일 목록 관리, 업로드, 검색, 뷰어 등을 담당하는 메인 패널
 */
export default function SourcePanel({
  selectedBrainId,              // 현재 활성화된 프로젝트 ID
  collapsed,                  // 패널 접힘 상태
  setCollapsed,               // 패널 접힘 상태 설정 함수
  setIsSourceOpen,            // 소스 패널 열림 상태 설정 함수
  onBackFromPDF,              // PDF에서 뒤로가기 콜백
  onGraphRefresh,             // 그래프 새로고침 콜백
  onSourceCountRefresh,       // 소스 개수 새로고침 콜백
  onFocusNodeNamesUpdate,     // 포커스 노드 이름 업데이트 콜백
  focusSource,                // 포커스할 소스 정보
  onSourcePanelReady          // SourcePanel 준비 완료 콜백
}) {
  // === DOM 참조 ===
  const panelRef = useRef();                           // 패널 DOM 참조 (리사이징 감지용)
  const searchInputRef = useRef(null);                 // 검색 input 포커싱용

  // === 기본 상태 관리 ===
  const [panelWidth, setPanelWidth] = useState(0);     // 현재 패널 너비
  const [fileMap, setFileMap] = useState({});          // file_id → file 메타데이터 매핑

  // === 파일 뷰어 상태 ===
  const [openedPDF, setOpenedPDF] = useState(null);    // 열람 중인 PDF
  const [openedFile, setOpenedFile] = useState(null); // txt, md, memo 모두 이걸로
  const [showUploadModal, setShowUploadModal] = useState(false);  // 업로드 모달 표시 여부
  const [uploadKey, setUploadKey] = useState(0);       // 리렌더 트리거
  const [dataMetrics, setDataMetrics] = useState({     // 데이터 메트릭
    textLength: 0,
    nodesCount: 0,
    edgesCount: 0
  });

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
  // 데이터 메트릭 재계산 (프로젝트 변경 시)
  useEffect(() => { refreshDataMetrics(); }, [selectedBrainId, uploadKey]);

  // 외부에서 특정 소스를 클릭했을 때 처리 (focusSource 업데이트 감지)
  useEffect(() => {
    if (focusSource) {
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
    if (selectedBrainId) {
      loadAllFiles();
    }
  }, [selectedBrainId]);

  // 외부에서 특정 소스를 클릭했을 때 해당 파일 열기
  useEffect(() => {
    if (focusSource) {
      const targetFile = allFiles.find(file => {
        if (file.type === 'pdf') return file.pdf_id == focusSource.id;
        if (['txt', 'md', 'memo'].includes(file.type)) {
          if (file.type === 'txt') return file.txt_id == focusSource.id;
          if (file.type === 'md') return file.md_id == focusSource.id;
          if (file.type === 'memo') return file.memo_id == focusSource.id;
        }
        return false;
      });
      if (targetFile) {
        if (targetFile.type === 'pdf') setOpenedPDF(targetFile);
        else if (['txt', 'md', 'memo'].includes(targetFile.type)) setOpenedFile(targetFile);
        setIsSourceOpen(true);
        setLocalFocusSource(null); // 포커스 초기화
      }
    }
  }, [localFocusSource]);

  /**
   * 모든 소스(PDF, TXT, Memo) 파일들을 비동기로 불러오는 함수
   * 서버에서 파일 목록을 가져와서 allFiles 상태를 업데이트
   */
  const loadAllFiles = async () => {
    try {
      const [pdfs, txts, memos, mds] = await Promise.all([
        getPdfsByBrain(selectedBrainId),
        getTextfilesByBrain(selectedBrainId),
        getSourceMemosByBrain(selectedBrainId),
        getMDFilesByBrain(selectedBrainId)
      ]);
      // txt, memo, md를 각각 type: 'txt', 'memo', 'md'로 구분
      const merged = [
        ...pdfs.map(pdf => ({ ...pdf, title: pdf.pdf_title, type: 'pdf' })),
        ...txts.map(txt => ({ ...txt, title: txt.txt_title, type: 'txt', txt_path: txt.txt_path, txt_id: txt.txt_id })),
        ...mds.map(md => ({ ...md, title: md.md_title, type: 'md', md_path: md.md_path, md_id: md.md_id })),
        ...memos.map(memo => ({ ...memo, title: memo.memo_title, type: 'memo', memo_id: memo.memo_id }))
      ];
      setAllFiles(merged);
      setUploadKey(k => k + 1);
      onSourcePanelReady?.();
    } catch (e) {
      setAllFiles([]);
      setUploadKey(k => k + 1);
      onSourcePanelReady?.();
    }
  };

  /**
   * 데이터 메트릭 계산 함수
   * 현재 프로젝트의 텍스트 양과 그래프 데이터 양을 계산하여 상태 업데이트
   */
  const refreshDataMetrics = async () => {
    if (!selectedBrainId) return;
    try {
      const metrics = await getSourceDataMetrics(selectedBrainId);
      setDataMetrics({
        textLength: metrics.total_text_length || 0,
        nodesCount: metrics.total_nodes || 0,
        edgesCount: metrics.total_edges || 0
      });
    } catch (e) {
      setDataMetrics({ textLength: 0, nodesCount: 0, edgesCount: 0 });
    }
  };

  /**
   * 열린 파일 뷰어를 닫는 함수
   * 모든 뷰어 상태를 초기화하고 소스 패널을 닫음
   */
  const closeSource = () => {
    setOpenedPDF(null);
    setOpenedFile(null); // 통합 변수로 변경
    setIsSourceOpen(false);
    onBackFromPDF?.();
  };

  // 파일 열기 핸들러: pdf는 그대로, 나머지는 모두 openedFile로
  const handleOpenFile = (id, type) => {
    let file;
    if (type === 'txt') file = allFiles.find(f => f.type === 'txt' && String(f.txt_id) === String(id));
    else if (type === 'md') file = allFiles.find(f => f.type === 'md' && String(f.md_id) === String(id));
    else if (type === 'memo') file = allFiles.find(f => f.type === 'memo' && String(f.memo_id) === String(id));
    else if (type === 'pdf') file = allFiles.find(f => f.type === 'pdf' && String(f.pdf_id) === String(id));
    if (file) {
      if (type === 'pdf') setOpenedPDF(file);
      else setOpenedFile(file);
      setIsSourceOpen(true);
    } else {
      alert('파일을 찾을 수 없습니다.');
    }
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
            {(!openedPDF && !openedFile) && (
              <div className="action-buttons">
                {/* 소스 추가 버튼 (아이콘/텍스트 토글) */}
                <button
                  className={`pill-button ${panelWidth < PANEL_WIDTH_THRESHOLD_SOURCE ? 'icon-only' : ''}`}
                  onClick={() => setShowUploadModal(true)}
                >
                  {panelWidth < 250
                    ? <MdOutlineDriveFolderUpload size={25} />
                    : <>
                      <span style={{ fontSize: '1.2em', fontWeight: 500, verticalAlign: 'middle', marginTop: '1px' }}>＋</span>
                      <span style={{ fontSize: '1.08em', fontWeight: 600, verticalAlign: 'middle' }}>소스</span>
                    </>}
                </button>
                {/* 탐색 버튼 (panelWidth < 250이면 아이콘만, 아니면 아이콘+텍스트) */}
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
                    ? <MdSearch size={25} style={{ verticalAlign: 'middle' }} />
                    : <>
                      <MdSearch size={15} style={{ verticalAlign: 'middle', marginTop: '1px', color: 'black' }} />
                      <span style={{ fontSize: '1.08em', fontWeight: 600, verticalAlign: 'middle' }}>탐색</span>
                    </>}
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
                  const res = await getSimilarSourceIds(searchText, selectedBrainId);
                  const ids = (res.source_ids || []).map(id => String(id));
                  setFilteredSourceIds(ids);
                } catch (err) {
                  alert('검색 중 오류 발생');
                }
              }}
              style={{ padding: '10px 16px' }}
            >
              <style>{`input::placeholder { color: #888; }`}</style>
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
            ) : openedFile ? (
              // TXT/MD/기타 텍스트 뷰어
              <div className="pdf-viewer-wrapper" style={{ height: '100%' }}>
                <GenericViewer
                  type={openedFile.type}
                  fileUrl={
                    openedFile.type === 'txt' ? `http://localhost:8000/${openedFile.txt_path}` :
                      openedFile.type === 'md' ? `http://localhost:8000/${openedFile.md_path}` :
                        undefined
                  }
                  memoId={openedFile.type === 'memo' ? openedFile.memo_id : undefined}
                  onBack={closeSource}
                />
              </div>
            ) : (
              // 파일 목록 뷰 (FileView 컴포넌트)
              <FileView
                brainId={selectedBrainId}
                files={allFiles}
                onOpenFile={handleOpenFile}
                setFileMap={setFileMap}
                refreshTrigger={uploadKey}
                onGraphRefresh={() => {
                  onGraphRefresh?.();
                  refreshDataMetrics();
                  loadAllFiles();
                }}
                onSourceCountRefresh={onSourceCountRefresh}
                onFocusNodeNamesUpdate={onFocusNodeNamesUpdate}
                filteredSourceIds={filteredSourceIds}
                searchText={searchText}
                onFileUploaded={loadAllFiles} // 파일 업로드 완료 시 목록 즉시 갱신
              />
            )}
          </div >
        </>
      )}
      {/* === 소스 업로드 모달 === */}
      <SourceUploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={async filePaths => {
          try {
            if (!filePaths || filePaths.length === 0) return;
            let fileObjs = [];
            if (window.api && window.api.readFilesAsBuffer) {
              const filesData = await window.api.readFilesAsBuffer(filePaths);
              fileObjs = filesData.map(fd => new File([new Uint8Array(fd.buffer)], fd.name));
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
                const result = await fileHandlers[ext](f, selectedBrainId);
                if (result && result.meta) uploadedFiles.push(result.meta);
              } catch (err) {
                alert(f.name + ' 업로드 실패: ' + err.message);
              } finally {
                setUploadQueue(q => q.filter(item => item.key !== key));
              }
            }
            await loadAllFiles();
            setUploadKey(k => k + 1);
            await refreshDataMetrics();
            setFileMap(prev => {
              const m = { ...prev };
              uploadedFiles.forEach(file => {
                if (file.pdf_id) m[file.pdf_id] = file;
                else if (file.text_id) m[file.text_id] = file; // text_id로 변경
              });
              return m;
            });
            onGraphRefresh?.();
            onSourceCountRefresh?.();
            if (uploadedFiles.length > 0) {
              const last = uploadedFiles[uploadedFiles.length - 1];
              if (last.pdf_id) setPendingFocusSource({ id: last.pdf_id, type: 'pdf' });
              else if (last.text_id) setPendingFocusSource({ id: last.text_id, type: 'text' }); // text_id로 변경
            }
            setShowUploadModal(false);
          } catch (e) {
            alert('파일 업로드 실패');
          }
        }}
      />
      {/* KnowledgeGraphStatusBar: 소스가 열려있지 않을 때만 표시 */}
      {!collapsed && !openedPDF && !openedFile && ( // 통합 변수로 변경
        <KnowledgeGraphStatusBar
          textLength={dataMetrics.textLength}
          nodesCount={dataMetrics.nodesCount}
          edgesCount={dataMetrics.edgesCount}
        />
      )}
    </div >
  );
}
