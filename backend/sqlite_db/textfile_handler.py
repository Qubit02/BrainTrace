import sqlite3, logging
from typing import List, Dict, Optional
from .base_handler import BaseHandler


class TextFileHandler(BaseHandler):
    def create_textfile(self, txt_title: str, txt_path: str, type: Optional[str] = None, brain_id: Optional[int] = None) -> dict:
        """새 텍스트 파일 생성"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            txt_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO TextFile (txt_id, txt_title, txt_path, type, brain_id) VALUES (?, ?, ?, ?, ?)",
                (txt_id, txt_title, txt_path, type, brain_id)
            )
            
            cursor.execute("SELECT txt_date FROM TextFile WHERE txt_id = ?", (txt_id,))
            txt_date = cursor.fetchone()[0]
            
            conn.commit()
            conn.close()
            
            logging.info("텍스트 파일 생성 완료: txt_id=%s, txt_title=%s, brain_id=%s", 
                        txt_id, txt_title, brain_id)
            return {
                "txt_id": txt_id, 
                "txt_title": txt_title, 
                "txt_path": txt_path,
                "txt_date": txt_date,
                "type": type,
                "brain_id": brain_id

            }
        except ValueError as e:
            logging.error("텍스트 파일 생성 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("텍스트 파일 생성 오류: %s", str(e))
            raise RuntimeError(f"텍스트 파일 생성 오류: {str(e)}")
    
    def delete_textfile(self, txt_id: int) -> bool:
        """텍스트 파일 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM TextFile WHERE txt_id = ?", (txt_id,))
            deleted = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if deleted:
                logging.info("텍스트 파일 삭제 완료: txt_id=%s", txt_id)
            else:
                logging.warning("텍스트 파일 삭제 실패: 존재하지 않는 txt_id=%s", txt_id)
            
            return deleted
        except Exception as e:
            logging.error("텍스트 파일 삭제 오류: %s", str(e))
            raise RuntimeError(f"텍스트 파일 삭제 오류: {str(e)}")

    def update_textfile(self, txt_id: int, txt_title: str = None, txt_path: str = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> bool:
        """텍스트 파일 정보 업데이트"""
        try:
            # 대상 텍스트 파일 존재 확인
            textfile = self.get_textfile(txt_id)
            if not textfile:
                raise ValueError(f"존재하지 않는 텍스트 파일 ID: {txt_id}")
            
            # brain_id 유효성 검사
            if brain_id is not None and brain_id != "null":
                brain_handler = BrainHandler(self.db_path)
                if not brain_handler.get_brain(brain_id):
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            update_fields = []
            params = []
            
            if txt_title is not None:
                update_fields.append("txt_title = ?")
                params.append(txt_title)
                
            if txt_path is not None:
                update_fields.append("txt_path = ?")
                params.append(txt_path)
                
            if type is not None:
                update_fields.append("type = ?")
                params.append(type)

            # brain_id 처리: null 또는 값
            if brain_id is None or brain_id == "null":
                update_fields.append("brain_id = NULL")
            else:
                update_fields.append("brain_id = ?")
                params.append(brain_id)

            if not update_fields:
                conn.close()
                return False  # 변경할 내용 없음
            
            update_fields.append("txt_date = CURRENT_TIMESTAMP")
            
            query = f"UPDATE TextFile SET {', '.join(update_fields)} WHERE txt_id = ?"
            params.append(txt_id)
            
            cursor.execute(query, params)
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("텍스트 파일 업데이트 완료: txt_id=%s", txt_id)
            else:
                logging.warning("텍스트 파일 업데이트 실패: 존재하지 않는 txt_id=%s", txt_id)
            
            return updated
        except ValueError as e:
            logging.error("텍스트 파일 업데이트 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("텍스트 파일 업데이트 오류: %s", str(e))
            raise RuntimeError(f"텍스트 파일 업데이트 오류: {str(e)}")

    def get_textfile(self, txt_id: int) -> Optional[dict]:
        """텍스트 파일 정보 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT txt_id, txt_title, txt_path, txt_date, type, brain_id FROM TextFile WHERE txt_id = ?", 
                (txt_id,)
            )
            textfile = cursor.fetchone()
            
            conn.close()
            
            if textfile:
                return {
                    "txt_id": textfile[0], 
                    "txt_title": textfile[1], 
                    "txt_path": textfile[2],
                    "txt_date": textfile[3],
                    "type": textfile[4],
                    "brain_id" : textfile[5]
                }
            else:
                return None
        except Exception as e:
            logging.error("텍스트 파일 조회 오류: %s", str(e))
            return None

    def get_textfiles_by_brain(self, brain_id: int) -> List[dict]:
        """
        주어진 brain_id에 해당하는 모든 텍스트 파일(txt) 목록을 반환합니다.
        폴더 여부와 관계없이 brain_id로만 필터링합니다.
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        sql = """
            SELECT
                txt_id,
                txt_title,
                txt_path,
                txt_date,
                type,
                brain_id
            FROM TextFile
            WHERE brain_id = ?
            ORDER BY txt_date DESC
        """
        cursor.execute(sql, (brain_id,))
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]

        conn.close()
        return [dict(zip(cols, row)) for row in rows]


# Import at the end to avoid circular imports
from .brain_handler import BrainHandler 