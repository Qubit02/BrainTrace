import { deletePdf, deleteTextFile, deleteMDFile, setMemoAsNotSource } from '../../../../../api/backend';

const deleteHandlers = {
  pdf: async (id) => await deletePdf(id),
  txt: async (id) => await deleteTextFile(id),
  md: async (id) => await deleteMDFile(id),
  memo: async (id) => { await setMemoAsNotSource(id); return true; },
};

export default deleteHandlers; 