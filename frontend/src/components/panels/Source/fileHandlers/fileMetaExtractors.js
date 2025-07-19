const fileMetaExtractors = {
  pdf: f => ({ id: f.pdf_id, filetype: 'pdf', name: f.pdf_title || f.title, meta: f }),
  txt: f => ({ id: f.txt_id, filetype: 'txt', name: f.txt_title || f.title, meta: f }),
  md: f => ({ id: f.md_id, filetype: 'md', name: f.md_title || f.title, meta: f }),
  memo: f => ({ id: f.memo_id, filetype: 'memo', name: f.memo_title || f.title, meta: f }),
  // 새로운 파일 타입 추가 시 여기에만 함수 추가
};

export default fileMetaExtractors; 