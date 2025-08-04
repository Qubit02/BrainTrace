import { uploadPdfs, uploadTextfiles, createMemo, uploadMDFiles, createTextToGraph, uploadDocxFiles } from '../../../../../api/backend';
import { pdfjs } from 'react-pdf';

const fileHandlers = {
  pdf: async (f, brainId) => {
    try {
      // 서버에서 PDF 텍스트 추출
      const [meta] = await uploadPdfs([f], brainId);
      
      if (!meta || !meta.pdf_text) {
        throw new Error('PDF 텍스트 추출에 실패했습니다.');
      }
      
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
  txt: async (f, brainId) => {
    try {
      // 서버에서 TXT 텍스트 읽기
      const [meta] = await uploadTextfiles([f], brainId);
      
      if (!meta || !meta.txt_text) {
        throw new Error('TXT 텍스트 읽기에 실패했습니다.');
      }
      
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
  memo: async (f, brainId) => {
    try {
      const content = await f.text();
      const res = await createMemo({
        memo_title: f.name.replace(/\.memo$/, ''),
        memo_text: content,
        is_source: true,
        brain_id: brainId,
        type: 'memo',
      });
      return { id: res.memo_id, filetype: 'memo', meta: res };
    } catch (error) {
      console.error('메모 파일 처리 오류:', error);
      throw new Error(`메모 파일 업로드 실패: ${error.message}`);
    }
  },
  md: async (f, brainId) => {
    try {
      // 서버에서 MD 텍스트 읽기
      const [meta] = await uploadMDFiles([f], brainId);
      
      if (!meta || !meta.md_text) {
        throw new Error('MD 텍스트 읽기에 실패했습니다.');
      }
      
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
  docx: async (f, brainId) => {
    try {
      // 서버에서 DOCX 텍스트 추출
      const [meta] = await uploadDocxFiles([f], brainId);
      
      if (!meta || !meta.docx_text) {
        throw new Error('DOCX 텍스트 추출에 실패했습니다.');
      }
      
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