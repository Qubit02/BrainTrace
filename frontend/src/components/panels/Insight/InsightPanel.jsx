/**
 * InsightPanel 컴포넌트
 *
 * 이 컴포넌트는 브레인 프로젝트의 인사이트 기능을 제공합니다.
 * 주요 기능:
 * - 지식 그래프 시각화 (GraphViewWithModal)
 * - 메모 작성 및 관리 (MemoEditor, MemoListPanel)
 * - 그래프와 메모 패널의 동적 리사이징
 * - 삭제된 메모의 휴지통 관리
 * - 참조된 노드 및 포커스 노드 표시
 *
 * Props:
 * - selectedBrainId: 선택된 브레인 ID
 * - collapsed: 패널 축소 상태
 * - setCollapsed: 패널 축소 상태 설정 함수
 * - referencedNodes: 참조된 노드 목록
 * - focusNodeNames: 포커스할 노드 이름 목록
 * - graphRefreshTrigger: 그래프 새로고침 트리거
 * - onGraphDataUpdate: 그래프 데이터 업데이트 콜백
 * - onGraphReady: 그래프 준비 완료 콜백
 * - setReferencedNodes: 참조된 노드 설정 함수
 * - setFocusNodeNames: 포커스 노드 설정 함수
 * - setNewlyAddedNodeNames: 새로 추가된 노드 설정 함수
 */
// src/components/panels/InsightPanel.jsx
import React, { useState, useEffect } from "react";
import "./InsightPanel.css";

import MemoEditor from "./Memo/MemoEditor";
import MemoListPanel from "./Memo/MemoListPanel";
import GraphViewWithModal from "./Graph/GraphViewWithModal";
import {
  VscLayoutSidebarRightOff,
  VscLayoutSidebarLeftOff,
} from "react-icons/vsc";
import { PiGraphLight } from "react-icons/pi";
import { CiStickyNote } from "react-icons/ci";
import { PiGraphBold } from "react-icons/pi";
import { PiNoteBlankFill } from "react-icons/pi";

import {
  createMemo,
  getMemosByBrain,
  updateMemo,
  deleteMemo,
  restoreMemo,
  hardDeleteMemo,
  emptyTrash,
} from "../../../../api/config/apiIndex";

function InsightPanel({
  selectedBrainId,
  collapsed,
  setCollapsed,
  referencedNodes = [],
  graphRefreshTrigger,
  onGraphDataUpdate,
  focusNodeNames = [],
  onGraphReady,
  setReferencedNodes,
  setFocusNodeNames,
  setNewlyAddedNodeNames,
}) {
  const projectId = selectedBrainId;
  const [showGraph, setShowGraph] = useState(true);
  const [showMemo, setShowMemo] = useState(true);
  const [memos, setMemos] = useState([]);
  const [selectedMemoId, setSelectedMemoId] = useState(null);
  const [highlightedMemoId, setHighlightedMemoId] = useState(null);
  const [graphHeight, setGraphHeight] = useState(450);
  const [isResizing, setIsResizing] = useState(false);

  /**
   * 브레인 ID가 변경될 때 해당 브레인의 메모들을 불러옵니다.
   * 삭제된 메모도 포함하여 모든 메모를 조회합니다.
   */
  useEffect(() => {
    const fetch = async () => {
      if (!projectId) return;
      try {
        // 삭제된 메모도 포함하여 조회
        const memos = await getMemosByBrain(projectId);
        setMemos(memos);
      } catch (err) {
        console.error("메모/휴지통 불러오기 실패:", err);
      }
    };
    fetch();
  }, [projectId]);

  /**
   * 그래프 패널 리사이징을 위한 마우스 이벤트 핸들러를 설정합니다.
   * 마우스 드래그로 그래프 높이를 동적으로 조절할 수 있습니다.
   */
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newHeight =
        e.clientY -
        document.querySelector(".panel-container").getBoundingClientRect().top -
        45;
      if (newHeight > 10 && newHeight < 950) {
        setGraphHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const selectedMemo = memos.find((m) => m.memo_id === selectedMemoId) || null;

  /**
   * 새로운 메모를 생성합니다.
   * @param {string} content - 메모 내용
   * @returns {string|null} 생성된 메모 ID 또는 null
   */
  const handleAddMemo = async (content) => {
    try {
      const newMemo = await createMemo({
        memo_text: content,
        memo_title: "",
        is_source: false,
        type: "memo",
        folder_id: null,
        brain_id: projectId,
      });

      setMemos((prev) => [newMemo, ...prev]);

      setHighlightedMemoId(newMemo.memo_id);
      setSelectedMemoId(null);
      setTimeout(() => {
        setSelectedMemoId(newMemo.memo_id);
        setHighlightedMemoId(null);
      }, 1000);

      return newMemo.memo_id;
    } catch (e) {
      console.error("메모 생성 오류:", e);
      return null;
    }
  };

  /**
   * 메모를 저장하고 편집 모드를 종료합니다.
   * @param {Object} updatedMemo - 업데이트된 메모 객체
   */
  const handleSaveAndClose = async (updatedMemo) => {
    try {
      await updateMemo(updatedMemo.memo_id, {
        memo_title: updatedMemo.title,
        memo_text: updatedMemo.content,
        brain_id: updatedMemo.brain_id,
      });
      setMemos((prev) =>
        prev.map((m) =>
          m.memo_id === updatedMemo.memo_id
            ? {
                ...m,
                memo_title: updatedMemo.title,
                memo_text: updatedMemo.content,
              }
            : m
        )
      );
      setSelectedMemoId(null);
    } catch (err) {
      console.error("메모 저장 오류:", err);
      alert("메모 저장에 실패했습니다.");
    }
  };

  /**
   * 메모를 휴지통으로 이동시킵니다 (소프트 삭제).
   * @param {string} id - 삭제할 메모 ID
   */
  const handleDeleteMemo = async (id) => {
    try {
      await deleteMemo(id);
      // 메모를 삭제하지 않고 is_deleted 상태만 업데이트
      setMemos((prev) =>
        prev.map((m) => (m.memo_id === id ? { ...m, is_deleted: true } : m))
      );
      if (selectedMemoId === id) setSelectedMemoId(null);
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  /**
   * 휴지통에서 메모를 복구합니다.
   * @param {string} id - 복구할 메모 ID
   */
  const handleRestoreMemo = async (id) => {
    try {
      await restoreMemo(id);
      // 메모를 복구하고 is_deleted 상태를 업데이트
      setMemos((prev) =>
        prev.map((m) => (m.memo_id === id ? { ...m, is_deleted: false } : m))
      );
    } catch (err) {
      console.error("복구 실패:", err);
    }
  };

  /**
   * 메모를 완전히 삭제합니다 (하드 삭제).
   * @param {string} id - 완전 삭제할 메모 ID
   */
  const handleHardDeleteMemo = async (id) => {
    try {
      await hardDeleteMemo(id);
      // 메모를 완전히 삭제하고 리스트에서 제거
      setMemos((prev) => prev.filter((m) => m.memo_id !== id));
      if (selectedMemoId === id) setSelectedMemoId(null);
    } catch (err) {
      console.error("완전 삭제 실패:", err);
    }
  };

  /**
   * 휴지통의 모든 메모를 완전히 삭제합니다.
   */
  const handleEmptyTrash = async () => {
    try {
      await emptyTrash(projectId);
      // 삭제된 메모들을 모두 리스트에서 제거
      setMemos((prev) => prev.filter((m) => m.is_deleted !== true));
      // 선택된 메모가 삭제된 메모였다면 선택 해제
      if (
        selectedMemoId &&
        memos.find((m) => m.memo_id === selectedMemoId)?.is_deleted === true
      ) {
        setSelectedMemoId(null);
      }
    } catch (err) {
      console.error("휴지통 비우기 실패:", err);
    }
  };

  /**
   * 참조된 노드 목록을 초기화합니다.
   */
  const handleClearReferencedNodes = () => {
    if (setReferencedNodes) setReferencedNodes([]);
  };

  /**
   * 포커스 노드 목록을 초기화합니다.
   */
  const handleClearFocusNodes = () => {
    if (setFocusNodeNames) setFocusNodeNames([]);
  };

  /**
   * 새로 추가된 노드 목록을 초기화합니다.
   */
  const handleClearNewlyAddedNodes = () => {
    if (setNewlyAddedNodeNames) setNewlyAddedNodeNames([]);
  };
  // 추가노드 콜백은 필요시 구현

  return (
    <div className={`panel-container ${collapsed ? "collapsed" : ""}`}>
      <div
        className="header-bar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "45px",
          padding: "10px 16px",
          borderBottom: "1px solid #eaeaea",
        }}
      >
        {!collapsed && (
          <div
            className="header-actions2"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span className="header-title">Insight</span>
          </div>
        )}
        <div className="header-actions">
          {!collapsed && (
            <div style={{ display: "flex" }}>
              <button
                className={`insight-toggle-btn${showGraph ? " active" : ""}`}
                title="그래프 보기 토글"
                onClick={() => setShowGraph((prev) => !prev)}
              >
                {showGraph ? (
                  <PiGraphBold size={19} color={"black"} />
                ) : (
                  <PiGraphLight size={19} color={"black"} />
                )}
              </button>
              <button
                className={`insight-toggle-btn${showMemo ? " active" : ""}`}
                title="메모 보기 토글"
                onClick={() => setShowMemo((prev) => !prev)}
                style={{ marginRight: "1px" }}
              >
                {showMemo ? (
                  <PiNoteBlankFill size={19} color={"black"} />
                ) : (
                  <CiStickyNote size={19} color={"black"} />
                )}
              </button>
            </div>
          )}
          {collapsed ? (
            <VscLayoutSidebarLeftOff
              size={18}
              style={{ cursor: "pointer" }}
              onClick={() => setCollapsed((prev) => !prev)}
            />
          ) : (
            <VscLayoutSidebarRightOff
              size={18}
              style={{
                cursor: "pointer",
                marginRight: "2px",
                marginLeft: "3px",
              }}
              onClick={() => setCollapsed((prev) => !prev)}
            />
          )}
        </div>
      </div>

      {!collapsed && (
        <div
          className="panel-content"
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {showGraph && (
            <div
              style={{
                height: showMemo ? `${graphHeight}px` : "100%",
                transition: isResizing ? "none" : "height 0.3s ease",
                position: "relative",
                zIndex: 10,
              }}
            >
              <GraphViewWithModal
                brainId={projectId || "default-brain-id"}
                height={showMemo ? graphHeight : 1022}
                referencedNodes={referencedNodes} // MainLayout에서 받은 참고된 노드 목록 전달
                focusNodeNames={focusNodeNames}
                graphRefreshTrigger={graphRefreshTrigger}
                onGraphDataUpdate={onGraphDataUpdate}
                onGraphReady={onGraphReady}
                onClearReferencedNodes={handleClearReferencedNodes}
                onClearFocusNodes={handleClearFocusNodes}
                onClearNewlyAddedNodes={handleClearNewlyAddedNodes}
              />
              {referencedNodes && referencedNodes.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    padding: "5px",
                    borderRadius: "3px",
                    fontSize: "12px",
                  }}
                >
                  참조된 노드: {referencedNodes.join(", ")}
                </div>
              )}
            </div>
          )}

          {/* 리사이저 바 */}
          {showGraph && showMemo && (
            <div
              style={{
                height: "10px",
                cursor: "ns-resize",
                borderBottom: "2px solid #ccc",
                backgroundColor: "#fafafa",
                position: "relative",
                zIndex: 100,
              }}
              onMouseDown={() => setIsResizing(true)}
            />
          )}

          {showMemo && (
            <div
              className="memo-body"
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderTop: "1px solid #eaeaea",
                position: "relative",
                zIndex: 50,
              }}
            >
              {selectedMemoId != null && selectedMemo ? (
                <MemoEditor
                  memo={selectedMemo}
                  onSaveAndClose={handleSaveAndClose}
                />
              ) : (
                <MemoListPanel
                  memos={memos}
                  selectedId={selectedMemoId}
                  highlightedId={highlightedMemoId}
                  onSelect={setSelectedMemoId}
                  onAdd={handleAddMemo}
                  onDelete={handleDeleteMemo}
                  onRestore={handleRestoreMemo}
                  onHardDelete={handleHardDeleteMemo}
                  onEmptyTrash={handleEmptyTrash}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InsightPanel;
