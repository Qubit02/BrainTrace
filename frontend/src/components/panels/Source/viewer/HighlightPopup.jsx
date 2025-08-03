import React, { useState, useEffect, useRef } from 'react';

// 하이라이트 색상 옵션
const HIGHLIGHT_COLORS = [
  { id: 'yellow', color: '#fff7a3', name: '노란색' },
  { id: 'orange', color: '#ffd8c2', name: '주황색' },
  { id: 'green', color: '#c9ffd9', name: '초록색' },
  { id: 'blue', color: '#cfe9ff', name: '파란색' },
  { id: 'purple', color: '#f2ccff', name: '보라색' }
];

// 팝업 스타일
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

// 색상 원 스타일
const COLOR_CIRCLE_STYLE = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  cursor: 'pointer',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  border: '2px solid transparent',
  position: 'relative'
};

// 버튼 공통 스타일
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

// 색상 원 컴포넌트
const ColorCircle = ({ color, onClick, isSelected = false }) => (
  <div
    style={{
      ...COLOR_CIRCLE_STYLE,
      backgroundColor: color.color,
      borderColor: isSelected ? '#4f46e5' : 'transparent',
      transform: isSelected ? 'scale(1.1)' : 'scale(1)'
    }}
    onClick={(e) => {
      e.stopPropagation();
      onClick(color);
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'scale(1.15)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = isSelected ? 'scale(1.1)' : 'scale(1)';
      e.currentTarget.style.boxShadow = 'none';
    }}
    title={color.name}
  />
);

// 액션 버튼 컴포넌트
const ActionButton = ({ onClick, variant = 'primary', children, icon }) => {
  const getButtonStyle = () => {
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
  };

  return (
    <button
      style={getButtonStyle()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};

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

  const [currentPos, setCurrentPos] = useState({
    x: position.x,
    y: position.y + (containerRef?.current?.scrollTop || 0)
  });

  // position 변경 시 위치 초기화 (드래그 중이 아닐 때만)
  useEffect(() => {
    if (!dragging) {
      setCurrentPos({
        x: position.x,
        y: position.y + (containerRef?.current?.scrollTop || 0)
      });
    }
  }, [position, dragging]);

  // 외부 클릭 시 팝업 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // 드래그 시작 처리
  const handleMouseDown = (e) => {
    e.preventDefault();
    const popupRect = popupRef.current?.getBoundingClientRect();
    if (!popupRect) return;

    setDragOffset({
      x: e.clientX - popupRect.left,
      y: e.clientY - popupRect.top
    });
    setDragging(true);
  };

  // 드래그 중 마우스 이동 처리
  const handleMouseMove = (e) => {
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
  };

  // 드래그 종료 처리
  const handleMouseUp = () => setDragging(false);

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
  }, [dragging]);

  // 색상 선택 처리
  const handleColorSelect = (color) => {
    setSelectedColor(color);
    onSelectColor(color.color);
  };

  // 복사 처리
  const handleCopy = () => {
    onCopyText();
    onClose?.();
  };

  // 하이라이트 제거 처리
  const handleDelete = () => {
    onDeleteHighlight(highlightId);
    onClose?.();
  };

  return (
    <div
      ref={popupRef}
      style={{
        ...POPUP_STYLE,
        left: currentPos.x,
        top: currentPos.y,
        cursor: dragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* 색상 선택 영역 */}
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
            제거
          </ActionButton>
        )}
      </div>
    </div>
  );
};

export default HighlightPopup;
