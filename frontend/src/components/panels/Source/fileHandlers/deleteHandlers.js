import { deletePdf, deleteTextFile, setMemoAsNotSource } from '../../../../../api/backend';

const deleteHandlers = {
  pdf: async (id) => await deletePdf(id),
  txt: async (id) => await deleteTextFile(id),
  memo: async (id) => { await setMemoAsNotSource(id); return true; },
};

export default deleteHandlers; 