"""
DocxFileHandler: DOCX 파일 메타/본문 관리 (SQLite)
---------------------------------------------

이 핸들러는 로컬 SQLite DB의 **DocxFile** 테이블에 대해 생성/조회/수정/삭제를 제공합니다.
`BaseHandler`로부터 `db_path`와 시퀀스 발급(`_get_next_id`)을 이용하며, 필요 시 `brain_id`
유효성(존재 여부)을 검사합니다.

스키마(참고: BaseHandler._init_db에서 생성)
- DocxFile(
    docx_id   INTEGER PRIMARY KEY,
    docx_title TEXT NOT NULL,
    docx_path  TEXT NOT NULL,
    docx_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    type       TEXT,
    brain_id   INTEGER,
    docx_text  TEXT
  )

주요 메서드
- create_docxfile(docx_title, docx_path, type=None, brain_id=None, docx_text=None) -> dict
  : (선택) `brain_id` 존재 여부 검증 → `_get_next_id()`로 docx_id 발급 → INSERT 후 생성 레코드 정보 반환

- get_docxfile(docx_id) -> Optional[dict]
  : 단일 DOCX 레코드 조회

- get_docxfiles_by_brain(brain_id) -> List[dict]
  : 특정 브레인에 속한 DOCX 목록을 `docx_date DESC`로 반환

- update_docxfile(docx_id, docx_title=None, docx_path=None, type=None, brain_id=None|"null", docx_text=None) -> bool
  : 전달된 필드만 동적 업데이트, `brain_id`는 `None`/"null"이면 NULL로 설정
  : 변경 시 `docx_date = CURRENT_TIMESTAMP`로 갱신

- delete_docxfile(docx_id) -> bool
  : 레코드 삭제(주의: **실제 파일 삭제는 수행하지 않음**)

주의/안내
- `brain_id` 외래키 무결성 보장은 환경에 따라 `PRAGMA foreign_keys=ON`이 필요할 수 있습니다.
- 파일 경로 검증/실제 파일 삭제는 상위 레이어(서비스/잡)에서 처리하는 것을 권장합니다.
- 빈 업데이트(변경 필드 없음)는 False 반환.
- 대량 조회 시 성능을 위해 `DocxFile(brain_id)`, `DocxFile(docx_date)` 인덱스 추가를 고려하세요.
"""

import sqlite3, logging
from typing import List, Dict, Optional
from .base_handler import BaseHandler

class DocxFileHandler(BaseHandler):
    def create_docxfile(self, docx_title: str, docx_path: str, type: Optional[str] = None, brain_id: Optional[int] = None, docx_text: Optional[str] = None) -> dict:
        try:
            if brain_id is not None:
                from .brain_handler import BrainHandler
                brain_handler = BrainHandler(self.db_path)
                brain = brain_handler.get_brain(brain_id)
                if not brain:
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
            docx_id = self._get_next_id()  # 직접 id 생성
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO DocxFile (docx_id, docx_title, docx_path, type, brain_id, docx_text) VALUES (?, ?, ?, ?, ?, ?)",
                (docx_id, docx_title, docx_path, type, brain_id, docx_text)
            )
            cursor.execute("SELECT docx_date FROM DocxFile WHERE docx_id = ?", (docx_id,))
            docx_date = cursor.fetchone()[0]
            conn.commit()
            conn.close()
            logging.info("DOCX 파일 생성 완료: docx_id=%s, docx_title=%s, brain_id=%s", docx_id, docx_title, brain_id)
            return {
                "docx_id": docx_id,
                "docx_title": docx_title,
                "docx_path": docx_path,
                "docx_date": docx_date,
                "type": type,
                "brain_id": brain_id,
                "docx_text": docx_text
            }
        except Exception as e:
            logging.error("DOCX 파일 생성 오류: %s", str(e))
            raise RuntimeError(f"DOCX 파일 생성 오류: {str(e)}")

    def get_docxfile(self, docx_id: int) -> Optional[dict]:
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT docx_id, docx_title, docx_path, docx_date, type, brain_id, docx_text FROM DocxFile WHERE docx_id = ?", (docx_id,))
            row = cursor.fetchone()
            conn.close()
            if row:
                return dict(zip(["docx_id", "docx_title", "docx_path", "docx_date", "type", "brain_id", "docx_text"], row))
            else:
                return None
        except Exception as e:
            logging.error("DOCX 파일 조회 오류: %s", str(e))
            return None

    def get_docxfiles_by_brain(self, brain_id: int) -> List[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        sql = """
            SELECT docx_id, docx_title, docx_path, docx_date, type, brain_id, docx_text
            FROM DocxFile
            WHERE brain_id = ?
            ORDER BY docx_date DESC
        """
        cursor.execute(sql, (brain_id,))
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        conn.close()
        return [dict(zip(cols, row)) for row in rows]

    def update_docxfile(self, docx_id: int, docx_title: str = None, docx_path: str = None, type: Optional[str] = None, brain_id: Optional[int] = None, docx_text: Optional[str] = None) -> bool:
        """DOCX 파일 정보 업데이트"""
        try:
            # 대상 DOCX 파일 존재 확인
            docxfile = self.get_docxfile(docx_id)
            if not docxfile:
                raise ValueError(f"존재하지 않는 DOCX 파일 ID: {docx_id}")

            # brain_id 유효성 검사
            if brain_id is not None and brain_id != "null":
                from .brain_handler import BrainHandler
                brain_handler = BrainHandler(self.db_path)
                if not brain_handler.get_brain(brain_id):
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")

            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            update_fields = []
            params = []

            if docx_title is not None:
                update_fields.append("docx_title = ?")
                params.append(docx_title)
            if docx_path is not None:
                update_fields.append("docx_path = ?")
                params.append(docx_path)
            if type is not None:
                update_fields.append("type = ?")
                params.append(type)
            if docx_text is not None:
                update_fields.append("docx_text = ?")
                params.append(docx_text)

            # brain_id 처리: null 또는 값
            if brain_id is None or brain_id == "null":
                update_fields.append("brain_id = NULL")
            elif brain_id is not None:
                update_fields.append("brain_id = ?")
                params.append(brain_id)

            if not update_fields:
                conn.close()
                return False  # 변경할 내용 없음

            update_fields.append("docx_date = CURRENT_TIMESTAMP")

            query = f"UPDATE DocxFile SET {', '.join(update_fields)} WHERE docx_id = ?"
            params.append(docx_id)

            cursor.execute(query, params)
            updated = cursor.rowcount > 0

            conn.commit()
            conn.close()

            if updated:
                logging.info("DOCX 파일 업데이트 완료: docx_id=%s", docx_id)
            else:
                logging.warning("DOCX 파일 업데이트 실패: 존재하지 않는 docx_id=%s", docx_id)

            return updated
        except ValueError as e:
            logging.error("DOCX 파일 업데이트 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("DOCX 파일 업데이트 오류: %s", str(e))
            raise RuntimeError(f"DOCX 파일 업데이트 오류: {str(e)}")

    def delete_docxfile(self, docx_id: int) -> bool:
        """DOCX 파일 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM DocxFile WHERE docx_id = ?", (docx_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
            if deleted:
                logging.info("DOCX 파일 삭제 완료: docx_id=%s", docx_id)
            else:
                logging.warning("DOCX 파일 삭제 실패: 존재하지 않는 docx_id=%s", docx_id)
            return deleted
        except Exception as e:
            logging.error("DOCX 파일 삭제 오류: %s", str(e))
            raise RuntimeError(f"DOCX 파일 삭제 오류: {str(e)}") 