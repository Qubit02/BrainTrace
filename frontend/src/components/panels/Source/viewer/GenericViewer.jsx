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
  const [fontSize, setFontSize] = useState(16);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const contentRef = useRef(null); // 텍스트 콘텐츠 영역을 위한 새로운 ref

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
      console.log("스크롤 조건 확인:", {
        isFromSourceView,
        highlightingInfo: !!highlightingInfo,
        contentRef: !!contentRef.current,
      });
      return;
    }

    console.log("스크롤 함수 실행 시작");
    console.log(
      "highlightingInfo 상세 내용:",
      JSON.stringify(highlightingInfo, null, 2)
    );
    console.log("contentRef.current:", contentRef.current);
    console.log("contentRef.current.innerHTML:", contentRef.current.innerHTML);

    // 여러 방법으로 하이라이트된 텍스트를 찾기
    let highlightedElements = contentRef.current.querySelectorAll(".highlight");
    console.log(
      "CSS 클래스로 찾은 하이라이트 요소 수:",
      highlightedElements.length
    );

    // CSS 클래스로 찾지 못한 경우, 다른 방법 시도
    if (highlightedElements.length === 0) {
      // data-highlight 속성으로 찾기
      const dataHighlightElements =
        contentRef.current.querySelectorAll("[data-highlight]");
      console.log(
        "data-highlight 속성으로 찾은 요소 수:",
        dataHighlightElements.length
      );
      if (dataHighlightElements.length > 0) {
        highlightedElements = dataHighlightElements;
      }
    }

    // 여전히 못 찾은 경우, 더 다양한 방법 시도
    if (highlightedElements.length === 0) {
      // span 태그 중에서 style 속성에 하이라이트 관련 텍스트가 있는 요소 찾기
      const allSpans = contentRef.current.querySelectorAll("span");
      console.log("전체 span 요소 수:", allSpans.length);

      const highlightedSpans = [];
      for (let span of allSpans) {
        const style = span.getAttribute("style") || "";
        if (
          style.includes("background") ||
          style.includes("highlight") ||
          style.includes("color")
        ) {
          console.log("하이라이트 스타일이 있는 span 발견:", span, style);
          highlightedSpans.push(span);
        }
      }

      if (highlightedSpans.length > 0) {
        highlightedElements = highlightedSpans;
        console.log(
          "스타일로 찾은 하이라이트 span 요소 수:",
          highlightedSpans.length
        );
      }
    }

    // 추가로 auto-highlight 스타일이 있는 요소들도 찾기
    if (highlightedElements.length === 0) {
      const autoHighlightElements = contentRef.current.querySelectorAll(
        'span[style*="auto-highlight"]'
      );
      console.log(
        "auto-highlight 스타일로 찾은 요소 수:",
        autoHighlightElements.length
      );
      if (autoHighlightElements.length > 0) {
        highlightedElements = autoHighlightElements;
      }
    }

    // 여전히 못 찾은 경우, highlightingInfo의 텍스트로 검색
    if (highlightedElements.length === 0) {
      console.log("텍스트 검색으로 하이라이트 위치 찾기 시도");

      // highlightingInfo에서 텍스트 추출 시도
      let searchText = "";
      if (highlightingInfo.text) {
        searchText = highlightingInfo.text;
      } else if (highlightingInfo.nodeName) {
        searchText = highlightingInfo.nodeName;
      } else if (highlightingInfo.sourceId) {
        searchText = highlightingInfo.sourceId;
      } else if (typeof highlightingInfo === "string") {
        searchText = highlightingInfo;
      } else if (
        highlightingInfo.highlightedRanges &&
        highlightingInfo.highlightedRanges.length > 0
      ) {
        // highlightedRanges가 있는 경우 첫 번째 범위의 텍스트 사용
        const firstRange = highlightingInfo.highlightedRanges[0];
        if (firstRange.text) {
          searchText = firstRange.text;
        }
      }

      console.log("검색할 텍스트:", searchText);

      if (searchText) {
        const textContent = contentRef.current.textContent;
        const textIndex = textContent.indexOf(searchText);

        if (textIndex !== -1) {
          console.log("텍스트 검색으로 위치 찾음:", textIndex);

          // 텍스트 위치를 대략적으로 계산하여 스크롤
          const lineHeight =
            parseInt(getComputedStyle(contentRef.current).lineHeight) || 20;
          const charsPerLine = Math.floor(contentRef.current.clientWidth / 8); // 대략적인 문자당 너비
          const lineNumber = Math.floor(textIndex / charsPerLine);
          const scrollTop = lineNumber * lineHeight;

          // 부드러운 스크롤
          contentRef.current.scrollTo({
            top: Math.max(0, scrollTop - contentRef.current.clientHeight / 2),
            behavior: "smooth",
          });

          console.log("텍스트 위치로 스크롤 완료");
          return;
        }
      }
    }

    if (highlightedElements.length > 0) {
      // 모든 하이라이트된 요소에 애니메이션 적용
      console.log(`총 ${highlightedElements.length}개의 하이라이트 요소 발견`);

      highlightedElements.forEach((element, index) => {
        console.log(`하이라이트 요소 ${index + 1}:`, element);

        // 각 요소에 시각적 강조 효과 추가
        element.style.animation = "pulse-highlight 2s ease-in-out";

        // 애니메이션 완료 후 스타일 제거
        setTimeout(() => {
          element.style.animation = "";
        }, 2000);
      });

      // 첫 번째 하이라이트된 요소로 스크롤
      const firstHighlight = highlightedElements[0];
      console.log("첫 번째 하이라이트 요소로 스크롤:", firstHighlight);

      // 부드러운 스크롤로 이동
      firstHighlight.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });

      console.log("모든 하이라이트 요소에 애니메이션 적용 및 스크롤 완료");
    } else {
      console.log(
        "하이라이트된 요소를 찾을 수 없습니다. highlightingInfo:",
        highlightingInfo
      );

      // 마지막 수단: 페이지 상단으로 스크롤
      contentRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, [isFromSourceView, highlightingInfo]);

  // 파일/메모 불러오기 - useCallback으로 최적화
  const loadContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      switch (type) {
        case "docx":
          if (!docxId) {
            throw new Error("docx_id가 제공되지 않았습니다");
          }
          const docxData = await getDocxFile(docxId);
          setContent(docxData.docx_text || "[텍스트를 불러올 수 없습니다]");
          break;

        case "memo":
          if (!memoId) {
            throw new Error("memo_id가 제공되지 않았습니다");
          }
          const memoData = await getMemo(memoId);
          setContent(memoData.memo_text || "[메모를 불러올 수 없습니다]");
          break;

        case "pdf":
          if (!pdfId) {
            throw new Error("pdf_id가 제공되지 않았습니다");
          }
          const pdfData = await getPdf(pdfId);
          setContent(pdfData.pdf_text || "[텍스트를 불러올 수 없습니다]");
          break;

        case "txt":
          if (!txtId) {
            throw new Error("txt_id가 제공되지 않았습니다");
          }
          const txtData = await getTextFile(txtId);
          setContent(txtData.txt_text || "[텍스트를 불러올 수 없습니다]");
          break;

        case "md":
          if (!mdId) {
            throw new Error("md_id가 제공되지 않았습니다");
          }
          const mdData = await getMDFile(mdId);
          setContent(mdData.md_text || "[텍스트를 불러올 수 없습니다]");
          break;

        default:
          // 기존 방식으로 파일 시스템에서 읽기 (fallback)
          if (!fileUrl) {
            throw new Error("fileUrl이 제공되지 않았습니다");
          }
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const text = await response.text();
          setContent(text);
          break;
      }
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
    if (isFromSourceView && content && !isLoading) {
      console.log("출처보기 스크롤 useEffect 실행:", {
        content: !!content,
        isLoading,
      });

      // 콘텐츠가 로드되고 하이라이트가 렌더링된 후 스크롤
      const timer = setTimeout(() => {
        console.log("스크롤 타이머 실행");
        scrollToHighlight();
      }, 1000); // 시간을 더 늘려서 하이라이트 렌더링 완료 보장

      return () => clearTimeout(timer);
    }
  }, [isFromSourceView, content, isLoading, scrollToHighlight]);

  // 모든 모드에서 텍스트 선택 활성화 - useCallback으로 최적화
  const handleTextSelection = useCallback(
    (containerRef) => {
      handleSelection(containerRef);
    },
    [handleSelection]
  );

  // 출처보기를 통해 들어온 경우 하이라이트 클릭 비활성화 - useCallback으로 최적화
  const handleHighlightClick = useCallback(
    (highlight) => {
      if (isFromSourceView) {
        return; // 출처보기에서는 하이라이트 클릭 기능 비활성화
      }
    },
    [isFromSourceView]
  );

  // 글꼴 크기 조절 함수들 - useCallback으로 최적화
  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.max(prev - 2, 12));
  }, []);

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.min(prev + 2, 48));
  }, []);

  // 팝업 닫기 함수 - useCallback으로 최적화
  const handlePopupClose = useCallback(() => {
    setPopup(null);
  }, [setPopup]);

  // 컨테이너 스타일 - useMemo로 최적화
  const containerStyle = useMemo(
    () => ({
      fontSize: `${fontSize}px`,
      userSelect: "text", // 모든 모드에서 텍스트 선택 활성화
      cursor: "text", // 모든 모드에서 텍스트 커서
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
          ref={contentRef} // 새로운 ref 추가
          className="viewer-pre viewer-text-content"
          style={containerStyle}
          onSelect={() => handleTextSelection(containerRef)}
          onMouseUp={() => handleTextSelection(containerRef)}
        >
          {renderHighlightedContent(content, handleHighlightClick)}
        </div>
      </div>
    </div>
  );
}
