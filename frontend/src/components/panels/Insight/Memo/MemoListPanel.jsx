// src/components/panels/MemoListPanel.jsx
import React, { useState, useRef, useMemo } from 'react';
import './MemoList.css';
import { CiMemoPad } from 'react-icons/ci';
import micOff from '../../../../assets/icons/mic_off.png';
import micOn from '../../../../assets/icons/mic_on.png';
import { IoTrashBinOutline } from "react-icons/io5";
import { CgNotes } from "react-icons/cg";
import { BsTrash } from "react-icons/bs";
import { MdOutlineRestore } from "react-icons/md";
import { MdDeleteForever } from "react-icons/md";
import { MdOutlineDeleteSweep } from "react-icons/md";
import ConfirmDialog from '../../../common/ConfirmDialog';

import useAudioRecorder from '../hooks/useAudioRecorder'

// 초 단위 시간을 mm:ss 포맷으로 변환하는 함수
function formatTime(seconds) {
    const min = String(Math.floor(seconds / 60)).padStart(2, '0');
    const sec = String(seconds % 60).padStart(2, '0');
    return `${min}:${sec}`;
}

function MemoListPanel({
    memos,           // 메모 리스트
    selectedId,      // 선택된 메모 ID
    highlightedId,   // 하이라이트된 메모 ID
    onSelect,        // 메모 클릭 시 호출
    onAdd,           // 새 메모 추가 시 호출
    onDelete,        // 메모 삭제 시 호출
    onRestore,       // 메모 복구 시 호출
    onHardDelete,    // 메모 완전 삭제 시 호출
    onEmptyTrash     // 휴지통 비우기 시 호출
}) {

    const {
        isRecording,
        isTranscribing,
        elapsedTime,
        volume,
        showOnIcon,
        handleMicClick
    } = useAudioRecorder(onAdd);

    // 휴지통 모드 상태
    const [showTrash, setShowTrash] = useState(false);

    // 휴지통 비우기 확인 다이얼로그 상태
    const [showEmptyTrashDialog, setShowEmptyTrashDialog] = useState(false);

    // 표시할 메모 리스트 (휴지통 모드에 따라 필터링)
    const displayedMemos = useMemo(() => {
        return memos.filter(memo => {
            if (showTrash) {
                // 휴지통 모드: is_deleted가 true인 메모만 표시
                return memo.is_deleted === true;
            } else {
                // 일반 모드: is_deleted가 false이거나 null인 메모만 표시하고, is_source가 0인 메모만 표시
                return (memo.is_deleted === false || memo.is_deleted === null || memo.is_deleted === undefined) && 
                       (memo.is_source === 0 || memo.is_source === false);
            }
        });
    }, [memos, showTrash]);

    // 메모 삭제 처리 함수
    const handleDeleteMemo = (memoId) => {
        onDelete(memoId);
    };

    // 메모 복구 처리 함수
    const handleRestoreMemo = (memoId) => {
        if (onRestore) {
            onRestore(memoId);
        }
    };

    // 메모 완전 삭제 처리 함수
    const handleHardDeleteMemo = (memoId) => {
        if (onHardDelete) {
            onHardDelete(memoId);
        }
    };

    // 휴지통 토글 함수
    const toggleTrash = () => {
        setShowTrash(prev => !prev);
    };

    // 휴지통 비우기 처리 함수
    const handleEmptyTrash = () => {
        setShowEmptyTrashDialog(true);
    };

    // 휴지통 비우기 확인 처리 함수
    const handleConfirmEmptyTrash = () => {
        if (onEmptyTrash && displayedMemos.length > 0) {
            onEmptyTrash();
        }
        setShowEmptyTrashDialog(false);
    };

    return (
        <div className="memo-list-wrapper notebook-style">

            {/* 상단 헤더: 메모 제목, 마이크, 새 메모 버튼 */}
            <div className="memo-list-header">
                <div className="memo-list-header-left">
                    {/* 메모 아이콘 + Note 텍스트 */}
                    <div className="memo-list-title-row">
                        <span className="memo-title-text">
                            {showTrash ? 'Trash' : 'Memo'}
                        </span>
                    </div>
                </div>

                <div className="memo-list-header-right">
                    {/* 마이크 버튼 및 녹음 상태 UI (휴지통 모드에서는 숨김) */}
                    {!showTrash && (
                        <div className="mic-wrapper">

                            {/* 녹음 중일 때 타이머와 볼륨 바 표시 */}
                            {isRecording && (
                                <div className="volume-bar-wrapper">
                                    <div className="recording-indicator-timer">
                                        {formatTime(elapsedTime)}
                                    </div>
                                    <div className="volume-bar-bg">
                                        <div
                                            className="volume-bar-fill"
                                            style={{ width: `${volume * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 마이크 아이콘 (깜빡이며 상태 표시) */}
                            <img
                                src={isRecording ? (showOnIcon ? micOn : micOff) : micOff}
                                alt="mic"
                                className={`mic-icon ${isRecording ? 'recording' : ''} ${isTranscribing ? 'disabled' : ''}`}
                                onClick={handleMicClick}
                            />

                            {/* 음성 텍스트 변환 중 상태 표시 */}
                            {isTranscribing && (
                                <div
                                    className="transcribing-indicator"
                                    style={{ marginTop: '8px', color: '#666', fontSize: '13px' }}
                                >
                                    텍스트 변환 중...
                                </div>
                            )}
                        </div>
                    )}

                    {/* 새 메모 추가 버튼 (휴지통 모드에서는 숨김) */}
                    {!showTrash && (
                        <button className="chat-session-new-chat-button" onClick={() => onAdd('')}>
                            + 새 메모
                        </button>
                    )}

                    {/* 휴지통 모드에서만 비우기 버튼 표시 */}
                    {showTrash && displayedMemos.length > 0 && (
                        <button
                            className="empty-trash-button"
                            onClick={handleEmptyTrash}
                            title="휴지통 비우기"
                        >
                            <MdOutlineDeleteSweep size={14} />
                            전체 비우기
                        </button>
                    )}
                </div>
            </div>

            {/* 메모 목록 */}
            <div className="memo-list">
                {/* 메모가 없을 때 표시되는 안내 */}
                {displayedMemos.length === 0 && (
                    <div className="memo-empty-state">
                        <CgNotes className="memo-empty-icon" />
                        <div className="memo-empty-text">
                            {showTrash ? '휴지통이 비어있습니다' : '저장된 메모가 여기에 표시됩니다'}
                        </div>
                        <div className="memo-empty-subtext">
                            {showTrash ? 
                                '삭제된 메모가 여기에 표시됩니다' :
                                '중요한 생각을 메모로 남기고\n드래그해서 소스로 추가하면 그래프에 반영됩니다.'
                            }
                        </div>
                    </div>
                )}

                {/* 메모 아이템 목록 렌더링 */}
                {displayedMemos.map((memo) => {
                    const id = memo.memo_id;
                    const filename = `${memo.memo_title || '메모'}.memo`;
                    const content = memo.memo_text || '';
                    const isSource = memo.is_source === 1 || memo.is_source === true;

                    return (
                        <div
                            key={id}
                            className={`memo-item ${selectedId === id ? 'active' : ''} ${highlightedId === id ? 'highlighted' : ''} ${showTrash ? 'trash-mode' : ''}`}
                            draggable={!showTrash}
                            onDragStart={e => {
                                if (!showTrash) {
                                    const dragData = { id, name: filename, content };
                                    e.dataTransfer.setData('application/json-memo', JSON.stringify(dragData));
                                    e.dataTransfer.effectAllowed = 'copy';
                                    e.currentTarget.classList.add('dragging');
                                }
                            }}
                            onDragEnd={e => e.currentTarget.classList.remove('dragging')}
                        >
                            {/* 메모 클릭 영역 */}
                            <div className="memo-item-content" onClick={() => !showTrash && onSelect(id)}>
                                <div className="memo-title">
                                    {memo.memo_title || '제목 없음'}
                                </div>
                                <div className="memo-preview">
                                    {content.length > 0
                                        ? content.slice(0, 40).replace(/\n/g, ' ')
                                        : '내용 없음'}
                                    ...
                                </div>
                                <div className="memo-date">
                                    {memo.memo_date
                                        ? new Date(memo.memo_date).toLocaleDateString()
                                        : ''}
                                </div>
                            </div>

                            {/* 메모 삭제/복구/완전삭제 버튼 */}
                            <div 
                                className="memo-item-actions"
                                onMouseEnter={e => {
                                    if (!showTrash) {
                                        e.currentTarget.parentElement.classList.add('actions-hover');
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!showTrash) {
                                        e.currentTarget.parentElement.classList.remove('actions-hover');
                                    }
                                }}
                            >
                                {showTrash ? (
                                    <>
                                        <button
                                            className="restore-button"
                                            onClick={e => {
                                                e.stopPropagation();
                                                handleRestoreMemo(id);
                                            }}
                                            title="메모 복구"
                                        >
                                            <MdOutlineRestore size={18} />
                                        </button>
                                        <button
                                            className="hard-delete-button"
                                            onClick={e => {
                                                e.stopPropagation();
                                                handleHardDeleteMemo(id);
                                            }}
                                            title="메모 완전 삭제"
                                        >
                                            <MdDeleteForever size={18} />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="delete-button"
                                        onClick={e => {
                                            e.stopPropagation();
                                            handleDeleteMemo(id);
                                        }}
                                        title="메모 삭제"
                                    >
                                        <IoTrashBinOutline size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 하단 총 개수 표시 및 휴지통 토글 */}
            <div className="memo-footer">
                <div className="memo-count-footer">총 {displayedMemos.length}개</div>

                <div className="memo-list-header-toggle" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 16px', gap: '8px' }}>
                    <div className="memo-header-icons">
                        {!showTrash ? (
                            <BsTrash
                                className="header-icon"
                                onClick={toggleTrash}
                                title="휴지통 보기"
                            />
                        ) : (
                            <CiMemoPad
                                className="header-icon"
                                onClick={toggleTrash}
                                title="메모 목록으로"
                                size={22}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* 휴지통 비우기 확인 다이얼로그 */}
            {showEmptyTrashDialog && (
                <ConfirmDialog
                    message={`휴지통에 있는 ${displayedMemos.length}개의 메모를 모두 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`}
                    onOk={handleConfirmEmptyTrash}
                    onCancel={() => setShowEmptyTrashDialog(false)}
                    isLoading={false}
                />
            )}
        </div>
    );
}

export default MemoListPanel;
