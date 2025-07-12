// src/components/panels/MemoPanel.jsx
import React, { useState, useEffect } from 'react';
import './styles/Common.css';
import './styles/MemoPanel.css';
import './styles/PanelToggle.css';
import './styles/Scrollbar.css';

import MemoEditor from './MemoEditor';
import MemoListPanel from './MemoListPanel';
import GraphViewWithModal from './GraphViewWithModal';

import toggleIcon from '../../assets/icons/toggle-view.png';
import graphOnIcon from '../../assets/icons/graph-on.png';
import graphOffIcon from '../../assets/icons/graph-off.png';
import memoOnIcon from '../../assets/icons/memo-on.png';
import memoOffIcon from '../../assets/icons/memo-off.png';

import {
  createMemo,
  getMemosByBrain,
  updateMemo,
  deleteMemo
} from '../../../../backend/services/backend';

function MemoPanel({ activeProject, collapsed, setCollapsed, referencedNodes = [], graphRefreshTrigger, onGraphDataUpdate, focusNodeNames = [] }) {
  const projectId = activeProject;
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
        const memos = await getMemosByBrain(projectId);
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
        memo_title: 'Untitled',
        is_source: false,
        is_delete: false,
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
      console.log("updatedMemo.brain_id", updateMemo.brain_id)
      // 메모 리스트 상태 갱신
      setMemos(prev =>
        prev.map(m =>
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
      setMemos((prev) => prev.filter((m) => m.memo_id !== id));
      if (selectedMemoId === id) setSelectedMemoId(null);
    } catch (err) {
      console.error('삭제 실패:', err);
    }
  };

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
            <span className="header-title" style={{ fontSize: '17px' }}>Insight</span>
          </div>
        )}
        <div className="header-actions">
          {!collapsed && (
            <>
              <img
                src={showGraph ? graphOnIcon : graphOffIcon}
                alt="Graph View"
                style={{ width: '19px', height: '19px', cursor: 'pointer' }}
                onClick={() => setShowGraph(prev => !prev)}
              />
              <img
                src={showMemo ? memoOnIcon : memoOffIcon}
                alt="Memo View"
                style={{ width: '19px', height: '19px', cursor: 'pointer' }}
                onClick={() => setShowMemo(prev => !prev)}
              />
            </>
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
              overflow: 'auto',
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
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MemoPanel;
