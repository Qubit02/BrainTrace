// src/components/panels/FileView.jsx
import React, { useState, useEffect } from 'react'
import { pdfjs } from 'react-pdf';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';
import './styles/Common.css'
import './styles/SourcePanel.css'
import './styles/Scrollbar.css'
import './styles/FileView.css'
import FolderView from './FolderView'
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
  listBrainFolders,
  getPdfsByBrain,
  getTextfilesByBrain,
  getVoicesByBrain,
  getMemosByBrain,
  getSourceMemosByBrain,
  setMemoAsSource,
  uploadPdfs,
  createPdf,
  createTextFile,
  createVoice,
  createMemo,
  deleteMemo,
  movePdfToFolder,
  removePdfFromFolder,
  moveTextfileToFolder,
  removeTextFileFromFolder,
  moveVoiceToFolder,
  removeVoiceFromFolder,
  moveMemoToFolder,
  removeMemoFromFolder,
  deletePdf,
  deleteTextFile,
  deleteVoice,
  updatePdf,
  updateTextFile,
  updateVoice,
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

// API에서 받아온 폴더/파일 구조를 트리 형태로 변환하는 함수
// 이 함수는 폴더 내부에 포함된 pdf, txt, voice, memo 파일들을 children 배열로 정리함.
// 각 파일 객체는 type: 'file'과 함께, filetype(예: pdf, txt, memo 등), id, name을 포함함.
// 이렇게 변환된 트리 구조는 SourcePanel이나 FolderView 등에서 계층적으로 표시할 수 있도록 도와줌.

function normalizeApiTree(apiFolders = []) {
  return apiFolders.map(folder => ({
    type: 'folder', // 폴더임을 명시
    folder_id: folder.folder_id, // 폴더 고유 ID
    name: folder.folder_name, // 폴더 이름
    children: [
      // 폴더 안에 있는 PDF 파일들 추가
      ...(folder.pdfs || []).map(pdf => ({
        type: 'file',
        filetype: 'pdf',
        id: pdf.pdf_id,
        name: pdf.pdf_title,
      })),
      // 폴더 안에 있는 TXT 파일들 추가
      ...(folder.textfiles || []).map(txt => ({
        type: 'file',
        filetype: 'txt',
        id: txt.txt_id,
        name: txt.txt_title,
      })),
      // 폴더 안에 있는 음성 파일들 추가
      ...(folder.voices || []).map(voice => ({
        type: 'file',
        filetype: 'voice',
        id: voice.voice_id,
        name: voice.voice_title,
      })),
      // 폴더 안에 있는 메모 파일들 추가 (.memo)
      ...(folder.memos || []).map(memo => ({
        type: 'file',
        filetype: 'memo',
        id: memo.memo_id,
        name: memo.memo_title || '제목 없음',
      })),
    ],
  }))
}


export default function FileView({
  brainId,
  files = [],
  setFiles = () => { },
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
  const [refreshKey, setRefreshKey] = useState(0)
  const [rootFiles, setRootFiles] = useState([])
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [fileToDelete, setFileToDelete] = useState(null);
  const [uploadQueue, setUploadQueue] = useState([])

  // 보여줄 파일 리스트를 계산: filteredSourceIds가 존재하면 해당 ID만 필터링
  const visibleFiles = filteredSourceIds
    ? files.filter(fileOrFolder => {
      if (fileOrFolder.type === 'folder') {
        // 폴더 내부에 필터 대상 파일이 하나라도 있으면 그 폴더는 표시
        return fileOrFolder.children.some(f =>
          filteredSourceIds.includes(String(
            f.memo_id || f.pdf_id || f.txt_id || f.voice_id
          ))
        );
      }

      // 루트 파일일 경우: 해당 ID가 필터에 포함되어 있는지 확인
      const id = fileOrFolder.memo_id || fileOrFolder.pdf_id || fileOrFolder.txt_id || fileOrFolder.voice_id;
      return filteredSourceIds.includes(String(id));
    })
    : files;

  // 모든 파일을 평탄화 (폴더 내부의 파일들까지 모두 펼친 리스트 생성)
  // 이후 드래그 앤 드롭, 삭제, 이름 변경 등 처리에 사용됨
  const allFilesFlat = [
    ...rootFiles,
    ...files.flatMap(folder =>
      folder.type === 'folder'
        ? folder.children.map(child => ({
          ...child,
          filetype: child.filetype,
          id: child.id,
          name: child.name,
          meta: fileMap[child.id] || {}, // fileMap에서 메타데이터 보조 정보 추출
        }))
        : []
    ),
  ];

  const filteredAllFiles = filteredSourceIds
    ? allFilesFlat.filter(f => filteredSourceIds.includes(String(f.id)))
    : rootFiles;


  useEffect(() => {
    refresh()
  }, [brainId, refreshTrigger])

  useEffect(() => {
    const closeMenu = () => setMenuOpenId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const refresh = async () => {
    if (!brainId) return;
    try {
      // 1) 브레인에 속한 전체 폴더/파일 구조 조회 (PDF, TXT, VOICE, MEMO 포함)
      const api = await listBrainFolders(brainId);
      setFiles(normalizeApiTree(api));  // 폴더 트리 형태로 가공하여 상태에 저장

      // 2) 브레인 기준 전체 파일 조회 (폴더 밖의 루트 파일 포함)
      const [pdfs, txts, voices, memos] = await Promise.all([
        getPdfsByBrain(brainId),
        getTextfilesByBrain(brainId),
        getVoicesByBrain(brainId),
        getMemosByBrain(brainId),
      ]);

      // 2.1) fileMap 갱신 - 각 파일 ID를 키로 하여 메타데이터를 빠르게 참조 가능하게 구성
      setFileMap(prev => {
        const m = { ...prev };
        pdfs.forEach(p => { m[p.pdf_id] = p; });
        txts.forEach(t => { m[t.txt_id] = t; });
        voices.forEach(v => { m[v.voice_id] = v; });
        memos.forEach(memo => { m[memo.memo_id] = memo; });
        return m;
      });

      // 3) folder_id === null 인 루트 파일만 따로 분리 (왼쪽 패널 rootFiles 용)
      const roots = [
        ...pdfs
          .filter(p => p.folder_id == null)
          .map(p => ({ filetype: 'pdf', id: p.pdf_id, name: p.pdf_title })),
        ...txts
          .filter(t => t.folder_id == null)
          .map(t => ({ filetype: 'txt', id: t.txt_id, name: t.txt_title })),
        ...voices
          .filter(v => v.folder_id == null)
          .map(v => ({ filetype: 'voice', id: v.voice_id, name: v.voice_title })),
        ...memos
          .filter(m => m.folder_id == null)
          .map(m => ({ filetype: 'memo', id: m.memo_id, name: m.memo_title })),
      ];
      setRootFiles(roots);

      // 4) 전체 컴포넌트 리렌더링 트리거
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error('전체 로드 실패', err);
    }
  };

  const createFileByType = async (f, folderId = null) => {
    const ext = f.name.split('.').pop().toLowerCase()
    const common = { folder_id: folderId, type: ext, brain_id: brainId }

    // --- PDF ---
    if (ext === 'pdf') {
      // 1-1) 바이너리 + 메타 업로드
      const [meta] = await uploadPdfs([f], folderId, brainId);

      // 1-2) 텍스트 추출
      const arrayBuffer = await f.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let content = '';
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        content += textContent.items.map(item => item.str).join(' ') + '\n\n';
      }

      // 1-3) 그래프 생성
      await createTextToGraph({
        text: content,
        brain_id: String(brainId),
        source_id: String(meta.pdf_id),
      });

      return { id: meta.pdf_id, filetype: 'pdf', meta };
    }
    // --- TXT ---
    else if (ext === 'txt') {
      // 1) 업로드 (pdf와 동일한 방식)
      const [meta] = await uploadTextfiles([f], folderId, brainId);

      // 2) 파일 내용 추출 후 그래프 생성
      const content = await f.text();

      await createTextToGraph({
        text: content,
        brain_id: String(brainId),
        source_id: String(meta.txt_id),
      });

      return { id: meta.txt_id, filetype: 'txt', meta };

    }
    // --- Voice ---
    else if (['mp3', 'wav', 'm4a'].includes(ext)) {
      const res = await createVoice({
        ...common,
        voice_title: f.name,
        voice_path: f.name,
      });
      return { id: res.voice_id, filetype: 'voice', meta: res };
    }
    // --- Memo ---
    else if (ext === 'memo') {
      const content = await f.text();

      // 예시: 메모 생성 API 호출 (FastAPI 기준)
      const res = await createMemo({
        memo_title: f.name.replace(/\.memo$/, ''),
        memo_text: content,
        is_source: true,
        folder_id: folderId,
        brain_id: brainId,
        type: 'memo',
      });

      return { id: res.memo_id, filetype: 'memo', meta: res };
    }
    else {
      await createTextFile({ ...common, txt_title: f.name, txt_path: f.name })
    }

    await refresh();
    if (onGraphRefresh) onGraphRefresh();
  }

  // 소스 삭제 함수 (PDF, TXT, VOICE, MEMO 공통)
  const handleDelete = async f => {
    try {
      console.log('삭제할 파일 정보:', {
        brainId,
        fileId: f.id,
        fileType: f.filetype,
        fileName: f.name
      });

      // 1. 벡터 DB 및 그래프 DB에서 삭제
      try {
        await deleteDB(brainId, f.id);
        console.log('벡터 DB, 그래프 DB 삭제 성공');
      } catch (dbError) {
        console.error('벡터 DB, 그래프 DB 삭제 실패:', dbError);
        // 벡터 DB 삭제 실패는 무시하고 계속 진행
      }

      // 2. 파일 시스템에서 삭제
      let deleted = false;
      if (f.filetype === 'pdf') {
        deleted = await deletePdf(f.id);
      } else if (f.filetype === 'txt') {
        deleted = await deleteTextFile(f.id);
      } else if (f.filetype === 'voice') {
        deleted = await deleteVoice(f.id);
      } else if (f.filetype === 'memo') {
        await deleteMemo(f.id);  // memo는 삭제 성공 여부 반환 X → 에러 나면 catch 됨
        deleted = true;
      }

      if (!deleted) {
        throw new Error(`${f.filetype} 파일 삭제 실패`);
      }

      // 3. 그래프 뷰 새로고침
      if (onGraphRefresh) {
        onGraphRefresh();
      }

      // 4. 파일 목록 갱신
      await refresh();

    } catch (e) {
      console.error('삭제 실패:', e);
      alert('삭제 실패');
    }
  };

  // 이름 변경 함수 (PDF, TXT, VOICE, MEMO 공통)
  const handleNameChange = async (f) => {
    const newName = tempName.trim();
    if (!newName || newName === f.name) {
      setEditingId(null);
      return;
    }

    try {
      if (f.filetype === 'pdf') {
        await updatePdf(f.id, { pdf_title: newName, brain_id: brainId });
      } else if (f.filetype === 'txt') {
        await updateTextFile(f.id, { txt_title: newName, brain_id: brainId });
      } else if (f.filetype === 'voice') {
        await updateVoice(f.id, { voice_title: newName, brain_id: brainId });
      } else if (f.filetype === 'memo') {
        await updateMemo(f.id, { memo_title: newName, brain_id: brainId });
      }

      // 변경 후 목록 리프레시
      await refresh();
    } catch (e) {
      alert('이름 변경 실패');
    } finally {
      setEditingId(null);
    }
  };

  // 삭제 확인 모달을 띄우기 위해 삭제할 파일 지정
  const openDeleteConfirm = (f) => {
    setFileToDelete(f); // 삭제할 파일 정보 저장
    setMenuOpenId(null); // 점 3개 메뉴 닫기
  };

  // 루트 영역으로 드롭 시 처리하는 로직 (폴더 밖으로 이동 또는 메모 드래그)
  const handleRootDrop = async e => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDrag(false); // 드래그 상태 해제

    // 1️⃣ 내부 항목 이동 (폴더 안 → 루트로)
    const moved = e.dataTransfer.getData('application/json');
    if (moved) {
      const { id, filetype } = JSON.parse(moved);
      await moveItem({ id, filetype }, null); // folder_id = null 처리
      return;
    }

    // 메모 드래그된 경우 (text → txt 파일로 처리 후 소스로 전환)
    // const memoData = e.dataTransfer.getData('application/json-memo');
    // if (memoData) {
    //   const { name, content } = JSON.parse(memoData);
    //   const key = `${name}-${Date.now()}`; // 업로드 큐에서 고유 키

    //   // (1) 업로드 큐에 표시 (UI 상에서 "변환 중" 표시용)
    //   setUploadQueue(q => [...q, {
    //     key,
    //     name,
    //     filetype: 'txt',
    //     status: 'processing'
    //   }]);

    //   try {
    //     // (2) 메모 내용을 Blob → File 형태로 변환
    //     const blob = new Blob([content], { type: 'text/plain' });
    //     const file = new File([blob], name, { type: 'text/plain' });

    //     // (3) uploadTextfiles 사용하여 서버에 업로드 (txt 파일처럼 처리)
    //     const [meta] = await uploadTextfiles([file], null, brainId);

    //     // (4) 그래프 변환 처리 (LLM 기반 노드/엣지 추출)
    //     await processMemoTextAsGraph(content, meta.txt_id, brainId);

    //     // (5) 메모를 소스로 설정
    //     await setMemoAsSource(meta.txt_id);

    //     // (6) 완료 처리 - 업로드 큐 제거 및 그래프 뷰 새로고침
    //     setUploadQueue(q => q.filter(item => item.key !== key));
    //     if (onGraphRefresh) onGraphRefresh();
    //     await refresh();

    //   } catch (err) {
    //     console.error('메모 파일 생성 실패', err);
    //     // 에러가 발생해도 큐에서 제거
    //     setUploadQueue(q => q.filter(item => item.key !== key));
    //   }
    //   return;
    // }

    // 메모 드래그된 경우 (text → 소스로 전환)
    const memoData = e.dataTransfer.getData('application/json-memo');
    console.log("memoData", memoData)
    if (memoData) {
      const { id, name, content } = JSON.parse(memoData);
      const key = `${name}-${Date.now()}`; // 업로드 큐에서 고유 키

      // (1) 업로드 큐에 표시 (UI 상에서 "변환 중" 표시용)
      setUploadQueue(q => [...q, {
        key,
        name,
        filetype: 'memo',
        status: 'processing'
      }]);

      try {
        // (2) 메모를 소스로 설정 (is_source: true)
        await setMemoAsSource(id);

        // (3) 그래프 변환 처리 (LLM 기반 노드/엣지 추출)
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


    // OS 파일 드래그 앤 드롭 처리
    const dropped = Array.from(e.dataTransfer.files); // 드래그한 파일 배열로 변환
    if (!dropped.length) return; // 비어 있으면 종료

    // ── 즉시 UI에 보여주고, 백그라운드에서 비동기로 업로드 & 그래프 생성 ──
    dropped.forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase(); // 확장자 추출
      const key = `${file.name}-${Date.now()}`; // 업로드 큐용 고유 key

      // (1) UI 업로드 큐에 "처리중" 상태로 추가 → 사용자에게 진행 상황 표시
      setUploadQueue(q => [
        ...q,
        {
          key,
          name: file.name,
          filetype: ext, // pdf, txt, mp3 등
          status: 'processing'
        }
      ]);

      // (2) 실제 업로드 및 그래프 생성
      createFileByType(file, null) // folder_id=null (루트에 추가)
        .then(r => {
          // (2-1) 업로드 큐에서 완료된 항목 제거
          setUploadQueue(q => q.filter(item => item.key !== key));

          // (2-2) fileMap 갱신 → 방금 업로드한 파일 정보를 메타로 추가
          setFileMap(prev => ({
            ...prev,
            [r.id]: r.meta
          }));

          // (2-3) 그래프 뷰도 새로고침
          if (onGraphRefresh) onGraphRefresh();

          // (2-4) 전체 파일 목록 새로 고침
          refresh();
        })
        .catch(err => {
          console.error('파일 업로드 실패', err);

          // (3) 에러 발생 시에도 업로드 큐에서 제거
          setUploadQueue(q => q.filter(item => item.key !== key));
        });
    });
  }

  // 폴더로 외부 파일 드롭 시 처리
  const handleDropToFolder = async (folderId, dropped) => {
    if (!Array.isArray(dropped)) return;
    try {
      // 1) dropped = File[] → 파일 유형에 맞게 업로드 및 그래프 생성
      const results = await Promise.all(
        dropped.map(f => createFileByType(f, folderId)) // { id, filetype, meta }
      );

      // 2) fileMap 갱신 (id → 파일 메타 정보)
      setFileMap(prev => {
        const m = { ...prev };
        results.forEach(r => {
          m[r.id] = r.meta;
        });
        return m;
      });

      // 3) 파일 트리와 그래프 뷰 새로고침
      await refresh();
      if (onGraphRefresh) onGraphRefresh();
    } catch (err) {
      console.error('폴더 파일 생성 실패', err);
    }
  };

  // 파일을 특정 폴더로 이동하거나 루트로 이동하는 처리
  const moveItem = async ({ id, filetype }, targetFolderId) => {
    const toRoot = targetFolderId == null;
    try {
      if (filetype === 'pdf') {
        if (toRoot) {
          await removePdfFromFolder(brainId, id); // 루트로 이동
        } else {
          await movePdfToFolder(brainId, targetFolderId, id); // 폴더로 이동
        }
      } else if (filetype === 'txt') {
        if (toRoot) {
          await removeTextFileFromFolder(brainId, id);
        } else {
          await moveTextfileToFolder(brainId, targetFolderId, id);
        }
      } else if (filetype === 'voice') {
        if (toRoot) {
          await removeVoiceFromFolder(brainId, id);
        } else {
          await moveVoiceToFolder(brainId, targetFolderId, id);
        }
      } else if (filetype === 'memo') {
        if (toRoot) {
          await removeMemoFromFolder(id);
        } else {
          await moveMemoToFolder(targetFolderId, id);
        }
      }
      // 이동 후 트리 갱신
      await refresh();
    } catch (e) {
      console.error('파일 이동 오류', e);
    }
  };

  return (
    <div
      className={`file-explorer modern-explorer${isRootDrag ? ' root-drag-over' : ''}`}
      onDragEnter={e => { e.preventDefault(); setIsRootDrag(true) }}
      onDragLeave={e => { e.preventDefault(); setIsRootDrag(false) }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleRootDrop}
    >
      {isRootDrag && (
        <div className="drop-overlay">
          <div className="drop-icon">
            <TiUpload />
          </div>
        </div>
      )}

      {/* ── 폴더 트리 ── */}
      {visibleFiles.map(node =>
        node.type === 'folder' ? (
          <FolderView
            key={node.folder_id}
            item={node}
            refreshKey={refreshKey}
            depth={0}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
            onDropFileToFolder={handleDropToFolder}
            onOpenPDF={onOpenPDF}
            onOpenTXT={onOpenTXT}
            fileMap={fileMap}
            moveItem={moveItem}
            refreshParent={refresh}
            brainId={brainId}
            onGraphRefresh={onGraphRefresh}
            filteredSourceIds={filteredSourceIds}
            onFocusNodeNamesUpdate={onFocusNodeNamesUpdate}
          />
        ) : null
      )}

      {/* ── 업로드 진행중/완료 표시 ── */}
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

      {/* ── 루트 레벨 파일들 ── */}
      {filteredAllFiles.map(f => {
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
              console.log("f : ", f)
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
                          onFocusNodeNamesUpdate(names); // ✅ 이름 수정
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
      {/* 비어 있을 때 */}
      {files.length === 0 && rootFiles.length === 0 && (
        <div className="empty-state">
          <p className="empty-sub">이 영역에 파일을 <strong>드래그해서 추가</strong>해보세요!</p>
        </div>
      )}

      {filteredSourceIds && visibleFiles.length === 0 && filteredAllFiles.length === 0 && (
        <div className="empty-state">
          <p className="empty-sub">검색 결과가 없습니다.</p>
        </div>
      )}

      {fileToDelete && (
        <ConfirmDialog
          message={`"${fileToDelete.name}" 소스를 삭제하시겠습니까?`}
          onCancel={() => setFileToDelete(null)}
          onOk={async () => {
            await handleDelete(fileToDelete); // 실제 삭제
            setFileToDelete(null);
          }}
        />
      )}
    </div>
  )
}
