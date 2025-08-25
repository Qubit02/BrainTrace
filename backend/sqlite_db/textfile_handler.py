"""
TextFileHandler: 텍스트 파일 메타/본문 관리 (SQLite)
----------------------------------------------

이 핸들러는 로컬 SQLite DB의 **TextFile** 테이블에 대해 생성/조회/수정/삭제 기능을 제공합니다.
`BaseHandler`로부터 `db_path`와 시퀀스 발급(`_get_next_id`)을 활용하며, 필요 시 `brain_id`
유효성(존재 여부)을 `BrainHandler`로 확인합니다.

스키마(참고: BaseHandler._init_db에서 생성)
- TextFile(
    txt_id    INTEGER PRIMARY KEY,
    txt_title TEXT,
    txt_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    txt_path  TEXT,
    brain_id  INTEGER,
    type      TEXT,
    txt_text  TEXT
  )

주요 메서드
- create_textfile(txt_title, txt_path, type=None, brain_id=None, txt_text=None) -> dict
  : `_get_next_id()`로 txt_id 발급 → INSERT 후 생성 레코드 정보 반환

- get_textfile(txt_id) -> Optional[dict]
  : 단일 텍스트 파일 레코드 조회

- get_textfiles_by_brain(brain_id) -> List[dict]
  : 특정 브레인의 텍스트 파일 목록을 `txt_date DESC`로 반환

- update_textfile(txt_id, txt_title=None, txt_path=None, type=None, brain_id=None|"null", txt_text=None) -> bool
  : 전달된 필드만 동적 업데이트, `brain_id`는 None/"null"이면 **NULL**로 설정
  : 변경 발생 시 `txt_date = CURRENT_TIMESTAMP`로 갱신

- delete_textfile(txt_id) -> bool
  : 레코드 삭제(주의: **실제 파일 삭제는 수행하지 않음**)

주의/안내
- 외래키 무결성 보장은 환경에 따라 `PRAGMA foreign_keys=ON`이 필요할 수 있습니다.
- 대량 조회/정렬 성능을 위해 `TextFile(brain_id)`, `TextFile(txt_date)` 인덱스 추가 고려.
- 파일 경로 검증/실제 파일 삭제는 상위 레이어(서비스/잡)에서 처리하는 것을 권장합니다.
"""

import sqlite3, logging
from typing import List, Dict, Optional
from .base_handler import BaseHandler


class TextFileHandler(BaseHandler):
    def create_textfile(self, txt_title: str, txt_path: str, type: Optional[str] = None, brain_id: Optional[int] = None, txt_text: Optional[str] = None) -> dict:
        """새 텍스트 파일 생성"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            txt_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO TextFile (txt_id, txt_title, txt_path, type, brain_id, txt_text) VALUES (?, ?, ?, ?, ?, ?)",
                (txt_id, txt_title, txt_path, type, brain_id, txt_text)
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
                "brain_id": brain_id,
                "txt_text": txt_text
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

    def update_textfile(self, txt_id: int, txt_title: str = None, txt_path: str = None, type: Optional[str] = None, brain_id: Optional[int] = None, txt_text: Optional[str] = None) -> bool:
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
                
            if txt_text is not None:
                update_fields.append("txt_text = ?")
                params.append(txt_text)

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
                "SELECT txt_id, txt_title, txt_path, txt_date, type, brain_id, txt_text FROM TextFile WHERE txt_id = ?", 
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
                    "brain_id" : textfile[5],
                    "txt_text": textfile[6]
                }
            else:
                return None
        except Exception as e:
            logging.error("텍스트 파일 조회 오류: %s", str(e))
            return None

    def get_textfiles_by_brain(self, brain_id: int) -> List[dict]:
        """특정 brain_id에 해당하는 모든 텍스트 파일 목록 반환"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        sql = """
            SELECT
                txt_id,
                txt_title,
                txt_path,
                txt_date,
                type,
                brain_id,
                txt_text
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