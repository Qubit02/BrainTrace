/**
 * SpaceBackground.jsx - 우주 배경 컴포넌트
 *
 * 기능:
 * - 그래프 뷰어의 풀스크린 모드에서 우주 테마 배경 제공
 * - 다크모드/라이트모드에 따른 다른 배경 스타일 적용
 * - 별들이 움직이는 애니메이션 효과
 * - 고정 위치(fixed)로 전체 화면을 덮는 배경
 * - 모드 변경 시 부드러운 페이드 전환 효과 (두 배경을 겹쳐서 구현)
 *
 * Props:
 * - isVisible: 배경 표시 여부 (기본값: false)
 * - isDarkMode: 다크모드 여부 (기본값: true)
 *
 * 스타일 특징:
 * - 다크모드: 우주 공간 느낌의 어두운 그라데이션 + 컬러풀한 별들
 * - 라이트모드: 부드러운 파스텔 그라데이션 + 은은한 컬러 별들
 * - 별들은 CSS 애니메이션으로 천천히 움직임
 * - 모드 변경 시 0.8초 동안 부드러운 전환 효과
 *
 * 사용법:
 * <SpaceBackground isVisible={true} isDarkMode={isDarkMode} />
 */

import React, { useState, useEffect } from "react";

const SpaceBackground = ({ isVisible = false, isDarkMode = true }) => {
  // 배경이 보이지 않으면 렌더링하지 않음
  if (!isVisible) return null;

  // === 다크모드용 배경 스타일 정의 ===
  // 우주 공간 느낌의 어두운 그라데이션과 컬러풀한 별들
  const darkModeStyles = {
    background: `
            radial-gradient(ellipse at center, #0a0a1a 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%),
            radial-gradient(circle at 20% 30%, rgba(135, 206, 235, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(255, 215, 0, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(255, 105, 180, 0.1) 0%, transparent 50%)
        `,
    starBackground: `
            radial-gradient(2px 2px at 50px 50px, #ffffff, transparent),
            radial-gradient(2px 2px at 150px 150px, #87ceeb, transparent),
            radial-gradient(1px 1px at 250px 100px, #ffd700, transparent),
            radial-gradient(2px 2px at 350px 200px, #ff69b4, transparent),
            radial-gradient(1px 1px at 450px 50px, #98fb98, transparent),
            radial-gradient(2px 2px at 550px 300px, #ffffff, transparent),
            radial-gradient(1px 1px at 650px 150px, #87ceeb, transparent),
            radial-gradient(2px 2px at 750px 250px, #ffd700, transparent),
            radial-gradient(1px 1px at 850px 100px, #ff69b4, transparent),
            radial-gradient(2px 2px at 950px 350px, #98fb98, transparent),
            radial-gradient(1px 1px at 100px 300px, #ffffff, transparent),
            radial-gradient(2px 2px at 200px 80px, #87ceeb, transparent),
            radial-gradient(1px 1px at 300px 250px, #ffd700, transparent),
            radial-gradient(2px 2px at 400px 120px, #ff69b4, transparent),
            radial-gradient(1px 1px at 500px 350px, #98fb98, transparent),
            radial-gradient(2px 2px at 600px 180px, #ffffff, transparent),
            radial-gradient(1px 1px at 700px 320px, #87ceeb, transparent),
            radial-gradient(2px 2px at 800px 90px, #ffd700, transparent),
            radial-gradient(1px 1px at 900px 280px, #ff69b4, transparent),
            radial-gradient(2px 2px at 1000px 150px, #98fb98, transparent),
            radial-gradient(1px 1px at 120px 120px, #ffffff, transparent),
            radial-gradient(2px 2px at 220px 220px, #87ceeb, transparent),
            radial-gradient(1px 1px at 320px 320px, #ffd700, transparent),
            radial-gradient(2px 2px at 420px 420px, #ff69b4, transparent),
            radial-gradient(1px 1px at 520px 520px, #98fb98, transparent),
            radial-gradient(2px 2px at 620px 620px, #ffffff, transparent),
            radial-gradient(1px 1px at 720px 720px, #87ceeb, transparent),
            radial-gradient(2px 2px at 820px 820px, #ffd700, transparent),
            radial-gradient(1px 1px at 920px 920px, #ff69b4, transparent),
            radial-gradient(2px 2px at 1020px 1020px, #98fb98, transparent),
            radial-gradient(1px 1px at 180px 280px, #ffffff, transparent),
            radial-gradient(2px 2px at 280px 380px, #87ceeb, transparent),
            radial-gradient(1px 1px at 380px 480px, #ffd700, transparent),
            radial-gradient(2px 2px at 480px 580px, #ff69b4, transparent),
            radial-gradient(1px 1px at 580px 680px, #98fb98, transparent),
            radial-gradient(2px 2px at 680px 780px, #ffffff, transparent),
            radial-gradient(1px 1px at 780px 880px, #87ceeb, transparent),
            radial-gradient(2px 2px at 880px 980px, #ffd700, transparent),
            radial-gradient(1px 1px at 980px 1080px, #ff69b4, transparent),
            radial-gradient(2px 2px at 1080px 1180px, #98fb98, transparent)
        `,
  };

  // === 라이트모드용 배경 스타일 정의 ===
  // 부드러운 파스텔 그라데이션과 은은한 컬러 별들
  const lightModeStyles = {
    background: `
            radial-gradient(ellipse at center, #ffffff 0%, #f8f9fa 15%, #f1f3f4 30%, #e8eaed 50%, #dadce0 70%, #bdc1c6 85%, #9aa0a6 100%),
            radial-gradient(circle at 20% 20%, rgba(147, 197, 253, 0.08) 0%, transparent 70%),
            radial-gradient(circle at 80% 80%, rgba(251, 191, 36, 0.06) 0%, transparent 70%),
            radial-gradient(circle at 50% 15%, rgba(167, 139, 250, 0.04) 0%, transparent 70%),
            radial-gradient(circle at 15% 65%, rgba(34, 197, 94, 0.03) 0%, transparent 70%),
            radial-gradient(circle at 85% 35%, rgba(236, 72, 153, 0.03) 0%, transparent 70%),
            radial-gradient(circle at 35% 85%, rgba(59, 130, 246, 0.02) 0%, transparent 70%),
            radial-gradient(circle at 65% 45%, rgba(16, 185, 129, 0.02) 0%, transparent 70%)
        `,
    starBackground: `
            radial-gradient(1.5px 1.5px at 80px 80px, #3b82f6, transparent),
            radial-gradient(1px 1px at 180px 180px, #60a5fa, transparent),
            radial-gradient(1.5px 1.5px at 280px 120px, #8b5cf6, transparent),
            radial-gradient(1px 1px at 380px 220px, #10b981, transparent),
            radial-gradient(1.5px 1.5px at 480px 80px, #f59e0b, transparent),
            radial-gradient(1px 1px at 580px 320px, #ef4444, transparent),
            radial-gradient(1.5px 1.5px at 680px 180px, #06b6d4, transparent),
            radial-gradient(1px 1px at 780px 280px, #ec4899, transparent),
            radial-gradient(1.5px 1.5px at 880px 140px, #84cc16, transparent),
            radial-gradient(1px 1px at 980px 360px, #f97316, transparent),
            radial-gradient(1.5px 1.5px at 120px 320px, #6366f1, transparent),
            radial-gradient(1px 1px at 220px 100px, #14b8a6, transparent),
            radial-gradient(1px 1px at 320px 260px, #f43f5e, transparent),
            radial-gradient(1px 1px at 420px 140px, #a855f7, transparent),
            radial-gradient(1px 1px at 520px 360px, #22c55e, transparent),
            radial-gradient(1px 1px at 620px 200px, #eab308, transparent),
            radial-gradient(1px 1px at 720px 340px, #0ea5e9, transparent),
            radial-gradient(1px 1px at 820px 120px, #f97316, transparent),
            radial-gradient(1px 1px at 920px 240px, #8b5cf6, transparent),
            radial-gradient(1px 1px at 1020px 180px, #06b6d4, transparent),
            radial-gradient(1px 1px at 150px 150px, #3b82f6, transparent),
            radial-gradient(1px 1px at 250px 250px, #60a5fa, transparent),
            radial-gradient(1px 1px at 350px 350px, #8b5cf6, transparent),
            radial-gradient(1px 1px at 450px 450px, #10b981, transparent),
            radial-gradient(1px 1px at 550px 550px, #f59e0b, transparent),
            radial-gradient(1px 1px at 650px 650px, #ef4444, transparent),
            radial-gradient(1px 1px at 750px 750px, #06b6d4, transparent),
            radial-gradient(1px 1px at 850px 850px, #ec4899, transparent),
            radial-gradient(1px 1px at 950px 950px, #84cc16, transparent),
            radial-gradient(1px 1px at 1050px 1050px, #f97316, transparent),
            radial-gradient(1px 1px at 200px 300px, #6366f1, transparent),
            radial-gradient(1px 1px at 300px 400px, #14b8a6, transparent),
            radial-gradient(1px 1px at 400px 500px, #f43f5e, transparent),
            radial-gradient(1px 1px at 500px 600px, #a855f7, transparent),
            radial-gradient(1px 1px at 600px 700px, #22c55e, transparent),
            radial-gradient(1px 1px at 700px 800px, #eab308, transparent),
            radial-gradient(1px 1px at 800px 900px, #0ea5e9, transparent),
            radial-gradient(1px 1px at 900px 1000px, #f97316, transparent),
            radial-gradient(1px 1px at 1000px 1100px, #8b5cf6, transparent),
            radial-gradient(1px 1px at 1100px 1200px, #06b6d4, transparent)
        `,
  };

  return (
    // === 우주 배경 컨테이너 ===
    // 전체 화면을 덮는 고정 위치 배경
    <div
      className="space-background-container"
      style={{
        position: "fixed", // 화면 스크롤과 무관하게 고정
        top: 0, // 화면 최상단
        left: 0, // 화면 최좌측
        width: "100vw", // 뷰포트 전체 너비
        height: "100vh", // 뷰포트 전체 높이
        zIndex: -1, // 다른 요소들 뒤에 배치
        pointerEvents: "none", // 마우스 이벤트 무시 (배경 클릭 방지)
      }}
    >
      {/* === 다크모드 배경 레이어 === */}
      <div
        style={{
          position: "absolute", // 부모 요소 기준 절대 위치
          top: 0, // 부모 최상단
          left: 0, // 부모 최좌측
          width: "100%", // 부모 전체 너비
          height: "100%", // 부모 전체 높이
          background: darkModeStyles.background, // 다크모드 배경 그라데이션
          opacity: isDarkMode ? 1 : 0, // 다크모드일 때만 보임
          transition: "opacity 0.8s ease-in-out", // 투명도 전환 효과
        }}
      >
        {/* 다크모드 별들 */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundImage: darkModeStyles.starBackground,
            backgroundRepeat: "repeat",
            backgroundSize: "1100px 400px",
            opacity: 0.9,
            animation: "simpleStarMove 60s linear infinite",
          }}
        />
      </div>

      {/* === 라이트모드 배경 레이어 === */}
      <div
        style={{
          position: "absolute", // 부모 요소 기준 절대 위치
          top: 0, // 부모 최상단
          left: 0, // 부모 최좌측
          width: "100%", // 부모 전체 너비
          height: "100%", // 부모 전체 높이
          background: lightModeStyles.background, // 라이트모드 배경 그라데이션
          opacity: isDarkMode ? 0 : 1, // 라이트모드일 때만 보임
          transition: "opacity 0.8s ease-in-out", // 투명도 전환 효과
        }}
      >
        {/* 라이트모드 별들 */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundImage: lightModeStyles.starBackground,
            backgroundRepeat: "repeat",
            backgroundSize: "1100px 400px",
            opacity: 0.85,
            animation: "simpleStarMove 60s linear infinite",
          }}
        />
      </div>
    </div>
  );
};

export default SpaceBackground;
