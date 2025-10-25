/**
 * SourcePanel 컴포넌트
 *
 * 이 컴포넌트는 브레인 프로젝트의 소스 파일 관리 기능을 제공합니다.
 * 주요 기능:
 * - 다양한 파일 타입 지원 (PDF, TXT, MD, DOCX, Memo)
 * - 파일 업로드 및 관리
 * - 실시간 검색 기능
 * - 파일 뷰어 통합 (GenericViewer)
 * - 반응형 UI (패널 크기에 따른 버튼 표시 변경)
 * - 데이터 메트릭 표시
 * - 외부에서의 파일 포커스 지원
 *
 * Props:
 * - selectedBrainId: 선택된 브레인 ID
 * - collapsed: 패널 축소 상태
 * - setCollapsed: 패널 축소 상태 설정 함수
 * - setIsSourceOpen: 소스 패널 열림 상태 설정 함수
 * - onBackFromSource: 소스에서 뒤로가기 콜백
 * - onGraphRefresh: 그래프 새로고침 콜백
 * - onSourceCountRefresh: 소스 개수 새로고침 콜백
 * - onFocusNodeNamesUpdate: 포커스 노드 이름 업데이트 콜백
 * - focusSource: 포커스할 소스 정보
 * - highlightingInfo: 하이라이팅 정보
 * - onSourcePanelReady: SourcePanel 준비 완료 콜백
 * - openSourceId: 열릴 소스 ID
 * - isNodeViewLoading: 노드 뷰 로딩 상태
 * - setIsNodeViewLoading: 노드 뷰 로딩 상태 설정 함수
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  getPdfsByBrain,
  getTextfilesByBrain,
  getSimilarSourceIds,
  getSourceMemosByBrain,
  getMDFilesByBrain,
  getSourceDataMetrics,
  getDocxFilesByBrain,
} from '../../../../api/config/apiIndex';
import { toast } from 'react-toastify';
import FileView from './FileView';
import KnowledgeGraphStatusBar from './KnowledgeGraphStatusBar';
import {
  VscLayoutSidebarRightOff,
  VscLayoutSidebarLeftOff,
} from 'react-icons/vsc';
import './SourcePanel.css';
import { MdSearch } from 'react-icons/md';
import { MdOutlineDriveFolderUpload } from 'react-icons/md';
import GenericViewer from './viewer/GenericViewer';

/**
 * 파일 타입별 메타데이터 추출 함수 맵
 * 각 파일 타입에 대해 ID, 제목, 경로를 추출하는 함수들을 정의
 */
const TYPE_META = {
  pdf: {
    id: (f) => f.pdf_id,
    title: (f) => f.pdf_title,
    path: (f) => f.pdf_path,
  },
  txt: {
    id: (f) => f.txt_id,
    title: (f) => f.txt_title,
    path: (f) => f.txt_path,
  },
  md: {
    id: (f) => f.md_id,
    title: (f) => f.md_title,
    path: (f) => f.md_path,
  },
  docx: {
    id: (f) => f.docx_id,
    title: (f) => f.docx_title,
    path: (f) => f.docx_path,
  },
  memo: {
    id: (f) => f.memo_id,
    title: (f) => f.memo_title,
    path: () => undefined,
  },
};

/**
 * 반응형 UI 설정 상수
 */
const RESPONSIVE_THRESHOLDS = {
  SEARCH: 250, // 탐색 버튼 텍스트/아이콘 기준
  SOURCE: 220, // 소스 버튼 텍스트/아이콘 기준
};

export default function SourcePanel({
  selectedBrainId,
  collapsed,
  setCollapsed,
  setIsSourceOpen,
  onBackFromSource,
  onGraphRefresh,
  onSourceCountRefresh,
  onFocusNodeNamesUpdate,
  focusSource,
  highlightingInfo,
  onSourcePanelReady,
  openSourceId,
  isNodeViewLoading,
  setIsNodeViewLoading,
}) {
  // === DOM 참조 ===
  const panelRef = useRef(); // 패널 DOM 참조 (리사이징 감지용)
  const searchInputRef = useRef(null); // 검색 input 포커싱용

  // === 기본 상태 관리 ===
  const [panelWidth, setPanelWidth] = useState(0); // 현재 패널 너비
  const [fileMap, setFileMap] = useState({}); // file_id → file 메타데이터 매핑

  // === 파일 뷰어 상태 ===
  const [openedFile, setOpenedFile] = useState(null); // 모든 파일 타입 통합
  const [uploadKey, setUploadKey] = useState(0); // 리렌더 트리거
  const [dataMetrics, setDataMetrics] = useState({
    // 데이터 메트릭
    textLength: 0,
    nodesCount: 0,
    edgesCount: 0,
  });

  // === 검색 관련 상태 ===
  const [showSearchInput, setShowSearchInput] = useState(false); // 검색창 표시 여부
  const [searchText, setSearchText] = useState(''); // 검색 텍스트
  const [filteredSourceIds, setFilteredSourceIds] = useState(null); // 검색 필터링된 id 리스트

  // === 파일 목록 및 포커스 상태 ===
  const [allFiles, setAllFiles] = useState([]); // 모든 파일 리스트 (PDF, TXT, MEMO)
  const [localFocusSource, setLocalFocusSource] = useState(null); // 클릭 포커스 대상
  const [pendingFocusSource, setPendingFocusSource] = useState(null); // 업로드 후 포커스 대상
  const [externalUploadQueue, setExternalUploadQueue] = useState([]); // 외부에서 전달할 업로드 큐

  // === useEffect 훅들 ===

  /**
   * 데이터 메트릭 재계산 (프로젝트 변경 시)
   */
  useEffect(() => {
    refreshDataMetrics();
  }, [selectedBrainId, uploadKey]);

  /**
   * 외부에서 특정 소스를 클릭했을 때 처리 (focusSource 업데이트 감지)
   */
  useEffect(() => {
    if (focusSource) {
      setLocalFocusSource(focusSource); // 최신 클릭 반영
    }
    if (pendingFocusSource) {
      setLocalFocusSource(pendingFocusSource);
      setPendingFocusSource(null);
    }
  }, [focusSource, pendingFocusSource]);

  /**
   * 패널 너비 추적용 ResizeObserver 등록
   */
  useEffect(() => {
    if (!panelRef.current) return;
    const ro = new ResizeObserver(() => {
      setPanelWidth(panelRef.current.offsetWidth);
    });
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, []);

  /**
   * 프로젝트가 변경되면 모든 파일 로드 (PDF, TXT, Memo)
   */
  useEffect(() => {
    if (selectedBrainId) {
      loadAllFiles();
    }
    setOpenedFile(null);
    // 프로젝트 변경 시 검색 상태 초기화
    setShowSearchInput(false);
    setSearchText('');
    setFilteredSourceIds(null);
  }, [selectedBrainId]);

  /**
   * 외부에서 특정 소스를 클릭했을 때 해당 파일 열기
   */
  useEffect(() => {
    if (focusSource) {
      const targetFile = allFiles.find(
        (f) => String(TYPE_META[f.type]?.id(f)) === String(focusSource.id)
      );
      if (targetFile) {
        setOpenedFile(targetFile);
        setIsSourceOpen(true);
        setLocalFocusSource(null); // 포커스 초기화
        // 외부에서 소스 클릭 시 검색 상태 초기화
        setShowSearchInput(false);
        setSearchText('');
        setFilteredSourceIds(null);
      } else {
        // 파일이 없는 경우 toast 메시지
        toast.error('해당 소스 파일이 삭제되었거나 존재하지 않습니다.');
      }
    }
  }, [localFocusSource]);

  /**
   * 모든 소스(PDF, TXT, Memo) 파일들을 비동기로 불러오는 함수
   * 서버에서 파일 목록을 가져와서 allFiles 상태를 업데이트
   */
  const loadAllFiles = async () => {
    try {
      const [pdfs, txts, memos, mds, docxfiles] = await Promise.all([
        getPdfsByBrain(selectedBrainId),
        getTextfilesByBrain(selectedBrainId),
        getSourceMemosByBrain(selectedBrainId),
        getMDFilesByBrain(selectedBrainId),
        getDocxFilesByBrain(selectedBrainId),
      ]);

      // TYPE_META를 활용해 merged 생성
      const merged = [
        ...pdfs.map((pdf) => ({
          ...pdf,
          title: TYPE_META.pdf.title(pdf),
          type: 'pdf',
          pdf_id: TYPE_META.pdf.id(pdf),
          pdf_path: TYPE_META.pdf.path(pdf),
        })),
        ...txts.map((txt) => ({
          ...txt,
          title: TYPE_META.txt.title(txt),
          type: 'txt',
          txt_id: TYPE_META.txt.id(txt),
          txt_path: TYPE_META.txt.path(txt),
        })),
        ...mds.map((md) => ({
          ...md,
          title: TYPE_META.md.title(md),
          type: 'md',
          md_id: TYPE_META.md.id(md),
          md_path: TYPE_META.md.path(md),
        })),
        ...memos.map((memo) => ({
          ...memo,
          title: TYPE_META.memo.title(memo),
          type: 'memo',
          memo_id: TYPE_META.memo.id(memo),
        })),
        ...docxfiles.map((docx) => ({
          ...docx,
          title: TYPE_META.docx.title(docx),
          type: 'docx',
          docx_id: TYPE_META.docx.id(docx),
          docx_path: TYPE_META.docx.path(docx),
        })),
      ];
      setAllFiles(merged);
      setUploadKey((k) => k + 1);
      onSourcePanelReady?.();
    } catch (e) {
      setAllFiles([]);
      setUploadKey((k) => k + 1);
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
        edgesCount: metrics.total_edges || 0,
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
    setOpenedFile(null);
    setIsSourceOpen(false);
    // 소스 닫을 때 검색 상태 초기화
    setShowSearchInput(false);
    setSearchText('');
    setFilteredSourceIds(null);
    onBackFromSource?.();
  };

  /**
   * 파일 열기 핸들러: 모든 파일 타입을 통합 처리
   * @param {string} id - 파일 ID
   * @param {string} type - 파일 타입 (pdf, txt, md, docx, memo)
   */
  const handleOpenFile = (id, type) => {
    // 파일 타입에 따라 ID 필드명 결정
    const idFieldMap = {
      pdf: 'pdf_id',
      txt: 'txt_id',
      md: 'md_id',
      docx: 'docx_id',
      memo: 'memo_id',
    };

    const idField = idFieldMap[type] || 'id';

    const file = allFiles.find((f) => {
      const fileId = f[idField];
      const matches = f.type === type && String(fileId) === String(id);
      return matches;
    });

    if (file) {
      setOpenedFile(file);
      setIsSourceOpen(true);
      // 파일 열 때 검색 상태 초기화
      setShowSearchInput(false);
      setSearchText('');
      setFilteredSourceIds(null);
    } else {
      console.log('파일을 찾을 수 없음:', { id, type, allFiles });
      alert('파일을 찾을 수 없습니다.');
    }
  };

  /**
   * 파일 선택 핸들러
   * Electron 환경과 웹 브라우저 환경을 모두 지원
   */
  const handleFileSelect = async () => {
    try {
      let filePaths = [];
      if (window.api && window.api.openFileDialog) {
        // Electron 환경
        filePaths = await window.api.openFileDialog();
      } else {
        // 웹 브라우저 환경 - HTML5 file input 사용
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.pdf,.txt,.md,.docx';

        input.onchange = async (event) => {
          const files = Array.from(event.target.files);
          if (files.length > 0) {
            await processSelectedFiles(files);
          }
        };

        input.click();
        return;
      }

      if (filePaths && filePaths.length > 0) {
        // Electron 환경에서 파일 경로를 File 객체로 변환
        if (window.api && window.api.readFilesAsBuffer) {
          const filesData = await window.api.readFilesAsBuffer(filePaths);
          const fileObjs = filesData.map(
            (fd) => new File([new Uint8Array(fd.buffer)], fd.name)
          );
          await processSelectedFiles(fileObjs);
        }
      }
    } catch (e) {
      console.error('파일 선택 오류:', e);
    }
  };

  /**
   * 선택된 파일 처리 함수
   * @param {File[]} fileObjs - 선택된 파일 객체 배열
   */
  const processSelectedFiles = async (fileObjs) => {
    try {
      const uploadItems = [];
      for (const f of fileObjs) {
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['pdf', 'txt', 'md', 'docx'].includes(ext)) continue;

        const key = `${f.name}-${f.size || 0}-${ext}`;
        uploadItems.push({
          key,
          name: f.name,
          filetype: ext,
          status: 'processing',
          fileObj: f,
        });
      }

      if (uploadItems.length > 0) {
        setExternalUploadQueue(uploadItems);
      }
    } catch (e) {
      console.error('파일 처리 오류:', e);
    }
  };

  /**
   * 검색 입력창 토글 핸들러
   */
  const handleSearchToggle = () => {
    setShowSearchInput((prev) => {
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
  };

  /**
   * 검색 폼 제출 핸들러
   */
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    try {
      const res = await getSimilarSourceIds(searchText, selectedBrainId);
      const ids = (res.source_ids || []).map((id) => String(id));
      setFilteredSourceIds(ids);
    } catch (err) {
      alert('검색 중 오류 발생');
    }
  };

  /**
   * 검색 텍스트 변경 핸들러
   */
  const handleSearchTextChange = (e) => {
    const text = e.target.value;
    setSearchText(text);
    if (text.trim() === '') {
      setFilteredSourceIds(null); // 검색어 지워졌을 때 전체 보여주기
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
        style={{
          justifyContent: collapsed ? 'center' : 'space-between',
          alignItems: 'center',
        }}
      >
        {!collapsed && <span className="header-title">Source</span>}
        <div
          className="header-right-icons"
          style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          {/* 사이드패널 접기/펴기 버튼 */}
          {collapsed ? (
            <VscLayoutSidebarLeftOff
              size={18}
              style={{ cursor: 'pointer' }}
              onClick={() => setCollapsed((prev) => !prev)}
            />
          ) : (
            <VscLayoutSidebarRightOff
              size={18}
              style={{ cursor: 'pointer' }}
              onClick={() => setCollapsed((prev) => !prev)}
            />
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div>
            {/* 소스가 열려있지 않을 때만 표시 */}
            {!openedFile && (
              <div className="action-buttons">
                {/* 소스 추가 버튼 (아이콘/텍스트 토글) */}
                <button
                  className={`pill-button ${
                    panelWidth < RESPONSIVE_THRESHOLDS.SOURCE ? 'icon-only' : ''
                  }`}
                  onClick={handleFileSelect}
                >
                  {panelWidth < 250 ? (
                    <MdOutlineDriveFolderUpload size={25} />
                  ) : (
                    <>
                      <span
                        style={{
                          fontSize: '1.2em',
                          fontWeight: 500,
                          verticalAlign: 'middle',
                          marginTop: '1px',
                        }}
                      >
                        ＋
                      </span>
                      <span
                        style={{
                          fontSize: '1.08em',
                          fontWeight: 600,
                          verticalAlign: 'middle',
                        }}
                      >
                        소스
                      </span>
                    </>
                  )}
                </button>
                {/* 탐색 버튼 (panelWidth < 250이면 아이콘만, 아니면 아이콘+텍스트) */}
                <button
                  className={`pill-button${showSearchInput ? ' active' : ''} ${
                    panelWidth < RESPONSIVE_THRESHOLDS.SEARCH ? 'icon-only' : ''
                  }`}
                  onClick={handleSearchToggle}
                >
                  {panelWidth < 250 ? (
                    <MdSearch size={25} style={{ verticalAlign: 'middle' }} />
                  ) : (
                    <>
                      <MdSearch
                        size={15}
                        style={{
                          verticalAlign: 'middle',
                          marginTop: '1px',
                          color: 'black',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '1.08em',
                          fontWeight: 600,
                          verticalAlign: 'middle',
                        }}
                      >
                        탐색
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 검색창 표시 여부에 따라 입력창 렌더링 */}
          {showSearchInput && (
            <form
              onSubmit={handleSearchSubmit}
              style={{ padding: '10px 16px' }}
            >
              <style>{`input::placeholder { color: #888; }`}</style>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="설명이나 키워드를 입력하세요"
                value={searchText}
                onChange={handleSearchTextChange}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  backgroundColor: '#f9f9f9',
                  color: 'black',
                }}
              />
            </form>
          )}

          {/* === 메인 콘텐츠 영역 === */}
          <div
            className="panel-content"
            style={{ flexGrow: 1, overflow: 'auto' }}
          >
            {openedFile ? (
              // 모든 파일 타입을 GenericViewer로 통합 처리
              <div className="pdf-viewer-wrapper" style={{ height: '100%' }}>
                <GenericViewer
                  type={openedFile.type}
                  fileUrl={
                    openedFile.type === 'txt'
                      ? `http://localhost:8000/${openedFile.txt_path}`
                      : openedFile.type === 'md'
                      ? `http://localhost:8000/${openedFile.md_path}`
                      : openedFile.type === 'docx'
                      ? `http://localhost:8000/${openedFile.docx_path}`
                      : openedFile.type === 'pdf'
                      ? `http://localhost:8000/${openedFile.pdf_path}`
                      : undefined
                  }
                  memoId={
                    openedFile.type === 'memo' ? openedFile.memo_id : undefined
                  }
                  onBack={closeSource}
                  title={openedFile.title}
                  docxId={
                    openedFile.type === 'docx' ? openedFile.docx_id : undefined
                  }
                  pdfId={
                    openedFile.type === 'pdf' ? openedFile.pdf_id : undefined
                  }
                  txtId={
                    openedFile.type === 'txt' ? openedFile.txt_id : undefined
                  }
                  mdId={openedFile.type === 'md' ? openedFile.md_id : undefined}
                  highlightingInfo={highlightingInfo}
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
                onFocusNodeNamesUpdate={async (names) => {
                  if (onFocusNodeNamesUpdate) {
                    await onFocusNodeNamesUpdate(names);
                  }
                  setIsNodeViewLoading(null); // 실제로 부모까지 전달 후 스피너 해제
                }}
                filteredSourceIds={filteredSourceIds}
                searchText={searchText}
                onFileUploaded={loadAllFiles}
                isNodeViewLoading={isNodeViewLoading}
                setIsNodeViewLoading={setIsNodeViewLoading}
                externalUploadQueue={externalUploadQueue}
                setExternalUploadQueue={setExternalUploadQueue}
              />
            )}
          </div>
        </>
      )}

      {/* KnowledgeGraphStatusBar: 소스가 열려있지 않을 때만 표시 */}
      {!collapsed && !openedFile && (
        <KnowledgeGraphStatusBar
          textLength={dataMetrics.textLength}
          nodesCount={dataMetrics.nodesCount}
          edgesCount={dataMetrics.edgesCount}
        />
      )}
    </div>
  );
}
