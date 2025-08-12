// src/App.jsx
import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProjectListView from "./components/layout/ProjectListView";
import MainLayout from "./components/layout/MainLayout";
import GraphViewStandalone from "./components/panels/Insight/Graph/GraphViewStandalone";

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
