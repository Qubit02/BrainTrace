// AppHeader.jsx
import React, { useEffect, useState } from 'react';
import './AppHeader.css';
import logo from '../../assets/logo.png';
import { TbBrandAirtable } from "react-icons/tb";
import { TbBrandAmongUs } from "react-icons/tb";
import { TbBrand4Chan } from "react-icons/tb";
import { TbBrandBilibili } from "react-icons/tb";
import { DiHtml5DeviceAccess } from "react-icons/di";
import { DiGoogleAnalytics } from "react-icons/di";
import { IoLogoOctocat } from "react-icons/io";
import { BiLogoCodepen } from "react-icons/bi";
import { PiDropboxLogo } from "react-icons/pi";
export default function AppHeader() {
    const [today, setToday] = useState('');

    // 날짜 초기화
    useEffect(() => {
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const weekday = weekdays[date.getDay()];

        const formatted = `${year}년 ${month}월 ${day}일 (${weekday})`;
        setToday(formatted);
    }, []);

    return (
        <header className="app-header">
            <div className="header-left">
                <PiDropboxLogo size={29} color='black' style={{ marginRight: 11 }} />
                <span className="app-name">brainTrace</span>
            </div>
            <div className="header-right">
                <span className="today-text strong-date">{today}</span>
            </div>
        </header>
    );
}
