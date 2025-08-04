import { deletePdf, deleteTextFile, deleteMDFile, hardDeleteMemo, deleteDocxFile } from '../../../../../api/config/apiIndex';
import { clearHighlightingData } from '../viewer/Highlighting.jsx';

const deleteHandlers = {
  pdf: async (id, fileUrl) => {
    try {
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
  txt: async (id, fileUrl) => {
    try {
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
  md: async (id, fileUrl) => {
    try {
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
  memo: async (id) => { 
    try {
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
  docx: async (id, fileUrl) => {
    try {
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