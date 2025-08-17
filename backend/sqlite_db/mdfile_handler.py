
"""
MDFileHandler: 마크다운(MD) 파일 메타/본문 관리 (SQLite)
-------------------------------------------------

이 핸들러는 로컬 SQLite DB의 **MDFile** 테이블에 대한 생성/조회/수정/삭제 기능을 제공합니다.
`BaseHandler`로부터 `db_path`와 시퀀스 발급(`_get_next_id`)을 활용하며, 필요 시 `brain_id`
유효성(존재 여부)을 검사합니다.

스키마(참고: BaseHandler._init_db에서 생성)
- MDFile(
    md_id     INTEGER PRIMARY KEY,
    md_title  TEXT,
    md_path   TEXT,
    md_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
    type      TEXT,
    brain_id  INTEGER,
    md_text   TEXT
  )

주요 메서드
- create_mdfile(md_title, md_path, type=None, brain_id=None, md_text=None) -> dict
  : `_get_next_id()`로 md_id 발급 → INSERT 후 생성 레코드 정보 반환

- get_mdfile(md_id) -> Optional[dict]
  : 단일 MD 레코드 조회

- get_mds_by_brain(brain_id) -> List[dict]
  : 특정 브레인에 속한 MD 목록을 `md_date DESC`로 반환

- update_mdfile(md_id, md_title=None, md_path=None, type=None, brain_id=None|"null", md_text=None) -> bool
  : 전달된 필드만 동적 업데이트, `brain_id`는 `None` 혹은 문자열 "null"이면 **NULL**로 설정
  : 변경 발생 시 `md_date = CURRENT_TIMESTAMP`로 갱신

- delete_mdfile(md_id) -> bool
  : 레코드 삭제(주의: **실제 파일 삭제는 수행하지 않음**)

주의/안내
- 외래키 무결성 보장은 환경에 따라 `PRAGMA foreign_keys=ON`이 필요할 수 있습니다.
- 대량 조회/정렬 성능을 위해 `MDFile(brain_id)`, `MDFile(md_date)` 인덱스 추가를 고려하세요.
- 파일 경로 검증/실제 파일 삭제는 상위 레이어(서비스/잡)에서 처리하는 것을 권장합니다.
"""
import sqlite3, logging
from typing import List, Dict, Optional
from .base_handler import BaseHandler

class MDFileHandler(BaseHandler):
    def create_mdfile(self, md_title: str, md_path: str, type: Optional[str] = None, brain_id: Optional[int] = None, md_text: Optional[str] = None) -> dict:
        """새 MD 파일 생성"""
        try:
            md_id = self._get_next_id()  # 직접 id 생성
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO MDFile (md_id, md_title, md_path, type, brain_id, md_text) VALUES (?, ?, ?, ?, ?, ?)",
                (md_id, md_title, md_path, type, brain_id, md_text)
            )
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
                "brain_id": brain_id,
                "md_text": md_text
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

    def update_mdfile(self, md_id: int, md_title: str = None, md_path: str = None, type: Optional[str] = None, brain_id: Optional[int] = None, md_text: Optional[str] = None) -> bool:
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
            if md_text is not None:
                update_fields.append("md_text = ?")
                params.append(md_text)
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
                "SELECT md_id, md_title, md_path, md_date, type, brain_id, md_text FROM MDFile WHERE md_id = ?",
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
                    "brain_id": mdfile[5],
                    "md_text": mdfile[6]
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
                brain_id,
                md_text
            FROM MDFile
            WHERE brain_id = ?
            ORDER BY md_date DESC
        """
        cursor.execute(sql, (brain_id,))
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        conn.close()
        return [dict(zip(cols, row)) for row in rows] 