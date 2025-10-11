// src/components/panels/MemoListPanel.jsx
import React, { useState, useRef, useMemo } from "react";
import "./MemoListPanel.css";
import { CiMemoPad } from "react-icons/ci";
import micOff from "../../../../assets/icons/mic_off.png";
import micOn from "../../../../assets/icons/mic_on.png";
import { IoTrashBinOutline } from "react-icons/io5";
import { CgNotes } from "react-icons/cg";
import { BsTrash } from "react-icons/bs";
import { MdOutlineRestore } from "react-icons/md";
import { MdDeleteForever } from "react-icons/md";
import { MdOutlineDeleteSweep } from "react-icons/md";
import ConfirmDialog from "../../../common/ConfirmDialog";

import useAudioRecorder from "../hooks/useAudioRecorder";

// ===== 상수 정의 =====

/**
 * 메모 기본값 상수
 */
const MEMO_DEFAULTS = {
  TITLE: "메모",
  UNTITLED: "제목 없음",
  EMPTY_CONTENT: "내용 없음",
  PREVIEW_LENGTH: 40, // 미리보기 텍스트 길이
};

/**
 * UI 타이밍 상수 (밀리초)
 */
const TIMING = {
  ADD_MEMO_DELAY: 1500, // 메모 추가 후 재클릭 가능 시간
};

/**
 * 메모 모드 타입
 */
const MEMO_MODES = {
  NORMAL: "normal", // 일반 메모 모드
  TRASH: "trash", // 휴지통 모드
};

/**
 * 메모 표시 텍스트
 */
const UI_TEXT = {
  TITLE_NORMAL: "Memo",
  TITLE_TRASH: "Bin",
  BUTTON_ADD: "+ 새 메모",
  BUTTON_ADDING: "추가 중...",
  BUTTON_EMPTY_TRASH: "전체 비우기",
  EMPTY_NORMAL: "저장된 메모가 여기에 표시됩니다",
  EMPTY_TRASH: "휴지통이 비어있습니다",
  EMPTY_NORMAL_SUB:
    "중요한 생각을 메모로 남기고\n드래그해서 소스로 추가하면 그래프에 반영됩니다.",
  EMPTY_TRASH_SUB: "삭제된 메모가 여기에 표시됩니다",
  TOOLTIP_RESTORE: "메모 복구",
  TOOLTIP_HARD_DELETE: "메모 완전 삭제",
  TOOLTIP_DELETE: "휴지통 이동",
  TOOLTIP_SHOW_TRASH: "휴지통 보기",
  TOOLTIP_SHOW_MEMOS: "메모 목록으로",
};

// ===== 유틸리티 함수 =====

/**
 * 초 단위 시간을 mm:ss 포맷으로 변환
 *
 * @param {number} seconds - 초 단위 시간
 * @returns {string} mm:ss 형식 문자열
 */
function formatTime(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, "0");
  const sec = String(seconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

/**
 * 날짜를 한국 시간대 기준으로 포맷팅
 *
 * @param {string|number|Date} dateValue - 날짜 값
 * @returns {string} YYYY.MM.DD 형식 문자열 (실패 시 빈 문자열)
 */
function formatDateKST(dateValue) {
  if (!dateValue) return "";

  try {
    let date;
    if (typeof dateValue === "string") {
      date = new Date(dateValue);
    } else if (typeof dateValue === "number") {
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return "";
    }

    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      return "";
    }

    // 한국 시간대(KST, Asia/Seoul)로 변환
    const koreanDate = new Date(
      date.toLocaleString("en-US", {
        timeZone: "Asia/Seoul",
      })
    );

    const year = koreanDate.getFullYear();
    const month = `${koreanDate.getMonth() + 1}`.padStart(2, "0");
    const day = `${koreanDate.getDate()}`.padStart(2, "0");
    return `${year}.${month}.${day}`;
  } catch (error) {
    console.error("날짜 포맷팅 오류:", error);
    return "";
  }
}

/**
 * 메모가 삭제되었는지 확인
 *
 * @param {Object} memo - 메모 객체
 * @returns {boolean} 삭제 여부
 */
function isMemoDeleted(memo) {
  return memo.is_deleted === true || memo.is_deleted === 1;
}

/**
 * 메모가 활성 상태인지 확인 (삭제되지 않음)
 *
 * @param {Object} memo - 메모 객체
 * @returns {boolean} 활성 상태 여부
 */
function isMemoActive(memo) {
  return (
    memo.is_deleted === false ||
    memo.is_deleted === null ||
    memo.is_deleted === undefined ||
    memo.is_deleted === 0
  );
}

/**
 * 메모가 소스로 변환되었는지 확인
 *
 * @param {Object} memo - 메모 객체
 * @returns {boolean} 소스 변환 여부
 */
function isMemoSource(memo) {
  return memo.is_source === 1 || memo.is_source === true;
}

/**
 * 일반 메모인지 확인 (삭제되지 않고 소스가 아닌 메모)
 *
 * @param {Object} memo - 메모 객체
 * @returns {boolean} 일반 메모 여부
 */
function isRegularMemo(memo) {
  return isMemoActive(memo) && !isMemoSource(memo);
}

/**
 * 메모 리스트를 모드에 따라 필터링
 *
 * @param {Array} memos - 전체 메모 배열
 * @param {boolean} isTrashMode - 휴지통 모드 여부
 * @returns {Array} 필터링된 메모 배열
 */
function filterMemosByMode(memos, isTrashMode) {
  if (!Array.isArray(memos)) return [];

  return memos.filter((memo) => {
    if (isTrashMode) {
      // 휴지통 모드: 삭제된 메모만
      return isMemoDeleted(memo);
    } else {
      // 일반 모드: 삭제되지 않고 소스가 아닌 메모만
      return isRegularMemo(memo);
    }
  });
}

/**
 * 메모 미리보기 텍스트 생성
 *
 * @param {string} content - 메모 내용
 * @param {number} maxLength - 최대 길이
 * @returns {string} 미리보기 텍스트
 */
function generatePreview(content, maxLength = MEMO_DEFAULTS.PREVIEW_LENGTH) {
  if (!content || content.length === 0) {
    return MEMO_DEFAULTS.EMPTY_CONTENT;
  }

  const preview = content.slice(0, maxLength).replace(/\n/g, " ");
  return `${preview}...`;
}

/**
 * 드래그 데이터 생성
 *
 * @param {Object} memo - 메모 객체
 * @returns {Object} 드래그 데이터 객체
 */
function createDragData(memo) {
  return {
    id: memo.memo_id,
    name: `${memo.memo_title || MEMO_DEFAULTS.TITLE}.memo`,
    content: memo.memo_text || "",
  };
}

/**
 * 드래그 시작 이벤트 핸들러 생성
 *
 * @param {Object} memo - 메모 객체
 * @param {boolean} isTrashMode - 휴지통 모드 여부
 * @returns {Function} 드래그 시작 이벤트 핸들러
 */
function createDragStartHandler(memo, isTrashMode) {
  return (e) => {
    if (isTrashMode) return;

    const dragData = createDragData(memo);
    e.dataTransfer.setData("application/json-memo", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
    e.currentTarget.classList.add("dragging");
  };
}

/**
 * 드래그 종료 이벤트 핸들러
 *
 * @param {DragEvent} e - 드래그 이벤트
 */
function handleDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
}

/**
 * 액션 호버 이벤트 핸들러 생성
 *
 * @param {boolean} isTrashMode - 휴지통 모드 여부
 * @returns {Object} onMouseEnter, onMouseLeave 핸들러
 */
function createActionHoverHandlers(isTrashMode) {
  if (isTrashMode) {
    return {
      onMouseEnter: undefined,
      onMouseLeave: undefined,
    };
  }

  return {
    onMouseEnter: (e) => {
      e.currentTarget.parentElement.classList.add("actions-hover");
    },
    onMouseLeave: (e) => {
      e.currentTarget.parentElement.classList.remove("actions-hover");
    },
  };
}

// ===== 하위 컴포넌트 =====

/**
 * MemoEmptyState 컴포넌트
 *
 * 메모가 없을 때 표시되는 빈 상태 안내
 *
 * @param {boolean} isTrashMode - 휴지통 모드 여부
 */
const MemoEmptyState = ({ isTrashMode }) => {
  return (
    <div className="memo-empty-state">
      <CgNotes className="memo-empty-icon" />
      <div className="memo-empty-text">
        {isTrashMode ? UI_TEXT.EMPTY_TRASH : UI_TEXT.EMPTY_NORMAL}
      </div>
      <div className="memo-empty-subtext">
        {isTrashMode ? UI_TEXT.EMPTY_TRASH_SUB : UI_TEXT.EMPTY_NORMAL_SUB}
      </div>
    </div>
  );
};

/**
 * RecordingStatus 컴포넌트
 *
 * 녹음 중 상태 표시 (타이머 및 볼륨 바)
 *
 * @param {boolean} isRecording - 녹음 중 여부
 * @param {number} elapsedTime - 경과 시간 (초)
 * @param {number} volume - 볼륨 레벨 (0~1)
 */
const RecordingStatus = ({ isRecording, elapsedTime, volume }) => {
  if (!isRecording) return null;

  return (
    <div className="recording-status-left">
      <div className="recording-indicator-timer">{formatTime(elapsedTime)}</div>
      <div className="volume-bar-bg">
        <div
          className="volume-bar-fill"
          style={{ width: `${volume * 100}%` }}
        />
      </div>
    </div>
  );
};

/**
 * TranscribingStatus 컴포넌트
 *
 * 음성 텍스트 변환 중 상태 표시
 *
 * @param {boolean} isTranscribing - 변환 중 여부
 */
const TranscribingStatus = ({ isTranscribing }) => {
  if (!isTranscribing) return null;

  return <div className="transcribing-status-left">텍스트 변환 중...</div>;
};

/**
 * MemoItem 컴포넌트
 *
 * 개별 메모 아이템
 *
 * @param {Object} memo - 메모 객체
 * @param {boolean} isSelected - 선택 여부
 * @param {boolean} isHighlighted - 하이라이트 여부
 * @param {boolean} isTrashMode - 휴지통 모드 여부
 * @param {Function} onSelect - 선택 핸들러
 * @param {Function} onDelete - 삭제 핸들러
 * @param {Function} onRestore - 복구 핸들러
 * @param {Function} onHardDelete - 완전 삭제 핸들러
 */
const MemoItem = ({
  memo,
  isSelected,
  isHighlighted,
  isTrashMode,
  onSelect,
  onDelete,
  onRestore,
  onHardDelete,
}) => {
  const id = memo.memo_id;
  const content = memo.memo_text || "";

  // 액션 호버 핸들러 생성
  const actionHoverHandlers = createActionHoverHandlers(isTrashMode);

  // 메모 클릭 핸들러
  const handleClick = () => {
    if (!isTrashMode && onSelect) {
      onSelect(id);
    }
  };

  // 버튼 클릭 핸들러 (이벤트 전파 방지)
  const createButtonHandler = (handler) => (e) => {
    e.stopPropagation();
    if (handler) handler(id);
  };

  return (
    <div
      className={`memo-item ${isSelected ? "active" : ""} ${
        isHighlighted ? "highlighted" : ""
      } ${isTrashMode ? "trash-mode" : ""}`}
      draggable={!isTrashMode}
      onDragStart={createDragStartHandler(memo, isTrashMode)}
      onDragEnd={handleDragEnd}
    >
      {/* 메모 클릭 영역 */}
      <div className="memo-item-content" onClick={handleClick}>
        <div className="memo-title">
          {memo.memo_title || MEMO_DEFAULTS.UNTITLED}
        </div>
        <div className="memo-preview">{generatePreview(content)}</div>
        <div className="memo-date">{formatDateKST(memo.memo_date)}</div>
      </div>

      {/* 메모 삭제/복구/완전삭제 버튼 */}
      <div className="memo-item-actions" {...actionHoverHandlers}>
        {isTrashMode ? (
          <>
            <button
              className="restore-button"
              onClick={createButtonHandler(onRestore)}
              title={UI_TEXT.TOOLTIP_RESTORE}
            >
              <MdOutlineRestore size={18} />
            </button>
            <button
              className="hard-delete-button"
              onClick={createButtonHandler(onHardDelete)}
              title={UI_TEXT.TOOLTIP_HARD_DELETE}
            >
              <MdDeleteForever size={18} />
            </button>
          </>
        ) : (
          <button
            className="delete-button"
            onClick={createButtonHandler(onDelete)}
            title={UI_TEXT.TOOLTIP_DELETE}
          >
            <IoTrashBinOutline size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

function MemoListPanel({
  memos, // 메모 리스트
  selectedId, // 선택된 메모 ID
  highlightedId, // 하이라이트된 메모 ID
  onSelect, // 메모 클릭 시 호출
  onAdd, // 새 메모 추가 시 호출
  onDelete, // 메모 삭제 시 호출
  onRestore, // 메모 복구 시 호출
  onHardDelete, // 메모 완전 삭제 시 호출
  onEmptyTrash, // 휴지통 비우기 시 호출
}) {
  // ===== 오디오 녹음 훅 =====
  const {
    isRecording,
    isTranscribing,
    elapsedTime,
    volume,
    showOnIcon,
    handleMicClick,
  } = useAudioRecorder(onAdd);

  // ===== UI 상태 관리 (통합) =====
  const [uiState, setUiState] = useState({
    showTrash: false, // 휴지통 모드
    showEmptyTrashDialog: false, // 휴지통 비우기 확인 다이얼로그
    isAddingMemo: false, // 메모 추가 중 상태
  });

  // ===== 파생 상태 (useMemo로 최적화) =====
  // 표시할 메모 리스트 (휴지통 모드에 따라 필터링)
  const displayedMemos = useMemo(() => {
    return filterMemosByMode(memos, uiState.showTrash);
  }, [memos, uiState.showTrash]);

  // 휴지통에 있는 메모 개수
  const trashedMemosCount = useMemo(() => {
    return memos.filter(isMemoDeleted).length;
  }, [memos]);

  // 일반 메모 개수
  const regularMemosCount = useMemo(() => {
    return memos.filter(isRegularMemo).length;
  }, [memos]);

  // ===== 이벤트 핸들러 =====

  /**
   * 새 메모 추가 처리 (연속 클릭 방지)
   */
  const handleAddMemo = async () => {
    if (uiState.isAddingMemo) return;

    setUiState((prev) => ({ ...prev, isAddingMemo: true }));
    try {
      await onAdd("");
    } finally {
      setTimeout(() => {
        setUiState((prev) => ({ ...prev, isAddingMemo: false }));
      }, TIMING.ADD_MEMO_DELAY);
    }
  };

  /**
   * 휴지통 모드 토글
   */
  const toggleTrash = () => {
    setUiState((prev) => ({ ...prev, showTrash: !prev.showTrash }));
  };

  /**
   * 휴지통 비우기 확인 다이얼로그 표시
   */
  const handleEmptyTrash = () => {
    setUiState((prev) => ({ ...prev, showEmptyTrashDialog: true }));
  };

  /**
   * 휴지통 비우기 확인 처리
   */
  const handleConfirmEmptyTrash = () => {
    if (onEmptyTrash && displayedMemos.length > 0) {
      onEmptyTrash();
    }
    setUiState((prev) => ({ ...prev, showEmptyTrashDialog: false }));
  };

  /**
   * 휴지통 비우기 취소
   */
  const handleCancelEmptyTrash = () => {
    setUiState((prev) => ({ ...prev, showEmptyTrashDialog: false }));
  };

  return (
    <div className="memo-list-wrapper notebook-style">
      {/* 상단 헤더: 메모 제목, 마이크, 새 메모 버튼 */}
      <div className="memo-list-header">
        <div className="memo-list-header-left">
          {/* 메모 아이콘 + Note 텍스트 */}
          <div className="memo-list-title-row">
            <span className="memo-title-text">
              {uiState.showTrash ? UI_TEXT.TITLE_TRASH : UI_TEXT.TITLE_NORMAL}
            </span>
          </div>
        </div>

        <div className="memo-list-header-right">
          {/* 마이크 버튼 및 녹음 상태 UI (휴지통 모드에서는 숨김) */}
          {!uiState.showTrash && (
            <div className="mic-wrapper">
              {/* 녹음 중 상태 표시 */}
              <RecordingStatus
                isRecording={isRecording}
                elapsedTime={elapsedTime}
                volume={volume}
              />

              {/* 음성 텍스트 변환 중 상태 표시 */}
              <TranscribingStatus isTranscribing={isTranscribing} />

              {/* 마이크 아이콘 (깜빡이며 상태 표시) */}
              <img
                src={isRecording ? (showOnIcon ? micOn : micOff) : micOff}
                alt="mic"
                className={`mic-icon ${isRecording ? "recording" : ""} ${
                  isTranscribing ? "disabled" : ""
                }`}
                onClick={handleMicClick}
              />
            </div>
          )}

          {/* 새 메모 추가 버튼 (휴지통 모드에서는 숨김) */}
          {!uiState.showTrash && (
            <button
              className={`chat-session-new-chat-button ${
                uiState.isAddingMemo ? "disabled" : ""
              }`}
              onClick={handleAddMemo}
              disabled={uiState.isAddingMemo}
            >
              {uiState.isAddingMemo
                ? UI_TEXT.BUTTON_ADDING
                : UI_TEXT.BUTTON_ADD}
            </button>
          )}

          {/* 휴지통 모드에서만 비우기 버튼 표시 */}
          {uiState.showTrash && displayedMemos.length > 0 && (
            <button
              className="empty-trash-button"
              onClick={handleEmptyTrash}
              title={UI_TEXT.BUTTON_EMPTY_TRASH}
            >
              <MdOutlineDeleteSweep size={14} />
              {UI_TEXT.BUTTON_EMPTY_TRASH}
            </button>
          )}
        </div>
      </div>

      {/* 메모 목록 */}
      <div className="memo-list">
        {/* 메모가 없을 때 표시되는 안내 */}
        {displayedMemos.length === 0 && (
          <MemoEmptyState isTrashMode={uiState.showTrash} />
        )}

        {/* 메모 아이템 목록 렌더링 */}
        {displayedMemos.map((memo) => (
          <MemoItem
            key={memo.memo_id}
            memo={memo}
            isSelected={selectedId === memo.memo_id}
            isHighlighted={highlightedId === memo.memo_id}
            isTrashMode={uiState.showTrash}
            onSelect={onSelect}
            onDelete={onDelete}
            onRestore={onRestore}
            onHardDelete={onHardDelete}
          />
        ))}
      </div>

      {/* 하단 총 개수 표시 및 휴지통 토글 */}
      <div className="memo-footer">
        <div className="memo-count-footer">총 {displayedMemos.length}개</div>

        <div
          className="memo-list-header-toggle"
          style={{
            marginRight: "8px",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "0 16px",
            gap: "8px",
          }}
        >
          <div className="memo-header-icons">
            {!uiState.showTrash ? (
              <BsTrash
                className="header-icon"
                onClick={toggleTrash}
                title={UI_TEXT.TOOLTIP_SHOW_TRASH}
              />
            ) : (
              <CiMemoPad
                className="header-icon"
                onClick={toggleTrash}
                title={UI_TEXT.TOOLTIP_SHOW_MEMOS}
                size={22}
              />
            )}
          </div>
        </div>
      </div>

      {/* 휴지통 비우기 확인 다이얼로그 */}
      {uiState.showEmptyTrashDialog && (
        <ConfirmDialog
          message={`휴지통에 있는 ${displayedMemos.length}개의 메모를 모두 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`}
          onOk={handleConfirmEmptyTrash}
          onCancel={handleCancelEmptyTrash}
          isLoading={false}
        />
      )}
    </div>
  );
}

export default MemoListPanel;
