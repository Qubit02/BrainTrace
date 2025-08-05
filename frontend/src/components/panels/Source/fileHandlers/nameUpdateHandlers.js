import { updatePdf, updateTextFile, updateMemo, updateDocxFile, updateMDFile } from '../../../../../api/config/apiIndex';

const nameUpdateHandlers = {
  pdf: async (id, newName, brainId) => {
    await updatePdf(id, {
      pdf_title: newName,
      brain_id: brainId,
    });
  },
  txt: async (id, newName, brainId) => {
    await updateTextFile(id, {
      txt_title: newName,
      brain_id: brainId,
    });
  },
  memo: async (id, newName, brainId) => {
    await updateMemo(id, {
      memo_title: newName,
      brain_id: brainId,
    });
  },
  docx: async (id, newName, brainId) => {
    await updateDocxFile(id, {
      docx_title: newName,
      brain_id: brainId,
    });
  },
  md: async (id, newName, brainId) => {
    await updateMDFile(id, {
      md_title: newName,
      brain_id: brainId,
    });
  },
};

export default nameUpdateHandlers; 