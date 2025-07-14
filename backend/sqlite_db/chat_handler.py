import sqlite3, logging
from typing import List, Dict
from .base_handler import BaseHandler


class ChatHandler(BaseHandler):
    def save_chat(self, is_ai: bool, message: str, brain_id: int, referenced_nodes: List[str] = None) -> int:
        """채팅 메시지를 저장합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # referenced_nodes를 텍스트 형식으로 변환
            referenced_nodes_text = ", ".join(referenced_nodes) if referenced_nodes else None
            
            # 새 ID 생성
            chat_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO Chat (chat_id, is_ai, message, brain_id, referenced_nodes) VALUES (?, ?, ?, ?, ?)",
                (chat_id, 1 if is_ai else 0, message, brain_id, referenced_nodes_text)
            )
            
            conn.commit()
            conn.close()
            
            logging.info("채팅 저장 완료: chat_id=%s, is_ai=%s, brain_id=%s", chat_id, is_ai, brain_id)
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
    
    def get_chat_list(self, brain_id: int) -> List[Dict] | None:
        """
        특정 브레인 ID에 해당하는 모든 채팅 목록을 조회합니다.
        
        Args:
            brain_id (int): 조회할 브레인의 ID
            
        Returns:
            List[Dict] | None: 채팅 목록 (각 채팅은 chat_id, is_ai, message, referenced_nodes 정보를 포함) 또는 None
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT chat_id, is_ai, message, referenced_nodes 
                FROM Chat 
                WHERE brain_id = ? 
                ORDER BY chat_id ASC
            """, (brain_id,))
            
            rows = cursor.fetchall()
            conn.close()
            
            if not rows:
                return []
                
            return [
                {
                    "chat_id": row[0],
                    "is_ai": bool(row[1]),
                    "message": row[2],
                    "referenced_nodes": [node.strip().strip('"') for node in row[3].split(",")] if row[3] else []
                }
                for row in rows
            ]
        except Exception as e:
            logging.error(f"채팅 목록 조회 중 오류 발생: {str(e)}")
            return None 