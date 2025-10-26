/**
 * FileView 컴포넌트
 *
 * 이 컴포넌트는 브레인 프로젝트의 파일 목록 표시 및 관리 기능을 제공합니다.
 * 주요 기능:
 * - 다양한 파일 타입 지원 (PDF, TXT, MD, DOCX, Memo)
 * - 드래그 앤 드롭 파일 업로드
 * - 파일 이름 변경 및 삭제
 * - 업로드/변환 큐 관리
 * - 실시간 검색 필터링
 * - 파일 메뉴 (노드 보기, 이름 변경, 삭제)
 * - 그래프 생성 및 새로고침 연동
 *
 * Props:
 * - brainId: 현재 브레인 ID
 * - files: 파일 목록 (PDF, TXT, MEMO, MD, DOCX)
 * - onOpenFile: 파일 열기 콜백
 * - setFileMap: fileMap 상태 업데이트 함수
 * - refreshTrigger: 파일 목록 새로고침 트리거
 * - onGraphRefresh: 그래프 새로고침 콜백
 * - onSourceCountRefresh: 소스 개수 새로고침 콜백
 * - onFocusNodeNamesUpdate: 포커스 노드 이름 업데이트 콜백
 * - filteredSourceIds: 검색 필터링된 소스 ID 목록
 * - searchText: 검색 텍스트
 * - onFileUploaded: 파일 업로드 완료 시 호출할 콜백
 * - isNodeViewLoading: 노드 뷰 로딩 상태
 * - setIsNodeViewLoading: 노드 뷰 로딩 상태 설정 함수
 * - externalUploadQueue: 외부에서 전달받은 업로드 큐
 * - setExternalUploadQueue: 외부 업로드 큐 초기화 함수
 *
 * 상태 관리:
 * - selectedFile: 현재 선택된 파일 ID
 * - isDrag: 드래그 중 여부
 * - menuOpenId: 열린 메뉴의 파일 ID
 * - editingId: 이름 편집 중인 파일 ID
 * - tempName: 임시 파일명 (편집용)
 * - fileToDelete: 삭제할 파일 정보
 * - uploadQueue: 업로드/변환 대기 큐
 * - isProcessing: 변환 작업 진행 중 여부
 * - isDeleting: 삭제 작업 진행 중 여부
 */
import React, { useState, useEffect, useRef } from "react";
import "./SourcePanel.css";
import "./FileView.css";
import FileIcon from "./FileIcon";
import { TiUpload } from "react-icons/ti";
import { GoPencil } from "react-icons/go";
import ConfirmDialog from "../../common/ConfirmDialog";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { AiOutlineNodeIndex } from "react-icons/ai";
import { LuGitPullRequestClosed } from "react-icons/lu";

// API 함수들 import
import {
  getPdfsByBrain,
  getTextfilesByBrain,
  getMemosByBrain,
  getNodesBySourceId,
  getMDFilesByBrain,
  getDocxFilesByBrain,
  convertMemoToSource,
} from "../../../../api/config/apiIndex";

// 외부 라이브러리 import
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// 파일 처리 관련 유틸리티 import
import fileHandlers from "./fileHandlers/fileHandlers";
import fileMetaExtractors from "./fileHandlers/fileMetaExtractors";
import { processMemoTextAsGraph } from "./fileHandlers/memoHandlers";
import {
  handleDrop,
  handleNameChange,
  handleDelete,
} from "./fileHandlers/fileViewHandlers";

export default function FileView({
  brainId, // 현재 브레인 ID
  files = [], // 파일 목록 (PDF, TXT, MEMO, MD, DOCX)
  onOpenFile = () => {}, // 파일 열기 콜백
  setFileMap = () => {}, // fileMap 상태 업데이트 함수
  refreshTrigger, // 파일 목록 새로고침 트리거
  onGraphRefresh, // 그래프 새로고침 콜백
  onSourceCountRefresh, // 소스 개수 새로고침 콜백
  onFocusNodeNamesUpdate, // 포커스 노드 이름 업데이트 콜백
  filteredSourceIds, // 검색 필터링된 소스 ID 목록
  searchText, // 검색 텍스트
  onFileUploaded, // 파일 업로드 완료 시 호출할 콜백
  isNodeViewLoading,
  setIsNodeViewLoading,
  externalUploadQueue = [], // 외부에서 전달받은 업로드 큐
  setExternalUploadQueue = () => {}, // 외부 업로드 큐 초기화 함수
  onUploadStateChange, // 업로드 상태 변경 콜백
}) {
  // === 상태 관리 ===
  const [selectedFile, setSelectedFile] = useState(null); // 현재 선택된 파일 ID
  const [isDrag, setIsDrag] = useState(false); // 드래그 중 여부
  const [menuOpenId, setMenuOpenId] = useState(null); // 열린 메뉴의 파일 ID
  const [editingId, setEditingId] = useState(null); // 이름 편집 중인 파일 ID
  const [tempName, setTempName] = useState(""); // 임시 파일명 (편집용)
  const [fileToDelete, setFileToDelete] = useState(null); // 삭제할 파일 정보
  const [uploadQueue, setUploadQueue] = useState([]); // 업로드/변환 대기 큐
  const [isProcessing, setIsProcessing] = useState(false); // 변환 작업 진행 중 여부
  const [isDeleting, setIsDeleting] = useState(false); // 삭제 작업 진행 중 여부

  // === 파일 목록 처리 ===
  /**
   * 검색 필터링된 파일 목록 계산
   * filteredSourceIds가 있으면 해당 ID에 해당하는 파일만 표시
   */
  const displayedFiles = filteredSourceIds
    ? files.filter((f) => {
        const id = f.memo_id || f.pdf_id || f.txt_id || f.md_id || f.docx_id;
        return filteredSourceIds.includes(String(id));
      })
    : files;

  /**
   * 파일 구조를 FileView에서 사용하는 형태로 변환
   * fileMetaExtractors를 사용하여 각 파일 타입별로 메타데이터 추출
   */
  const processedFiles = displayedFiles.map((f) =>
    fileMetaExtractors[f.type] ? fileMetaExtractors[f.type](f) : f
  );

  // === 외부 업로드 큐 처리 ===
  /**
   * 외부 업로드 큐가 변경될 때 내부 업로드 큐에 추가
   * 중복 제거를 위해 기존 큐와 병합
   */
  useEffect(() => {
    if (externalUploadQueue.length > 0) {
      setUploadQueue((prev) => {
        const existingKeys = prev.map((item) => item.key);
        const newItems = externalUploadQueue.filter(
          (item) => !existingKeys.includes(item.key)
        );
        return [...prev, ...newItems];
      });
      // 외부 업로드 큐 초기화 (중복 방지)
      setExternalUploadQueue([]);
    }
  }, [externalUploadQueue]);

  // 업로드 중인 파일의 고유 key 목록
  const uploadingKeys = uploadQueue.map((item) => item.key);

  /**
   * processedFiles에 key를 임시로 부여
   * name, size, type 기준으로 생성하여 업로드 대기 큐와 동일한 key 생성 방식 사용
   */
  const processedFilesWithKey = processedFiles.map((f) => {
    let ext = f.type;
    let size =
      f.size || f.pdf_size || f.txt_size || f.md_size || f.docx_size || 0;
    let name = f.name || f.title;

    // 파일 타입별로 이름 추출
    if (!name) {
      if (f.type === "pdf") name = f.pdf_title;
      else if (f.type === "txt") name = f.txt_title;
      else if (f.type === "md") name = f.md_title;
      else if (f.type === "docx") name = f.docx_title;
      else if (f.type === "memo") name = f.memo_title;
    }

    // 메모 타입의 경우 content 길이를 size로 사용
    if (f.type === "memo") {
      size = f.content
        ? f.content.length
        : f.memo_content
        ? f.memo_content.length
        : 0;
      ext = "memo";
    }

    const uploadKey = `${name}-${size}-${ext}`;
    return { ...f, _uploadKey: uploadKey };
  });

  // 업로드 중인 파일의 key와 일치하는 파일은 목록에서 제외
  const visibleFiles = processedFilesWithKey.filter(
    (f) => !uploadingKeys.includes(f._uploadKey)
  );

  // === 파일 처리 로직 ===
  /**
   * 변환 작업 함수: 큐에서 하나씩 꺼내서 처리
   * createFileByType 함수를 호출하여 실제 파일 업로드와 그래프 변환을 수행
   * 성공하면 fileMap을 업데이트하고, onFileUploaded 콜백을 호출
   * 마지막에 큐에서 해당 파일을 제거
   */
  const processNextInQueue = async () => {
    if (uploadQueue.length === 0) return;
    setIsProcessing(true);
    const file = uploadQueue[0];

    try {
      if (file.filetype === "memo" && file.memoId && file.memoContent) {
        // 메모를 소스로 변환하고 새로운 메모 ID 받기
        const newSourceMemo = await convertMemoToSource(file.memoId);
        const newSourceMemoId = newSourceMemo.memo_id;

        // 새로운 메모 ID로 그래프 생성
        await processMemoTextAsGraph(
          file.memoContent,
          newSourceMemoId,
          brainId
        );
        if (onGraphRefresh) onGraphRefresh();
        if (onSourceCountRefresh) onSourceCountRefresh();
      } else {
        // 실제 파일 업로드 및 그래프 생성
        const ext = file.filetype;
        const f = file.fileObj;
        const result = await createFileByType(f);
        if (!result) throw new Error("유효하지 않은 파일");

        setFileMap((prev) => ({
          ...prev,
          [result.id]: result.meta,
        }));
        if (onGraphRefresh) onGraphRefresh();
        if (onSourceCountRefresh) onSourceCountRefresh();
      }
    } catch (err) {
      console.error("파일 업로드 실패:", err);
    } finally {
      // 큐에서 제거 후 파일 목록 갱신
      setUploadQueue((q) => {
        const newQueue = q.slice(1);
        // 업로드가 모두 끝난 후에만 onFileUploaded 호출
        if (newQueue.length === 0 && typeof onFileUploaded === "function") {
          onFileUploaded();
        }
        return newQueue;
      });
      setIsProcessing(false);
    }
  };

  // === useEffect 훅들 ===
  /**
   * 큐에 변화가 생길 때마다 자동으로 다음 파일 처리
   * uploadQueue에 파일이 추가되면 processNextInQueue 함수가 자동으로 호출
   */
  useEffect(() => {
    if (uploadQueue.length > 0 && !isProcessing) {
      processNextInQueue();
    }
  }, [uploadQueue, isProcessing]);

  /**
   * 브레인 ID나 refreshTrigger가 변경될 때 파일 목록 새로고침
   */
  useEffect(() => {
    refresh();
  }, [brainId, refreshTrigger]);

  /**
   * 메뉴 외부 클릭 시 메뉴 닫기
   */
  useEffect(() => {
    const closeMenu = () => setMenuOpenId(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  /**
   * 업로드 상태 변경 시 상위 컴포넌트로 알림
   */
  useEffect(() => {
    const isUploading = uploadQueue.length > 0 || isProcessing;
    onUploadStateChange?.(isUploading);
  }, [uploadQueue.length, isProcessing, onUploadStateChange]);

  // === 핵심 함수들 ===
  /**
   * 파일 목록 새로고침 함수
   * 서버에서 최신 파일 목록을 가져와서 fileMap을 업데이트
   */
  const refresh = async () => {
    if (!brainId) return;

    try {
      // 브레인 기준 전체 파일 조회 (모든 타입)
      const [pdfs, txts, memos, mds, docxfiles] = await Promise.all([
        getPdfsByBrain(brainId),
        getTextfilesByBrain(brainId),
        getMemosByBrain(brainId),
        getMDFilesByBrain(brainId),
        getDocxFilesByBrain(brainId),
      ]);

      // fileMap 업데이트
      setFileMap((prev) => {
        const m = { ...prev };
        pdfs.forEach((p) => {
          m[p.pdf_id] = p;
        });
        txts.forEach((t) => {
          m[t.txt_id] = t;
        });
        memos.forEach((memo) => {
          m[memo.memo_id] = memo;
        });
        mds.forEach((md) => {
          m[md.md_id] = md;
        });
        docxfiles.forEach((docx) => {
          m[docx.docx_id] = docx;
        });
        return m;
      });
    } catch (err) {
      console.error("파일 목록 로딩 실패:", err);
    }
  };

  /**
   * 파일을 업로드하고 그래프를 생성하는 함수
   * @param {File} f - 업로드할 파일 객체
   * @returns {Object|null} 업로드 결과 또는 null
   */
  const createFileByType = async (f) => {
    if (!f || !f.name) {
      console.warn("createFileByType: 파일 객체가 유효하지 않습니다.", f);
      return null;
    }

    const ext = f.name.split(".").pop().toLowerCase();
    if (fileHandlers[ext]) {
      return await fileHandlers[ext](f, brainId);
    } else {
      console.warn(`❌ 지원되지 않는 파일 형식: .${ext}`);
      toast.error("지원되지 않는 파일 형식입니다. 소스를 추가할 수 없습니다.");
      return null;
    }
  };

  /**
   * 소스 삭제 확인 모달 열기
   * @param {Object} f - 삭제할 파일 정보
   */
  const openDeleteConfirm = (f) => {
    setFileToDelete(f); // 삭제할 파일 정보 저장
    setMenuOpenId(null); // ⋮ 메뉴 닫기
  };

  // === UI 렌더링 ===
  return (
    <div
      className={`file-explorer modern-explorer${isDrag ? " drag-over" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDrag(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDrag(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => handleDrop(e, setIsDrag, setUploadQueue)}
    >
      {/* 드래그 중 배경 표시 */}
      {isDrag && (
        <div className="drop-overlay">
          <div className="drop-icon">
            <TiUpload />
          </div>
        </div>
      )}

      {/* 업로드 진행 표시 섹션 */}
      {uploadQueue.length > 0 && (
        <>
          <div className="section-divider uploading-section"></div>
          {uploadQueue.map((item) => (
            <div key={item.key} className="file-item uploading">
              <FileIcon fileName={item.name} />
              <span className="file-name">{item.name}</span>
              {item.status === "processing" && (
                <span
                  className="upload-status"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginLeft: "auto",
                  }}
                >
                  <span style={{ marginLeft: 4 }}>그래프 변환 중</span>
                  <AiOutlineLoading3Quarters className="loading-spinner" />
                </span>
              )}
            </div>
          ))}
        </>
      )}

      {/* 기존 파일들과 구분선 */}
      {uploadQueue.length > 0 && visibleFiles.length > 0 && (
        <div className="section-divider existing-section"></div>
      )}

      {/* 소스패널에 파일들 렌더링 */}
      {visibleFiles.map((f) => {
        return (
          <div
            key={`${f.filetype}-${f.id}`}
            className={`file-item ${selectedFile === f.id ? "selected" : ""}`}
            onClick={() => {
              // 업로드 중일 때는 파일 열기 방지
              if (uploadQueue && uploadQueue.length > 0) {
                toast.info("소스 추가/변환 중에는 파일을 열 수 없습니다.");
                return;
              }

              setSelectedFile(f.id);
              // 변환된 파일 객체에서 원본 메타데이터의 ID를 가져오기
              const fileId = f.meta
                ? f.filetype === "pdf"
                  ? f.meta.pdf_id
                  : f.filetype === "txt"
                  ? f.meta.txt_id
                  : f.filetype === "md"
                  ? f.meta.md_id
                  : f.filetype === "docx"
                  ? f.meta.docx_id
                  : f.filetype === "memo"
                  ? f.meta.memo_id
                  : f.id
                : f.id;
              onOpenFile(fileId, f.filetype);
            }}
          >
            <FileIcon fileName={f.name} />

            {/* 이름 변경 입력창 */}
            {editingId === f.id ? (
              <span style={{ display: "flex", alignItems: "center" }}>
                <input
                  autoFocus
                  className="rename-input"
                  value={tempName.replace(/\.[^/.]+$/, "")}
                  onChange={(e) =>
                    setTempName(e.target.value.replace(/\.[^/.]+$/, ""))
                  }
                  onBlur={() =>
                    handleNameChange(
                      f,
                      tempName,
                      brainId,
                      setEditingId,
                      refresh,
                      onFileUploaded
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleNameChange(
                        f,
                        tempName,
                        brainId,
                        setEditingId,
                        refresh,
                        onFileUploaded
                      );
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  style={{ width: "120px", marginRight: "2px" }}
                />
                {/* 파일 확장자 표시 (메모 제외) */}
                {f.filetype !== "memo" && (
                  <span
                    style={{
                      color: "#888",
                      fontSize: "0.95em",
                      userSelect: "none",
                    }}
                  >
                    {f.name.slice(f.name.lastIndexOf("."))}
                  </span>
                )}
              </span>
            ) : (
              <span className="file-name">{f.name}</span>
            )}

            {/* ⋮ 메뉴 버튼 */}
            <div
              className="file-menu-button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId((prev) => (prev === f.id ? null : f.id));
              }}
            >
              ⋮
              {menuOpenId === f.id && (
                <div
                  className="file-menu-popup"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 노드 보기 메뉴 */}
                  <div
                    className="popup-item"
                    onClick={async () => {
                      setIsNodeViewLoading && setIsNodeViewLoading(f.id);
                      try {
                        const response = await getNodesBySourceId(
                          f.id,
                          brainId
                        );

                        const names = response?.nodes || [];
                        if (names && names.length > 0) {
                          if (onFocusNodeNamesUpdate) {
                            onFocusNodeNamesUpdate(names);
                          }
                        } else {
                          // 노드가 없을 때 toast 메시지 표시
                          toast.info(
                            `그래프에 "${f.name}" 파일의 노드가 없습니다.`
                          );
                        }
                      } catch (err) {
                        console.error("노드 조회 실패:", err);
                        toast.error(
                          "해당 소스에서 생성된 노드를 가져오지 못했습니다."
                        );
                      } finally {
                        // 로딩 상태 해제
                        setIsNodeViewLoading && setIsNodeViewLoading(null);
                      }
                      setMenuOpenId(null);
                    }}
                  >
                    <AiOutlineNodeIndex size={17} style={{ marginRight: 1 }} />
                    노드 보기
                    {isNodeViewLoading === f.id && (
                      <span
                        className="upload-status"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginLeft: 10,
                        }}
                      >
                        <AiOutlineLoading3Quarters className="loading-spinner" />
                      </span>
                    )}
                  </div>

                  {/* 소스 이름 바꾸기 메뉴 */}
                  <div
                    className="popup-item"
                    onClick={() => {
                      setEditingId(f.id);
                      setTempName(f.name);
                      setMenuOpenId(null);
                    }}
                  >
                    <GoPencil size={14} style={{ marginRight: 4 }} /> 소스 이름
                    바꾸기
                  </div>

                  {/* 소스 삭제 메뉴 */}
                  <div
                    className="popup-item"
                    onClick={() => openDeleteConfirm(f)}
                  >
                    <LuGitPullRequestClosed
                      size={14}
                      style={{ marginRight: 4 }}
                    />{" "}
                    소스 삭제
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 빈 상태 표시 (업로드 중이 아닐 때만) */}
      {processedFiles.length === 0 &&
        (!searchText || searchText.trim() === "") &&
        uploadQueue.length === 0 && (
          <div className="empty-state">
            <p className="empty-sub">
              이 영역에 파일을 <strong>드래그해서 추가</strong>해보세요!
            </p>
            <div className="supported-formats">
              <p className="format-title">지원하는 파일 형식</p>
              <div className="format-list">
                <span className="format-item">PDF</span>
                <span className="format-item">TXT</span>
                <span className="format-item">DOCX</span>
                <span className="format-item">MARKDOWN</span>
              </div>
            </div>
          </div>
        )}

      {/* 검색 결과가 없을 때 (업로드 중이 아닐 때만) */}
      {filteredSourceIds &&
        processedFiles.length === 0 &&
        uploadQueue.length === 0 && (
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
            await handleDelete(
              fileToDelete,
              brainId,
              onGraphRefresh,
              onSourceCountRefresh,
              refresh
            );
            setIsDeleting(false); // 로딩 종료
            setFileToDelete(null); // 모달 닫기
          }}
          isLoading={isDeleting}
        />
      )}

      {/* 토스트 알림 컨테이너 */}
      <ToastContainer
        position="top-right"
        autoClose={2000}
        hideProgressBar={true}
      />
    </div>
  );
}
