/**
 * GenericViewer.jsx - 범용 파일 뷰어 컴포넌트
 *
 * 기능:
 * - 다양한 파일 형식 지원 (DOCX, PDF, TXT, MD, MEMO)
 * - 텍스트 하이라이트 기능 (색상 선택, 복사, 제거)
 * - 출처보기 모드 지원 (highlightingInfo를 통한 소스 참조)
 * - 글꼴 크기 조절 및 하이라이트 초기화
 * - 드래그 가능한 하이라이트 팝업
 * - 출처보기 시 하이라이트된 위치로 자동 스크롤
 *
 * 지원 파일 형식:
 * - docx: Word 문서 (docxId 필요)
 * - pdf: PDF 문서 (pdfId 필요)
 * - txt: 텍스트 파일 (txtId 필요)
 * - md: 마크다운 파일 (mdId 필요)
 * - memo: 메모 (memoId 필요)
 *
 * 모드:
 * - 일반 모드: 일반적인 파일 뷰어 기능
 * - 출처보기 모드: highlightingInfo가 제공될 때, 소스 참조용
 *
 * 주요 컴포넌트:
 * - HighlightPopup: 하이라이트 색상 선택 및 액션 팝업
 * - useHighlighting: 하이라이트 기능 훅
 *
 * 사용법:
 * <GenericViewer
 *   type="pdf"
 *   pdfId="pdf-123"
 *   title="문서 제목"
 *   onBack={() => handleBack()}
 *   highlightingInfo={{ sourceId: "source-123", nodeName: "노드명" }}
 * />
 */

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import HighlightPopup from "./HighlightPopup.jsx";
import { useHighlighting } from "./Highlighting.jsx";
import "./Viewer.css";
import { FaArrowLeftLong, FaMinus, FaPlus } from "react-icons/fa6";
import { TbRefresh } from "react-icons/tb";
import { MdOutlineSource } from "react-icons/md";
import {
  getDocxFile,
  getMemo,
  getPdf,
  getTextFile,
  getMDFile,
} from "../../../../../api/config/apiIndex";

// 상수 정의
const FONT_SIZE = {
  MIN: 12,
  MAX: 48,
  DEFAULT: 16,
  STEP: 2,
};

const SCROLL_DELAY = 1000; // 하이라이트 렌더링 완료 대기 시간 (ms)
const ANIMATION_DURATION = 2000; // 하이라이트 애니메이션 지속 시간 (ms)

const FILE_TYPE_ERRORS = {
  docx: "docx_id가 제공되지 않았습니다",
  memo: "memo_id가 제공되지 않았습니다",
  pdf: "pdf_id가 제공되지 않았습니다",
  txt: "txt_id가 제공되지 않았습니다",
  md: "md_id가 제공되지 않았습니다",
};

const DEFAULT_ERROR_MESSAGES = {
  docx: "[텍스트를 불러올 수 없습니다]",
  memo: "[메모를 불러올 수 없습니다]",
  pdf: "[텍스트를 불러올 수 없습니다]",
  txt: "[텍스트를 불러올 수 없습니다]",
  md: "[텍스트를 불러올 수 없습니다]",
};

/**
 * 하이라이트된 요소를 찾는 유틸리티 함수
 * @param {HTMLElement} container - 검색할 컨테이너 요소
 * @returns {NodeList} 하이라이트된 요소들의 NodeList
 */
const findHighlightedElements = (container) => {
  // 1. CSS 클래스로 찾기
  let elements = container.querySelectorAll(".highlight");
  if (elements.length > 0) return elements;

  // 2. data-highlight 속성으로 찾기
  elements = container.querySelectorAll("[data-highlight]");
  if (elements.length > 0) return elements;

  // 3. auto-highlight 스타일로 찾기
  elements = container.querySelectorAll('span[style*="auto-highlight"]');
  if (elements.length > 0) return elements;

  // 4. span 태그 중 스타일 속성으로 찾기
  const allSpans = container.querySelectorAll("span");
  const highlightedSpans = Array.from(allSpans).filter((span) => {
    const style = span.getAttribute("style") || "";
    return (
      style.includes("background") ||
      style.includes("highlight") ||
      style.includes("color")
    );
  });

  return highlightedSpans.length > 0 ? highlightedSpans : [];
};

/**
 * highlightingInfo에서 검색할 텍스트 추출
 * @param {Object|string} highlightingInfo - 출처보기 정보
 * @returns {string} 검색할 텍스트
 */
const extractSearchText = (highlightingInfo) => {
  if (!highlightingInfo) return "";

  if (typeof highlightingInfo === "string") {
    return highlightingInfo;
  }

  if (highlightingInfo.text) return highlightingInfo.text;
  if (highlightingInfo.nodeName) return highlightingInfo.nodeName;
  if (highlightingInfo.sourceId) return highlightingInfo.sourceId;

  if (
    highlightingInfo.highlightedRanges &&
    highlightingInfo.highlightedRanges.length > 0
  ) {
    const firstRange = highlightingInfo.highlightedRanges[0];
    return firstRange.text || "";
  }

  return "";
};

/**
 * 텍스트 검색을 통해 위치로 스크롤
 * @param {HTMLElement} container - 스크롤할 컨테이너 요소
 * @param {string} searchText - 검색할 텍스트
 */
const scrollToText = (container, searchText) => {
  if (!searchText || !container) return false;

  const textContent = container.textContent;
  const textIndex = textContent.indexOf(searchText);

  if (textIndex === -1) return false;

  const lineHeight = parseInt(getComputedStyle(container).lineHeight) || 20;
  const charsPerLine = Math.floor(container.clientWidth / 8);
  const lineNumber = Math.floor(textIndex / charsPerLine);
  const scrollTop = lineNumber * lineHeight;

  container.scrollTo({
    top: Math.max(0, scrollTop - container.clientHeight / 2),
    behavior: "smooth",
  });

  return true;
};

/**
 * 하이라이트 요소에 애니메이션 적용
 * @param {NodeList|Array} elements - 애니메이션을 적용할 요소들
 */
const applyHighlightAnimation = (elements) => {
  const animationDuration = `${ANIMATION_DURATION / 1000}s`;
  Array.from(elements).forEach((element) => {
    element.style.animation = `pulse-highlight ${animationDuration} ease-in-out`;
    setTimeout(() => {
      element.style.animation = "";
    }, ANIMATION_DURATION);
  });
};

/**
 * 파일 타입에 따른 파일 로딩 함수
 * @param {string} type - 파일 타입
 * @param {Object} params - 파일 ID 매개변수들
 * @returns {Promise<string>} 파일 내용
 */
const loadFileByType = async (type, params) => {
  const { fileUrl, memoId, docxId, pdfId, txtId, mdId } = params;

  switch (type) {
    case "docx":
      if (!docxId) throw new Error(FILE_TYPE_ERRORS.docx);
      const docxData = await getDocxFile(docxId);
      return docxData.docx_text || DEFAULT_ERROR_MESSAGES.docx;

    case "memo":
      if (!memoId) throw new Error(FILE_TYPE_ERRORS.memo);
      const memoData = await getMemo(memoId);
      return memoData.memo_text || DEFAULT_ERROR_MESSAGES.memo;

    case "pdf":
      if (!pdfId) throw new Error(FILE_TYPE_ERRORS.pdf);
      const pdfData = await getPdf(pdfId);
      return pdfData.pdf_text || DEFAULT_ERROR_MESSAGES.pdf;

    case "txt":
      if (!txtId) throw new Error(FILE_TYPE_ERRORS.txt);
      const txtData = await getTextFile(txtId);
      return txtData.txt_text || DEFAULT_ERROR_MESSAGES.txt;

    case "md":
      if (!mdId) throw new Error(FILE_TYPE_ERRORS.md);
      const mdData = await getMDFile(mdId);
      return mdData.md_text || DEFAULT_ERROR_MESSAGES.md;

    default:
      // Fallback: 파일 URL에서 읽기
      if (!fileUrl) {
        throw new Error("fileUrl이 제공되지 않았습니다");
      }
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
  }
};

/**
 * GenericViewer - 범용 파일 뷰어 컴포넌트
 *
 * @param {string} type - 파일 타입 ('docx', 'pdf', 'txt', 'md', 'memo')
 * @param {string} fileUrl - 파일 URL (fallback용)
 * @param {string} memoId - 메모 ID
 * @param {Function} onBack - 뒤로가기 콜백
 * @param {string} title - 파일 제목
 * @param {string} docxId - DOCX 파일 ID
 * @param {string} pdfId - PDF 파일 ID
 * @param {string} txtId - TXT 파일 ID
 * @param {string} mdId - MD 파일 ID
 * @param {Object} highlightingInfo - 출처보기 정보 (선택사항)
 */
export default function GenericViewer({
  type,
  fileUrl,
  memoId,
  onBack,
  title,
  docxId,
  pdfId,
  txtId,
  mdId,
  highlightingInfo,
}) {
  const [content, setContent] = useState("");
  const [fontSize, setFontSize] = useState(FONT_SIZE.DEFAULT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  // 출처보기를 통해 들어온 경우인지 확인 (highlightingInfo가 있으면 출처보기)
  const isFromSourceView = !!highlightingInfo;

  // 하이라이팅 훅 사용 - highlightingInfo를 전달하여 출처보기 모드 지원
  const {
    popup,
    setPopup,
    addHighlight,
    deleteHighlight,
    clearHighlights,
    handleSelection,
    renderHighlightedContent,
    copyText,
    loadHighlights,
  } = useHighlighting(
    type,
    fileUrl,
    memoId,
    docxId,
    pdfId,
    txtId,
    mdId,
    isFromSourceView,
    highlightingInfo
  );

  // 출처보기에서 하이라이트된 위치로 스크롤하는 함수
  const scrollToHighlight = useCallback(() => {
    if (!isFromSourceView || !highlightingInfo || !contentRef.current) {
      return;
    }

    const container = contentRef.current;

    // 1. 하이라이트된 요소 찾기
    const highlightedElements = findHighlightedElements(container);

    // 2. 하이라이트 요소를 찾은 경우
    if (highlightedElements.length > 0) {
      applyHighlightAnimation(highlightedElements);

      // 첫 번째 하이라이트된 요소로 스크롤
      highlightedElements[0].scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      return;
    }

    // 3. 하이라이트 요소를 찾지 못한 경우, 텍스트 검색으로 스크롤
    const searchText = extractSearchText(highlightingInfo);
    if (searchText && scrollToText(container, searchText)) {
      return;
    }

    // 4. 모든 방법 실패 시 페이지 상단으로 스크롤
    container.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [isFromSourceView, highlightingInfo]);

  // 파일/메모 불러오기
  const loadContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fileContent = await loadFileByType(type, {
        fileUrl,
        memoId,
        docxId,
        pdfId,
        txtId,
        mdId,
      });
      setContent(fileContent);
    } catch (error) {
      console.error("파일 내용 로딩 실패:", error);
      setError(error.message);
      setContent(`[오류: ${error.message}]`);
    } finally {
      setIsLoading(false);
    }
  }, [type, fileUrl, memoId, docxId, pdfId, txtId, mdId]);

  // 파일/메모 불러오기
  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // 출처보기가 아닌 경우에만 기존 하이라이트 불러오기
  useEffect(() => {
    if (!isFromSourceView) {
      loadHighlights();
    }
  }, [isFromSourceView, loadHighlights]);

  // 출처보기인 경우 하이라이트된 위치로 스크롤
  useEffect(() => {
    if (!isFromSourceView || !content || isLoading) return;

    // 콘텐츠가 로드되고 하이라이트가 렌더링된 후 스크롤
    const timer = setTimeout(() => {
      scrollToHighlight();
    }, SCROLL_DELAY);

    return () => clearTimeout(timer);
  }, [isFromSourceView, content, isLoading, scrollToHighlight]);

  // 텍스트 선택 핸들러
  const handleTextSelection = useCallback(() => {
    handleSelection(containerRef);
  }, [handleSelection]);

  // 하이라이트 클릭 핸들러 (출처보기 모드에서는 비활성화)
  const handleHighlightClick = useCallback(() => {
    // 출처보기에서는 하이라이트 클릭 기능 비활성화
    if (isFromSourceView) return;
  }, [isFromSourceView]);

  // 글꼴 크기 조절 함수들
  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.max(prev - FONT_SIZE.STEP, FONT_SIZE.MIN));
  }, []);

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.min(prev + FONT_SIZE.STEP, FONT_SIZE.MAX));
  }, []);

  // 팝업 닫기 함수
  const handlePopupClose = useCallback(() => {
    setPopup(null);
  }, [setPopup]);

  // 컨테이너 스타일
  const containerStyle = useMemo(
    () => ({
      fontSize: `${fontSize}px`,
      userSelect: "text",
      cursor: "text",
    }),
    [fontSize]
  );

  // 로딩 상태 표시
  if (isLoading) {
    return (
      <div
        className="viewer-container"
        data-file-type={type}
        data-source-view={isFromSourceView}
      >
        <div className="viewer-loading">
          <div className="loading-spinner"></div>
          <p>파일을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="viewer-container"
      data-file-type={type}
      data-source-view={isFromSourceView}
    >
      {/* 상단 바: 뒤로가기, 제목, 글꼴 크기 조절, 초기화 */}
      <div className="viewer-header viewer-header-container">
        <FaArrowLeftLong
          onClick={onBack}
          className={`viewer-back-button ${type === "md" ? "md" : ""}`}
          title="뒤로 가기"
        />

        {/* 제목을 헤더 가운데에 표시 */}
        <div className="viewer-title-header">
          <span className="viewer-title-text">{title}</span>
        </div>

        <div className="viewer-controls viewer-controls-container">
          <FaMinus
            className="viewer-button"
            onClick={decreaseFontSize}
            title="글꼴 크기 줄이기"
          />
          <FaPlus
            className="viewer-button"
            onClick={increaseFontSize}
            title="글꼴 크기 늘리기"
          />
          <span className="viewer-fontsize">{fontSize}px</span>
          {/* 출처보기가 아닌 경우에만 하이라이트 초기화 버튼 표시 */}
          {!isFromSourceView && (
            <TbRefresh
              className="viewer-button"
              onClick={clearHighlights}
              title="하이라이트 모두 지우기"
            />
          )}
        </div>
      </div>

      {/* 텍스트 콘텐츠 영역 */}
      <div className="viewer-content" ref={containerRef}>
        {/* 출처보기 안내 메시지 */}
        {isFromSourceView && (
          <div className="source-view-notice">
            <MdOutlineSource className="source-view-notice-icon" />
            <span className="source-view-notice-text">
              이 소스는 <strong>출처보기</strong>를 통해 열렸습니다.
              하이라이트된 부분이 답변의 근거가 되는 내용입니다.
            </span>
          </div>
        )}

        {/* 오류 메시지 표시 */}
        {error && (
          <div className="viewer-error">
            <p>파일을 불러오는 중 오류가 발생했습니다: {error}</p>
          </div>
        )}

        {/* 하이라이트 팝업 표시 - 출처보기가 아닌 경우에만 */}
        {popup && !isFromSourceView && (
          <HighlightPopup
            position={popup.position}
            containerRef={containerRef}
            onSelectColor={addHighlight}
            onCopyText={copyText}
            onClose={handlePopupClose}
            onDeleteHighlight={deleteHighlight}
            isExistingHighlight={popup?.isExistingHighlight}
            highlightId={popup?.highlightId}
          />
        )}

        {/* 텍스트 본문 렌더링 */}
        <div
          ref={contentRef}
          className="viewer-pre viewer-text-content"
          style={containerStyle}
          onSelect={handleTextSelection}
          onMouseUp={handleTextSelection}
        >
          {renderHighlightedContent(content, handleHighlightClick)}
        </div>
      </div>
    </div>
  );
}
