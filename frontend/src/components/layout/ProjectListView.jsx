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
} from '../../../api/config/apiIndex';
import { getSourceCountByBrain } from '../../../api/services/graphApi';
import { clearAllHighlightingData } from '../panels/Source/viewer/Highlighting.jsx';

import AppHeader from './AppHeader';
import AppFooter from './AppFooter';
import { RiDeleteBinLine } from "react-icons/ri";
import { GoPencil } from "react-icons/go";
import { FaStar, FaRegStar } from "react-icons/fa";
import { MdSecurity } from "react-icons/md";
import { FaPlus } from "react-icons/fa";
import { IoIosArrowDown } from "react-icons/io";
import { BiWorld, BiCloud, BiLaptop } from "react-icons/bi";
import ConfirmDialog from '../common/ConfirmDialog';
import NewBrainModal from '../panels/Project/NewBrainModal';
import './ProjectListView.css';

export default function ProjectListView() {
    const navigate = useNavigate();

    // ===== 상태 관리 =====
    const [sortOption, setSortOption] = useState('최신 항목');
    const [filterOption, setFilterOption] = useState('전체'); // 필터 옵션 추가
    const [brains, setBrains] = useState([]);
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showNewBrainModal, setShowNewBrainModal] = useState(false);


    // 애니메이션 상태
    const [displayText, setDisplayText] = useState('');
    const [showTyping, setShowTyping] = useState(false);
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
            setShowTyping(false);
            setAnimationComplete(true);
            setShowSortButton(true);
        } else {
            // 처음 방문한 경우: 타이핑 애니메이션 실행
            sessionStorage.setItem('hasVisited', 'true');
            setShowTyping(true);

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
                        setShowTyping(false);
                        setAnimationComplete(true);
                        // 필터 컨트롤 표시
                        setTimeout(() => {
                            setShowSortButton(true);
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

    // ===== 필터링 및 정렬 로직 =====
    const filteredAndSorted = useMemo(() => {
        // 1. 필터링
        let filtered = [...brains];
        switch (filterOption) {
            case '로컬':
                filtered = brains.filter(brain => brain.deployment_type === 'local');
                break;
            case '클라우드':
                filtered = brains.filter(brain => brain.deployment_type === 'cloud');
                break;
            default: // '전체'
                filtered = brains;
                break;
        }

        // 2. 정렬
        switch (sortOption) {
            case '제목':
                filtered.sort((a, b) =>
                    (a.brain_name || '').localeCompare(b.brain_name || '')
                );
                break;
            case '소스 많은순':
                filtered.sort((a, b) => {
                    const countA = sourceCounts[a.brain_id] || 0;
                    const countB = sourceCounts[b.brain_id] || 0;
                    return countB - countA; // 소스 많은순
                });
                break;
            case '중요한 항목':
                // 중요도가 설정된 프로젝트를 먼저 표시
                // 중요도가 같으면 최신순으로 정렬
                filtered.sort((a, b) => {
                    if (a.is_important && !b.is_important) return -1;
                    if (!a.is_important && b.is_important) return 1;
                    return b.brain_id - a.brain_id; // 중요도가 같으면 최신순
                });
                break;
            default: // '최신 항목'
                filtered.sort((a, b) => b.brain_id - a.brain_id);
                break;
        }
        return filtered;
    }, [brains, filterOption, sortOption, sourceCounts]);

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
    const handleCreateProject = () => {
        setShowNewBrainModal(true);
    };

    // ===== 새 프로젝트 생성 완료 함수 =====
    const handleProjectCreated = (newBrain) => {
        setBrains(prev => [newBrain, ...prev]);
        setHighlightId(newBrain.brain_id);

        // 하이라이트 효과만 적용하고 편집 모드는 제거
        setTimeout(() => {
            setHighlightId(null);
        }, 1000);
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

            <div className="project-list-view" data-first-visit={!sessionStorage.getItem('hasVisited')}>
                {/* 페이지 헤더 */}
                <div className={`project-header ${animationComplete ? 'animation-complete' : ''}`}>
                    <h1 className={`page-highlight ${animationComplete ? 'animation-complete' : ''}`}>
                        {displayText}
                        {showTyping && <span className="typing-cursor">|</span>}
                    </h1>
                </div>

                {/* 필터 및 정렬 컨트롤 */}
                <div className={`project-header-controls ${showSortButton ? 'visible' : ''}`}>
                    {/* 필터 탭 */}
                    <div className="filter-tabs">
                        {[
                            { key: '전체', label: '전체', icon: <BiWorld /> },
                            { key: '로컬', label: '로컬', icon: <BiLaptop /> },
                            { key: '클라우드', label: '클라우드', icon: <BiCloud /> }
                        ].map(option => (
                            <button
                                key={option.key}
                                className={`filter-tab ${filterOption === option.key ? 'active' : ''}`}
                                onClick={() => setFilterOption(option.key)}
                            >
                                {option.icon}
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {/* 정렬 드롭다운 */}
                    <div className="sort-dropdown">
                        <button className="sort-button">
                            {sortOption}
                            <IoIosArrowDown
                                size={14}
                                className="dropdown-arrow"
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

                {/* 필터 안내 메시지 */}
                {filterOption === '전체' && showSortButton && (
                    <div className="filter-info-message">
                        <div className="info-icon">
                            <BiWorld size={24} />
                        </div>
                        <div className="info-content">
                            <h3>모든 프로젝트</h3>
                            <p>로컬과 클라우드 프로젝트를 모두 확인할 수 있습니다.</p>
                            <ul>
                                <li>• 로컬: 보안 강화, 오프라인 사용</li>
                                <li>• 클라우드: 빠른 속도, 높은 정확도</li>
                                <li>• 상황에 맞게 선택하세요! (보안 vs 속도)</li>
                            </ul>
                        </div>
                    </div>
                )}

                {filterOption === '로컬' && showSortButton && (
                    <div className="filter-info-message">
                        <div className="info-icon">
                            <BiLaptop size={24} />
                        </div>
                        <div className="info-content">
                            <h3>로컬 프로젝트</h3>
                            <p>데이터가 내 컴퓨터에서 처리되어 보안이 강화됩니다.</p>
                            <ul>
                                <li>• 오프라인에서도 사용 가능</li>
                                <li>• 데이터가 외부로 전송되지 않음</li>
                                <li>• 개인정보 보호 강화</li>
                            </ul>
                        </div>
                    </div>
                )}

                {filterOption === '클라우드' && showSortButton && (
                    <div className="filter-info-message">
                        <div className="info-icon">
                            <BiCloud size={24} />
                        </div>
                        <div className="info-content">
                            <h3>클라우드 프로젝트</h3>
                            <p>인터넷을 통해 강력한 AI 모델을 사용합니다.</p>
                            <ul>
                                <li>• 빠른 응답 속도</li>
                                <li>• 높은 정확도</li>
                                <li>• 최신 AI 모델 사용</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* 프로젝트 카드 그리드 */}
                <div className={`project-grid ${showSortButton ? 'visible' : ''}`}>
                    {filteredAndSorted.map((project, index) => (
                        <div
                            key={project.brain_id}
                            className={`project-card ${highlightId === project.brain_id ? 'highlighted' : ''} ${project.deployment_type === 'local' ? 'local-deployment' : 'cloud-deployment'}`}
                            data-id={project.brain_id}
                            style={{ '--card-index': index }}
                            onClick={e => {
                                if (e.target.closest('.card-menu')) return;
                                if (editingId === project.brain_id || e.target.closest('.project-name')) return;
                                navigate(`/project/${project.brain_id}`);
                            }}
                        >
                            {/* 프로젝트 아이콘 */}
                            <div className="project-icon">
                                <img width={30} src='/brainnormal.png' alt="프로젝트 아이콘" />
                                {/* 배포 타입 표시 */}
                                <div className="deployment-badge">
                                    {project.deployment_type === 'local' ? (
                                        <>
                                            로컬
                                            <MdSecurity size={12} style={{ marginLeft: '4px', color: 'black', verticalAlign: 'middle' }} />
                                        </>
                                    ) : (
                                        '클라우드'
                                    )}
                                </div>
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
                        style={{ '--card-index': filteredAndSorted.length }}
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

            {/* 새 프로젝트 생성 모달 */}
            {showNewBrainModal && (
                <NewBrainModal
                    onClose={() => setShowNewBrainModal(false)}
                    onCreated={handleProjectCreated}
                />
            )}
        </div>
    );
}