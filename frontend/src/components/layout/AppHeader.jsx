// AppHeader.jsx
import React, { useEffect, useState } from 'react';
import './AppHeader.css';
import logo from '../../assets/logo.png';
import { FiEdit2 } from 'react-icons/fi';
import { getOrCreateUserName, setUserName } from '../../utils/userName';

export default function AppHeader() {
    const [userName, setUserNameState] = useState('...');
    const [editing, setEditing] = useState(false);
    const [tempName, setTempName] = useState('');
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

    // 사용자 이름 초기화
    useEffect(() => {
        const name = getOrCreateUserName();
        setUserNameState(name);
        setTempName(name);
    }, []);

    const handleSave = () => {
        const trimmed = tempName.trim() || 'user-default';
        setUserName(trimmed);
        setUserNameState(trimmed);
        setEditing(false);
    };

    return (
        <header className="app-header">
            <div className="header-left">
                <img src={logo} alt="brainTrace 로고" className="app-logo" />
                <span className="app-name">brainTrace</span>
            </div>

            <div className="header-right">
                <div className="user-info-block">
                    <div className="today-text">{today}</div>
                    {editing ? (
                        <input
                            value={tempName}
                            onChange={e => setTempName(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') {
                                    setEditing(false);
                                    setTempName(userName);
                                }
                            }}
                            autoFocus
                            className="username-input"
                        />
                    ) : (
                        <button
                            className="avatar-round"
                            onClick={() => setEditing(true)}
                        >
                            {userName}
                            <FiEdit2 className="edit-icon" />
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
