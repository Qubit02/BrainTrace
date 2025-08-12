import React, { useState, useEffect, useRef } from 'react';
import './MemoEditor.css';
import { BsBoxArrowInLeft } from "react-icons/bs";

// 메모 에디터 컴포넌트
// - 메모 제목과 내용을 입력하거나 수정할 수 있는 화면
// - 완료 시 수정된 메모 데이터를 부모 컴포넌트에 전달

function MemoEditor({ memo, onSaveAndClose }) {
  // 제목과 본문 상태
  const [title, setTitle] = useState(memo.memo_title || '');
  const [body, setBody] = useState(memo.memo_text || '');

  // 제목 입력창에 포커스를 주기 위한 참조
  const titleInputRef = useRef(null);

  // 뒤로가기 또는 완료 버튼 클릭 시 실행
  // - 제목이 비어 있으면 'Untitled'로 대체
  // - 수정된 메모 객체를 부모로 전달
  const handleBack = () => {
    const finalTitle = title.trim() === '' ? 'Untitled' : title;
    const updated = {
      ...memo,
      title: finalTitle,
      content: body,
      brain_id: memo.brain_id,
    };
    onSaveAndClose(updated);
  };

  // memo prop가 바뀌면 상태 초기화
  useEffect(() => {
    setTitle(memo.memo_title || '');
    setBody(memo.memo_text || '');
  }, [memo]);

  // 컴포넌트 첫 렌더링 시 제목 입력창에 포커스
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);

  return (
    <div className="notion-editor">
      {/* 뒤로가기 버튼 */}
      <button className="back-button small-top-left" onClick={handleBack}>
        <BsBoxArrowInLeft size={26} color='black' />
      </button>

      {/* 제목 입력창 */}
      <input
        ref={titleInputRef}
        className="notion-title"
        placeholder="Untitled"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {/* 본문 입력 영역 */}
      <textarea
        className="notion-textarea"
        placeholder="내용을 작성하세요..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
    </div>
  );
}

export default MemoEditor;
