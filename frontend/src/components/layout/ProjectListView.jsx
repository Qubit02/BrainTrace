/**
 * ProjectListView.jsx
 * 
 * 프로젝트 목록 페이지 컴포넌트
 * 
 * 주요 기능:
 * - 브레인(프로젝트) 목록 표시 및 관리
 * - 새 프로젝트 생성
 * - 프로젝트 제목 인라인 편집
 * - 프로젝트 삭제 (확인 다이얼로그 포함)
 * - 프로젝트 정렬 (최신순/제목순)
 * - 타이핑 애니메이션 효과
 * - 프로젝트 카드 클릭 시 해당 프로젝트로 이동
 * - 소스 개수 표시
 * - 프로젝트의 중요도를 별표로 표시/해제하는 기능
 
 * 상태 관리:
 * - 브레인 목록 데이터
 * - 정렬 옵션
 * - 편집 모드
 * - 메뉴 팝업 상태
 * - 애니메이션 상태
 * 
 * API 연동:
 * - listBrains: 브레인 목록 조회
 * - createBrain: 새 브레인 생성
 * - renameBrain: 브레인 이름 변경
 * - deleteBrain: 브레인 삭제
 * - getSourceCountByBrain: 소스 개수 조회
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    listBrains,
    deleteBrain,
    renameBrain,
    createBrain,
    toggleBrainImportance
} from '../../../api/backend';
import { getSourceCountByBrain } from '../../../api/graphApi';
import { clearAllHighlightingData } from '../panels/Source/viewer/Highlighting.jsx';

import AppHeader from './AppHeader';
import AppFooter from './AppFooter';
import { RiDeleteBinLine } from "react-icons/ri";
import { GoPencil } from "react-icons/go";
import { FaStar, FaRegStar } from "react-icons/fa";
import ConfirmDialog from '../common/ConfirmDialog';
import './ProjectListView.css';
import { FaPlus } from "react-icons/fa";

export default function ProjectListView() {
    const navigate = useNavigate();

    // ===== 상태 관리 =====
    const [sortOption, setSortOption] = useState('최신 항목');
    const [brains, setBrains] = useState([]);
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);


    // 애니메이션 상태
    const [displayText, setDisplayText] = useState('');
    const [showCards, setShowCards] = useState(false);
    const [showSortButton, setShowSortButton] = useState(false);
    const [animationComplete, setAnimationComplete] = useState(false);

    const fullText = '지식을 연결하고, 아이디어를 확장하세요.';

    // ===== 브레인 데이터 관리 =====
    const fetchBrains = () => {
        listBrains()
            .then(setBrains)
            .catch(console.error);
    };

    useEffect(() => {
        fetchBrains();
    }, []);

    // ===== 타이핑 애니메이션 =====
    useEffect(() => {
        const hasVisited = sessionStorage.getItem('hasVisited');

        if (hasVisited) {
            // 이미 방문한 경우: 애니메이션 없이 바로 표시
            setDisplayText(fullText);
            setAnimationComplete(true);
            setShowCards(true);
            setShowSortButton(true);
        } else {
            // 처음 방문한 경우: 타이핑 애니메이션 실행
            sessionStorage.setItem('hasVisited', 'true');

            let timeoutId;
            let currentIndex = 0;

            const typeText = () => {
                if (currentIndex <= fullText.length) {
                    setDisplayText(fullText.slice(0, currentIndex));
                    currentIndex++;
                    timeoutId = setTimeout(typeText, 80);
                } else {
                    // 타이핑 완료 후 순차적 애니메이션
                    setTimeout(() => {
                        setAnimationComplete(true);
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

    // 팝업 외부 클릭 시 자동 닫기
    useEffect(() => {
        const close = () => setMenuOpenId(null);
        if (menuOpenId !== null) document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [menuOpenId]);

    // ===== 소스 개수 관리 =====
    const [sourceCounts, setSourceCounts] = useState({});

    // ===== 정렬 로직 =====
    const sorted = useMemo(() => {
        const arr = [...brains];
        switch (sortOption) {
            case '제목':
                arr.sort((a, b) =>
                    (a.brain_name || '').localeCompare(b.brain_name || '')
                );
                break;
            case '소스 많은순':
                arr.sort((a, b) => {
                    const countA = sourceCounts[a.brain_id] || 0;
                    const countB = sourceCounts[b.brain_id] || 0;
                    return countB - countA; // 소스 많은순
                });
                break;
            case '중요한 항목':
                // 중요도가 설정된 프로젝트를 먼저 표시
                // 중요도가 같으면 최신순으로 정렬
                arr.sort((a, b) => {
                    if (a.is_important && !b.is_important) return -1;
                    if (!a.is_important && b.is_important) return 1;
                    return b.brain_id - a.brain_id; // 중요도가 같으면 최신순
                });
                break;
            default: // '최신 항목'
                arr.sort((a, b) => b.brain_id - a.brain_id);
                break;
        }
        return arr;
    }, [brains, sortOption, sourceCounts]);

    // ===== 소스 개수 업데이트 =====
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

    // ===== 제목 편집 함수 =====
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

    // ===== 새 프로젝트 생성 함수 =====
    const handleCreateProject = async () => {
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

                // DOM 렌더 후 포커싱
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const el = document.querySelector(`.project-card[data-id="${newBrain.brain_id}"] .project-name`);
                        if (el) {
                            el.focus();
                            const sel = window.getSelection();
                            const range = document.createRange();
                            range.selectNodeContents(el);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    });
                });
            }, 1000);

        } catch (err) {
            alert(err.response?.data?.detail ?? '생성 실패');
        }
    };

    // ===== 프로젝트 삭제 함수 =====
    const handleDeleteProject = async () => {
        setIsDeleting(true);
        try {
            await deleteBrain(confirmId);
            clearAllHighlightingData();
            setBrains(prev => prev.filter(b => b.brain_id !== confirmId));
        } catch {
            alert('삭제 실패');
        }
        setIsDeleting(false);
        setConfirmId(null);
    };

    // ===== 제목 편집 시작 함수 =====
    const startEditing = (brain) => {
        setEditingId(brain.brain_id);
        setTempTitle(brain.brain_name);
        setMenuOpenId(null);
        
        setTimeout(() => {
            const el = document.querySelector(`.project-card[data-id="${brain.brain_id}"] .project-name`);
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
    };

    // ===== 중요도 토글 함수 =====
    const handleToggleImportance = async (brain, e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            const updatedBrain = await toggleBrainImportance(brain.brain_id);
            setBrains(prev =>
                prev.map(b => (b.brain_id === brain.brain_id ? updatedBrain : b))
            );
        } catch (error) {
            console.error('중요도 토글 실패:', error);
            alert('중요도 변경에 실패했습니다.');
        }
    };

    return (
        <div className="project-list-page">
            <AppHeader />

            <div className="project-list-view">
                {/* 페이지 헤더 */}
                <div className={`project-header ${animationComplete ? 'animation-complete' : ''}`}>
                    <h1 className={`page-highlight ${animationComplete ? 'animation-complete' : ''}`}>
                        {displayText}
                        <span className="typing-cursor">|</span>
                    </h1>
                </div>

                {/* 정렬 드롭다운 */}
                <div className={`project-header-controls ${showSortButton ? 'visible' : ''}`}>
                    <div className="sort-dropdown">
                        <button className="sort-button">
                            {sortOption}
                            <img
                                src="/src/assets/icons/arrow-down.png"
                                alt="dropdown"
                                className="dropdown-arrow"
                                width={12}
                                height={12}
                            />
                        </button>
                            <div className="sort-menu">
                             {[
                                 '최신 항목',
                                 '제목',
                                 '소스 많은순',
                                 '중요한 항목'
                             ].map(option => (
                                <div
                                    key={option}
                                    className="sort-menu-item"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSortOption(option);
                                    }}
                                >
                                    {option}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 프로젝트 카드 그리드 */}
                <div className={`project-grid ${showCards ? 'cards-visible' : ''}`}>
                    {sorted.map((project, index) => (
                        <div
                            key={project.brain_id}
                            className={`project-card ${highlightId === project.brain_id ? 'highlighted' : ''}`}
                            data-id={project.brain_id}
                            style={{
                                opacity: showCards ? 1 : 0,
                                transform: showCards ? 'translateY(0)' : 'translateY(20px)',
                                transition: `all 0.6s ease ${index * 0.1}s`,
                            }}
                            onClick={e => {
                                if (e.target.closest('.card-menu')) return;
                                if (editingId === project.brain_id || e.target.closest('.project-name')) return;
                                navigate(`/project/${project.brain_id}`);
                            }}
                        >
                            {/* 프로젝트 아이콘 */}
                            <div className="project-icon">
                                <img width={30} src='/brainnormal.png' alt="프로젝트 아이콘" />
                            </div>

                             {/* 중요도 별표 */}
                             {/* 클릭 시 프로젝트의 중요도를 토글하는 별표 아이콘 */}
                             {/* - 중요도 설정 시: 노란색 채워진 별표 */}
                             {/* - 중요도 해제 시: 회색 빈 별표 */}
                             <div 
                                 className="importance-star"
                                 onClick={(e) => handleToggleImportance(project, e)}
                                 onMouseDown={(e) => e.stopPropagation()}
                                 onMouseUp={(e) => e.stopPropagation()}
                                 title={project.is_important ? "중요 해제" : "중요로 설정"}
                             >
                                 {project.is_important ? (
                                     <FaStar size={16} color="#FFD700" />
                                 ) : (
                                     <FaRegStar size={16} color="#ccc" />
                                 )}
                             </div>

                            {/* 제목 (인라인 편집) */}
                            <div
                                className={`project-name ${editingId === project.brain_id ? 'editing' : ''}`}
                                contentEditable={editingId === project.brain_id}
                                suppressContentEditableWarning
                                data-placeholder="Untitled"
                                onInput={e => setTempTitle(e.currentTarget.textContent)}
                                onKeyDown={e => {
                                    if (e.key === 'Escape') {
                                        e.currentTarget.textContent = project.brain_name;
                                        setEditingId(null);
                                    }
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveTitle(project);
                                    }
                                }}
                                onBlur={() => editingId === project.brain_id && handleSaveTitle(project)}
                                style={{
                                    cursor: editingId === project.brain_id ? 'text' : 'pointer',
                                    pointerEvents: editingId === project.brain_id ? 'auto' : 'none'
                                }}
                            >
                                {editingId === project.brain_id
                                    ? null
                                    : (project.brain_name || '')}
                            </div>

                            {/* 편집 중 placeholder */}
                            {editingId === project.brain_id && !tempTitle && (
                                <div className="editable-placeholder">Untitled</div>
                            )}

                            {/* 생성일자 및 소스 개수 */}
                            <div className="project-date">
                                <span>{project.created_at ?? '날짜 없음'}</span>
                                <span className="source-count">
                                    (소스 {sourceCounts[project.brain_id] ?? 0}개)
                                </span>
                            </div>

                            {/* 메뉴 버튼 */}
                            <div
                                className="card-menu"
                                onClick={e => {
                                    e.stopPropagation();
                                    setMenuOpenId(prev => prev === project.brain_id ? null : project.brain_id);
                                }}
                            >
                                ⋮
                                {menuOpenId === project.brain_id && (
                                    <div className="card-menu-popup" onClick={e => e.stopPropagation()}>
                                        <div
                                            className="popup-item"
                                            onClick={() => startEditing(project)}
                                        >
                                            <GoPencil size={14} />
                                            제목 수정
                                        </div>
                                        <div
                                            className="popup-item"
                                            onClick={() => {
                                                setConfirmId(project.brain_id);
                                                setMenuOpenId(null);
                                            }}
                                        >
                                            <RiDeleteBinLine size={14} />
                                            삭제
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* 새 프로젝트 추가 카드 */}
                    <div
                        className="project-card add-card"
                        style={{
                            opacity: showCards ? 1 : 0,
                            transform: showCards ? 'translateY(0)' : 'translateY(20px)',
                            transition: `all 0.6s ease ${sorted.length * 0.1}s`,
                        }}
                        onClick={handleCreateProject}
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
                    onOk={handleDeleteProject}
                />
            )}
        </div>
    );
}