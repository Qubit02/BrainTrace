/**
 * AppHeader 컴포넌트
 *
 * 이 컴포넌트는 애플리케이션의 상단 헤더를 렌더링합니다.
 * 주요 기능:
 * - 애플리케이션 로고와 이름 표시
 * - 현재 날짜와 시간을 실시간으로 표시
 * - 1분마다 시간 자동 업데이트
 *
 * 상태:
 * - today: 현재 날짜 (YYYY년 MM월 DD일 (요일) 형식)
 * - currentTime: 현재 시간 (HH:MM 형식)
 */
// AppHeader.jsx
import React, { useEffect, useState, useCallback } from "react";
import "./AppHeader.css";
import { PiDropboxLogo } from "react-icons/pi";
import { LiaFacebookMessenger } from "react-icons/lia";
import { FiAperture } from "react-icons/fi";
import { FaCentSign } from "react-icons/fa6";
import { FiBold } from "react-icons/fi";
import appIcon from "../../assets/icons/앱아이콘.png";

export default function AppHeader() {
  const [today, setToday] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  /**
   * 현재 날짜와 시간을 포맷팅하여 상태를 업데이트합니다.
   * 날짜는 "YYYY년 MM월 DD일 (요일)" 형식으로,
   * 시간은 "HH:MM" 형식으로 표시됩니다.
   */
  const updateDateTime = useCallback(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];

    const formatted = `${year}년 ${month}월 ${day}일 (${weekday})`;
    setToday(formatted);

    // 시간 포맷팅
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const timeFormatted = `${hours}:${minutes}`;
    setCurrentTime(timeFormatted);
  }, []);

  /**
   * 컴포넌트 마운트 시 날짜와 시간을 초기화하고,
   * 다음 분의 시작부터 1분마다 시간을 업데이트합니다.
   * 정확한 분 단위 업데이트를 위해 다음 분까지 대기 후 인터벌을 설정합니다.
   */
  useEffect(() => {
    // 초기 실행
    updateDateTime();

    // 다음 분의 시작까지 대기 후 1분마다 업데이트
    const now = new Date();
    const nextMinute = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes() + 1,
      0,
      0
    );
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
        <img src={appIcon} alt="BrainTrace App Icon" className="app-icon" />
        <span className="app-name">BrainTrace</span>
      </div>
      <div className="header-right">
        <span className="today-text strong-date">{today}</span>
        <span className="current-time">{currentTime}</span>
      </div>
    </header>
  );
}
