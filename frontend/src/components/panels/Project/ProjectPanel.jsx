/*
 ProjectPanel.jsx

 왼쪽 사이드바에서 프로젝트(브레인) 목록을 표시하고, 선택/생성 동작을 제공하는 컴포넌트.

 주요 기능:
 1. 백엔드에서 브레인 목록 조회 및 표시(최근 생성 순 정렬)
 2. 항목 클릭 시 해당 프로젝트로 이동 및 상위(onProjectChange)로 알림
 3. 새 프로젝트 생성 모달 열기(NewBrainModal)

 UX/접근성:
 - 현재 선택된 프로젝트는 비활성화 상태로 표시
 - 로컬 프로젝트는 보안 아이콘(MdSecurity)로 구분
*/
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/* API ─ backend */
import { listBrains } from "../../../../api/config/apiIndex";

/* style */
import "./ProjectPanel.css";

import { IoHomeOutline } from "react-icons/io5";
import { AiOutlinePlus } from "react-icons/ai";
import { MdSecurity } from "react-icons/md";
import { BiCloud, BiLaptop } from "react-icons/bi";

import NewBrainModal from "./NewBrainModal";

/**
 * 왼쪽 세로 사이드바 (프로젝트/브레인 아이콘 목록)
 * @param {number}   selectedBrainId   – 현재 열린 브레인 id
 * @param {function} onProjectChange – 상위 컴포넌트로 id 전파
 */
export default function ProjectPanel({ selectedBrainId, onProjectChange }) {
  const nav = useNavigate();
  // ===== 상태 =====
  const [brains, setBrains] = useState([]);
  const [showModal, setShowModal] = useState(false);

  /* ───────── DB 호출 ───────── */
  // 선택된 브레인이 바뀌었을 때 목록을 새로 조회하여 동기화합니다.
  useEffect(() => {
    listBrains()
      .then((data) => {
        setBrains(data);
      })
      .catch(console.error);
  }, [selectedBrainId]);

  /* ───────── 이벤트 ───────── */
  /**
   * 프로젝트 클릭 핸들러
   * - 상위로 선택된 id를 전달하고 해당 라우트로 이동합니다.
   * @param {number} id - 선택한 브레인 id
   */
  const handleProjectClick = (id) => {
    onProjectChange?.(id);
    nav(`/project/${id}`);
  };

  /* ───────── 프로젝트 타입 판별 ───────── */
  /**
   * 프로젝트 타입(cloud/local) 판별
   * - 우선적으로 `deployment_type`을 사용하고, 없을 경우 이름으로 추정합니다.
   * @param {object} brain
   * @returns {"cloud"|"local"}
   */
  const getProjectType = (brain) => {
    // deployment_type 필드가 있으면 우선 사용
    if (brain.deployment_type) {
      return brain.deployment_type.toLowerCase();
    }

    // brain_name으로 추정 (fallback)
    if (
      brain.brain_name?.includes("Cloud") ||
      brain.brain_name?.includes("클라우드")
    ) {
      return "cloud";
    }

    // 기본값은 로컬
    return "local";
  };

  /**
   * 타입 라벨 반환
   * @param {"cloud"|"local"} type
   * @returns {string}
   */
  const getProjectTypeTitle = (type) => {
    return type === "cloud" ? "클라우드 프로젝트" : "로컬 프로젝트";
  };

  /* ───────── UI ───────── */
  return (
    <div className="panel-container sidebar-container">
      <div className="panel-content">
        <div className="sidebar-icons">
          {brains
            .slice()
            // 최근 생성 순서(내림차순)로 정렬
            .sort((a, b) => b.brain_id - a.brain_id)
            .map((b) => {
              const projectType = getProjectType(b);
              return (
                <div
                  key={b.brain_id}
                  className={`sidebar-icon ${
                    selectedBrainId === b.brain_id ? "active disabled" : ""
                  }`}
                  onClick={
                    selectedBrainId === b.brain_id
                      ? undefined
                      : () => handleProjectClick(b.brain_id)
                  }
                >
                  {/* 클라우드/로컬 아이콘 표시 */}
                  <div
                    className="project-type-icon"
                    title={getProjectTypeTitle(projectType)}
                  >
                    {projectType === "local" ? (
                      <BiLaptop size={26} />
                    ) : (
                      <BiCloud size={26} />
                    )}
                  </div>
                  <span className="brain-name-ellipsis">{b.brain_name}</span>

                  {/* 로컬 프로젝트일 때 보안 아이콘 표시 */}
                  {projectType === "local" && (
                    <div
                      className="local-security-icon"
                      title={getProjectTypeTitle(projectType)}
                    >
                      <MdSecurity size={15} />
                    </div>
                  )}
                </div>
              );
            })}

          <div
            className="sidebar-icon add-icon"
            onClick={() => setShowModal(true)}
          >
            <AiOutlinePlus size={27} />
            <span>새 프로젝트</span>
          </div>
        </div>
      </div>

      <div className="sidebar-icon home-icon" onClick={() => nav("/")}>
        <IoHomeOutline size={25} />
        <span>홈으로</span>
      </div>

      {showModal && (
        <NewBrainModal
          onClose={() => setShowModal(false)}
          onCreated={(brain) => setBrains((prev) => [brain, ...prev])}
        />
      )}
    </div>
  );
}
