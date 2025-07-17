// AppHeader.jsx
import React, { useEffect, useState } from 'react';
import './AppHeader.css';
import logo from '../../assets/logo.png';

export default function AppHeader() {
    const [today, setToday] = useState('');

    // 날짜 초기화
    useEffect(() => {
        const date = new Date();
        const formatted = date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short',
        });
        setToday(formatted);
    }, []);

    return (
        <header className="app-header">
            <div className="header-left">
                <img src={logo} alt="brainTrace 로고" className="app-logo" />
                <span className="app-name">brainTrace</span>
            </div>
            <div className="header-right">
                <span className="today-text strong-date">{today}</span>
            </div>
        </header>
    );
}
