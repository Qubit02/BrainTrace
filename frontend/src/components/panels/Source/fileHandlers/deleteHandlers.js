/**
 * deleteHandlers.js
 * 
 * 파일 삭제 관련 핸들러들을 관리하는 모듈입니다.
 * 
 * 주요 기능:
 * - 다양한 파일 타입(PDF, TXT, MD, DOCX, MEMO)의 삭제 처리
 * - 각 파일 타입별로 적절한 API 호출
 * - 파일 삭제 시 관련 하이라이팅 데이터도 함께 정리
 * - 상세한 에러 로깅 및 에러 처리
 * 
 * 지원하는 파일 타입:
 * - pdf: PDF 파일 삭제
 * - txt: 텍스트 파일 삭제  
 * - md: 마크다운 파일 삭제
 * - memo: 메모 파일 삭제
 * - docx: Word 문서 파일 삭제
 * 
 * 각 핸들러는 다음 매개변수를 받습니다:
 * - id: 삭제할 파일의 고유 ID
 * - fileUrl: 파일 URL (하이라이팅 데이터 정리용, memo 제외)
 * 
 * 반환값: 삭제 성공 시 true, 실패 시 에러를 throw
 */

import { deletePdf, deleteTextFile, deleteMDFile, hardDeleteMemo, deleteDocxFile } from '../../../../../api/config/apiIndex';
import { clearHighlightingData } from '../viewer/Highlighting.jsx';

const deleteHandlers = {
  /**
   * PDF 파일 삭제 핸들러
   * @param {string|number} id - 삭제할 PDF 파일의 고유 ID
   * @param {string} fileUrl - PDF 파일의 URL (하이라이팅 데이터 정리용)
   * @returns {Promise<boolean>} 삭제 성공 시 true 반환
   * @throws {Error} 삭제 실패 시 에러 throw
   */
  pdf: async (id, fileUrl) => {
    try {
      // PDF 파일 삭제 API 호출
      const result = await deletePdf(id);
      if (result) {
        // PDF 파일 삭제 시 하이라이팅 데이터도 삭제
        clearHighlightingData('pdf', fileUrl);
      }
      return result;
    } catch (error) {
      console.error('PDF 삭제 핸들러 에러:', error);
      console.error('에러 상세 정보:', {
        id,
        fileUrl,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  /**
   * 텍스트 파일 삭제 핸들러
   * @param {string|number} id - 삭제할 텍스트 파일의 고유 ID
   * @param {string} fileUrl - 텍스트 파일의 URL (하이라이팅 데이터 정리용)
   * @returns {Promise<boolean>} 삭제 성공 시 true 반환
   * @throws {Error} 삭제 실패 시 에러 throw
   */
  txt: async (id, fileUrl) => {
    try {
      // 텍스트 파일 삭제 API 호출
      const result = await deleteTextFile(id);
      if (result) {
        // TXT 파일 삭제 시 하이라이팅 데이터도 삭제
        clearHighlightingData('txt', fileUrl);
      }
      return result;
    } catch (error) {
      console.error('TXT 삭제 핸들러 에러:', error);
      console.error('에러 상세 정보:', {
        id,
        fileUrl,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  /**
   * 마크다운 파일 삭제 핸들러
   * @param {string|number} id - 삭제할 마크다운 파일의 고유 ID
   * @param {string} fileUrl - 마크다운 파일의 URL (하이라이팅 데이터 정리용)
   * @returns {Promise<boolean>} 삭제 성공 시 true 반환
   * @throws {Error} 삭제 실패 시 에러 throw
   */
  md: async (id, fileUrl) => {
    try {
      // 마크다운 파일 삭제 API 호출
      const result = await deleteMDFile(id);
      if (result) {
        // MD 파일 삭제 시 하이라이팅 데이터도 삭제
        clearHighlightingData('md', fileUrl);
      }
      return result;
    } catch (error) {
      console.error('MD 삭제 핸들러 에러:', error);
      console.error('에러 상세 정보:', {
        id,
        fileUrl,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  /**
   * 메모 파일 삭제 핸들러
   * @param {string|number} id - 삭제할 메모의 고유 ID
   * @returns {Promise<boolean>} 삭제 성공 시 true 반환
   * @throws {Error} 삭제 실패 시 에러 throw
   */
  memo: async (id) => { 
    try {
      // 메모 파일 삭제 API 호출 (hardDeleteMemo는 완전 삭제)
      const result = await hardDeleteMemo(id);
      if (result) {
        // 메모 삭제 시 하이라이팅 데이터도 삭제
        clearHighlightingData('memo', null, id);
      }
      return result;
    } catch (error) {
      console.error('Memo 삭제 핸들러 에러:', error);
      console.error('에러 상세 정보:', {
        id,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  /**
   * Word 문서 파일 삭제 핸들러
   * @param {string|number} id - 삭제할 Word 문서의 고유 ID
   * @param {string} fileUrl - Word 문서의 URL (하이라이팅 데이터 정리용)
   * @returns {Promise<boolean>} 삭제 성공 시 true 반환
   * @throws {Error} 삭제 실패 시 에러 throw
   */
  docx: async (id, fileUrl) => {
    try {
      // Word 문서 파일 삭제 API 호출
      const result = await deleteDocxFile(id);
      if (result) {
        // DOCX 파일 삭제 시 하이라이팅 데이터도 삭제
        clearHighlightingData('docx', fileUrl, null, id);
      }
      return result;
    } catch (error) {
      console.error('DOCX 삭제 핸들러 에러:', error);
      console.error('에러 상세 정보:', {
        id,
        fileUrl,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },
};

export default deleteHandlers; 