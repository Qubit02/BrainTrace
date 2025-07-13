// src/components/panels/FileView.jsx
import React, { useState, useEffect } from 'react'
import { pdfjs } from 'react-pdf';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
import './styles/Common.css'
import './styles/SourcePanel.css'
import './styles/Scrollbar.css'
import './styles/FileView.css'
import FileIcon from './FileIcon'
import { TiUpload } from 'react-icons/ti'
import { GoPencil } from 'react-icons/go';
import { RiDeleteBinLine } from 'react-icons/ri';
import { processText, deleteDB } from '../../api/graphApi';
import { fetchGraphData } from '../../api/graphApi';
import ConfirmDialog from '../ConfirmDialog'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { AiOutlineNodeIndex } from "react-icons/ai";
import {
  getPdfsByBrain,
  getTextfilesByBrain,
  getMemosByBrain,
  getSourceMemosByBrain,
  setMemoAsSource,
  uploadPdfs,
  createPdf,
  createTextFile,
  createMemo,
  setMemoAsNotSource,
  deletePdf,
  deleteTextFile,
  updatePdf,
  updateTextFile,
  updateMemo,
  createTextToGraph,
  uploadTextfiles,
  getNodesBySourceId
} from '../../../../backend/services/backend'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

// 메모 텍스트를 그래프 지식으로 변환하는 함수
async function processMemoTextAsGraph(content, sourceId, brainId) {
  try {
    const response = await processText(content, String(sourceId), String(brainId));
    console.log("✅ 그래프 생성 완료:", response);
  } catch (error) {
    console.error("❌ 그래프 생성 실패:", error);
  }
}

export default function FileView({
  brainId,
  files = [],
  onOpenPDF,
  onOpenTXT,
  onOpenMEMO,
  fileMap = {},
  setFileMap = () => { },
  refreshTrigger,
  onGraphRefresh,
  onFocusNodeNamesUpdate,
  filteredSourceIds
}) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isRootDrag, setIsRootDrag] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [fileToDelete, setFileToDelete] = useState(null);
  const [uploadQueue, setUploadQueue] = useState([])

  // 보여줄 파일 리스트를 계산: filteredSourceIds가 존재하면 해당 ID만 필터링
  const displayedFiles = filteredSourceIds
    ? files.filter(f => {
      const id = f.memo_id || f.pdf_id || f.txt_id;
      return filteredSourceIds.includes(String(id));
    })
    : files;

  // 파일 구조를 FileView에서 사용하는 형태로 변환
  const processedFiles = displayedFiles.map(f => {
    if (f.type === 'pdf') {
      return {
        id: f.pdf_id,
        filetype: 'pdf',
        name: f.pdf_title || f.title,
        meta: f
      };
    } else if (f.type === 'txt') {
      return {
        id: f.txt_id,
        filetype: 'txt',
        name: f.txt_title || f.title,
        meta: f
      };
    } else if (f.type === 'memo') {
      return {
        id: f.memo_id,
        filetype: 'memo',
        name: f.memo_title || f.title,
        meta: f
      };
    }
    return f;
  });

  useEffect(() => {
    refresh();
  }, [brainId, refreshTrigger]);

  useEffect(() => {
    const closeMenu = () => setMenuOpenId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const refresh = async () => {
    if (!brainId) return;
    try {
      // 1) 브레인 기준 전체 파일 조회
      const [pdfs, txts, memos] = await Promise.all([
        getPdfsByBrain(brainId),
        getTextfilesByBrain(brainId),
        getMemosByBrain(brainId),
      ]);

      // 2) fileMap 갱신 - 각 파일 ID를 키로 하여 메타데이터를 빠르게 참조 가능하게 구성
      setFileMap(prev => {
        const m = { ...prev };
        pdfs.forEach(p => { m[p.pdf_id] = p; });
        txts.forEach(t => { m[t.txt_id] = t; });
        memos.forEach(memo => { m[memo.memo_id] = memo; });
        return m;
      });

    } catch (err) {
      console.error('파일 목록 로딩 실패:', err);
    }
  };

  // 파일을 업로드하고 그래프를 생성하는 함수
  // PDF, TXT, MEMO만 처리하며, 그 외 확장자는 무시
  const createFileByType = async (f) => {
    const ext = f.name.split('.').pop().toLowerCase();  // 확장자 추출

    // --- PDF ---
    if (ext === 'pdf') {
      // 1) PDF 파일 업로드
      const [meta] = await uploadPdfs([f], brainId);

      // 2) 텍스트 추출
      const arrayBuffer = await f.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let content = '';
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        content += textContent.items.map(item => item.str).join(' ') + '\n\n';
      }

      // 3) 그래프 생성
      await createTextToGraph({
        text: content,
        brain_id: String(brainId),
        source_id: String(meta.pdf_id),
      });

      return { id: meta.pdf_id, filetype: 'pdf', meta };
    }

    // --- TXT 파일 처리 ---
    else if (ext === 'txt') {
      // 1) 업로드 (pdf와 동일한 방식)
      const [meta] = await uploadTextfiles([f], brainId);

      // 2) 파일 내용 추출 후 그래프 생성
      const content = await f.text();

      await createTextToGraph({
        text: content,
        brain_id: String(brainId),
        source_id: String(meta.txt_id),
      });

      return { id: meta.txt_id, filetype: 'txt', meta };

    }

    // --- MEMO 파일 처리 ---
    else if (ext === 'memo') {
      const content = await f.text();

      // 예시: 메모 생성 API 호출 (FastAPI 기준)
      const res = await createMemo({
        memo_title: f.name.replace(/\.memo$/, ''),
        memo_text: content,
        is_source: true,
        brain_id: brainId,
        type: 'memo',
      });

      return { id: res.memo_id, filetype: 'memo', meta: res };
    }

    // --- 허용되지 않은 확장자: 무시 ---
    else {
      console.warn(`❌ 지원되지 않는 파일 형식: .${ext}`);
      return null;
    }
  }

  // 소스를 삭제하는 함수 (PDF, TXT, MEMO 공통 처리)
  const handleDelete = async f => {
    try {
      console.log('삭제할 파일 정보:', {
        brainId,
        fileId: f.id,
        fileType: f.filetype,
        fileName: f.name
      });

      // 1) 벡터 DB 및 지식 그래프 DB에서 해당 소스 삭제
      try {
        await deleteDB(brainId, f.id);
        console.log('✅ 벡터 DB 및 그래프 DB 삭제 성공');
      } catch (dbError) {
        console.error('⚠️ 벡터/그래프 DB 삭제 실패 (계속 진행):', dbError);
      }

      // 2) 실제 파일 삭제 (파일 시스템 또는 DB에서)
      let deleted = false;
      if (f.filetype === 'pdf') {
        deleted = await deletePdf(f.id);
      } else if (f.filetype === 'txt') {
        deleted = await deleteTextFile(f.id);
      } else if (f.filetype === 'memo') {
        await setMemoAsNotSource(f.id);  // memo를 비소스로만 처리
        deleted = true;
      }

      // 삭제 실패 시 에러 처리
      if (!deleted) {
        throw new Error(`${f.filetype} 파일 삭제 실패`);
      }

      // 3) 그래프 뷰 새로고침
      if (onGraphRefresh) {
        onGraphRefresh();
      }

      // 4) 파일 목록 다시 로드
      await refresh();
    } catch (e) {
      console.error('❌ 삭제 실패:', e);
      alert('삭제 실패');
    }
  };

  // 소스 이름을 변경하는 함수 (PDF, TXT, MEMO 공통 처리)
  const handleNameChange = async (f) => {
    const newName = tempName.trim();
    if (!newName || newName === f.name) {
      setEditingId(null);
      return;
    }

    try {
      // 1) 파일 종류에 따라 이름 변경 API 호출
      if (f.filetype === 'pdf') {
        await updatePdf(f.id, {
          pdf_title: newName,
          brain_id: brainId,
        });
      } else if (f.filetype === 'txt') {
        await updateTextFile(f.id, {
          txt_title: newName,
          brain_id: brainId,
        });
      } else if (f.filetype === 'memo') {
        await updateMemo(f.id, {
          memo_title: newName,
          brain_id: brainId,
        });
      }

      // 2) 파일 목록 갱신
      await refresh();
    } catch (e) {
      alert('이름 변경 실패');
    } finally {
      setEditingId(null); // 편집 모드 해제
    }
  };

  // 삭제 확인 모달을 띄우기 위해 삭제할 파일 지정
  const openDeleteConfirm = (f) => {
    setFileToDelete(f);     // 삭제할 파일 정보 저장
    setMenuOpenId(null);    // ⋮ 메뉴 닫기
  };

  // 루트 영역으로 드롭 시 처리하는 로직 (메모 → 소스 변환 또는 외부 파일 업로드)
  const handleRootDrop = async e => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDrag(false); // 드래그 상태 해제

    // 메모 드래그 처리 (메모 → 소스로 전환)
    const memoData = e.dataTransfer.getData('application/json-memo');
    if (memoData) {
      const { id, name, content } = JSON.parse(memoData);
      const key = `${name}-${Date.now()}`; // 업로드 큐에서 고유 키

      // (1) 업로드 큐에 "그래프 변환 중" 표시 추가
      setUploadQueue(q => [...q, {
        key,
        name,
        filetype: 'memo',
        status: 'processing'
      }]);

      try {
        // (2) 메모를 소스로 설정 (is_source: true)
        await setMemoAsSource(id);

        // (3) 텍스트 → 지식 그래프 변환 처리
        await processMemoTextAsGraph(content, id, brainId);

        // (4) 완료 처리
        setUploadQueue(q => q.filter(item => item.key !== key));
        if (onGraphRefresh) onGraphRefresh();
        await refresh();

      } catch (err) {
        console.error('메모 처리 실패', err);
        setUploadQueue(q => q.filter(item => item.key !== key));
      }
      return;
    }

    // 외부 파일 드래그 앤 드롭 (pdf, txt, memo만 허용)
    const dropped = Array.from(e.dataTransfer.files); // 드래그한 파일 배열로 변환
    if (!dropped.length) return; // 비어 있으면 종료

    dropped.forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      const key = `${file.name}-${Date.now()}`;

      // 지원하지 않는 확장자는 무시
      if (!['pdf', 'txt', 'memo'].includes(ext)) {
        console.warn(`❌ 지원되지 않는 파일 형식: .${ext}`);
        return;
      }

      // (1) UI 업로드 큐에 "처리중" 상태로 추가 → 사용자에게 진행 상황 표시
      setUploadQueue(q => [
        ...q,
        {
          key,
          name: file.name,
          filetype: ext,
          status: 'processing'
        }
      ]);

      // (2) 실제 파일 업로드 및 그래프 생성
      createFileByType(file)
        .then(result => {
          if (!result) throw new Error('유효하지 않은 파일');

          // (2-1) 업로드 큐 제거
          setUploadQueue(q => q.filter(item => item.key !== key));

          // (2-2) 메타데이터 갱신
          setFileMap(prev => ({
            ...prev,
            [result.id]: result.meta,
          }));

          // (2-3) 그래프 뷰 및 파일 목록 갱신
          if (onGraphRefresh) onGraphRefresh();
          refresh();
        })
        .catch(err => {
          console.error('파일 업로드 실패:', err);
          setUploadQueue(q => q.filter(item => item.key !== key));
        });
    });
  }

  return (
    <div
      className={`file-explorer modern-explorer${isRootDrag ? ' root-drag-over' : ''}`}
      onDragEnter={e => { e.preventDefault(); setIsRootDrag(true); }}
      onDragLeave={e => { e.preventDefault(); setIsRootDrag(false); }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleRootDrop}
    >
      {/* 드래그 중 배경 표시 */}
      {isRootDrag && (
        <div className="drop-overlay">
          <div className="drop-icon">
            <TiUpload />
          </div>
        </div>
      )}

      {/* 업로드 진행 표시 (PDF, TXT, MEMO) */}
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

      {/* 루트 레벨 파일들 렌더링 */}
      {processedFiles.map(f => {
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
              if (f.filetype === 'pdf' && fileMap[f.id]) {
                onOpenPDF(fileMap[f.id]);
              } else if (f.filetype === 'txt' && fileMap[f.id]) {
                onOpenTXT(fileMap[f.id]);
              } else if (f.filetype === 'memo' && fileMap[f.id]) {
                onOpenMEMO(fileMap[f.id]);
              }
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
      {processedFiles.length === 0 && (
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
          onCancel={() => setFileToDelete(null)}
          onOk={async () => {
            await handleDelete(fileToDelete);
            setFileToDelete(null);
          }}
        />
      )}
    </div>
  )
}
