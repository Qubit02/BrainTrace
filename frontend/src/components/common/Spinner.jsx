/*
 설명: 페이지/패널 데이터 로딩 상태를 시각적으로 표시하는 스피너 컴포넌트입니다.
 사용법 예시:
   <Spinner />
 동작:
 - 400ms 간격으로 점(dot) 개수를 0~3개까지 순환하여 "..." 애니메이션을 만듭니다.
 - 컴포넌트 언마운트 시 interval을 정리하여 메모리 누수를 방지합니다.
 스타일 클래스:
 - spinner-brain-root: 스피너 전체 컨테이너
 - spinner-react-icon: 회전 아이콘 스타일
 - spinner-brain-text: 진행 중 문구 스타일
*/
import React, { useEffect, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import "./Spinner.css";

export default function Spinner() {
  // 점 애니메이션을 위한 상태 ("", ".", "..", "..." 순환)
  const [dots, setDots] = useState("");
  // 400ms 간격으로 점 개수를 순환하며, 언마운트 시 interval을 정리합니다.
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="spinner-brain-root">
      {/* 회전 로딩 아이콘 */}
      <AiOutlineLoading3Quarters className="spinner-react-icon" />
      {/* 진행 중 문구 + 점 애니메이션 */}
      <div className="spinner-brain-text">프로젝트 로딩중{dots}</div>
    </div>
  );
}
