import { updatePdf, updateTextFile, updateMemo } from '../../../../../../backend/api/backend';

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
};

export default nameUpdateHandlers; 