import sqlite3, logging
from typing import List, Dict, Optional
from .base_handler import BaseHandler

class MDFileHandler(BaseHandler):
    def create_mdfile(self, md_title: str, md_path: str, type: Optional[str] = None, brain_id: Optional[int] = None) -> dict:
        """새 MD 파일 생성"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO MDFile (md_title, md_path, type, brain_id) VALUES (?, ?, ?, ?)",
                (md_title, md_path, type, brain_id)
            )
            md_id = cursor.lastrowid
            cursor.execute("SELECT md_date FROM MDFile WHERE md_id = ?", (md_id,))
            md_date = cursor.fetchone()[0]
            conn.commit()
            conn.close()
            logging.info("MD 파일 생성 완료: md_id=%s, md_title=%s, brain_id=%s", md_id, md_title, brain_id)
            return {
                "md_id": md_id,
                "md_title": md_title,
                "md_path": md_path,
                "md_date": md_date,
                "type": type,
                "brain_id": brain_id
            }
        except Exception as e:
            logging.error("MD 파일 생성 오류: %s", str(e))
            raise RuntimeError(f"MD 파일 생성 오류: {str(e)}")

    def delete_mdfile(self, md_id: int) -> bool:
        """MD 파일 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM MDFile WHERE md_id = ?", (md_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
            if deleted:
                logging.info("MD 파일 삭제 완료: md_id=%s", md_id)
            else:
                logging.warning("MD 파일 삭제 실패: 존재하지 않는 md_id=%s", md_id)
            return deleted
        except Exception as e:
            logging.error("MD 파일 삭제 오류: %s", str(e))
            raise RuntimeError(f"MD 파일 삭제 오류: {str(e)}")

    def update_mdfile(self, md_id: int, md_title: str = None, md_path: str = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> bool:
        """MD 파일 정보 업데이트"""
        try:
            mdfile = self.get_mdfile(md_id)
            if not mdfile:
                raise ValueError(f"존재하지 않는 MD 파일 ID: {md_id}")
            if brain_id is not None and brain_id != "null":
                from .brain_handler import BrainHandler
                brain_handler = BrainHandler(self.db_path)
                if not brain_handler.get_brain(brain_id):
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            update_fields = []
            params = []
            if md_title is not None:
                update_fields.append("md_title = ?")
                params.append(md_title)
            if md_path is not None:
                update_fields.append("md_path = ?")
                params.append(md_path)
            if type is not None:
                update_fields.append("type = ?")
                params.append(type)
            if brain_id is None or brain_id == "null":
                update_fields.append("brain_id = NULL")
            else:
                update_fields.append("brain_id = ?")
                params.append(brain_id)
            if not update_fields:
                conn.close()
                return False
            update_fields.append("md_date = CURRENT_TIMESTAMP")
            query = f"UPDATE MDFile SET {', '.join(update_fields)} WHERE md_id = ?"
            params.append(md_id)
            cursor.execute(query, params)
            updated = cursor.rowcount > 0
            conn.commit()
            conn.close()
            if updated:
                logging.info("MD 파일 업데이트 완료: md_id=%s", md_id)
            else:
                logging.warning("MD 파일 업데이트 실패: 존재하지 않는 md_id=%s", md_id)
            return updated
        except Exception as e:
            logging.error("MD 파일 업데이트 오류: %s", str(e))
            raise RuntimeError(f"MD 파일 업데이트 오류: {str(e)}")

    def get_mdfile(self, md_id: int) -> Optional[dict]:
        """MD 파일 정보 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT md_id, md_title, md_path, md_date, type, brain_id FROM MDFile WHERE md_id = ?",
                (md_id,)
            )
            mdfile = cursor.fetchone()
            conn.close()
            if mdfile:
                return {
                    "md_id": mdfile[0],
                    "md_title": mdfile[1],
                    "md_path": mdfile[2],
                    "md_date": mdfile[3],
                    "type": mdfile[4],
                    "brain_id": mdfile[5]
                }
            else:
                return None
        except Exception as e:
            logging.error("MD 파일 조회 오류: %s", str(e))
            return None

    def get_mds_by_brain(self, brain_id: int) -> List[dict]:
        """특정 brain_id에 해당하는 모든 MD 파일 목록 반환"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        sql = """
            SELECT
                md_id,
                md_title,
                md_path,
                md_date,
                type,
                brain_id
            FROM MDFile
            WHERE brain_id = ?
            ORDER BY md_date DESC
        """
        cursor.execute(sql, (brain_id,))
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        conn.close()
        return [dict(zip(cols, row)) for row in rows] 