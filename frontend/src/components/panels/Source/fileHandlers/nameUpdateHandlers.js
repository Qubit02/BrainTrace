/**
 * nameUpdateHandlers.js
 * 
 * 파일 이름 변경 관련 핸들러들을 관리하는 모듈입니다.
 * 
 * 주요 기능:
 * - 다양한 파일 타입(PDF, TXT, MD, DOCX, MEMO)의 이름 변경 처리
 * - 각 파일 타입별로 적절한 API 호출
 * - 백엔드 서버에 이름 변경 요청 전송
 * 
 * 지원하는 파일 타입:
 * - pdf: PDF 파일 이름 변경
 * - txt: 텍스트 파일 이름 변경
 * - md: 마크다운 파일 이름 변경
 * - memo: 메모 파일 이름 변경
 * - docx: Word 문서 파일 이름 변경
 * 
 * 각 핸들러는 다음 매개변수를 받습니다:
 * - id: 변경할 파일의 고유 ID
 * - newName: 새로운 파일명
 * - brainId: 브레인 ID
 * 
 * 반환값: Promise<void> (성공 시 resolve, 실패 시 reject)
 */

import { updatePdf, updateTextFile, updateMemo, updateDocxFile, updateMDFile } from '../../../../../api/config/apiIndex';

const nameUpdateHandlers = {
  /**
   * PDF 파일 이름 변경 핸들러
   * @param {string|number} id - 변경할 PDF 파일의 고유 ID
   * @param {string} newName - 새로운 PDF 파일명
   * @param {string|number} brainId - 브레인 ID
   * @returns {Promise<void>} 이름 변경 완료 시 resolve
   */
  pdf: async (id, newName, brainId) => {
    await updatePdf(id, {
      pdf_title: newName,
      brain_id: brainId,
    });
  },

  /**
   * 텍스트 파일 이름 변경 핸들러
   * @param {string|number} id - 변경할 텍스트 파일의 고유 ID
   * @param {string} newName - 새로운 텍스트 파일명
   * @param {string|number} brainId - 브레인 ID
   * @returns {Promise<void>} 이름 변경 완료 시 resolve
   */
  txt: async (id, newName, brainId) => {
    await updateTextFile(id, {
      txt_title: newName,
      brain_id: brainId,
    });
  },

  /**
   * 메모 파일 이름 변경 핸들러
   * @param {string|number} id - 변경할 메모의 고유 ID
   * @param {string} newName - 새로운 메모 파일명
   * @param {string|number} brainId - 브레인 ID
   * @returns {Promise<void>} 이름 변경 완료 시 resolve
   */
  memo: async (id, newName, brainId) => {
    await updateMemo(id, {
      memo_title: newName,
      brain_id: brainId,
    });
  },

  /**
   * Word 문서 파일 이름 변경 핸들러
   * @param {string|number} id - 변경할 Word 문서의 고유 ID
   * @param {string} newName - 새로운 Word 문서 파일명
   * @param {string|number} brainId - 브레인 ID
   * @returns {Promise<void>} 이름 변경 완료 시 resolve
   */
  docx: async (id, newName, brainId) => {
    await updateDocxFile(id, {
      docx_title: newName,
      brain_id: brainId,
    });
  },

  /**
   * 마크다운 파일 이름 변경 핸들러
   * @param {string|number} id - 변경할 마크다운 파일의 고유 ID
   * @param {string} newName - 새로운 마크다운 파일명
   * @param {string|number} brainId - 브레인 ID
   * @returns {Promise<void>} 이름 변경 완료 시 resolve
   */
  md: async (id, newName, brainId) => {
    await updateMDFile(id, {
      md_title: newName,
      brain_id: brainId,
    });
  },
};

export default nameUpdateHandlers; 