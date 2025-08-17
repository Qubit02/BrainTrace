"""
BrainHandler: 브레인(워크스페이스) 관리 핸들러 (SQLite)
--------------------------------------------------

이 모듈은 로컬 SQLite DB를 사용하는 **브레인(작업공간) 엔티티**의 CRUD/유틸 기능을 제공합니다.
`BaseHandler`의 `db_path`를 상속받아 연결을 열고, 관련 파일/연관 테이블 정리를 포함한
안전한 삭제 로직을 제공합니다.

구성/역할
- create_brain(brain_name, created_at=None, deployment_type='local') -> dict
  - Brain 레코드를 생성하고 `{brain_id, brain_name, created_at, deployment_type, is_important}` 반환
  - `created_at` 미지정 시 오늘 날짜(ISO)로 자동 설정

- delete_brain(brain_id) -> bool
  - 브레인과 **연관된 로컬 파일**(Pdf.pdf_path, TextFile.txt_path)을 먼저 삭제
  - 이후 DB 내 연관 레코드(Pdf/TextFile/Memo/ChatSession → Brain) 순서로 제거
  - 트랜잭션으로 묶어 일부 실패 시 롤백
  - 최종적으로 Brain 삭제 여부를 bool로 반환

- update_brain_name(brain_id, new_brain_name) -> bool
  - 브레인 이름 변경

- update_brain_deployment_type(brain_id, deployment_type) -> bool
  - 브레인 배포 유형(local/cloud 등) 변경

- get_brain(brain_id) -> dict | None
  - 단일 브레인 조회(없으면 None)

- get_all_brains() -> List[dict]
  - 전체 브레인 목록 조회

- toggle_importance(brain_id) -> bool
  - 중요 표시 플래그(is_important) 토글

전제 조건
- 스키마는 `BaseHandler._init_db()`에 의해 생성됨(앱 시작 시 1회 호출 권장).
- Brain 스키마: (brain_id INTEGER PK AUTOINCREMENT, brain_name TEXT, created_at TEXT,
  is_important BOOLEAN, deployment_type TEXT)

트랜잭션/무결성
- `delete_brain`은 파일 삭제 → DB 트랜잭션 순으로 진행.
- 참조 무결성은 FOREIGN KEY 선언되어 있으나, SQLite에서 실제 enforcement는 PRAGMA 설정에 의존할 수 있음.
  (필요 시 `PRAGMA foreign_keys=ON;` 고려)

주의/안내
- 파일 삭제는 OS I/O 예외 가능 → 실패 시 로그만 남기고 진행.
- 다중 스레드/프로세스 환경에서의 동시성은 SQLite 특성에 주의(WAL 모드 권장, `BaseHandler._init_db` 참고).
- 에러는 로깅 후 재전파(`RuntimeError` 등)되어 상위(Web 레이어)에서 표준 오류 응답으로 변환하는 패턴 권장.
"""

import sqlite3, logging, datetime
import os
from typing import List, Dict
from .base_handler import BaseHandler


class BrainHandler(BaseHandler):
    def create_brain(self, brain_name: str, created_at: str | None = None, deployment_type: str = 'local') -> dict:
        try:
            # created_at 기본값: 오늘
            if created_at is None:
                created_at = datetime.date.today().isoformat()   # '2025-05-07'

            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """INSERT INTO Brain
                     (brain_name, created_at, deployment_type)
                   VALUES (?, ?, ?)""",
                (
                    brain_name,
                    created_at,
                    deployment_type
                )
            )
            brain_id = cur.lastrowid
            conn.commit(); conn.close()

            return {
                "brain_id":   brain_id,
                "brain_name": brain_name,
                "created_at": created_at,
                "deployment_type": deployment_type,
                "is_important": False
            }
        except Exception as e:
            logging.error("브레인 생성 오류: %s", e)
            raise
    
    def delete_brain(self, brain_id: int) -> bool:
        """브레인과 관련된 모든 데이터 삭제"""
        try:
            # 1. PDF/텍스트 파일 실제 파일 삭제
            from .pdf_handler import PdfHandler
            from .textfile_handler import TextFileHandler
            pdf_handler = PdfHandler(self.db_path)
            textfile_handler = TextFileHandler(self.db_path)
            pdfs = pdf_handler.get_pdfs_by_brain(brain_id)
            txts = textfile_handler.get_textfiles_by_brain(brain_id)
            for pdf in pdfs:
                file_path = pdf.get('pdf_path')
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logging.info(f"✅ PDF 로컬 파일 삭제 완료: {file_path}")
                    except Exception as e:
                        logging.error(f"❌ PDF 파일 삭제 실패: {file_path}, {e}")
            for txt in txts:
                file_path = txt.get('txt_path')
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logging.info(f"✅ TXT 로컬 파일 삭제 완료: {file_path}")
                    except Exception as e:
                        logging.error(f"❌ TXT 파일 삭제 실패: {file_path}, {e}")

            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 트랜잭션 시작
            cursor.execute("BEGIN TRANSACTION")
            
            try:
                logging.info("🧹 Pdf 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Pdf WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 TextFile 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM TextFile WHERE brain_id = ?", (brain_id,))

                logging.info("🧹 Memo 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Memo WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 ChatSession 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM ChatSession WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 Brain 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Brain WHERE brain_id = ?", (brain_id,))
                deleted = cursor.rowcount > 0
                
                conn.commit()
                
                if deleted:
                    logging.info("✅ 브레인 및 관련 데이터 삭제 완료: brain_id=%s", brain_id)
                else:
                    logging.warning("⚠️ 브레인 삭제 실패: 존재하지 않는 brain_id=%s", brain_id)
                
                return deleted
            
            except Exception as e:
                conn.rollback()
                logging.error("❌ DELETE 중 오류 발생: %s", str(e))
                raise e
            
            finally:
                conn.close()
        
        except Exception as e:
            logging.error("❌ 브레인 삭제 오류: %s", str(e))
            raise RuntimeError(f"브레인 삭제 오류: {str(e)}")

    def update_brain_name(self, brain_id: int, new_brain_name: str) -> bool:
        """브레인 이름 업데이트"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "UPDATE Brain SET brain_name = ? WHERE brain_id = ?",
                (new_brain_name, brain_id)
            )
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("브레인 이름 업데이트 완료: brain_id=%s, new_brain_name=%s", brain_id, new_brain_name)
            else:
                logging.warning("브레인 이름 업데이트 실패: 존재하지 않는 brain_id=%s", brain_id)
            
            return updated
        except Exception as e:
            logging.error("브레인 이름 업데이트 오류: %s", str(e))
            raise RuntimeError(f"브레인 이름 업데이트 오류: {str(e)}")
    
    def update_brain_deployment_type(self, brain_id: int, deployment_type: str) -> bool:
        """브레인 배포 타입 업데이트"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "UPDATE Brain SET deployment_type = ? WHERE brain_id = ?",
                (deployment_type, brain_id)
            )
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("브레인 배포 타입 업데이트 완료: brain_id=%s, deployment_type=%s", brain_id, deployment_type)
            else:
                logging.warning("브레인 배포 타입 업데이트 실패: 존재하지 않는 brain_id=%s", brain_id)
            
            return updated
        except Exception as e:
            logging.error("브레인 배포 타입 업데이트 오류: %s", str(e))
            raise RuntimeError(f"브레인 배포 타입 업데이트 오류: {str(e)}")

    def get_brain(self, brain_id: int) -> dict | None:
        try:
            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """SELECT brain_id, brain_name, created_at, is_important, deployment_type
                   FROM Brain WHERE brain_id=?""",
                (brain_id,)
            )
            row = cur.fetchone()
            conn.close()
            if not row:
                return None
            return {
                "brain_id":   row[0],
                "brain_name": row[1],
                "created_at": row[2],
                "is_important": bool(row[3]) if row[3] is not None else False,
                "deployment_type": row[4] if row[4] is not None else 'local',
            }
        except Exception as e:
            logging.error("브레인 조회 오류: %s", e)
            return None
         
    def get_all_brains(self) -> List[dict]:
        """시스템의 모든 브레인"""
        try:
            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """SELECT brain_id, brain_name, created_at, is_important, deployment_type
                     FROM Brain"""
            )
            rows = cur.fetchall(); conn.close()
            return [
                {
                    "brain_id":   r[0],
                    "brain_name": r[1],
                    "created_at": r[2],
                    "is_important": bool(r[3]) if r[3] is not None else False,
                    "deployment_type": r[4] if r[4] is not None else 'local',
                } for r in rows
            ]
        except Exception as e:
            logging.error("브레인 목록 조회 오류: %s", e)
            return []

    def toggle_importance(self, brain_id: int) -> bool:
        """브레인 중요도 토글"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 현재 중요도 상태 확인
            cursor.execute(
                "SELECT is_important FROM Brain WHERE brain_id = ?",
                (brain_id,)
            )
            row = cursor.fetchone()
            
            if not row:
                conn.close()
                return False
            
            current_importance = bool(row[0]) if row[0] is not None else False
            new_importance = not current_importance
            
            # 중요도 업데이트
            cursor.execute(
                "UPDATE Brain SET is_important = ? WHERE brain_id = ?",
                (new_importance, brain_id)
            )
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("브레인 중요도 토글 완료: brain_id=%s, is_important=%s", brain_id, new_importance)
            else:
                logging.warning("브레인 중요도 토글 실패: 존재하지 않는 brain_id=%s", brain_id)
            
            return updated
        except Exception as e:
            logging.error("브레인 중요도 토글 오류: %s", str(e))
            raise RuntimeError(f"브레인 중요도 토글 오류: {str(e)}") 