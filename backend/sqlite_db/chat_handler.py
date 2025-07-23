import sqlite3, logging, json
from typing import List, Dict, Any
from .base_handler import BaseHandler


class ChatHandler(BaseHandler):
    def save_chat(
        self,
        is_ai: bool,
        message: str,
        brain_id: int,
        referenced_nodes: List[Dict[str, Any]] = None
    ) -> int:
        """채팅 메시지를 저장합니다. referenced_nodes는 JSON 직렬화하여 저장됩니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # JSON 직렬화
            ref_json = json.dumps(referenced_nodes, ensure_ascii=False) if referenced_nodes is not None else None

            # 새 chat_id 생성
            chat_id = self._get_next_id()
            cursor.execute(
                "INSERT INTO Chat (chat_id, is_ai, message, brain_id, referenced_nodes) VALUES (?, ?, ?, ?, ?)",
                (chat_id, 1 if is_ai else 0, message, brain_id, ref_json)
            )
            conn.commit()
            conn.close()

            logging.info(
                "채팅 저장 완료: chat_id=%s, is_ai=%s, brain_id=%s",
                chat_id, is_ai, brain_id
            )
            return chat_id
        except Exception as e:
            logging.error("채팅 저장 오류: %s", str(e))
            return -1
    
    def delete_chat(self, chat_id: int) -> bool:
        """
        특정 채팅 ID에 해당하는 대화를 삭제합니다.
        
        Args:
            chat_id (int): 삭제할 채팅의 ID
            
        Returns:
            bool: 삭제 성공 여부
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM Chat WHERE chat_id = ?", (chat_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
            
            if deleted:
                logging.info("채팅 삭제 완료: chat_id=%s", chat_id)
            else:
                logging.warning("채팅 삭제 실패: 존재하지 않는 chat_id=%s", chat_id)
            
            return deleted
        except Exception as e:
            logging.error(f"채팅 삭제 중 오류 발생: {str(e)}")
            return False
    
    def delete_all_chats_by_brain(self, brain_id: int) -> bool:
        """
        특정 brain_id에 해당하는 모든 채팅을 삭제합니다.
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM Chat WHERE brain_id = ?", (brain_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
            if deleted:
                logging.info("모든 채팅 삭제 완료: brain_id=%s", brain_id)
            else:
                logging.warning("채팅 삭제 실패: 존재하지 않는 brain_id=%s", brain_id)
            return deleted
        except Exception as e:
            logging.error(f"모든 채팅 삭제 중 오류 발생: {str(e)}")
            return False
    
    def get_referenced_nodes(self, chat_id: int) -> str | None:
        """
        특정 채팅 ID에 해당하는 대화의 참고 노드 목록을 조회합니다.
        
        Args:
            chat_id (int): 조회할 채팅의 ID
            
        Returns:
            str | None: 참고 노드 목록 문자열 (쉼표로 구분) 또는 None
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT referenced_nodes FROM Chat WHERE chat_id = ?", (chat_id,))
            result = cursor.fetchone()
            
            conn.close()
            
            return result[0] if result else None
        except Exception as e:
            logging.error(f"참고 노드 조회 중 오류 발생: {str(e)}")
            return None
    
    def get_chat_list(self, brain_id: int) -> List[Dict[str, Any]] | None:
        """특정 brain_id의 모든 채팅을 반환합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT chat_id, is_ai, message, referenced_nodes
                  FROM Chat
                 WHERE brain_id = ?
              ORDER BY chat_id ASC
                """,
                (brain_id,)
            )
            rows = cursor.fetchall()
            conn.close()

            result: List[Dict[str, Any]] = []
            for chat_id, is_ai, message, ref_json in rows:
                referenced_nodes = json.loads(ref_json) if ref_json else []
                result.append({
                    "chat_id": chat_id,
                    "is_ai": bool(is_ai),
                    "message": message,
                    "referenced_nodes": referenced_nodes
                })
            return result
        except Exception as e:
            logging.error("채팅 목록 조회 중 오류 발생: %s", str(e))
            return None

    def get_chat_by_id(self, chat_id: int) -> Dict[str, Any] | None:
        """특정 chat_id의 채팅 정보를 반환합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT chat_id, is_ai, message, referenced_nodes
                  FROM Chat
                 WHERE chat_id = ?
                """,
                (chat_id,)
            )
            row = cursor.fetchone()
            conn.close()

            if not row:
                return None

            _id, is_ai, message, ref_json = row
            referenced_nodes = json.loads(ref_json) if ref_json else []
            return {
                "chat_id": _id,
                "is_ai": bool(is_ai),
                "message": message,
                "referenced_nodes": referenced_nodes
            }
        except Exception as e:
            logging.error("chat_id로 채팅 조회 중 오류 발생: %s", str(e))
            return None
