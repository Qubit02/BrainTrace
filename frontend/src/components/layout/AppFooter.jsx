/**
 * AppFooter 컴포넌트
 * 
 * 이 컴포넌트는 애플리케이션의 하단 푸터를 렌더링합니다.
 * 주요 기능:
 * - 개발팀 정보 표시
 * - 연락처 정보 (이메일) 표시
 * - 저작권 정보 표시
 * 
 * 표시되는 정보:
 * - 개발팀: brainTrace 개발팀
 * - 이메일: contact@braintrace.com
 * - 저작권: Copyright brainTrace All rights reserved.
 */
// src/components/layout/AppFooter.jsx
import React from 'react';
import './AppFooter.css';

export default function Footer() {
    return (
        <footer className="app-footer">
            <div className="footer-oss-info">
                <span>brainTrace 개발팀</span>
                <span>E-mail : contact@braintrace.com</span>
                <span>Copyright brainTrace All rights reserved.</span>
            </div>
        </footer>
    );
}
