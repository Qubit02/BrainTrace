import React, { useState, useEffect, useRef } from 'react';

// 하이라이트 색상 옵션 목록
const colors = ['#fff7a3', '#ffd8c2', '#c9ffd9', '#cfe9ff', '#f2ccff'];

const HighlightPopup = ({
  position,              // 팝업의 초기 위치
  containerRef,          // 팝업이 위치할 기준 컨테이너 (스크롤 기준)
  onSelectColor,         // 색상 클릭 시 호출되는 콜백
  onCopyText,            // 복사 버튼 클릭 시 호출
  onClose,               // 팝업 외부 클릭 시 닫기
  onDeleteHighlight,     // 기존 하이라이트 제거 콜백
  isExistingHighlight,   // 기존 하이라이트인지 여부
  highlightId            // 하이라이트 ID (제거용)
}) => {
  const popupRef = useRef(null);               // 팝업 요소 참조
  const [dragging, setDragging] = useState(false); // 드래그 중인지 여부
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // 드래그 시작 위치 기준 오프셋

  const [currentPos, setCurrentPos] = useState({
    x: position.x,
    y: position.y + (containerRef?.current?.scrollTop || 0)
  });

  // position 변경 시 위치 초기화 (단, 드래그 중이 아닐 때만)
  useEffect(() => {
    if (!dragging) {
      setCurrentPos({
        x: position.x,
        y: position.y + (containerRef?.current?.scrollTop || 0)
      });
    }
  }, [position]);

  // 외부 클릭 시 팝업 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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

  // 드래그 시 이벤트 리스너 등록/해제
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

  // 팝업 스타일 설정
  const style = {
    position: 'absolute',
    left: currentPos.x,
    top: currentPos.y,
    padding: '10px 14px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    border: '1px solid #e6e8eb',
    cursor: dragging ? 'grabbing' : 'grab'
  };

  // 색상 원 스타일
  const circleStyle = (color) => ({
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: color,
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
  });

  return (
    <div ref={popupRef} style={style} onMouseDown={handleMouseDown}>
      {/* 신규 하이라이트인 경우 색상 선택 버튼 표시 */}
      {!isExistingHighlight && colors.map((color) => (
        <div
          key={color}
          style={circleStyle(color)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectColor(color);
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        />
      ))}

      {/* 복사 버튼 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCopyText();
        }}
        style={{
          border: 'none',
          backgroundColor: '#4f46e5',
          color: '#ffffff',
          padding: '6px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        복사
      </button>

      {/* 기존 하이라이트일 경우 제거 버튼 표시 */}
      {isExistingHighlight && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteHighlight(highlightId);
          }}
          style={{
            border: 'none',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          하이라이팅 제거
        </button>
      )}
    </div>
  );
};

export default HighlightPopup;
