// src/components/layout/ProjectPanel.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* API ─ backend */
import { listBrains } from '../../../../backend/services/backend';

/* style */
import './styles/Common.css';
import './styles/ProjectPanel.css';
import './styles/Scrollbar.css';

import { IoHomeOutline } from 'react-icons/io5';
import { AiOutlinePlus } from 'react-icons/ai';

import NewBrainModal from '../NewBrainModal';

/**
 * 왼쪽 세로 사이드바 (프로젝트/브레인 아이콘 목록)
 * @param {number}   activeProject   – 현재 열린 브레인 id
 * @param {function} onProjectChange – 상위 컴포넌트로 id 전파
 */
export default function ProjectPanel({ activeProject, onProjectChange }) {
  const nav = useNavigate();
  const [brains, setBrains] = useState([]);
  const [showModal, setShowModal] = useState(false);

  /* ───────── DB 호출 ───────── */
  useEffect(() => {
    listBrains()
      .then(setBrains)
      .catch(console.error);
  }, []);

  /* ───────── 이벤트 ───────── */
  const handleProjectClick = id => {
    onProjectChange?.(id);
    nav(`/project/${id}`);
  };

  /* ───────── UI ───────── */
  return (
    <div className="panel-container sidebar-container">
      <div className="panel-content">
        <div className="sidebar-icons">
          {brains.slice().sort((a, b) => b.brain_id - a.brain_id)
            .map(b => {
              return (
                <div
                  key={b.brain_id}
                  className={`sidebar-icon ${activeProject === b.brain_id ? 'active' : ''}`}
                  onClick={() => handleProjectClick(b.brain_id)}
                >
                  <img
                    width={30}
                    src={activeProject === b.brain_id ? '/brainbanzzak.png' : '/brain.png'}
                    style={{ flexShrink: 0 }}
                  />
                  <span className="brain-name-ellipsis">{b.brain_name}</span>
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
