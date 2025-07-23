import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    listBrains,
    deleteBrain,
    renameBrain,
    createBrain
} from '../../../api/backend';
import { getSourceCountByBrain } from '../../../api/graphApi';

import AppHeader from './AppHeader';
import AppFooter from './AppFooter';
import { RiDeleteBinLine } from "react-icons/ri";
import { GoPencil } from "react-icons/go";
import ConfirmDialog from '../common/ConfirmDialog';
import './ProjectListView.css';
import { FaPlus } from "react-icons/fa";

export default function ProjectListView() {
    const nav = useNavigate();

    /* ───────── state ───────── */
    const [sortOption, setSortOption] = useState('최신 항목');
    const [brains, setBrains] = useState([]);
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false); // 삭제 로딩 상태

    /* ───────── 애니메이션 상태 ───────── */
    const [displayText, setDisplayText] = useState('');
    const [showCards, setShowCards] = useState(false);
    const [showSortButton, setShowSortButton] = useState(false);
    const [animationComplete, setAnimationComplete] = useState(false);

    const fullText = '당신만의 세컨드 브레인을 만들어보세요.';

    const fetchBrains = () => { // 모든 브레인 가져오기
        listBrains()
            .then(setBrains)
            .catch(console.error);
    };

    useEffect(() => {
        fetchBrains();
    }, []);

    /* ───────── 타이핑 애니메이션 ───────── */
    useEffect(() => {
        const hasVisited = sessionStorage.getItem('hasVisited');

        if (hasVisited) {
            // 이미 한 번 본 경우: 애니메이션 없이 바로 카드 보이기
            setDisplayText(fullText);
            setAnimationComplete(true);
            setShowCards(true);
            setShowSortButton(true);
        } else {
            // 처음 접속한 경우: 애니메이션 실행
            sessionStorage.setItem('hasVisited', 'true');

            let timeoutId;
            let currentIndex = 0;

            const typeText = () => {
                if (currentIndex <= fullText.length) {
                    setDisplayText(fullText.slice(0, currentIndex));
                    currentIndex++;
                    timeoutId = setTimeout(typeText, 80); // 타이핑 속도
                } else {
                    // 타이핑 완료 후 1초 대기 후 제목을 위로 이동
                    setTimeout(() => {
                        setAnimationComplete(true); // 먼저 제목을 위로 이동
                        setTimeout(() => {
                            setShowCards(true);
                            setTimeout(() => {
                                setShowSortButton(true);
                            }, 300);
                        }, 800);
                    }, 1000);
                }
            };

            const initialDelay = setTimeout(typeText, 500);

            return () => {
                clearTimeout(timeoutId);
                clearTimeout(initialDelay);
            };
        }
    }, []);

    /* 팝업 외부 클릭 시 자동 닫기 */
    useEffect(() => {
        const close = () => setMenuOpenId(null);
        if (menuOpenId !== null) document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [menuOpenId]);

    /* ───────── 정렬 ───────── */
    const sorted = useMemo(() => {
        const arr = [...brains];
        if (sortOption === '제목') {
            arr.sort((a, b) =>
                (a.brain_name || '').localeCompare(b.brain_name || '')
            );
        } else {
            arr.sort((a, b) => b.brain_id - a.brain_id);
        }
        return arr;
    }, [brains, sortOption]);

    /* 소스 개수 상태 */
    const [sourceCounts, setSourceCounts] = useState({}); // {brain_id: count}

    // 모든 브레인 소스 개수 fetch
    useEffect(() => {
        if (!brains.length) return;
        let cancelled = false;
        (async () => {
            const counts = {};
            await Promise.all(brains.map(async (b) => {
                try {
                    const res = await getSourceCountByBrain(b.brain_id);
                    counts[b.brain_id] = res.total_count;
                } catch {
                    counts[b.brain_id] = 0;
                }
            }));
            if (!cancelled) setSourceCounts(counts);
        })();
        return () => { cancelled = true; };
    }, [brains]);

    /* ───────── 제목 저장 함수 ───────── */
    async function handleSaveTitle(brain) {
        const newTitle = tempTitle.trim() || 'Untitled';
        setEditingId(null);
        if (newTitle === brain.brain_name) return;

        try {
            const updated = await renameBrain(brain.brain_id, newTitle);
            setBrains(prev =>
                prev.map(b => (b.brain_id === brain.brain_id ? updated : b))
            );
        } catch {
            alert('제목 수정 실패');
        }
    }

    return (
        <div className="project-list-page" style={{ backgroundColor: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <AppHeader />

            <div className="project-list-view" style={{ flex: 1 }}>
                {/* 페이지 헤더 */}
                <div className="project-header" style={{
                    textAlign: 'center',
                    margin: '35px 0 16px',
                    transform: animationComplete ? 'translateY(0)' : 'translateY(25vh)',
                    transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    <h1
                        className={`page-highlight ${animationComplete ? 'animation-complete' : ''}`}
                        style={{
                            fontSize: '40px',
                            lineHeight: '1.4',
                            minHeight: '56px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {displayText}
                        <span className="typing-cursor">|</span>
                    </h1>
                </div>
                {/* 정렬 드롭다운 */}
                <div
                    className={`project-header-controls ${showSortButton ? 'visible' : ''}`}
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginBottom: 20,
                        paddingRight: 20,
                        opacity: showSortButton ? 1 : 0,
                        transform: showSortButton ? 'translateY(0)' : 'translateY(-10px)',
                        transition: 'all 0.5s ease',
                        position: 'relative',
                        zIndex: 1000
                    }}
                >
                    <div className="sort-dropdown">
                        <button className="sort-button">
                            {sortOption}
                            <img
                                src="/src/assets/icons/arrow-down.png"
                                alt="dropdown"
                                className="dropdown-arrow"
                                width={12}
                                height={12}
                                style={{ marginLeft: '8px' }}
                            />
                        </button>
                        <div className="sort-menu">
                            {['최신 항목', '제목'].map(option => (
                                <div
                                    key={option}
                                    className="sort-menu-item"
                                    onClick={() => setSortOption(option)}
                                >
                                    {option}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {/* 프로젝트 카드 그리드 */}
                <div className={`project-grid ${showCards ? 'cards-visible' : ''}`}>
                    {sorted.map((p, index) => {
                        return (
                            <div
                                key={p.brain_id}
                                className={`project-card ${highlightId === p.brain_id ? 'highlighted' : ''}`}
                                data-id={p.brain_id}
                                style={{
                                    opacity: showCards ? 1 : 0,
                                    transform: showCards ? 'translateY(0)' : 'translateY(20px)',
                                    transition: `all 0.6s ease ${index * 0.1}s`,
                                }}
                                onClick={e => {
                                    if (e.target.closest('.card-menu')) return;
                                    if (editingId === p.brain_id || e.target.closest('.project-name')) return;
                                    nav(`/project/${p.brain_id}`);
                                }}
                            >
                                {/* 아이콘 */}
                                <div className="project-icon" >
                                    <img width={30} src='/brainnormal.png' />
                                </div>

                                {/* 제목 (인라인 편집) */}
                                <div
                                    className={`project-name ${editingId === p.brain_id ? 'editing' : ''}`}
                                    contentEditable={editingId === p.brain_id}
                                    suppressContentEditableWarning
                                    data-placeholder="Untitled"
                                    onInput={e => setTempTitle(e.currentTarget.textContent)}
                                    onKeyDown={e => {
                                        if (e.key === 'Escape') {
                                            e.currentTarget.textContent = p.brain_name;
                                            setEditingId(null);
                                        }
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveTitle(p);
                                        }
                                    }}
                                    onBlur={() => editingId === p.brain_id && handleSaveTitle(p)}
                                    style={{
                                        cursor: editingId === p.brain_id ? 'text' : 'pointer',
                                        pointerEvents: editingId === p.brain_id ? 'auto' : 'none'
                                    }}
                                >
                                    {editingId === p.brain_id
                                        ? null // editing 중일 땐 내부를 비워두고 placeholder만 표시
                                        : (p.brain_name || '')}

                                </div>
                                {
                                    // placeholder
                                    editingId === p.brain_id && !tempTitle && (
                                        <div className="editable-placeholder">Untitled</div>
                                    )
                                }

                                {/* 생성일자 + 소스 개수 (오른쪽 고정) */}
                                <div className="project-date" style={{ display: 'flex', alignItems: 'center' }}>
                                    <span>{p.created_at ?? '날짜 없음'}</span>
                                    <span style={{ marginLeft: 'auto', color: '#888', fontSize: '1.02em', fontWeight: 550 }}>
                                        (소스 {sourceCounts[p.brain_id] ?? 0}개)
                                    </span>
                                </div>

                                {/* ⋮ 메뉴 */}
                                <div
                                    className="card-menu"
                                    onClick={e => {
                                        e.stopPropagation();
                                        setMenuOpenId(prev => prev === p.brain_id ? null : p.brain_id);
                                    }}
                                >
                                    ⋮
                                    {menuOpenId === p.brain_id && (
                                        <div className="card-menu-popup" onClick={e => e.stopPropagation()}>
                                            <div
                                                className="popup-item"
                                                onClick={() => {
                                                    setEditingId(p.brain_id);
                                                    setTempTitle(p.brain_name);
                                                    setMenuOpenId(null);
                                                    setTimeout(() => {
                                                        const el = document.querySelector(`.project-card[data-id="${p.brain_id}"] .project-name`);
                                                        if (el) {
                                                            el.focus();
                                                            const sel = window.getSelection();
                                                            const range = document.createRange();
                                                            range.selectNodeContents(el);
                                                            range.collapse(false);
                                                            sel.removeAllRanges();
                                                            sel.addRange(range);
                                                        }
                                                    }, 0);
                                                }}
                                            >
                                                <GoPencil size={14} style={{ marginRight: 4 }} />
                                                제목 수정
                                            </div>
                                            <div
                                                className="popup-item"
                                                onClick={() => {
                                                    setConfirmId(p.brain_id);
                                                    setMenuOpenId(null);
                                                }}
                                            >
                                                <RiDeleteBinLine size={14} style={{ marginRight: 4 }} />
                                                삭제
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <div
                        className="project-card add-card"
                        style={{
                            opacity: showCards ? 1 : 0,
                            transform: showCards ? 'translateY(0)' : 'translateY(20px)',
                            transition: `all 0.6s ease ${sorted.length * 0.1}s`,
                        }}
                        onClick={async () => {
                            try {
                                const newBrain = await createBrain({
                                    brain_name: 'Untitled'
                                });

                                setBrains(prev => [newBrain, ...prev]);
                                setHighlightId(newBrain.brain_id);
                                setTimeout(() => {
                                    setHighlightId(null);
                                    setEditingId(newBrain.brain_id);
                                    setTempTitle(newBrain.brain_name);

                                    // 👉 DOM 렌더 후 포커싱
                                    requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                            const el = document.querySelector(`.project-card[data-id="${newBrain.brain_id}"] .project-name`);
                                            if (el) {
                                                el.focus();
                                                const sel = window.getSelection();
                                                const range = document.createRange();
                                                range.selectNodeContents(el);
                                                range.collapse(false); // 끝으로 이동
                                                sel.removeAllRanges();
                                                sel.addRange(range);
                                            }
                                        });
                                    });
                                }, 1000); // 하이라이팅 유지 후

                            } catch (err) {
                                alert(err.response?.data?.detail ?? '생성 실패');
                            }
                        }}
                    >
                        <div className="add-card-content">
                            <FaPlus size={26} />
                            <span>새 프로젝트</span>
                        </div>
                    </div>
                </div>
            </div>

            <AppFooter />

            {/* 삭제 확인 다이얼로그 */}
            {confirmId !== null && (
                <ConfirmDialog
                    message="이 프로젝트를 삭제하시겠습니까?"
                    onCancel={() => {
                        if (!isDeleting) setConfirmId(null);
                    }}
                    isLoading={isDeleting}
                    onOk={async () => {
                        setIsDeleting(true);
                        try {
                            await deleteBrain(confirmId);
                            setBrains(prev => prev.filter(b => b.brain_id !== confirmId));
                        } catch {
                            alert('삭제 실패');
                        }
                        setIsDeleting(false);
                        setConfirmId(null);
                    }}
                />
            )}
        </div>
    );
}