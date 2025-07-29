// src/components/panels/InsightPanel.jsx
import React, { useState, useEffect } from 'react';
import './InsightPanel.css';

import MemoEditor from './Memo/MemoEditor';
import MemoListPanel from './Memo/MemoListPanel';
import GraphViewWithModal from './Graph/GraphViewWithModal';
import toggleIcon from '../../../assets/icons/toggle-view.png';

import { PiGraphLight } from "react-icons/pi";
import { CiStickyNote } from "react-icons/ci";

import {
  createMemo,
  getMemosByBrain,
  updateMemo,
  deleteMemo,
  restoreMemo,
  hardDeleteMemo,
  emptyTrash
} from '../../../../api/backend';

function InsightPanel({ selectedBrainId, collapsed, setCollapsed, referencedNodes = [], graphRefreshTrigger, onGraphDataUpdate, focusNodeNames = [], onGraphReady, setReferencedNodes, setFocusNodeNames, setNewlyAddedNodeNames }) {
  const projectId = selectedBrainId;
  const [showGraph, setShowGraph] = useState(true);
  const [showMemo, setShowMemo] = useState(true);
  const [memos, setMemos] = useState([]);
  const [selectedMemoId, setSelectedMemoId] = useState(null);
  const [highlightedMemoId, setHighlightedMemoId] = useState(null);
  const [graphHeight, setGraphHeight] = useState(450);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!projectId) return;
      try {
        // 삭제된 메모도 포함하여 조회
        const memos = await getMemosByBrain(projectId);
        console.log('조회된 메모들:', memos);
        setMemos(memos);
      } catch (err) {
        console.error('메모/휴지통 불러오기 실패:', err);
      }
    };
    fetch();
  }, [projectId]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newHeight = e.clientY - document.querySelector('.panel-container').getBoundingClientRect().top - 45;
      if (newHeight > 10 && newHeight < 950) {
        setGraphHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const selectedMemo = memos.find(m => m.memo_id === selectedMemoId) || null;

  const handleAddMemo = async (content) => {
    try {
      const newMemo = await createMemo({
        memo_text: content,
        memo_title: "",
        is_source: false,
        type: 'memo',
        folder_id: null,
        brain_id: projectId,
      });

      setMemos(prev => [newMemo, ...prev]);

      setHighlightedMemoId(newMemo.memo_id);
      setSelectedMemoId(null);
      setTimeout(() => {
        setSelectedMemoId(newMemo.memo_id);
        setHighlightedMemoId(null);
      }, 1000);

      return newMemo.memo_id;
    } catch (e) {
      console.error('메모 생성 오류:', e);
      return null;
    }
  };

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
            ? { ...m, memo_title: updatedMemo.title, memo_text: updatedMemo.content }
            : m
        )
      );
      setSelectedMemoId(null);
    } catch (err) {
      console.error('메모 저장 오류:', err);
      alert('메모 저장에 실패했습니다.');
    }
  };

  const handleDeleteMemo = async (id) => {
    try {
      await deleteMemo(id);
      // 메모를 삭제하지 않고 is_deleted 상태만 업데이트
      setMemos((prev) =>
        prev.map((m) =>
          m.memo_id === id ? { ...m, is_deleted: true } : m
        )
      );
      if (selectedMemoId === id) setSelectedMemoId(null);
    } catch (err) {
      console.error('삭제 실패:', err);
    }
  };

  const handleRestoreMemo = async (id) => {
    try {
      await restoreMemo(id);
      // 메모를 복구하고 is_deleted 상태를 업데이트
      setMemos((prev) =>
        prev.map((m) =>
          m.memo_id === id ? { ...m, is_deleted: false } : m
        )
      );
    } catch (err) {
      console.error('복구 실패:', err);
    }
  };

  const handleHardDeleteMemo = async (id) => {
    try {
      await hardDeleteMemo(id);
      // 메모를 완전히 삭제하고 리스트에서 제거
      setMemos((prev) =>
        prev.filter((m) => m.memo_id !== id)
      );
      if (selectedMemoId === id) setSelectedMemoId(null);
    } catch (err) {
      console.error('완전 삭제 실패:', err);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await emptyTrash(projectId);
      // 삭제된 메모들을 모두 리스트에서 제거
      setMemos((prev) =>
        prev.filter((m) => m.is_deleted !== true)
      );
      // 선택된 메모가 삭제된 메모였다면 선택 해제
      if (selectedMemoId && memos.find(m => m.memo_id === selectedMemoId)?.is_deleted === true) {
        setSelectedMemoId(null);
      }
    } catch (err) {
      console.error('휴지통 비우기 실패:', err);
    }
  };

  // 팝업 닫기 콜백 정의
  const handleClearReferencedNodes = () => {
    if (setReferencedNodes) setReferencedNodes([]);
  };
  const handleClearFocusNodes = () => {
    if (setFocusNodeNames) setFocusNodeNames([]);
  };
  const handleClearNewlyAddedNodes = () => {
    if (setNewlyAddedNodeNames) setNewlyAddedNodeNames([]);
  };
  // 추가노드 콜백은 필요시 구현

  return (
    <div className={`panel-container ${collapsed ? 'collapsed' : ''}`}>
      <div
        className="header-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '45px',
          padding: '10px 16px',
          borderBottom: '1px solid #eaeaea',
        }}
      >
        {!collapsed && (
          <div className="header-actions2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="header-title">Insight</span>
          </div>
        )}
        <div className="header-actions">
          {!collapsed && (
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '6px' }}>
              <button
                className={`insight-toggle-btn${showGraph ? ' active' : ''}`}
                title="그래프 보기 토글"
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                onClick={() => setShowGraph(prev => !prev)}
              >
                <PiGraphLight size={19} color={'black'} />
              </button>
              <button
                className={`insight-toggle-btn${showMemo ? ' active' : ''}`}
                title="메모 보기 토글"
                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                onClick={() => setShowMemo(prev => !prev)}
              >
                <CiStickyNote size={19} color={'black'} />
              </button>
            </div>
          )}
          <img
            src={toggleIcon}
            alt="Toggle View"
            style={{ width: '23px', height: '23px', cursor: 'pointer' }}
            onClick={() => setCollapsed(prev => !prev)}
          />
        </div>
      </div>

      {!collapsed && (
        <div className="panel-content" style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}>
          {showGraph && (
            <div
              style={{
                height: showMemo ? `${graphHeight}px` : '100%',
                transition: isResizing ? 'none' : 'height 0.3s ease'
              }}
            >
              <GraphViewWithModal
                brainId={projectId || 'default-brain-id'}
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
            </div>
          )}

          {/* 리사이저 바 */}
          {showGraph && showMemo && (
            <div
              style={{
                height: '10px',
                cursor: 'ns-resize',
                borderBottom: '2px solid #ccc',
                backgroundColor: '#fafafa',
              }}
              onMouseDown={() => setIsResizing(true)}
            />
          )}

          {showMemo && (
            <div className="memo-body" style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderTop: '1px solid #eaeaea',
            }}>
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
