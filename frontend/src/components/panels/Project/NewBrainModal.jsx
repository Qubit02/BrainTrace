// src/components/NewBrainModal.jsx
import React, { useEffect, useState, useRef } from "react";
import { createBrain } from "../../../../api/config/apiIndex";
import "./NewBrainModal.css";
import { FaCloud } from "react-icons/fa";
import { MdSecurity } from "react-icons/md";

export default function NewBrainModal({ onClose, onCreated }) {
  // 프로젝트 이름 상태
  const [name, setName] = useState("");

  // 배포 타입 상태 (cloud 또는 local)
  const [deploymentType, setDeploymentType] = useState("cloud");

  // API 요청 중 여부 상태
  const [loading, setLoading] = useState(false);

  // 입력창 포커스를 위한 ref
  const inputRef = useRef(null);

  // 모달 열리면 자동 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 생성 버튼 시 실행
  const handleSubmit = async (e) => {
    e.preventDefault(); // 폼 기본 제출 막기
    setLoading(true);
    try {
      // API 요청: 새로운 브레인 생성
      const newBrain = await createBrain({
        brain_name: name,
        deployment_type: deploymentType,
      });

      // 상위 컴포넌트에 전달
      onCreated(newBrain);
      onClose();
    } catch (err) {
      // 에러 메시지 출력
      alert(err.response?.data?.detail ?? "생성 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-back">
      <form className="modal-box" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3>새 프로젝트 만들기</h3>
          <button type="button" onClick={onClose} className="close-button">
            ✕
          </button>
        </div>

        {/* 배포 타입 선택 */}
        <div className="deployment-type-section">
          <h4>배포 타입 선택</h4>
          <div className="deployment-options">
            <div
              className={`deployment-option ${
                deploymentType === "cloud" ? "selected" : ""
              }`}
              onClick={() => setDeploymentType("cloud")}
            >
              <div className="deployment-icon">
                <FaCloud size={24} color="#4A90E2" />
              </div>
              <div className="deployment-content">
                <h5>클라우드</h5>
                <p>OpenAI GPT 모델 사용</p>
                <ul>
                  <li>• 빠른 응답 속도</li>
                  <li>• 높은 정확도</li>
                  <li>• 인터넷 연결 필요</li>
                </ul>
              </div>
            </div>

            <div
              className={`deployment-option ${
                deploymentType === "local" ? "selected" : ""
              }`}
              onClick={() => setDeploymentType("local")}
            >
              <div className="deployment-icon">
                <MdSecurity size={24} color="#FF6B6B" />
              </div>
              <div className="deployment-content">
                <h5>로컬</h5>
                <p>Ollama 로컬 모델 사용</p>
                <ul>
                  <li>• 데이터 보안 강화</li>
                  <li>• 오프라인 사용 가능</li>
                  <li>• 로컬 리소스 사용</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 프로젝트 이름 입력 */}
        <div className="project-name-section">
          <label htmlFor="project-name">프로젝트 이름</label>
          <input
            ref={inputRef}
            id="project-name"
            type="text"
            placeholder="프로젝트 이름 입력"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* 생성 버튼: 입력 없으면 비활성화 */}
        <button type="submit" disabled={loading || !name.trim()}>
          {loading ? "저장 중…" : "생성"}
        </button>
      </form>
    </div>
  );
}
