import { uploadPdfs, uploadTextfiles, createMemo, createTextToGraph } from '../../../../../api/backend';
import { pdfjs } from 'react-pdf';

const fileHandlers = {
  pdf: async (f, brainId) => {
    const [meta] = await uploadPdfs([f], brainId);
    const arrayBuffer = await f.arrayBuffer();
    const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let content = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      content += textContent.items.map(item => item.str).join(' ') + '\n\n';
    }
    await createTextToGraph({
      text: content,
      brain_id: String(brainId),
      source_id: String(meta.pdf_id),
    });
    return { id: meta.pdf_id, filetype: 'pdf', meta };
  },
  txt: async (f, brainId) => {
    const [meta] = await uploadTextfiles([f], brainId);
    const content = await f.text();
    await createTextToGraph({
      text: content,
      brain_id: String(brainId),
      source_id: String(meta.txt_id),
    });
    return { id: meta.txt_id, filetype: 'txt', meta };
  },
  memo: async (f, brainId) => {
    const content = await f.text();
    const res = await createMemo({
      memo_title: f.name.replace(/\.memo$/, ''),
      memo_text: content,
      is_source: true,
      brain_id: brainId,
      type: 'memo',
    });
    return { id: res.memo_id, filetype: 'memo', meta: res };
  },
};

export default fileHandlers; 