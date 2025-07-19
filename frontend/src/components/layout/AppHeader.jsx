// AppHeader.jsx
import React, { useEffect, useState, useCallback } from 'react';
import './AppHeader.css';
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
    const [currentTime, setCurrentTime] = useState('');

    // 날짜와 시간 업데이트 함수
    const updateDateTime = useCallback(() => {
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const weekday = weekdays[date.getDay()];

        const formatted = `${year}년 ${month}월 ${day}일 (${weekday})`;
        setToday(formatted);

        // 시간 포맷팅
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const timeFormatted = `${hours}:${minutes}`;
        setCurrentTime(timeFormatted);
    }, []);

    // 날짜와 시간 초기화
    useEffect(() => {

        // 초기 실행
        updateDateTime();

        // 다음 분의 시작까지 대기 후 1분마다 업데이트
        const now = new Date();
        const nextMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 0);
        const delayToNextMinute = nextMinute.getTime() - now.getTime();

        const timeoutId = setTimeout(() => {
            updateDateTime(); // 첫 번째 분 업데이트
            const intervalId = setInterval(updateDateTime, 60000); // 이후 1분마다 업데이트

            // cleanup 함수에서 interval 정리
            return () => clearInterval(intervalId);
        }, delayToNextMinute);

        // cleanup 함수
        return () => {
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <header className="app-header">
            <div className="header-left">
                <PiDropboxLogo size={29} color='black' style={{ marginRight: 11 }} />
                <span className="app-name">brainTrace</span>
            </div>
            <div className="header-right">
                <span className="today-text strong-date">{today}</span>
                <span className="current-time">{currentTime}</span>
            </div>
        </header>
    );
}
