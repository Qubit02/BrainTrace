import React from "react";
import "./ConfirmDialog.css";

export default function ConfirmDialog({ message, onOk, onCancel, isLoading }) {
  return (
    <div className="confirm-back" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <div>{message}</div>
        <div className="confirm-buttons">
          <button
            className="cancel-button"
            onClick={onCancel}
            disabled={isLoading}
          >
            취소
          </button>
          <button
            className="delete-button danger"
            onClick={onOk}
            disabled={isLoading}
          >
            {isLoading ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
