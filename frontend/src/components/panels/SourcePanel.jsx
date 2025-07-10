import React, { useState, useEffect, useRef } from 'react';
import {
  listBrainFolders,
  createFolder,
  createMemo,
  createPdf,
  createTextFile,
  createVoice,
  getPdfsByBrain,
  getTextfilesByBrain,
  getVoicesByBrain,
  getSimilarSourceIds
} from '../../../../backend/services/backend';
import FileView from '../panels/FileView';
import PDFViewer from '../panels/PDFViewer';
import TxtViewer from '../panels/TxtViewer';
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
function normalizeApiTree(apiFolders = []) {
  return apiFolders.map(folder => ({
    type: 'folder',
    folder_id: folder.folder_id,
    name: folder.folder_name,
    children: (folder.memos || []).map(memo => ({
      type: 'file',
      memo_id: memo.memo_id,
      name: memo.memo_title
    }))
  }));
}
export default function SourcePanel({
  activeProject,
  collapsed,
  setCollapsed,
  setIsPDFOpen,
  onBackFromPDF,
  onGraphRefresh,
  onFocusNodeNamesUpdate,
  focusSource,
  onSourceCountChange
}) {
  const panelRef = useRef();
  const [panelWidth, setPanelWidth] = useState(0);
  const [folderTree, setFolderTree] = useState([]);
  const [fileMap, setFileMap] = useState({});
  const [openedPDF, setOpenedPDF] = useState(null);
  const [showAddFolderInput, setShowAddFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [openedTXT, setOpenedTXT] = useState(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredSourceIds, setFilteredSourceIds] = useState(null); // null이면 전체 표시
  const searchInputRef = useRef(null);  // 검색 input 포커싱용
  const [allFiles, setAllFiles] = useState([]);
  const [localFocusSource, setLocalFocusSource] = useState(null);

  useEffect(() => {
    if (activeProject) {
      loadAllFiles();
    }
  }, [activeProject]);

  useEffect(() => {
    if (focusSource) {
      setLocalFocusSource(focusSource); // 최신 클릭 반영
    }
  }, [focusSource]);

  const loadAllFiles = async () => {
    try {
      const [pdfs, txts] = await Promise.all([
        getPdfsByBrain(activeProject),
        getTextfilesByBrain(activeProject)
      ]);
      const merged = [
        ...pdfs.map(pdf => ({ ...pdf, title: pdf.pdf_title })),
        ...txts.map(txt => ({ ...txt, title: txt.txt_title }))
      ];
      setAllFiles(merged);
    } catch (e) {
      console.error('파일 목록 로딩 실패', e);
      setAllFiles([]);
    }
  };

  useEffect(() => {
    if (focusSource) {
      const targetFile = allFiles.find(file => {
        if (file.type === 'pdf') return file.pdf_id == focusSource.id;
        if (file.type === 'txt') return file.txt_id == focusSource.id;
        return false;
      });

      if (targetFile) {
        if (targetFile.type === 'pdf') {
          setOpenedPDF(targetFile);
          setIsPDFOpen(true);
        } else if (targetFile.type === 'txt') {
          setOpenedTXT(targetFile);
          setIsPDFOpen(true);
        }
        setLocalFocusSource(null);
      }
    }
  }, [localFocusSource]);

  useEffect(() => {
    if (!panelRef.current) return;
    const ro = new ResizeObserver(() => {
      setPanelWidth(panelRef.current.offsetWidth);
    });
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, []);

  const refresh = async () => {
    if (!activeProject) return;
    try {
      const api = await listBrainFolders(activeProject);
      setFolderTree(normalizeApiTree(Array.isArray(api) ? api : []));
    } catch (e) {
      console.error('폴더/메모 로드 실패', e);
      setFolderTree([]);
    }
  };

  useEffect(() => {
    refresh();
  }, [activeProject]);

  // 소스(파일) 카운트 계산
  const refreshSourceCount = async () => {
    if (!activeProject) return;
    try {
      const [
        pdfRoot, pdfNested,
        txtRoot, txtNested,
        voiceRoot, voiceNested
      ] = await Promise.all([
        // PDF
        getPdfsByBrain(activeProject),        // folder_id IS NULL
        getPdfsByBrain(activeProject, 1),     // folder_id IS NOT NULL (1은 아무 숫자)
        // TXT
        getTextfilesByBrain(activeProject),   // folder_id IS NULL
        getTextfilesByBrain(activeProject, 1),// folder_id IS NOT NULL
        // Voice
        getVoicesByBrain(activeProject),      // folder_id IS NULL
        getVoicesByBrain(activeProject, 1)    // folder_id IS NOT NULL
      ]);

      const totalCount =
        pdfRoot.length + pdfNested.length +
        txtRoot.length + txtNested.length +
        voiceRoot.length + voiceNested.length;

      setSourceCount(totalCount);
      onSourceCountChange?.(totalCount); // ✅ MainLayout로 전달
    } catch (e) {
      console.error('소스 카운트 오류', e);
      setSourceCount(0);
    }
  };

  // 마운트 시와 uploadKey 변경 시 재계산
  useEffect(() => {
    refreshSourceCount();
  }, [activeProject, uploadKey]);

  const handleAddFolder = async e => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await createFolder(name, activeProject);
      setNewFolderName('');
      setShowAddFolderInput(false);
      await refresh();
      setUploadKey(k => k + 1);
    } catch {
      alert('폴더 생성 실패');
    }
  };

  const closePDF = () => {
    setOpenedPDF(null);
    setOpenedTXT(null);
    setIsPDFOpen(false);
    onBackFromPDF?.();
  };

  return (
    <div
      ref={panelRef}
      className={`panel-container modern-panel ${collapsed ? 'collapsed' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div
        className="panel-header"
        style={{ justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center' }}
      >
        {!collapsed && <span className="header-title">Source</span>}

        <div className="header-right-icons" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            {(!openedPDF && !openedTXT) && (
              <div className="action-buttons">
                <button
                  className={`pill-button ${panelWidth < 250 ? 'icon-only' : ''}`}
                  onClick={() => setShowAddFolderInput(true)}
                >
                  {panelWidth < 250
                    ? <TbFolderPlus size={25} />
                    : <>＋ 폴더</>}
                </button>
                <button
                  className={`pill-button ${panelWidth < 220 ? 'icon-only' : ''}`}
                  onClick={() => setShowUploadModal(true)}
                >
                  {panelWidth < 250
                    ? <TbCylinderPlus size={25} />
                    : <>＋ 소스</>}
                </button>
              </div>

            )}

          </div>
          {showSearchInput && (
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!searchText.trim()) return;
                console.log("🔍 검색 요청", {
                  query: searchText,
                  brain_id: activeProject
                });

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
                {`
                  input::placeholder {
                    color: #888; /* 원하는 색상 */
                  }
                `}
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

          {showAddFolderInput && (
            <form className="add-form fancy-form" onSubmit={handleAddFolder}>
              <input
                autoFocus
                placeholder="새 폴더 이름"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}

              />
              <div className="form-buttons">
                <button type="submit" className="primary">추가</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowAddFolderInput(false)}
                >
                  취소
                </button>
              </div>
            </form>
          )}

          <div className="panel-content" style={{ flexGrow: 1, overflow: 'auto' }}>
            {openedPDF ? (
              <div className="pdf-viewer-wrapper" style={{ height: '100%' }}>
                <PDFViewer file={`http://localhost:8000/${openedPDF.pdf_path}`} containerWidth={panelWidth}
                  onBack={closePDF} />
              </div>
            ) : openedTXT ? (
              <div className="pdf-viewer-wrapper" style={{ height: '100%' }}>
                <TxtViewer fileUrl={`http://localhost:8000/${openedTXT.txt_path}`} onBack={closePDF} />
              </div>
            ) : (
              <FileView
                brainId={activeProject}
                files={folderTree}
                setFiles={setFolderTree}
                onOpenPDF={file => {
                  setOpenedPDF(file);
                  setIsPDFOpen(true);
                }}
                onOpenTXT={file => {
                  setOpenedTXT(file);
                  setIsPDFOpen(true);
                }}
                fileMap={fileMap}
                setFileMap={setFileMap}
                refreshTrigger={uploadKey}
                onGraphRefresh={() => {
                  onGraphRefresh?.();
                  // 소스 수 갱신
                  refreshSourceCount();
                }}
                onFocusNodeNamesUpdate={onFocusNodeNamesUpdate}
                filteredSourceIds={filteredSourceIds}
              />
            )
            }
          </div >
        </>
      )
      }

      <SourceUploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={async uploadedFiles => {
          try {
            // 서버에 저장된 PDF 메타데이터로 목록만 갱신
            await refresh();                    // getPdfsByBrain으로 새로고침
            setUploadKey(k => k + 1);

            // fileMap에 pdf_id → PdfResponse 매핑
            setFileMap(prev => {
              const m = { ...prev };
              uploadedFiles.forEach(file => {
                if (file.pdf_id) m[file.pdf_id] = file;
                else if (file.txt_id) m[file.txt_id] = file;
                else if (file.voice_id) m[file.voice_id] = file;
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
