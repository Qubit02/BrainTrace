import React, { useEffect, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import "./Spinner.css";

export default function Spinner() {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="spinner-brain-root">
      <AiOutlineLoading3Quarters className="spinner-react-icon" />
      <div className="spinner-brain-text">프로젝트 로딩중{dots}</div>
    </div>
  );
}
