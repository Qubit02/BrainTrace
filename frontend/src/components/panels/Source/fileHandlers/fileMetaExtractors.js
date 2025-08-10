/**
 * fileMetaExtractors.js
 * 
 * 파일 메타데이터 추출 관련 핸들러들을 관리하는 모듈입니다.
 * 
 * 주요 기능:
 * - 다양한 파일 타입의 메타데이터를 표준화된 형태로 추출
 * - 각 파일 타입별로 적절한 ID와 제목 필드 매핑
 * - 일관된 객체 구조로 메타데이터 반환
 * 
 * 지원하는 파일 타입:
 * - pdf: PDF 파일 메타데이터 추출
 * - txt: 텍스트 파일 메타데이터 추출
 * - md: 마크다운 파일 메타데이터 추출
 * - memo: 메모 파일 메타데이터 추출
 * - docx: Word 문서 파일 메타데이터 추출
 * 
 * 반환되는 객체 구조:
 * {
 *   id: 파일의 고유 ID,
 *   filetype: 파일 타입 ('pdf', 'txt', 'md', 'memo', 'docx'),
 *   name: 파일명 또는 제목,
 *   meta: 전체 메타데이터 객체
 * }
 * 
 * 사용법:
 * const extractor = fileMetaExtractors.pdf;
 * const fileInfo = extractor(pdfFileData);
 */

const fileMetaExtractors = {
  /**
   * PDF 파일 메타데이터 추출 함수
   * @param {Object} f - PDF 파일 데이터 객체
   * @returns {Object} { id, filetype: 'pdf', name, meta } 형태의 객체
   */
  pdf: f => ({ 
    id: f.pdf_id, 
    filetype: 'pdf', 
    name: f.pdf_title || f.title, 
    meta: f 
  }),

  /**
   * 텍스트 파일 메타데이터 추출 함수
   * @param {Object} f - 텍스트 파일 데이터 객체
   * @returns {Object} { id, filetype: 'txt', name, meta } 형태의 객체
   */
  txt: f => ({ 
    id: f.txt_id, 
    filetype: 'txt', 
    name: f.txt_title || f.title, 
    meta: f 
  }),

  /**
   * 마크다운 파일 메타데이터 추출 함수
   * @param {Object} f - 마크다운 파일 데이터 객체
   * @returns {Object} { id, filetype: 'md', name, meta } 형태의 객체
   */
  md: f => ({ 
    id: f.md_id, 
    filetype: 'md', 
    name: f.md_title || f.title, 
    meta: f 
  }),

  /**
   * 메모 파일 메타데이터 추출 함수
   * @param {Object} f - 메모 파일 데이터 객체
   * @returns {Object} { id, filetype: 'memo', name, meta } 형태의 객체
   */
  memo: f => ({ 
    id: f.memo_id, 
    filetype: 'memo', 
    name: f.memo_title || f.title, 
    meta: f 
  }),

  /**
   * Word 문서 파일 메타데이터 추출 함수
   * @param {Object} f - Word 문서 파일 데이터 객체
   * @returns {Object} { id, filetype: 'docx', name, meta } 형태의 객체
   */
  docx: f => ({ 
    id: f.docx_id, 
    filetype: 'docx', 
    name: f.docx_title || f.title, 
    meta: f 
  }),

  // 새로운 파일 타입 추가 시 여기에만 함수 추가
};

export default fileMetaExtractors; 