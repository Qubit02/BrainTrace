"""
PdfHandler: PDF 파일 메타/본문 관리 (SQLite)
----------------------------------------

이 핸들러는 로컬 SQLite DB의 **Pdf** 테이블에 대해 생성/조회/수정/삭제 기능을 제공합니다.
`BaseHandler`로부터 `db_path`와 시퀀스 발급(`_get_next_id`)을 활용하며, 필요 시 `brain_id`
유효성(존재 여부)을 `BrainHandler`로 확인합니다.

스키마(참고: BaseHandler._init_db에서 생성)
- Pdf(
    pdf_id    INTEGER PRIMARY KEY,
    pdf_title TEXT,
    pdf_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    pdf_path  TEXT,
    brain_id  INTEGER,
    type      TEXT,
    pdf_text  TEXT
  )

주요 메서드
- create_pdf(pdf_title, pdf_path, type=None, brain_id=None, pdf_text=None) -> dict
  : (선택) `brain_id` 검증 → `_get_next_id()`로 pdf_id 발급 → INSERT 후 생성 레코드 정보 반환

- get_pdf(pdf_id) -> Optional[dict]
  : 단일 PDF 레코드 조회

- get_pdfs_by_brain(brain_id) -> List[dict]
  : 특정 브레인에 속한 PDF 목록을 `pdf_date DESC`로 반환

- update_pdf(pdf_id, pdf_title=None, pdf_path=None, type=None, brain_id=None|"null", pdf_text=None) -> bool
  : 전달된 필드만 동적 업데이트, `brain_id`는 None/"null"이면 **NULL**로 설정
  : 변경 발생 시 `pdf_date = CURRENT_TIMESTAMP`로 갱신

- delete_pdf(pdf_id) -> bool
  : 레코드 삭제(주의: **실제 파일 삭제는 수행하지 않음**)

주의/안내
- 외래키 무결성 보장은 환경에 따라 `PRAGMA foreign_keys=ON`이 필요할 수 있습니다.
- 대량 조회/정렬 성능을 위해 `Pdf(brain_id)`, `Pdf(pdf_date)` 인덱스 추가를 고려하세요.
- 실제 파일 삭제/이동 등 파일 시스템 작업은 상위 레이어에서 수행하세요.
- 순환 참조 방지를 위해 `BrainHandler` 임포트는 **파일 하단**에서 수행합니다(이미 코드에 반영됨).
"""

import sqlite3, logging
from typing import List, Dict, Optional
from .base_handler import BaseHandler


class PdfHandler(BaseHandler):
    def create_pdf(self, pdf_title: str, pdf_path: str, type: Optional[str] = None, brain_id: Optional[int] = None, pdf_text: Optional[str] = None) -> dict:
        """새 PDF 생성"""
        try:
            # brain_id 유효성 검사
            if brain_id is not None:
                brain_handler = BrainHandler(self.db_path)
                brain = brain_handler.get_brain(brain_id)
                if not brain:
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 새 ID 생성
            pdf_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO Pdf (pdf_id, pdf_title, pdf_path, type, brain_id, pdf_text) VALUES (?, ?, ?, ?, ?, ?)",
                (pdf_id, pdf_title, pdf_path, type, brain_id, pdf_text)
            )
            
            # 현재 날짜 가져오기 (자동 생성됨)
            cursor.execute("SELECT pdf_date FROM Pdf WHERE pdf_id = ?", (pdf_id,))
            pdf_date = cursor.fetchone()[0]
            
            conn.commit()
            conn.close()
            
            logging.info(
                "PDF 생성 완료: pdf_id=%s, pdf_title=%s, brain_id=%s",
                pdf_id, pdf_title, brain_id
            )
            
            return {
                "pdf_id": pdf_id, 
                "pdf_title": pdf_title, 
                "pdf_path": pdf_path,
                "pdf_date": pdf_date,
                "type": type,
                "brain_id":  brain_id,
                "pdf_text": pdf_text
            }
        except ValueError as e:
            logging.error("PDF 생성 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("PDF 생성 오류: %s", str(e))
            raise RuntimeError(f"PDF 생성 오류: {str(e)}")

    def delete_pdf(self, pdf_id: int) -> bool:
        """PDF 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM Pdf WHERE pdf_id = ?", (pdf_id,))
            deleted = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if deleted:
                logging.info("PDF 삭제 완료: pdf_id=%s", pdf_id)
            else:
                logging.warning("PDF 삭제 실패: 존재하지 않는 pdf_id=%s", pdf_id)
            
            return deleted
        except Exception as e:
            logging.error("PDF 삭제 오류: %s", str(e))
            raise RuntimeError(f"PDF 삭제 오류: {str(e)}")
        
    def get_pdfs_by_brain(self, brain_id: int) -> List[dict]:
        """
        주어진 brain_id에 해당하는 모든 PDF 파일 목록을 반환합니다.
        폴더 여부와 관계없이 brain_id로만 필터링합니다.
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 폴더 조건 없이 brain_id만 기준으로 조회
        sql = """
            SELECT
                pdf_id,
                pdf_title,
                pdf_path,
                pdf_date,
                type,
                brain_id,
                pdf_text
            FROM Pdf
            WHERE brain_id = ?
            ORDER BY pdf_date DESC
        """
        cursor.execute(sql, (brain_id,))
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]

        conn.close()
        return [dict(zip(cols, row)) for row in rows]

    def update_pdf(self, pdf_id: int, pdf_title: str = None, pdf_path: str = None, type: Optional[str] = None, brain_id: Optional[int] = None, pdf_text: Optional[str] = None) -> bool:
        """PDF 정보 업데이트"""
        try:
            # 대상 PDF 존재 확인
            pdf = self.get_pdf(pdf_id)
            if not pdf:
                raise ValueError(f"존재하지 않는 PDF ID: {pdf_id}")

            # brain_id 검사
            if brain_id is not None and brain_id != "null":
                brain_handler = BrainHandler(self.db_path)
                if not brain_handler.get_brain(brain_id):
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 업데이트할 필드 지정
            update_fields = []
            params = []
            
            if pdf_title is not None:
                update_fields.append("pdf_title = ?")
                params.append(pdf_title)
                
            if pdf_path is not None:
                update_fields.append("pdf_path = ?")
                params.append(pdf_path)
                
            if type is not None:
                update_fields.append("type = ?")
                params.append(type)
                
            if pdf_text is not None:
                update_fields.append("pdf_text = ?")
                params.append(pdf_text)
    
            if not update_fields:
                return False  # 업데이트할 내용 없음
            
            # brain_id 처리
            if brain_id is None or brain_id == "null":
                update_fields.append("brain_id = NULL")
            else:
                update_fields.append("brain_id = ?")
                params.append(brain_id)
            if not update_fields:
                conn.close()
                return False

            # 날짜 자동 업데이트
            update_fields.append("pdf_date = CURRENT_TIMESTAMP")
            
            # 쿼리 구성
            query = f"UPDATE Pdf SET {', '.join(update_fields)} WHERE pdf_id = ?"
            params.append(pdf_id)
            
            cursor.execute(query, params)
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("PDF 업데이트 완료: pdf_id=%s", pdf_id)
            else:
                logging.warning("PDF 업데이트 실패: 존재하지 않는 pdf_id=%s", pdf_id)
            
            return updated
        except ValueError as e:
            logging.error("PDF 업데이트 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("PDF 업데이트 오류: %s", str(e))
            raise RuntimeError(f"PDF 업데이트 오류: {str(e)}")

    def get_pdf(self, pdf_id: int) -> Optional[dict]:
        """PDF 정보 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT pdf_id, pdf_title, pdf_path, pdf_date, type, brain_id, pdf_text FROM Pdf WHERE pdf_id = ?", 
                (pdf_id,)
            )
            pdf = cursor.fetchone()
            
            conn.close()
            
            if pdf:
                return {
                    "pdf_id": pdf[0], 
                    "pdf_title": pdf[1], 
                    "pdf_path": pdf[2],
                    "pdf_date": pdf[3],
                    "type": pdf[4],
                    "brain_id":  pdf[5],
                    "pdf_text": pdf[6]
                }
            else:
                return None
        except Exception as e:
            logging.error("PDF 조회 오류: %s", str(e))
            return None


# Import at the end to avoid circular imports
from .brain_handler import BrainHandler 