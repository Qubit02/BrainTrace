/**
 * AppFooter 컴포넌트
 *
 * 이 컴포넌트는 애플리케이션의 하단 푸터를 렌더링합니다.
 * 주요 기능:
 * - 개발팀 정보 표시
 * - 연락처 정보 (이메일) 표시
 * - 저작권 정보 표시
 * - GitHub 링크 표시
 *
 * 표시되는 정보:
 * - 개발팀: brainTrace 개발팀
 * - 이메일: yes490411@gmail.com
 * - 저작권: Copyright brainTrace All rights reserved.
 * - GitHub: https://github.com/Metamong0711/BrainTrace
 */
// src/components/layout/AppFooter.jsx
import React from "react";
import { FaGithub } from "react-icons/fa";
import "./AppFooter.css";

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-oss-info">
        <span>brainTrace 개발팀</span>
        <span>E-mail : yes490411@gmail.com</span>
        <a
          href="https://github.com/Metamong0711/BrainTrace"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          <FaGithub size={16} />
          <span>GitHub</span>
        </a>
        <span>Copyright brainTrace All rights reserved.</span>
      </div>
    </footer>
  );
}
