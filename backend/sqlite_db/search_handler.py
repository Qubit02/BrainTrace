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
        