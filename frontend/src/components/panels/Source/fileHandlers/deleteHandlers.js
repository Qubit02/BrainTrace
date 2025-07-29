import { deletePdf, deleteTextFile, deleteMDFile, hardDeleteMemo, deleteDocxFile } from '../../../../../api/backend';
import { clearHighlightingData } from '../viewer/Highlighting.jsx';

const deleteHandlers = {
  pdf: async (id, fileUrl) => {
    const result = await deletePdf(id);
    if (result) {
      // PDF 파일 삭제 시 하이라이팅 데이터도 삭제
      clearHighlightingData('pdf', fileUrl);
    }
    return result;
  },
  txt: async (id, fileUrl) => {
    const result = await deleteTextFile(id);
    if (result) {
      // TXT 파일 삭제 시 하이라이팅 데이터도 삭제
      clearHighlightingData('txt', fileUrl);
    }
    return result;
  },
  md: async (id, fileUrl) => {
    const result = await deleteMDFile(id);
    if (result) {
      // MD 파일 삭제 시 하이라이팅 데이터도 삭제
      clearHighlightingData('md', fileUrl);
    }
    return result;
  },
  memo: async (id) => { 
    const result = await hardDeleteMemo(id);
    if (result) {
      // 메모 삭제 시 하이라이팅 데이터도 삭제
      clearHighlightingData('memo', null, id);
    }
    return result;
  },
  docx: async (id, fileUrl) => {
    const result = await deleteDocxFile(id);
    if (result) {
      // DOCX 파일 삭제 시 하이라이팅 데이터도 삭제
      clearHighlightingData('docx', fileUrl, null, id);
    }
    return result;
  },
};

export default deleteHandlers; 