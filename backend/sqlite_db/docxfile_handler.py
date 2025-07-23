import sqlite3, logging
from typing import List, Dict, Optional
from .base_handler import BaseHandler

class DocxFileHandler(BaseHandler):
    def create_docxfile(self, docx_title: str, docx_path: str, type: Optional[str] = None, brain_id: Optional[int] = None, docx_text: Optional[str] = None) -> dict:
        try:
            if brain_id is not None:
                from .brain_handler import BrainHandler
                brain_handler = BrainHandler(self.db_path)
                brain = brain_handler.get_brain(brain_id)
                if not brain:
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO DocxFile (docx_title, docx_path, type, brain_id, docx_text) VALUES (?, ?, ?, ?, ?)",
                (docx_title, docx_path, type, brain_id, docx_text)
            )
            docx_id = cursor.lastrowid
            cursor.execute("SELECT docx_date FROM DocxFile WHERE docx_id = ?", (docx_id,))
            docx_date = cursor.fetchone()[0]
            conn.commit()
            conn.close()
            logging.info("DOCX 파일 생성 완료: docx_id=%s, docx_title=%s, brain_id=%s", docx_id, docx_title, brain_id)
            return {
                "docx_id": docx_id,
                "docx_title": docx_title,
                "docx_path": docx_path,
                "docx_date": docx_date,
                "type": type,
                "brain_id": brain_id,
                "docx_text": docx_text
            }
        except Exception as e:
            logging.error("DOCX 파일 생성 오류: %s", str(e))
            raise RuntimeError(f"DOCX 파일 생성 오류: {str(e)}")

    def get_docxfile(self, docx_id: int) -> Optional[dict]:
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT docx_id, docx_title, docx_path, docx_date, type, brain_id, docx_text FROM DocxFile WHERE docx_id = ?", (docx_id,))
            row = cursor.fetchone()
            conn.close()
            if row:
                return dict(zip(["docx_id", "docx_title", "docx_path", "docx_date", "type", "brain_id", "docx_text"], row))
            else:
                return None
        except Exception as e:
            logging.error("DOCX 파일 조회 오류: %s", str(e))
            return None

    def get_docxfiles_by_brain(self, brain_id: int) -> List[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        sql = """
            SELECT docx_id, docx_title, docx_path, docx_date, type, brain_id, docx_text
            FROM DocxFile
            WHERE brain_id = ?
            ORDER BY docx_date DESC
        """
        cursor.execute(sql, (brain_id,))
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        conn.close()
        return [dict(zip(cols, row)) for row in rows]

    def delete_docxfile(self, docx_id: int) -> bool:
        """DOCX 파일 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM DocxFile WHERE docx_id = ?", (docx_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
            if deleted:
                logging.info("DOCX 파일 삭제 완료: docx_id=%s", docx_id)
            else:
                logging.warning("DOCX 파일 삭제 실패: 존재하지 않는 docx_id=%s", docx_id)
            return deleted
        except Exception as e:
            logging.error("DOCX 파일 삭제 오류: %s", str(e))
            raise RuntimeError(f"DOCX 파일 삭제 오류: {str(e)}") 