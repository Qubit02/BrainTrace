// src/components/layout/ProjectPanel.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* API ─ backend */
import { listBrains } from '../../../../api/config/apiIndex';

/* style */
import './ProjectPanel.css';

import { IoHomeOutline } from 'react-icons/io5';
import { AiOutlinePlus } from 'react-icons/ai';
import { MdSecurity } from 'react-icons/md';

import NewBrainModal from './NewBrainModal';

/**
 * 왼쪽 세로 사이드바 (프로젝트/브레인 아이콘 목록)
 * @param {number}   selectedBrainId   – 현재 열린 브레인 id
 * @param {function} onProjectChange – 상위 컴포넌트로 id 전파
 */
export default function ProjectPanel({ selectedBrainId, onProjectChange }) {
  const nav = useNavigate();
  const [brains, setBrains] = useState([]);
  const [showModal, setShowModal] = useState(false);

  /* ───────── DB 호출 ───────── */
  useEffect(() => {
    listBrains()
      .then(data => {
        setBrains(data);
      })
      .catch(console.error);
  }, [selectedBrainId]);

  /* ───────── 이벤트 ───────── */
  const handleProjectClick = id => {
    onProjectChange?.(id);
    nav(`/project/${id}`);
  };

  /* ───────── 프로젝트 타입 판별 ───────── */
  const getProjectType = (brain) => {
    // deployment_type 필드가 있으면 우선 사용
    if (brain.deployment_type) {
      return brain.deployment_type.toLowerCase();
    }
    
    // brain_name으로 추정 (fallback)
    if (brain.brain_name?.includes('Cloud') || brain.brain_name?.includes('클라우드')) {
      return 'cloud';
    }
    
    // 기본값은 로컬
    return 'local';
  };

  const getProjectTypeTitle = (type) => {
    return type === 'cloud' ? '클라우드 프로젝트' : '로컬 프로젝트';
  };

  /* ───────── UI ───────── */
  return (
    <div className="panel-container sidebar-container">
      <div className="panel-content">
        <div className="sidebar-icons">
          {brains.slice().sort((a, b) => b.brain_id - a.brain_id)
            .map(b => {
              const projectType = getProjectType(b);
              return (
                <div
                  key={b.brain_id}
                  className={`sidebar-icon ${selectedBrainId === b.brain_id ? 'active disabled' : ''}`}
                  onClick={selectedBrainId === b.brain_id ? undefined : () => handleProjectClick(b.brain_id)}
                >
                  <img
                    width={30}
                    src={selectedBrainId === b.brain_id ? '/brainbanzzak.png' : '/brainnormal.png'}
                    style={{ flexShrink: 0 }}
                    alt={b.brain_name}
                  />
                  <span className="brain-name-ellipsis">{b.brain_name}</span>
                  
                  {/* 로컬 프로젝트일 때만 MdSecurity 아이콘 표시 */}
                  {projectType === 'local' && (
                    <div className="local-security-icon" title={getProjectTypeTitle(projectType)}>
                      <MdSecurity size={15} />
                    </div>
                  )}
                </div>
              );
            })}
          
          <div className="sidebar-icon add-icon" onClick={() => setShowModal(true)}>
            <AiOutlinePlus size={27} />
            <span>새 프로젝트</span>
          </div>
        </div>
      </div>
      
      <div className="sidebar-icon home-icon" onClick={() => nav('/')}>
        <IoHomeOutline size={25} />
        <span>홈으로</span>
      </div>
      
      {showModal && (
        <NewBrainModal
          onClose={() => setShowModal(false)}
          onCreated={brain => setBrains(prev => [brain, ...prev])}
        />
      )}
    </div>
  );
}
