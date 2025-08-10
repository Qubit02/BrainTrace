/**
 * FileIcon 컴포넌트
 * 
 * 이 컴포넌트는 파일 확장자에 따라 적절한 아이콘을 렌더링합니다.
 * 지원하는 파일 형식:
 * - PDF (.pdf)
 * - 텍스트 파일 (.txt)
 * - 마크다운 (.md)
 * - Word 문서 (.doc, .docx)
 * - Excel 파일 (.xls, .xlsx)
 * - 기타 파일 (기본 아이콘)
 * 
 * Props:
 * - fileName: 파일 이름 (확장자 포함)
 * 
 * @param {string} fileName - 파일 이름
 * @returns {JSX.Element} 파일 확장자에 맞는 아이콘 컴포넌트
 */
import {
    TbFileTypePdf,       // PDF 파일 아이콘
    TbFileTypeXls,       // Excel 파일 아이콘
    TbFileTypeTxt,       // 텍스트 파일 아이콘
    TbFileTypeDocx, // Docx 파일 아이콘
    TbFile,       // 확장자를 알 수 없는 파일 아이콘
    TbFileDescription    // 일반적인 파일 설명 아이콘 (기본 fallback)
} from "react-icons/tb";
import { AiOutlineFileMarkdown } from "react-icons/ai";


function FileIcon({ fileName }) {
    const iconSize = 20; // 아이콘 크기 지정 (예: 20px)

    // fileName이 없거나 문자열이 아닐 경우, 알 수 없는 파일 아이콘 표시
    if (!fileName || typeof fileName !== "string") {
        return <TbFile color="black" size={iconSize} />;
    }

    // 파일 이름을 소문자로 변환하여 확장자 비교에 사용
    const lower = fileName.toLowerCase();

    // 확장자에 따라 해당 파일 아이콘 렌더링
    if (lower.endsWith(".pdf")) {
        return <TbFileTypePdf color="black" size={iconSize} />;
    }
    if (lower.endsWith(".txt")) {
        return <TbFileTypeTxt color="black" size={iconSize} />;
    }
    if (lower.endsWith(".md")) {
        return <AiOutlineFileMarkdown color="black" size={iconSize} />;
    }
    if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
        return <TbFileTypeDocx color="black" size={iconSize} />;
    }
    if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) {
        return <TbFileTypeXls color="black" size={iconSize} />;
    }

    // 위 조건에 해당하지 않으면 일반적인 파일 설명 아이콘으로 대체
    return <TbFileDescription color="black" size={iconSize} />;
}

export default FileIcon;
