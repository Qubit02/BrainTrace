// src/components/panels/MemoListPanel.jsx
import React, { useState, useRef } from 'react';
import './styles/MemoList.css';
import { CiMemoPad } from 'react-icons/ci';
import { MdOutlineRestore } from "react-icons/md";
import { BsTrash } from "react-icons/bs";
import micOff from '../../assets/icons/mic_off.png'
import micOn from '../../assets/icons/mic_on.png'
import { IoTrashBinOutline } from "react-icons/io5";
import { CgNotes } from "react-icons/cg";
import { LuTrash } from "react-icons/lu";

import { transcribeAudio } from '../../../../backend/services/backend';

function formatTime(seconds) {
    const min = String(Math.floor(seconds / 60)).padStart(2, '0');
    const sec = String(seconds % 60).padStart(2, '0');
    return `${min}:${sec}`;
}

function MemoListPanel({
    memos,
    deletedMemos,
    selectedId,
    highlightedId,
    onSelect,
    onAdd,
    onDelete,
    onRestore
}) {
    const [isRecording, setIsRecording] = useState(false);
    const [showTrash, setShowTrash] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showOnIcon, setShowOnIcon] = useState(true);

    const [volume, setVolume] = useState(0);  // 0 ~ 1 사이
    const [isTranscribing, setIsTranscribing] = useState(false);

    const isTrash = showTrash;
    const displayedMemos = isTrash ? deletedMemos : memos;

    const intervalRef = useRef(null);
    const blinkRef = useRef(null);

    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);
    const sourceRef = useRef(null);
    const volumeIntervalRef = useRef(null);

    const handleMicClick = async () => {
        if (isTranscribing) {
            return; // 변환 중에는 녹음 시작/중지 막기
        }
        if (!isRecording) {
            // 🎤 녹음 시작
            recordedChunksRef.current = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            // ▶ 오디오 볼륨 측정용 AudioContext 설정
            audioContextRef.current = new AudioContext();
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;

            const bufferLength = analyserRef.current.frequencyBinCount;
            dataArrayRef.current = new Uint8Array(bufferLength);

            sourceRef.current.connect(analyserRef.current);

            // 🎚️ 볼륨 측정 루프
            volumeIntervalRef.current = setInterval(() => {
                analyserRef.current.getByteFrequencyData(dataArrayRef.current);
                const avg = dataArrayRef.current.reduce((a, b) => a + b, 0) / bufferLength;
                setVolume(avg / 255); // 0~1 정규화
            }, 100);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                clearInterval(volumeIntervalRef.current);
                try {
                    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                        await audioContextRef.current.close();
                    }
                } catch (e) {
                    console.warn("AudioContext 종료 오류:", e);
                }

                const recordedChunks = recordedChunksRef.current;
                if (recordedChunks.length === 0) {
                    alert("녹음된 오디오가 없습니다.");
                    return;
                }

                const blob = new Blob(recordedChunks, { type: 'audio/webm' });
                const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });

                setIsTranscribing(true); // 🔸 로딩 시작
                try {
                    const result = await transcribeAudio(file);
                    const transcribedText = result.text || '';
                    if (transcribedText.trim().length > 0) {
                        await onAdd(transcribedText);
                    } else {
                        alert("🎤 텍스트를 추출하지 못했습니다.");
                    }
                } catch (err) {
                    console.error('변환 오류:', err);
                    alert('음성 텍스트 변환에 실패했습니다.');
                } finally {
                    setIsTranscribing(false); // 🔸 로딩 종료
                }
            };
            mediaRecorder.start();
            setElapsedTime(0);
            intervalRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
            blinkRef.current = setInterval(() => setShowOnIcon(prev => !prev), 1000);
        } else {
            // ⏹️ 녹음 중지
            clearInterval(intervalRef.current);
            clearInterval(blinkRef.current);
            clearInterval(volumeIntervalRef.current);
            audioContextRef.current?.close();

            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        }

        setIsRecording(prev => !prev);
    };


    return (
        <div className="memo-list-wrapper notebook-style">
            <div className="memo-list-header">
                <div className="memo-list-header-left">
                    <div className="memo-list-title-row">
                        {isTrash ? (
                            <>
                                <BsTrash className="memo-title-icon" />
                                <span className="memo-title-text">bin</span>
                            </>
                        ) : (
                            <>
                                <CiMemoPad className="memo-title-icon" />
                                <span className="memo-title-text">Note</span>
                            </>
                        )}
                    </div>
                </div>


                <div className="memo-list-header-right">
                    {isTrash && (
                        <div className="tooltip-container">
                            <span className="tooltip-icon">?</span>
                            <div className="tooltip-text">
                                휴지통에 있는 메모는<br />30일 후 자동 삭제됩니다.
                            </div>
                        </div>
                    )}

                    {!isTrash && (
                        <>
                            <div className="mic-wrapper">
                                {isRecording && (
                                    <div className="volume-bar-wrapper">
                                        <div className="recording-indicator-timer">{formatTime(elapsedTime)}</div>
                                        <div className="volume-bar-bg">
                                            <div className="volume-bar-fill" style={{ width: `${volume * 100}%` }} />
                                        </div>
                                    </div>

                                )}
                                <img
                                    src={isRecording ? (showOnIcon ? micOn : micOff) : micOff}
                                    alt="mic"
                                    className={`mic-icon ${isRecording ? 'recording' : ''} ${isTranscribing ? 'disabled' : ''}`}
                                    onClick={handleMicClick}
                                />

                                {isTranscribing && (
                                    <div className="transcribing-indicator" style={{ marginTop: '8px', color: '#666', fontSize: '13px' }}>
                                        텍스트 변환 중...
                                    </div>
                                )}

                            </div>

                            <button className="add-memo-button" onClick={() => onAdd('')}>+ 새 메모</button>
                        </>
                    )}
                </div>
            </div>
            <div className="memo-list">
                {displayedMemos.length === 0 && (
                    <div className="memo-empty-state">
                        {!isTrash ? (
                            <>
                                <CgNotes className="memo-empty-icon" />
                                <div className="memo-empty-text">저장된 메모가 여기에 표시됩니다</div>
                                <div className="memo-empty-subtext">
                                    중요한 생각을 메모로 남기고<br />드래그해서 소스로 추가하면 그래프에 반영됩니다.
                                </div>
                            </>
                        ) : (
                            <>
                                <LuTrash className="memo-empty-icon" />
                                <div className="memo-empty-text">휴지통이 비어 있어요</div>
                                <div className="memo-empty-subtext">
                                    삭제된 메모가 이곳에 표시됩니다.<br />
                                    메모는 30일 후 자동으로 완전히 삭제돼요.
                                </div>
                            </>
                        )}
                    </div>
                )}


                {displayedMemos.map((memo) => {
                    const filename = `${memo.memo_title || '메모'}.txt`;
                    const content = memo.memo_text || '';

                    return (
                        <div
                            key={memo.memo_id}
                            className={`memo-item ${isTrash ? 'trash' : ''} ${selectedId === memo.memo_id ? 'active' : ''} ${highlightedId === memo.memo_id ? 'highlighted' : ''}`}
                            draggable={!isTrash}
                            onDragStart={!isTrash ? e => {
                                const dragData = { name: filename, content };
                                e.dataTransfer.setData('application/json-memo', JSON.stringify(dragData));
                                e.dataTransfer.effectAllowed = 'copy';
                                e.currentTarget.classList.add('dragging');
                            } : undefined}
                            onDragEnd={!isTrash ? e => e.currentTarget.classList.remove('dragging') : undefined}
                        >
                            <div className="memo-item-content" onClick={() => !isTrash && onSelect(memo.memo_id)}>
                                <div className="memo-title">{memo.memo_title || '제목 없음'}</div>
                                <div className="memo-preview">
                                    {(content.length > 0 ? content.slice(0, 40).replace(/\n/g, ' ') : '내용 없음')}...
                                </div>
                                <div className="memo-date">
                                    {memo.memo_date ? new Date(memo.memo_date).toLocaleDateString() : ''}
                                </div>

                            </div>

                            {!isTrash ? (
                                <button
                                    className="delete-button"
                                    onClick={e => {
                                        e.stopPropagation();
                                        onDelete(memo.memo_id);
                                    }}
                                >
                                    <IoTrashBinOutline size={18} />
                                </button>
                            ) : (
                                <button
                                    className="restore-button"
                                    onClick={() => onRestore(memo.memo_id)}
                                >
                                    <MdOutlineRestore />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="memo-footer">
                <div className="memo-count-footer">총 {displayedMemos.length}개</div>

                <div className="memo-list-header-toggle" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 16px', gap: '8px' }}>
                    <div className="memo-header-icons">
                        {!showTrash ? (
                            <BsTrash
                                className="header-icon"
                                onClick={() => setShowTrash(true)}
                                title="휴지통 보기"
                            />
                        ) : (
                            <CiMemoPad
                                className="header-icon"
                                onClick={() => setShowTrash(false)}
                                title="메모 목록으로"
                                size={22}
                            />
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
}

export default MemoListPanel;
