
"""
MemoHandler: 메모 CRUD·소프트삭제(휴지통) 관리 (SQLite)
-------------------------------------------------

이 핸들러는 로컬 SQLite의 **Memo** 테이블을 대상으로 생성/조회/수정/삭제(소프트·하드)와
브레인별 목록, 휴지통 비우기를 제공합니다. `BaseHandler`로부터 `db_path`와 시퀀스 발급
(`_get_next_id`)을 활용합니다.

스키마(참고: BaseHandler._init_db에서 생성)
- Memo(
    memo_id    INTEGER PRIMARY KEY,
    memo_text  TEXT,
    memo_title TEXT,
    memo_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_source  BOOLEAN DEFAULT 0,
    type       TEXT,
    brain_id   INTEGER,
    is_deleted INTEGER DEFAULT 0
  )

주요 기능
- create_memo(memo_title, memo_text, is_source=False, type=None, brain_id=None) -> dict
  : 새 메모 생성, 자동 생성된 `memo_date` 포함하여 반환. (brain_id가 주어지면 브레인 존재 여부 검증)

- delete_memo(memo_id) -> bool
  : **소프트 삭제**(is_deleted=1). 복구 가능.

- hard_delete_memo(memo_id) -> bool
  : **완전 삭제**(DB에서 제거). 복구 불가.

- restore_memo(memo_id) -> bool
  : 소프트 삭제 복구(is_deleted=0).

- update_memo(memo_id, ...) -> bool
  : 전달된 필드만 부분 업데이트. 변경 시 `memo_date=CURRENT_TIMESTAMP`로 갱신.
  : brain_id는 None/"null"이면 **NULL**로 설정.

- get_memo(memo_id) -> Optional[dict]
  : 삭제되지 않은 메모만 조회.

- get_memo_with_deleted(memo_id) -> Optional[dict]
  : 삭제된 메모 포함하여 조회.

- get_memos_by_brain(brain_id, is_source: Optional[bool]=None, include_deleted=False) -> List[Dict]
  : 브레인별 목록(옵션: 출처 여부 필터, 삭제 포함 여부). 최신순(memo_date DESC).

- empty_trash(brain_id) -> int
  : 해당 브레인의 휴지통(is_deleted=1)을 비워 삭제된 행 수 반환.

주의/안내
- **브레인 존재 검증**: 현재 `create_memo`/`update_memo`에서 `self.get_brain(...)`을 호출하지만
  `BaseHandler`에는 이 메서드가 없습니다. 실제 운용 시에는
  `from .brain_handler import BrainHandler` 후 `BrainHandler(self.db_path).get_brain(...)` 방식으로
  검증하는 것을 권장합니다(동일 프로젝트의 다른 핸들러와 일관성 맞춤).
- 외래키 무결성 적용이 필요한 환경이라면 연결 후 `PRAGMA foreign_keys=ON;` 고려.
- 대량 조회 성능을 위해 `Memo(brain_id)`, `Memo(memo_date)`, `Memo(is_deleted)` 인덱스 추가 권장.
- 소프트 삭제와 완전 삭제의 의미 차이를 API 문서로 명확히 전달하세요.
"""

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
                brain = self.get_brain(brain_id)
                if not brain:
                    raise ValueError(f"존재하지 않는 브레인 ID: {brain_id}")
                    
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 새 ID 생성
            memo_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO Memo (memo_id, memo_title, memo_text, is_source, type, brain_id, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (memo_id, memo_title, memo_text, 1 if is_source else 0, type, brain_id, 0)
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
                "brain_id": brain_id,
                "is_deleted": False
            }
        except ValueError as e:
            logging.error("메모 생성 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("메모 생성 오류: %s", str(e))
            raise RuntimeError(f"메모 생성 오류: {str(e)}")
    
    def delete_memo(self, memo_id: int) -> bool:
        """메모 소프트 삭제 (is_deleted = 1로 설정 => 휴지통으로 이동)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 메모가 존재하는지 확인
            memo = self.get_memo_with_deleted(memo_id)
            if not memo:
                logging.warning("메모 삭제 실패: 존재하지 않는 memo_id=%s", memo_id)
                return False
            
            # 모든 메모에 대해 소프트 삭제
            cursor.execute("UPDATE Memo SET is_deleted = 1 WHERE memo_id = ?", (memo_id,))
            logging.info("메모 소프트 삭제 완료: memo_id=%s", memo_id)
            
            updated = cursor.rowcount > 0
            conn.commit()
            conn.close()
            
            return updated
        except Exception as e:
            logging.error("메모 삭제 오류: %s", str(e))
            raise RuntimeError(f"메모 삭제 오류: {str(e)}")
    
    def hard_delete_memo(self, memo_id: int) -> bool:
        """메모 완전 삭제 (데이터베이스에서 실제 삭제)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM Memo WHERE memo_id = ?", (memo_id,))
            deleted = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if deleted:
                logging.info("메모 완전 삭제 완료: memo_id=%s", memo_id)
            else:
                logging.warning("메모 완전 삭제 실패: 존재하지 않는 memo_id=%s", memo_id)
            
            return deleted
        except Exception as e:
            logging.error("메모 완전 삭제 오류: %s", str(e))
            raise RuntimeError(f"메모 완전 삭제 오류: {str(e)}")
    
    def restore_memo(self, memo_id: int) -> bool:
        """삭제된 메모 복구 (is_deleted = 0으로 설정)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("UPDATE Memo SET is_deleted = 0 WHERE memo_id = ?", (memo_id,))
            restored = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if restored:
                logging.info("메모 복구 완료: memo_id=%s", memo_id)
            else:
                logging.warning("메모 복구 실패: 존재하지 않는 memo_id=%s", memo_id)
            
            return restored
        except Exception as e:
            logging.error("메모 복구 오류: %s", str(e))
            raise RuntimeError(f"메모 복구 오류: {str(e)}")
    
    def update_memo(self, memo_id: int, memo_title: str = None, memo_text: str = None, is_source: bool = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> bool:
        """메모 정보 업데이트"""
        try:
            # 메모가 존재하는지 확인
            memo = self.get_memo(memo_id)
            if not memo:
                raise ValueError(f"존재하지 않는 메모 ID: {memo_id}")

            # brain_id가 주어진 경우에만 브레인 존재 여부 확인
            if brain_id is not None and brain_id != "null":
                brain = self.get_brain(brain_id)
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
        """메모 정보 조회 (삭제되지 않은 메모만)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT memo_id, memo_title, memo_text, memo_date, is_source, type, brain_id, is_deleted FROM Memo WHERE memo_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)", 
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
                    "brain_id": memo[6],
                    "is_deleted": bool(memo[7]) if memo[7] is not None else False
                }
            else:
                return None
        except Exception as e:
            logging.error("메모 조회 오류: %s", str(e))
            return None
    
    def get_memo_with_deleted(self, memo_id: int) -> Optional[dict]:
        """메모 정보 조회 (삭제된 메모 포함)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT memo_id, memo_title, memo_text, memo_date, is_source, type, brain_id, is_deleted FROM Memo WHERE memo_id = ?", 
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
                    "brain_id": memo[6],
                    "is_deleted": bool(memo[7]) if memo[7] is not None else False
                }
            else:
                return None
        except Exception as e:
            logging.error("메모 조회 오류: %s", str(e))
            return None
        
    def get_memos_by_brain(self, brain_id: int, is_source: Optional[bool] = None, include_deleted: bool = False) -> List[Dict]:
        """
        특정 brain_id에 해당하는 메모들을 반환합니다.
        - is_source가 지정되면 해당 조건도 함께 적용됩니다.
        - include_deleted가 True이면 삭제된 메모도 포함합니다.
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

        # 삭제된 메모 포함 여부
        if not include_deleted:
            where_clauses.append("(is_deleted = 0 OR is_deleted IS NULL)")

        where_clause = " AND ".join(where_clauses)

        sql = f"""
            SELECT
                memo_id,
                memo_title,
                memo_text,
                memo_date,
                is_source,
                type,
                brain_id,
                COALESCE(is_deleted, 0) as is_deleted -- null 값을 0으로 처리
            FROM Memo
            WHERE {where_clause}
            ORDER BY memo_date DESC
        """
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        conn.close()
        return [dict(zip(cols, r)) for r in rows]

    def empty_trash(self, brain_id: int) -> int:
        """브레인 내 삭제된 메모들을 모두 완전 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 먼저 삭제될 메모 수를 확인
            cursor.execute(
                "SELECT COUNT(*) FROM Memo WHERE brain_id = ? AND is_deleted = 1",
                (brain_id,)
            )
            count = cursor.fetchone()[0]
            
            if count == 0:
                logging.info("휴지통이 비어있음: brain_id=%s", brain_id)
                conn.close()
                return 0
            
            # 삭제된 메모들을 모두 완전 삭제
            cursor.execute(
                "DELETE FROM Memo WHERE brain_id = ? AND is_deleted = 1",
                (brain_id,)
            )
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            logging.info("휴지통 비우기 완료: brain_id=%s, 삭제된 메모 수=%s", brain_id, deleted_count)
            return deleted_count
        except Exception as e:
            logging.error("휴지통 비우기 오류: %s", str(e))
            raise RuntimeError(f"휴지통 비우기 오류: {str(e)}")
