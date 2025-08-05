/**
 * HighlightPopup.jsx - 텍스트 하이라이트 팝업 컴포넌트
 * 
 * 기능:
 * - 텍스트 선택 시 색상 하이라이트 팝업 표시
 * - 5가지 색상 옵션 (노란색, 주황색, 초록색, 파란색, 보라색)
 * - 드래그 가능한 팝업 위치 조정
 * - 텍스트 복사 및 하이라이트 제거 기능
 * - 기존 하이라이트 수정 시 색상 선택 비활성화
 * 
 * 주요 컴포넌트:
 * - ColorCircle: 색상 선택 원형 버튼
 * - ActionButton: 복사/제거 액션 버튼
 * - HighlightPopup: 메인 팝업 컨테이너
 * 
 * 사용법:
 * <HighlightPopup
 *   position={{ x: 100, y: 200 }}
 *   containerRef={containerRef}
 *   onSelectColor={(color) => handleHighlight(color)}
 *   onCopyText={() => handleCopy()}
 *   onClose={() => setShowPopup(false)}
 *   onDeleteHighlight={(id) => handleDelete(id)}
 *   isExistingHighlight={true}
 *   highlightId="highlight-123"
 * />
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// 하이라이트 색상 옵션 - 상수로 분리하여 재사용성 향상
const HIGHLIGHT_COLORS = [
  { id: 'yellow', color: '#fff7a3', name: '노란색' },
  { id: 'orange', color: '#ffd8c2', name: '주황색' },
  { id: 'green', color: '#c9ffd9', name: '초록색' },
  { id: 'blue', color: '#cfe9ff', name: '파란색' },
  { id: 'purple', color: '#f2ccff', name: '보라색' }
];

// 팝업 스타일 - useMemo로 최적화
const POPUP_STYLE = {
  position: 'absolute',
  padding: '12px 16px',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  border: '1px solid #f1f3f4',
  backdropFilter: 'blur(8px)',
  minWidth: '200px'
};

// 색상 원 스타일 - useMemo로 최적화
const COLOR_CIRCLE_STYLE = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  cursor: 'pointer',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  border: '2px solid transparent',
  position: 'relative'
};

// 버튼 공통 스타일 - useMemo로 최적화
const BUTTON_BASE_STYLE = {
  border: 'none',
  padding: '8px 16px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '500',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '77px',
  height: '32px'
};

/**
 * ColorCircle - 색상 선택 원형 버튼 컴포넌트
 * 
 * @param {Object} color - 색상 정보 { id, color, name }
 * @param {Function} onClick - 색상 선택 시 호출되는 콜백
 * @param {boolean} isSelected - 현재 선택된 색상인지 여부
 */
const ColorCircle = React.memo(({ color, onClick, isSelected = false }) => {
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onClick(color);
  }, [onClick, color]);

  const handleMouseEnter = useCallback((e) => {
    e.currentTarget.style.transform = 'scale(1.15)';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  }, []);

  const handleMouseLeave = useCallback((e) => {
    e.currentTarget.style.transform = isSelected ? 'scale(1.1)' : 'scale(1)';
    e.currentTarget.style.boxShadow = 'none';
  }, [isSelected]);

  const circleStyle = useMemo(() => ({
    ...COLOR_CIRCLE_STYLE,
    backgroundColor: color.color,
    borderColor: isSelected ? '#4f46e5' : 'transparent',
    transform: isSelected ? 'scale(1.1)' : 'scale(1)'
  }), [color.color, isSelected]);

  return (
    <div
      style={circleStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={color.name}
      role="button"
      aria-label={`${color.name} 색상 선택`}
    />
  );
});

ColorCircle.displayName = 'ColorCircle';

/**
 * ActionButton - 액션 버튼 컴포넌트
 * 
 * @param {Function} onClick - 버튼 클릭 시 호출되는 콜백
 * @param {string} variant - 버튼 스타일 변형 ('primary' | 'danger')
 * @param {React.ReactNode} children - 버튼 텍스트
 * @param {React.ReactNode} icon - 버튼 아이콘 (선택사항)
 */
const ActionButton = React.memo(({ onClick, variant = 'primary', children, icon }) => {
  const buttonStyle = useMemo(() => {
    const baseStyle = { ...BUTTON_BASE_STYLE };
    
    switch (variant) {
      case 'danger':
        return {
          ...baseStyle,
          backgroundColor: '#ef4444',
          color: '#ffffff',
          ':hover': { backgroundColor: '#dc2626' }
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: '#4f46e5',
          color: '#ffffff',
          ':hover': { backgroundColor: '#4338ca' }
        };
    }
  }, [variant]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onClick();
  }, [onClick]);

  const handleMouseEnter = useCallback((e) => {
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  }, []);

  const handleMouseLeave = useCallback((e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = 'none';
  }, []);

  return (
    <button
      style={buttonStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      type="button"
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
});

ActionButton.displayName = 'ActionButton';

/**
 * HighlightPopup - 텍스트 하이라이트 팝업 메인 컴포넌트
 * 
 * @param {Object} position - 팝업 위치 { x, y }
 * @param {React.RefObject} containerRef - 컨테이너 참조
 * @param {Function} onSelectColor - 색상 선택 시 콜백
 * @param {Function} onCopyText - 텍스트 복사 시 콜백
 * @param {Function} onClose - 팝업 닫기 시 콜백
 * @param {Function} onDeleteHighlight - 하이라이트 제거 시 콜백
 * @param {boolean} isExistingHighlight - 기존 하이라이트인지 여부
 * @param {string} highlightId - 하이라이트 ID
 */
const HighlightPopup = ({
  position,
  containerRef,
  onSelectColor,
  onCopyText,
  onClose,
  onDeleteHighlight,
  isExistingHighlight,
  highlightId
}) => {
  const popupRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedColor, setSelectedColor] = useState(null);

  // 현재 위치 상태 - useMemo로 최적화
  const [currentPos, setCurrentPos] = useState(() => ({
    x: position.x,
    y: position.y + (containerRef?.current?.scrollTop || 0)
  }));

  // position 변경 시 위치 초기화 (드래그 중이 아닐 때만)
  useEffect(() => {
    if (!dragging) {
      setCurrentPos({
        x: position.x,
        y: position.y + (containerRef?.current?.scrollTop || 0)
      });
    }
  }, [position, dragging, containerRef]);

  // 외부 클릭 시 팝업 닫기 - useCallback으로 최적화
  const handleClickOutside = useCallback((e) => {
    if (popupRef.current && !popupRef.current.contains(e.target)) {
      onClose?.();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  // 드래그 시작 처리 - useCallback으로 최적화
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const popupRect = popupRef.current?.getBoundingClientRect();
    if (!popupRect) return;

    setDragOffset({
      x: e.clientX - popupRect.left,
      y: e.clientY - popupRect.top
    });
    setDragging(true);
  }, []);

  // 드래그 중 마우스 이동 처리 - useCallback으로 최적화
  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;

    const scrollTop = containerRef?.current?.scrollTop || window.scrollY || 0;
    const scrollLeft = containerRef?.current?.scrollLeft || window.scrollX || 0;
    const containerRect = containerRef?.current?.getBoundingClientRect();

    const baseX = containerRect ? containerRect.left : 0;
    const baseY = containerRect ? containerRect.top : 0;

    setCurrentPos({
      x: e.clientX - baseX - dragOffset.x + scrollLeft,
      y: e.clientY - baseY - dragOffset.y + scrollTop
    });
  }, [dragging, dragOffset, containerRef]);

  // 드래그 종료 처리 - useCallback으로 최적화
  const handleMouseUp = useCallback(() => setDragging(false), []);

  // 드래그 이벤트 리스너 관리
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  // 색상 선택 처리 - useCallback으로 최적화
  const handleColorSelect = useCallback((color) => {
    setSelectedColor(color);
    onSelectColor(color.color);
  }, [onSelectColor]);

  // 복사 처리 - useCallback으로 최적화
  const handleCopy = useCallback(() => {
    onCopyText();
    onClose?.();
  }, [onCopyText, onClose]);

  // 하이라이트 제거 처리 - useCallback으로 최적화
  const handleDelete = useCallback(() => {
    onDeleteHighlight(highlightId);
    onClose?.();
  }, [onDeleteHighlight, highlightId, onClose]);

  // 팝업 스타일 - useMemo로 최적화
  const popupStyle = useMemo(() => ({
    ...POPUP_STYLE,
    left: currentPos.x,
    top: currentPos.y,
    cursor: dragging ? 'grabbing' : 'grab'
  }), [currentPos.x, currentPos.y, dragging]);

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      onMouseDown={handleMouseDown}
      role="dialog"
      aria-label="텍스트 하이라이트 팝업"
    >
      {/* 색상 선택 영역 - 기존 하이라이트가 아닐 때만 표시 */}
      {!isExistingHighlight && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {HIGHLIGHT_COLORS.map((color) => (
            <ColorCircle
              key={color.id}
              color={color}
              onClick={handleColorSelect}
              isSelected={selectedColor?.id === color.id}
            />
          ))}
        </div>
      )}

      {/* 액션 버튼들 */}
      <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
        <ActionButton onClick={handleCopy}>
          복사
        </ActionButton>

        {isExistingHighlight && (
          <ActionButton onClick={handleDelete} variant="danger">
            하이라이팅 제거
          </ActionButton>
        )}
      </div>
    </div>
  );
};

export default HighlightPopup;
