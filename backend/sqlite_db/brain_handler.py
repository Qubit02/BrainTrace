import sqlite3, logging, datetime
import os
from typing import List, Dict
from .base_handler import BaseHandler


class BrainHandler(BaseHandler):
    def create_brain(self, brain_name: str, created_at: str | None = None) -> dict:
        try:
            # created_at 기본값: 오늘
            if created_at is None:
                created_at = datetime.date.today().isoformat()   # '2025-05-07'

            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """INSERT INTO Brain
                     (brain_name, created_at)
                   VALUES (?, ?)""",
                (
                    brain_name,
                    created_at
                )
            )
            brain_id = cur.lastrowid
            conn.commit(); conn.close()

            return {
                "brain_id":   brain_id,
                "brain_name": brain_name,
                "created_at": created_at,
            }
        except Exception as e:
            logging.error("브레인 생성 오류: %s", e)
            raise
    
    def delete_brain(self, brain_id: int) -> bool:
        """브레인과 관련된 모든 데이터 삭제"""
        try:
            # 1. PDF/텍스트 파일 실제 파일 삭제
            from .pdf_handler import PdfHandler
            from .textfile_handler import TextFileHandler
            pdf_handler = PdfHandler(self.db_path)
            textfile_handler = TextFileHandler(self.db_path)
            pdfs = pdf_handler.get_pdfs_by_brain(brain_id)
            txts = textfile_handler.get_textfiles_by_brain(brain_id)
            for pdf in pdfs:
                file_path = pdf.get('pdf_path')
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logging.info(f"✅ PDF 로컬 파일 삭제 완료: {file_path}")
                    except Exception as e:
                        logging.error(f"❌ PDF 파일 삭제 실패: {file_path}, {e}")
            for txt in txts:
                file_path = txt.get('txt_path')
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logging.info(f"✅ TXT 로컬 파일 삭제 완료: {file_path}")
                    except Exception as e:
                        logging.error(f"❌ TXT 파일 삭제 실패: {file_path}, {e}")

            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 트랜잭션 시작
            cursor.execute("BEGIN TRANSACTION")
            
            try:
                logging.info("🧹 Pdf 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Pdf WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 TextFile 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM TextFile WHERE brain_id = ?", (brain_id,))

                logging.info("🧹 Memo 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Memo WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 ChatSession 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM ChatSession WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 Brain 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Brain WHERE brain_id = ?", (brain_id,))
                deleted = cursor.rowcount > 0
                
                conn.commit()
                
                if deleted:
                    logging.info("✅ 브레인 및 관련 데이터 삭제 완료: brain_id=%s", brain_id)
                else:
                    logging.warning("⚠️ 브레인 삭제 실패: 존재하지 않는 brain_id=%s", brain_id)
                
                return deleted
            
            except Exception as e:
                conn.rollback()
                logging.error("❌ DELETE 중 오류 발생: %s", str(e))
                raise e
            
            finally:
                conn.close()
        
        except Exception as e:
            logging.error("❌ 브레인 삭제 오류: %s", str(e))
            raise RuntimeError(f"브레인 삭제 오류: {str(e)}")

    def update_brain_name(self, brain_id: int, new_brain_name: str) -> bool:
        """브레인 이름 업데이트"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "UPDATE Brain SET brain_name = ? WHERE brain_id = ?",
                (new_brain_name, brain_id)
            )
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("브레인 이름 업데이트 완료: brain_id=%s, new_brain_name=%s", brain_id, new_brain_name)
            else:
                logging.warning("브레인 이름 업데이트 실패: 존재하지 않는 brain_id=%s", brain_id)
            
            return updated
        except Exception as e:
            logging.error("브레인 이름 업데이트 오류: %s", str(e))
            raise RuntimeError(f"브레인 이름 업데이트 오류: {str(e)}")
    
    def get_brain(self, brain_id: int) -> dict | None:
        try:
            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """SELECT brain_id, brain_name, created_at
                   FROM Brain WHERE brain_id=?""",
                (brain_id,)
            )
            row = cur.fetchone()
            conn.close()
            if not row:
                return None
            return {
                "brain_id":   row[0],
                "brain_name": row[1],
                "created_at": row[2],
            }
        except Exception as e:
            logging.error("브레인 조회 오류: %s", e)
            return None
         
    def get_all_brains(self) -> List[dict]:
        """시스템의 모든 브레인"""
        try:
            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """SELECT brain_id, brain_name, created_at
                     FROM Brain"""
            )
            rows = cur.fetchall(); conn.close()
            return [
                {
                    "brain_id":   r[0],
                    "brain_name": r[1],
                    "created_at": r[2],
                } for r in rows
            ]
        except Exception as e:
            logging.error("브레인 목록 조회 오류: %s", e)
            return [] 