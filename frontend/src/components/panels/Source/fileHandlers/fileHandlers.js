/**
 * fileHandlers.js
 *
 * 파일 업로드 및 처리 관련 핸들러들을 관리하는 모듈입니다.
 *
 * 주요 기능:
 * - 다양한 파일 타입(PDF, TXT, MD, DOCX, MEMO)의 업로드 처리
 * - 각 파일 타입별로 적절한 API 호출 및 텍스트 추출
 * - 추출된 텍스트를 지식 그래프로 변환
 * - 파일 메타데이터 반환
 *
 * 지원하는 파일 타입:
 * - pdf: PDF 파일 업로드 및 텍스트 추출
 * - txt: 텍스트 파일 업로드 및 텍스트 읽기
 * - md: 마크다운 파일 업로드 및 텍스트 읽기
 * - memo: 메모 파일 생성 및 텍스트 처리
 * - docx: Word 문서 업로드 및 텍스트 추출
 *
 * 각 핸들러는 다음 매개변수를 받습니다:
 * - f: File 객체 또는 파일 정보
 * - brainId: 브레인 ID
 *
 * 반환값: { id, filetype, meta } 형태의 객체
 */

import {
  uploadPdfs,
  uploadTextfiles,
  createMemo,
  uploadMDFiles,
  createTextToGraph,
  uploadDocxFiles,
} from '../../../../../api/config/apiIndex';

const fileHandlers = {
  /**
   * PDF 파일 업로드 및 처리 핸들러
   * @param {File} f - 업로드할 PDF 파일 객체
   * @param {string|number} brainId - 브레인 ID
   * @returns {Promise<Object>} { id, filetype: 'pdf', meta } 형태의 객체
   * @throws {Error} 업로드 실패 시 에러 throw
   */
  pdf: async (f, brainId) => {
    try {
      // 서버에서 PDF 텍스트 추출
      const [meta] = await uploadPdfs([f], brainId);

      // 텍스트 추출 실패 시 에러 처리
      if (!meta || !meta.pdf_text) {
        throw new Error('PDF 텍스트 추출에 실패했습니다.');
      }

      // 추출된 텍스트를 지식 그래프로 변환
      await createTextToGraph({
        text: meta.pdf_text,
        brain_id: String(brainId),
        source_id: String(meta.pdf_id),
      });
      return { id: meta.pdf_id, filetype: 'pdf', meta };
    } catch (error) {
      console.error('PDF 파일 처리 오류:', error);
      throw new Error(`PDF 파일 업로드 실패: ${error.message}`);
    }
  },

  /**
   * 텍스트 파일 업로드 및 처리 핸들러
   * @param {File} f - 업로드할 텍스트 파일 객체
   * @param {string|number} brainId - 브레인 ID
   * @returns {Promise<Object>} { id, filetype: 'txt', meta } 형태의 객체
   * @throws {Error} 업로드 실패 시 에러 throw
   */
  txt: async (f, brainId) => {
    try {
      // 서버에서 TXT 텍스트 읽기
      const [meta] = await uploadTextfiles([f], brainId);

      // 텍스트 읽기 실패 시 에러 처리
      if (!meta || !meta.txt_text) {
        throw new Error('TXT 텍스트 읽기에 실패했습니다.');
      }

      // 읽은 텍스트를 지식 그래프로 변환
      await createTextToGraph({
        text: meta.txt_text,
        brain_id: String(brainId),
        source_id: String(meta.txt_id),
      });
      return { id: meta.txt_id, filetype: 'txt', meta };
    } catch (error) {
      console.error('TXT 파일 처리 오류:', error);
      throw new Error(`TXT 파일 업로드 실패: ${error.message}`);
    }
  },

  /**
   * 메모 파일 생성 및 처리 핸들러
   * @param {File} f - 메모 파일 객체 (내용은 text()로 읽음)
   * @param {string|number} brainId - 브레인 ID
   * @returns {Promise<Object>} { id, filetype: 'memo', meta } 형태의 객체
   * @throws {Error} 메모 생성 실패 시 에러 throw
   */
  memo: async (f, brainId) => {
    try {
      // 파일에서 텍스트 내용 읽기
      const content = await f.text();
      // 메모 생성 API 호출
      const res = await createMemo({
        memo_title: f.name.replace(/\.memo$/, ''), // .memo 확장자 제거
        memo_text: content,
        is_source: true, // 소스로 사용하는 메모임을 표시
        brain_id: brainId,
        type: 'memo',
      });
      return { id: res.memo_id, filetype: 'memo', meta: res };
    } catch (error) {
      console.error('메모 파일 처리 오류:', error);
      throw new Error(`메모 파일 업로드 실패: ${error.message}`);
    }
  },

  /**
   * 마크다운 파일 업로드 및 처리 핸들러
   * @param {File} f - 업로드할 마크다운 파일 객체
   * @param {string|number} brainId - 브레인 ID
   * @returns {Promise<Object>} { id, filetype: 'md', meta } 형태의 객체
   * @throws {Error} 업로드 실패 시 에러 throw
   */
  md: async (f, brainId) => {
    try {
      // 서버에서 MD 텍스트 읽기
      const [meta] = await uploadMDFiles([f], brainId);

      // 텍스트 읽기 실패 시 에러 처리
      if (!meta || !meta.md_text) {
        throw new Error('MD 텍스트 읽기에 실패했습니다.');
      }

      // 읽은 텍스트를 지식 그래프로 변환
      await createTextToGraph({
        text: meta.md_text,
        brain_id: String(brainId),
        source_id: String(meta.md_id),
      });
      return { id: meta.md_id, filetype: 'md', meta };
    } catch (error) {
      console.error('MD 파일 처리 오류:', error);
      throw new Error(`MD 파일 업로드 실패: ${error.message}`);
    }
  },

  /**
   * Word 문서 파일 업로드 및 처리 핸들러
   * @param {File} f - 업로드할 Word 문서 파일 객체
   * @param {string|number} brainId - 브레인 ID
   * @returns {Promise<Object>} { id, filetype: 'docx', meta } 형태의 객체
   * @throws {Error} 업로드 실패 시 에러 throw
   */
  docx: async (f, brainId) => {
    try {
      // 서버에서 DOCX 텍스트 추출
      const [meta] = await uploadDocxFiles([f], brainId);

      // 텍스트 추출 실패 시 에러 처리
      if (!meta || !meta.docx_text) {
        throw new Error('DOCX 텍스트 추출에 실패했습니다.');
      }

      // 추출된 텍스트를 지식 그래프로 변환
      await createTextToGraph({
        text: meta.docx_text,
        brain_id: String(brainId),
        source_id: String(meta.docx_id),
      });
      return { id: meta.docx_id, filetype: 'docx', meta };
    } catch (error) {
      console.error('DOCX 파일 처리 오류:', error);
      throw new Error(`DOCX 파일 업로드 실패: ${error.message}`);
    }
  },
};

export default fileHandlers;
