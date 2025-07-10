import React, { useState, useEffect, useRef } from 'react';
import './styles/MemoEditor.css';
import { RiCollapseDiagonalFill } from "react-icons/ri";
function MemoEditor({ memo, onSaveAndClose }) {

  const [title, setTitle] = useState(memo.memo_title || '');
  const [body, setBody] = useState(memo.memo_text || '');
  const titleInputRef = useRef(null);

  const handleBack = () => {
    const finalTitle = title.trim() === '' ? 'Untitled' : title;
    const updated = { ...memo, title: finalTitle, content: body, brain_id: memo.brain_id };
    onSaveAndClose(updated);
  };

  useEffect(() => {
    setTitle(memo.memo_title || '');
    setBody(memo.memo_text || '');
  }, [memo]);

  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);


  return (
    <div className="notion-editor">
      <button className="back-button small-top-left" onClick={handleBack}>
        <RiCollapseDiagonalFill size={25} />
      </button>

      <input
        ref={titleInputRef}
        className="notion-title"
        placeholder="Untitled"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

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
