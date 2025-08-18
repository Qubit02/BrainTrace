
"""
ChatHandler: 채팅 저장/조회/삭제 유틸 (SQLite)
-----------------------------------------

이 모듈은 세션별 채팅 로그를 **SQLite**에 기록/관리하기 위한 헬퍼입니다.
메시지 본문, 발화 주체(AI/사용자), 정확도(옵션), 참고 노드 목록을 저장/조회/삭제합니다.

테이블 스키마(참고: BaseHandler._init_db에서 생성)
- Chat(chat_id INTEGER PK, session_id INTEGER, is_ai BOOLEAN, message TEXT,
       referenced_nodes TEXT(JSON), accuracy REAL)

핵심 동작
- save_chat(session_id, is_ai, message, referenced_nodes=None, accuracy=None) -> int
  - 내부 시퀀스(Sequence 테이블)의 값을 이용해 **chat_id**를 발급한 뒤 INSERT
  - referenced_nodes는 **JSON 문자열**로 직렬화하여 저장
  - 성공 시 chat_id 반환, 실패 시 -1

- delete_chat(chat_id) -> bool
  - chat_id로 단일 메시지 삭제, 성공 여부 반환

- delete_all_chats_by_session(session_id) -> bool
  - 특정 세션의 모든 메시지 일괄 삭제

- get_referenced_nodes(chat_id) -> str | None
  - 해당 채팅의 참고 노드 JSON 문자열을 그대로 반환(파싱하지 않음)

- get_chat_list(session_id) -> List[Dict[str, Any]] | None
  - 세션 내 채팅을 chat_id 오름차순으로 조회
  - referenced_nodes는 JSON 문자열을 **파싱하여 리스트**로 돌려줌

- get_chat_by_id(chat_id) -> Dict[str, Any] | None
  - 단일 채팅 조회, referenced_nodes를 **리스트**로 변환하여 반환

주의/안내
- referenced_nodes는 저장 시 JSON 직렬화, 조회 시 역직렬화(없으면 빈 리스트).
- save_chat은 내부 시퀀스 발급에 의존 → BaseHandler._init_db 선행 필요.
- 다중 접근 환경에서는 WAL 모드/timeout 설정 등 BaseHandler 설정을 따릅니다.
- 대량 조회/삭제 성능을 위해 `Chat(session_id)` 인덱스 생성 고려 권장.
"""

import sqlite3, logging, json
from typing import List, Dict, Any
from .base_handler import BaseHandler


class ChatHandler(BaseHandler):
    def save_chat(
        self,
        session_id: int,
        is_ai: bool,
        message: str,
        referenced_nodes: List[Dict[str, Any]] = None,
        accuracy: float = None
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
                "INSERT INTO Chat (chat_id, session_id, is_ai, message, referenced_nodes, accuracy) VALUES (?, ?, ?, ?, ?, ?)",
                (chat_id, session_id, 1 if is_ai else 0, message, ref_json, accuracy)
            )
            conn.commit()
            conn.close()

            logging.info(
                "채팅 저장 완료: chat_id=%s, session_id=%s, is_ai=%s, accuracy=%s",
                chat_id, session_id, is_ai, accuracy
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
    
    def delete_all_chats_by_session(self, session_id: int) -> bool:
        """
        특정 session_id에 해당하는 모든 채팅을 삭제합니다.
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM Chat WHERE session_id = ?", (session_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
            if deleted:
                logging.info("모든 채팅 삭제 완료: session_id=%s", session_id)
            else:
                logging.warning("채팅 삭제 실패: 존재하지 않는 session_id=%s", session_id)
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
    
    def get_chat_list(self, session_id: int) -> List[Dict[str, Any]] | None:
        """특정 session_id의 모든 채팅을 반환합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT chat_id, is_ai, message, referenced_nodes, accuracy
                  FROM Chat
                 WHERE session_id = ?
              ORDER BY chat_id ASC
                """,
                (session_id,)
            )
            rows = cursor.fetchall()
            conn.close()

            result: List[Dict[str, Any]] = []
            for chat_id, is_ai, message, ref_json, accuracy in rows:
                referenced_nodes = json.loads(ref_json) if ref_json else []
                result.append({
                    "chat_id": chat_id,
                    "is_ai": bool(is_ai),
                    "message": message,
                    "referenced_nodes": referenced_nodes,
                    "accuracy": accuracy
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
                SELECT chat_id, is_ai, message, referenced_nodes, accuracy
                  FROM Chat
                 WHERE chat_id = ?
                """,
                (chat_id,)
            )
            row = cursor.fetchone()
            conn.close()

            if not row:
                return None

            _id, is_ai, message, ref_json, accuracy = row
            referenced_nodes = json.loads(ref_json) if ref_json else []
            return {
                "chat_id": _id,
                "is_ai": bool(is_ai),
                "message": message,
                "referenced_nodes": referenced_nodes,
                "accuracy": accuracy
            }
        except Exception as e:
            logging.error("chat_id로 채팅 조회 중 오류 발생: %s", str(e))
            return None
