// src/components/panels/MemoListPanel.jsx
import React, { useState, useRef } from 'react';
import './styles/MemoList.css';
import { CiMemoPad } from 'react-icons/ci';
import micOff from '../../assets/icons/mic_off.png'
import micOn from '../../assets/icons/mic_on.png'
import { IoTrashBinOutline } from "react-icons/io5";
import { CgNotes } from "react-icons/cg";

import useAudioRecorder from '../../hooks/useAudioRecorder';

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
    onDelete         // 메모 삭제 시 호출
}) {

    const {
        isRecording,
        isTranscribing,
        elapsedTime,
        volume,
        showOnIcon,
        handleMicClick
    } = useAudioRecorder(onAdd);

    // 표시할 메모 리스트
    const displayedMemos = memos;

    return (
        <div className="memo-list-wrapper notebook-style">

            {/* 상단 헤더: 메모 제목, 마이크, 새 메모 버튼 */}
            <div className="memo-list-header">
                <div className="memo-list-header-left">
                    {/* 메모 아이콘 + Note 텍스트 */}
                    <div className="memo-list-title-row">
                        <CiMemoPad className="memo-title-icon" />
                        <span className="memo-title-text">Note</span>
                    </div>
                </div>

                <div className="memo-list-header-right">
                    {/* 마이크 버튼 및 녹음 상태 UI */}
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

                    {/* 새 메모 추가 버튼 */}
                    <button className="add-memo-button" onClick={() => onAdd('')}>
                        + 새 메모
                    </button>
                </div>
            </div>

            {/* 메모 목록 */}
            <div className="memo-list">
                {/* 메모가 없을 때 표시되는 안내 */}
                {displayedMemos.length === 0 && (
                    <div className="memo-empty-state">
                        <CgNotes className="memo-empty-icon" />
                        <div className="memo-empty-text">저장된 메모가 여기에 표시됩니다</div>
                        <div className="memo-empty-subtext">
                            중요한 생각을 메모로 남기고<br />
                            드래그해서 소스로 추가하면 그래프에 반영됩니다.
                        </div>
                    </div>
                )}

                {/* 메모 아이템 목록 렌더링 */}
                {displayedMemos.map((memo) => {
                    const id = memo.memo_id;
                    const filename = `${memo.memo_title || '메모'}.memo`;
                    const content = memo.memo_text || '';

                    return (
                        <div
                            key={id}
                            className={`memo-item ${selectedId === id ? 'active' : ''} ${highlightedId === id ? 'highlighted' : ''}`}
                            draggable
                            onDragStart={e => {
                                const dragData = { id, name: filename, content };
                                e.dataTransfer.setData('application/json-memo', JSON.stringify(dragData));
                                e.dataTransfer.effectAllowed = 'copy';
                                e.currentTarget.classList.add('dragging');
                            }}
                            onDragEnd={e => e.currentTarget.classList.remove('dragging')}
                        >
                            {/* 메모 클릭 영역 */}
                            <div className="memo-item-content" onClick={() => onSelect(id)}>
                                <div className="memo-title">{memo.memo_title || '제목 없음'}</div>
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

                            {/* 메모 삭제 버튼 */}
                            <button
                                className="delete-button"
                                onClick={e => {
                                    e.stopPropagation();
                                    onDelete(id);
                                }}
                            >
                                <IoTrashBinOutline size={18} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* 하단 총 개수 표시 */}
            <div className="memo-footer">
                <div className="memo-count-footer">총 {displayedMemos.length}개</div>
            </div>
        </div>
    );
}

export default MemoListPanel;
