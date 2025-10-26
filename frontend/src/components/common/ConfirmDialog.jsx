/*
 설명: 삭제 및 수정 작업전에 사용자에게 확인을 받는 모달 다이얼로그입니다.
 사용법 예시:
   <ConfirmDialog
     message="정말 삭제하시겠습니까?"
     onOk={handleOk}
     onCancel={handleCancel}
     isLoading={isDeleting}
   />
 Props:
 - message: string            다이얼로그 본문에 표시될 메시지
 - onOk: () => void           확인(삭제) 버튼 클릭 시 실행될 콜백
 - onCancel: () => void       취소 버튼 또는 백드롭 클릭 시 실행될 콜백
 - isLoading: boolean         진행 중 상태로 버튼 비활성화 및 라벨 변경
 접근성/UX 참고:
 - 백드롭 영역 클릭 시 닫히며, 박스 내부 클릭은 이벤트 전파를 중단합니다.
 - isLoading이 true일 때 버튼들이 비활성화되고 라벨이 "삭제 중..."으로 변경됩니다.
*/
import React from "react";
import { createPortal } from "react-dom";
import "./ConfirmDialog.css";

export default function ConfirmDialog({ message, onOk, onCancel, isLoading }) {
  return createPortal(
    // 백드롭: 배경 클릭 시 onCancel을 호출하여 다이얼로그를 닫습니다.
    <div className="confirm-back" onClick={onCancel}>
      {/* 다이얼로그 컨테이너: 내부 클릭은 백드롭으로 전파되지 않도록 차단합니다. */}
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        {/* 본문 메시지 영역 */}
        <div>{message}</div>
        {/* 액션 버튼 영역: 취소/삭제 버튼. 로딩 중에는 비활성화됩니다. */}
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
    </div>,
    document.body
  );
}
