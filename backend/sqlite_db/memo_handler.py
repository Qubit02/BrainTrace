import sqlite3, logging
from typing import List, Dict, Optional
from .base_handler import BaseHandler


class MemoHandler(BaseHandler):
    def create_memo(self, memo_title: str, memo_text: str, is_source: bool = False, type: Optional[str] = None, brain_id: Optional[int] = None) -> dict:
        """새 메모 생성"""
        logging.info("✅ create_memo() 호출됨: brain_id=%s", brain_id)
        try:
            # brain_id가 주어진 경우에만 브레인 존재 여부 확인
            if brain_id is not None:
                brain_handler = BrainHandler(self.db_path)
                brain = brain_handler.get_brain(brain_id)
                if not brain:
                    raise ValueError(f"존재하지 않는 브레인 ID: {brain_id}")
                    
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 새 ID 생성
            memo_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO Memo (memo_id, memo_title, memo_text, is_source, type, brain_id) VALUES (?, ?, ?, ?, ?, ?)",
                (memo_id, memo_title, memo_text, 1 if is_source else 0, type, brain_id)
            )
            
            # 현재 날짜 가져오기 (자동 생성됨)
            cursor.execute("SELECT memo_date FROM Memo WHERE memo_id = ?", (memo_id,))
            memo_date = cursor.fetchone()[0]
            
            conn.commit()
            conn.close()
            
            logging.info("메모 생성 완료: memo_id=%s, memo_title=%s, brain_id=%s", 
                        memo_id, memo_title, brain_id)
            return {
                "memo_id": memo_id, 
                "memo_title": memo_title, 
                "memo_text": memo_text,
                "memo_date": memo_date,
                "is_source": is_source,
                "type": type,
                "brain_id": brain_id
            }
        except ValueError as e:
            logging.error("메모 생성 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("메모 생성 오류: %s", str(e))
            raise RuntimeError(f"메모 생성 오류: {str(e)}")
    
    def delete_memo(self, memo_id: int) -> bool:
        """메모 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM Memo WHERE memo_id = ?", (memo_id,))
            deleted = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if deleted:
                logging.info("메모 삭제 완료: memo_id=%s", memo_id)
            else:
                logging.warning("메모 삭제 실패: 존재하지 않는 memo_id=%s", memo_id)
            
            return deleted
        except Exception as e:
            logging.error("메모 삭제 오류: %s", str(e))
            raise RuntimeError(f"메모 삭제 오류: {str(e)}")
    
    def update_memo(self, memo_id: int, memo_title: str = None, memo_text: str = None, is_source: bool = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> bool:
        """메모 정보 업데이트"""
        try:
            # 메모가 존재하는지 확인
            memo = self.get_memo(memo_id)
            if not memo:
                raise ValueError(f"존재하지 않는 메모 ID: {memo_id}")

            # brain_id가 주어진 경우에만 브레인 존재 여부 확인
            if brain_id is not None and brain_id != "null":
                brain_handler = BrainHandler(self.db_path)
                brain = brain_handler.get_brain(brain_id)
                if not brain:
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 업데이트할 필드 지정
            update_fields = []
            params = []
            
            # 값이 None인 필드는 업데이트 하지 않음
            if memo_title is not None:
                update_fields.append("memo_title = ?")
                params.append(memo_title)
                
            if memo_text is not None:
                update_fields.append("memo_text = ?")
                params.append(memo_text)
                
            if is_source is not None:
                update_fields.append("is_source = ?")
                params.append(1 if is_source else 0)

            if type is not None:
                update_fields.append("type = ?")
                params.append(type)
                
            # brain_id가 None이거나 "null"이면 NULL로 설정
            if brain_id is None or brain_id == "null":
                update_fields.append("brain_id = NULL")
            elif brain_id is not None:
                update_fields.append("brain_id = ?")
                params.append(brain_id)
            
            if not update_fields:
                return False  # 업데이트할 내용 없음
            
            # 날짜 자동 업데이트
            update_fields.append("memo_date = CURRENT_TIMESTAMP")
            
            # 쿼리 구성
            query = f"UPDATE Memo SET {', '.join(update_fields)} WHERE memo_id = ?"
            params.append(memo_id)
            
            cursor.execute(query, params)
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("메모 업데이트 완료: memo_id=%s", memo_id)
            else:
                logging.warning("메모 업데이트 실패: 존재하지 않는 memo_id=%s", memo_id)
            
            return updated
        except ValueError as e:
            logging.error("메모 업데이트 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("메모 업데이트 오류: %s", str(e))
            raise RuntimeError(f"메모 업데이트 오류: {str(e)}")
    
    def get_memo(self, memo_id: int) -> Optional[dict]:
        """메모 정보 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT memo_id, memo_title, memo_text, memo_date, is_source, type, brain_id FROM Memo WHERE memo_id = ?", 
                (memo_id,)
            )
            memo = cursor.fetchone()
            conn.close()
            
            if memo:
                return {
                    "memo_id": memo[0], 
                    "memo_title": memo[1], 
                    "memo_text": memo[2],
                    "memo_date": memo[3],
                    "is_source": bool(memo[4]),
                    "type": memo[5],
                    "brain_id": memo[6]
                }
            else:
                return None
        except Exception as e:
            logging.error("메모 조회 오류: %s", str(e))
            return None
        
    def get_memos_by_brain(self, brain_id: int, is_source: Optional[bool] = None) -> List[Dict]:
        """
        특정 brain_id에 해당하는 메모들을 반환합니다.
        - is_source가 지정되면 해당 조건도 함께 적용됩니다.
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 기본 조건: brain_id
        where_clauses = ["brain_id = ?"]
        params = [brain_id]

        # 선택 조건: is_source
        if is_source is not None:
            where_clauses.append("is_source = ?")
            params.append(1 if is_source else 0)

        where_clause = " AND ".join(where_clauses)

        sql = f"""
            SELECT
                memo_id,
                memo_title,
                memo_text,
                memo_date,
                is_source,
                type,
                brain_id
            FROM Memo
            WHERE {where_clause}
            ORDER BY memo_date DESC
        """
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        conn.close()
        return [dict(zip(cols, r)) for r in rows]


# Import at the end to avoid circular imports
from .brain_handler import BrainHandler 