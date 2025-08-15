/*
 App.jsx

 애플리케이션 루트 컴포넌트. 전역 라우팅을 설정합니다.

 라우트 개요:
 - "/"                   → 프로젝트 목록 화면(ProjectListView)
 - "/project/:projectId" → 메인 레이아웃(채팅/소스/인사이트 패널 포함)
 - "/graph-view"         → 스탠드얼론 전체화면 그래프 뷰
*/
import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProjectListView from "./components/layout/ProjectListView";
import MainLayout from "./components/layout/MainLayout";
import GraphViewStandalone from "./components/panels/Insight/Graph/GraphViewStandalone";

/**
 * App 루트 컴포넌트
 * - 전역 라우팅 구성과 초기 화면 설정을 담당합니다.
 */
function App() {
  return (
    <Router>
      <Routes>
        {/* 기본 홈화면을 ProjectListView로 설정 */}
        <Route path="/" element={<ProjectListView />} />
        {/* 기존 프로젝트 화면 */}
        <Route path="/project/:projectId" element={<MainLayout />} />
        <Route path="/graph-view" element={<GraphViewStandalone />} />
      </Routes>
    </Router>
  );
}

export default App;
