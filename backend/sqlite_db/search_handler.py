
"""
SearchHandler: 제목 검색 & ID→제목 맵 조회 (SQLite)
-----------------------------------------------

이 핸들러는 로컬 SQLite DB의 여러 컨텐츠 테이블(Pdf, TextFile, Memo, MDFile, DocxFile)을
대상으로 **제목 부분검색**과 **ID 목록을 한 번에 제목으로 매핑**하는 기능을 제공합니다.

주요 메서드
- search_titles_by_query(query: str, brain_id: int) -> List[Dict]
  : 지정한 브레인에서 `Pdf.pdf_title`과 `TextFile.txt_title`을 대상으로
    `LIKE '%query%'` 조건으로 부분 일치 검색.
  : 반환 형식 예시: `[{"type": "pdf"|"text", "id": 123, "title": "..."}, ...]`

- get_titles_by_ids(ids: List[int]) -> Dict[int, str]
  : 주어진 ID 리스트를 **Pdf/TextFile/Memo/MDFile/DocxFile**에 대해 `UNION ALL`로
    한 번에 조회하여 `{컨텐츠ID: 제목}` 딕셔너리로 반환.
  : 서로 다른 테이블에서 **동일한 숫자 ID**가 존재할 경우, 나중에 조회된 항목으로
    덮어써질 수 있으므로(충돌 위험) 필요 시 **타입 구분 키**(예: `"pdf:123"`)로
    반환 스펙을 변경하는 것을 권장.

구현/주의 사항
- SQL 인자 바인딩을 사용하여 **SQL 인젝션을 방지**합니다.
- LIKE 검색은 기본적으로 **대소문자 구분 여부가 컬레이션/플랫폼에 따라** 달라질 수 있습니다.
  (필요 시 `COLLATE NOCASE` 또는 **FTS5** 도입 검토)
- 퍼포먼스:
  - `Pdf(brain_id, pdf_title)`, `TextFile(brain_id, txt_title)`에 인덱스를 고려하면 좋습니다.
  - 대규모 텍스트 검색은 **FTS5 가상 테이블**로 마이그레이션을 권장합니다.
"""

import sqlite3, logging
from typing import List, Dict
from .base_handler import BaseHandler


class SearchHandler(BaseHandler):
    def search_titles_by_query(self, query: str, brain_id: int) -> List[Dict]:
        """query를 포함하는 제목 검색
        
        Args:
            query (str): 검색할 키워드
            brain_id (int): 브레인 ID
            
        Returns:
            List[Dict]: 검색 결과 목록. 각 항목은 type(pdf/text), id, title을 포함
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # PDF와 TextFile 테이블에서 제목 검색
            cursor.execute("""
                SELECT 'pdf' as type, pdf_id as id, pdf_title as title
                FROM Pdf 
                WHERE brain_id = ? AND pdf_title LIKE ?
                UNION ALL
                SELECT 'text' as type, txt_id as id, txt_title as title
                FROM TextFile 
                WHERE brain_id = ? AND txt_title LIKE ?
            """, (brain_id, f'%{query}%', brain_id, f'%{query}%'))
            
            results = cursor.fetchall()
            conn.close()
            
            return [
                {
                    "type": row[0],
                    "id": row[1],
                    "title": row[2]
                }
                for row in results
            ]
        
        
        except Exception as e:
            logging.error("제목 검색 오류: %s", str(e))
            return [] 


    def get_titles_by_ids(self, ids: List[int]) -> Dict[int, str]:
        """
        주어진 source_id 리스트에 대해,
        Pdf/TextFile/Memo/MD/Docx 테이블을 UNION ALL 로 한 번에 조회해서
        { id: title, ... } 맵으로 반환.
        """
        if not ids:
            return {}

        placeholders = ",".join("?" for _ in ids)
        sql = f"""
        SELECT pdf_id  AS id, pdf_title   AS title FROM Pdf      WHERE pdf_id  IN ({placeholders})
        UNION ALL
        SELECT txt_id  AS id, txt_title   AS title FROM TextFile WHERE txt_id  IN ({placeholders})
        UNION ALL
        SELECT memo_id AS id, memo_title AS title FROM Memo     WHERE memo_id IN ({placeholders})
        UNION ALL
        SELECT md_id    AS id, md_title   AS title FROM MDFile   WHERE md_id    IN ({placeholders})
        UNION ALL
        SELECT docx_id  AS id, docx_title AS title FROM DocxFile WHERE docx_id IN ({placeholders})
        """
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        params = ids * 5
        cur.execute(sql, params)
        rows = cur.fetchall()
        conn.close()

        return {rid: title for rid, title in rows}   
        