import sqlite3, logging
from typing import List, Dict, Any, Optional
from .base_handler import BaseHandler

class ChatSessionHandler(BaseHandler):
    def create_session(self, session_name: str, brain_id: Optional[int] = None) -> int:
        """새로운 채팅 세션을 생성합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO ChatSession (session_name, brain_id) VALUES (?, ?)",
                (session_name, brain_id)
            )
            session_id = cursor.lastrowid
            conn.commit()
            conn.close()
            logging.info(f"채팅 세션 생성: session_id={session_id}, session_name={session_name}")
            return session_id
        except Exception as e:
            logging.error(f"채팅 세션 생성 오류: {str(e)}")
            return -1

    def delete_session(self, session_id: int) -> bool:
        """특정 채팅 세션을 삭제합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM ChatSession WHERE session_id = ?", (session_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
            if deleted:
                logging.info(f"채팅 세션 삭제: session_id={session_id}")
            else:
                logging.warning(f"채팅 세션 삭제 실패: session_id={session_id}")
            return deleted
        except Exception as e:
            logging.error(f"채팅 세션 삭제 오류: {str(e)}")
            return False

    def update_session_name(self, session_id: int, new_session_name: str) -> bool:
        """채팅 세션 이름을 수정합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE ChatSession SET session_name = ? WHERE session_id = ?",
                (new_session_name, session_id)
            )
            updated = cursor.rowcount > 0
            conn.commit()
            conn.close()
            
            if updated:
                logging.info(f"채팅 세션 이름 수정: session_id={session_id}, new_name={new_session_name}")
            else:
                logging.warning(f"채팅 세션 이름 수정 실패: 존재하지 않는 session_id={session_id}")
            
            return updated
        except Exception as e:
            logging.error(f"채팅 세션 이름 수정 오류: {str(e)}")
            return False

    def get_all_sessions(self) -> List[Dict[str, Any]]:
        """모든 채팅 세션 리스트를 반환합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT session_id, session_name, created_at, brain_id FROM ChatSession ORDER BY created_at DESC")
            rows = cursor.fetchall()
            conn.close()
            return [
                {"session_id": r[0], "session_name": r[1], "created_at": r[2], "brain_id": r[3]} for r in rows
            ]
        except Exception as e:
            logging.error(f"채팅 세션 리스트 조회 오류: {str(e)}")
            return []

    def get_session(self, session_id: int) -> Optional[Dict[str, Any]]:
        """특정 session_id의 세션 정보를 반환합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT session_id, session_name, created_at, brain_id FROM ChatSession WHERE session_id = ?", (session_id,))
            row = cursor.fetchone()
            conn.close()
            if row:
                return {"session_id": row[0], "session_name": row[1], "created_at": row[2], "brain_id": row[3]}
            return None
        except Exception as e:
            logging.error(f"채팅 세션 단일 조회 오류: {str(e)}")
            return None

    def get_sessions_by_brain(self, brain_id: int) -> List[Dict[str, Any]]:
        """특정 brain_id에 해당하는 모든 채팅 세션 리스트를 반환합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT session_id, session_name, created_at, brain_id FROM ChatSession WHERE brain_id = ? ORDER BY created_at DESC", 
                (brain_id,)
            )
            rows = cursor.fetchall()
            conn.close()
            return [
                {"session_id": r[0], "session_name": r[1], "created_at": r[2], "brain_id": r[3]} for r in rows
            ]
        except Exception as e:
            logging.error(f"브레인별 채팅 세션 리스트 조회 오류: {str(e)}")
            return [] 