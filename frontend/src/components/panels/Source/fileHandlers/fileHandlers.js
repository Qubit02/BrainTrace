import { uploadPdfs, uploadTextfiles, createMemo, uploadMDFiles, createTextToGraph, uploadDocxFiles } from '../../../../../api/backend';
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
  md: async (f, brainId) => {
    const [meta] = await uploadMDFiles([f], brainId);
    const content = await f.text();
    await createTextToGraph({
      text: content,
      brain_id: String(brainId),
      source_id: String(meta.md_id),
    });
    return { id: meta.md_id, filetype: 'md', meta };
  },
  docx: async (f, brainId) => {
    const [meta] = await uploadDocxFiles([f], brainId);
    // 프론트에서 f.text()로 읽지 않고, 서버에서 추출한 텍스트(meta.docx_text)만 사용
    await createTextToGraph({
      text: meta.docx_text,
      brain_id: String(brainId),
      source_id: String(meta.docx_id),
    });
    return { id: meta.docx_id, filetype: 'docx', meta };
  },
};

export default fileHandlers; 