/**
 * SourceHoverTooltip.jsx
 * 
 * 출처보기에서 소스 제목에 마우스를 올렸을 때 참조 문장들을 표시하는 툴팁 컴포넌트
 * 
 * 주요 기능:
 * 1. 호버 상태 관리 (시작, 종료, 지연 처리)
 * 2. 참조 문장 목록 표시
 * 3. 참조 문장이 없을 때 안내 메시지 표시
 * 4. 호버 상태에 따른 표시/숨김
 * 5. 스타일링된 툴팁 디자인
 * 6. 화면 경계 처리
 */

import React, { useState, useRef, useEffect } from 'react';
import './SourceHoverTooltip.css';

/**
 * SourceHoverTooltip 컴포넌트
 * 
 * @param {Array} originalSentences - 참조 문장 배열
 * @param {string} sourceTitle - 소스 제목
 * @param {React.ReactNode} children - 호버 대상이 되는 자식 요소
 */
const SourceHoverTooltip = ({ originalSentences = [], sourceTitle = '', children }) => {
  // 호버 툴팁 상태 관리
  const [hoverState, setHoverState] = useState({
    isVisible: false,
    position: { x: 0, y: 0 }
  });

  // 타임아웃 참조
  const hoverTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);

  // 컴포넌트 언마운트 시 타임아웃 정리
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  /**
   * 호버 시작 핸들러
   * 
   * @param {React.MouseEvent} event - 마우스 이벤트
   */
  const handleMouseEnter = (event) => {
    // 기존 타임아웃 정리
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // 약간의 지연을 두어 의도하지 않은 호버를 방지
    const targetElement = event.currentTarget;
    hoverTimeoutRef.current = setTimeout(() => {
      if (!targetElement) {
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // 툴팁이 화면 밖으로 나가지 않도록 위치 조정
      let x = rect.left + rect.width + 10;
      let y = rect.top - 10;
      
      // 오른쪽 공간이 부족하면 왼쪽에 표시
      if (x + 320 > viewportWidth) {
        x = rect.left - 330;
      }
      
      // 위쪽 공간이 부족하면 아래쪽에 표시
      if (y < 10) {
        y = rect.bottom + 10;
      }
      
      // 아래쪽 공간이 부족하면 위쪽에 표시
      if (y + 200 > viewportHeight) {
        y = viewportHeight - 210;
      }
      
      setHoverState({
        isVisible: true,
        position: { x, y }
      });
    }, 300); // 300ms 지연
  };

  /**
   * 호버 종료 핸들러
   */
  const handleMouseLeave = () => {
    // 진행 중인 hover timeout 취소
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // 약간의 지연을 두어 툴팁이 너무 빨리 사라지지 않도록 함
    hideTimeoutRef.current = setTimeout(() => {
      setHoverState(prev => ({ ...prev, isVisible: false }));
    }, 100);
  };

  return (
    <div 
      className="source-hover-tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {/* 호버 툴팁 */}
      {hoverState.isVisible && (
        <div 
          className="source-hover-tooltip"
          style={{
            left: hoverState.position.x,
            top: hoverState.position.y,
            display: hoverState.isVisible ? 'block' : 'none'
          }}
        >
          <div className="source-hover-tooltip-header">
            <span className="source-hover-tooltip-title">{sourceTitle}</span>
            <span className="source-hover-tooltip-subtitle">참조 문장</span>
          </div>
          <div className="source-hover-tooltip-content">
            {originalSentences && originalSentences.length > 0 ? (
              originalSentences.map((sentence, index) => (
                <div key={index} className="source-hover-tooltip-sentence">
                  <span className="source-hover-tooltip-text">{sentence}</span>
                </div>
              ))
            ) : (
              <div className="source-hover-tooltip-no-content">
                <span className="source-hover-tooltip-no-text">참조 문장이 없습니다</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceHoverTooltip; 