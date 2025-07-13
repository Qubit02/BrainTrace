import sqlite3, json, logging, os, hashlib,datetime
from typing import List, Dict, Any, Optional


class SQLiteHandler:
    def __init__(self, db_path=None):
        if db_path is None:
            # 기본 경로 설정 (backend 폴더 아래 data/sqlite.db)
            self.db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "sqlite.db")
            # 경로 생성
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        else:
            self.db_path = db_path
        
        #self._init_db()
    
    def _init_db(self):
        """SQLite 데이터베이스와 테이블 초기화"""
        try:
            
            conn = sqlite3.connect(self.db_path, timeout=30,check_same_thread=False)
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA busy_timeout=30000;")
            cursor = conn.cursor()
            
            # 시퀀스 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS Sequence (
                name TEXT PRIMARY KEY,
                value INTEGER NOT NULL DEFAULT 0
            )
            ''')
            
            # 초기 시퀀스 값 설정
            cursor.execute('''
            INSERT OR IGNORE INTO Sequence (name, value) VALUES ('content_id', 0)
            ''')
            
            # Brain 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS Brain (
                brain_id   INTEGER PRIMARY KEY AUTOINCREMENT,
                brain_name TEXT    NOT NULL,
                created_at TEXT
            )
            ''')
            
            # Memo 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS Memo (
                memo_id INTEGER PRIMARY KEY,
                memo_text TEXT,
                memo_title TEXT,
                memo_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_source BOOLEAN DEFAULT 0,
                type TEXT,          
                brain_id INTEGER,
                FOREIGN KEY (brain_id) REFERENCES Brain(brain_id)
            )
            ''')

            # PDF 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS Pdf (
                pdf_id INTEGER PRIMARY KEY,
                pdf_title TEXT,
                pdf_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                pdf_path TEXT,
                brain_id INTEGER,
                type TEXT,
                FOREIGN KEY (brain_id) REFERENCES Brain(brain_id)
            )
            ''')

            # TextFile 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS TextFile (
                txt_id INTEGER PRIMARY KEY,
                txt_title TEXT,
                txt_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                txt_path TEXT,
                brain_id INTEGER,
                type TEXT,
                FOREIGN KEY (brain_id) REFERENCES Brain(brain_id)
            )
            ''')

            # Chat 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS Chat (
                chat_id INTEGER PRIMARY KEY,
                is_ai BOOLEAN NOT NULL,
                message TEXT,
                brain_id INTEGER,
                referenced_nodes TEXT,
                FOREIGN KEY (brain_id) REFERENCES Brain(brain_id)
            )
            ''')

            conn.commit()
            conn.close()
            logging.info("SQLite 데이터베이스 초기화 완료: %s", self.db_path)
        except Exception as e:
            logging.error("SQLite 데이터베이스 초기화 오류: %s", str(e))
        finally:
            if conn:
                conn.close()
    
    # Brain 관련 메서드
    def create_brain(self, brain_name: str, created_at: str | None = None) -> dict:
        try:
            # created_at 기본값: 오늘
            if created_at is None:
                created_at = datetime.date.today().isoformat()   # '2025-05-07'

            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """INSERT INTO Brain
                     (brain_name, created_at)
                   VALUES (?, ?)""",
                (
                    brain_name,
                    created_at
                )
            )
            brain_id = cur.lastrowid
            conn.commit(); conn.close()

            return {
                "brain_id":   brain_id,
                "brain_name": brain_name,
                "created_at": created_at,
            }
        except Exception as e:
            logging.error("브레인 생성 오류: %s", e)
            raise
    
    def delete_brain(self, brain_id: int) -> bool:
        """브레인과 관련된 모든 데이터 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 트랜잭션 시작
            cursor.execute("BEGIN TRANSACTION")
            
            try:
                logging.info("🧹 Pdf 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Pdf WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 TextFile 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM TextFile WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 Chat 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Chat WHERE brain_id = ?", (brain_id,))
                
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
    
    def get_brain(self, brain_id: int) -> dict | None:
        try:
            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """SELECT brain_id, brain_name, created_at
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
                """SELECT brain_id, brain_name, created_at
                     FROM Brain"""
            )
            rows = cur.fetchall(); conn.close()
            return [
                {
                    "brain_id":   r[0],
                    "brain_name": r[1],
                    "created_at": r[2],
                } for r in rows
            ]
        except Exception as e:
            logging.error("브레인 목록 조회 오류: %s", e)
            return []
    
    # Memo 관련 메서드
    def _get_next_id(self) -> int:
        """다음 ID 값을 가져옵니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 트랜잭션 시작
            cursor.execute("BEGIN TRANSACTION")
            
            # 현재 값 조회
            cursor.execute("SELECT value FROM Sequence WHERE name = 'content_id'")
            current_value = cursor.fetchone()[0]
            
            # 값 증가
            new_value = current_value + 1
            cursor.execute("UPDATE Sequence SET value = ? WHERE name = 'content_id'", (new_value,))
            
            # 트랜잭션 커밋
            conn.commit()
            conn.close()
            
            return new_value
        except Exception as e:
            logging.error("ID 생성 오류: %s", str(e))
            raise RuntimeError(f"ID 생성 오류: {str(e)}")

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
        
    # PDF 관련 메서드
    def create_pdf(self, pdf_title: str, pdf_path: str, type: Optional[str] = None, brain_id: Optional[int] = None) -> dict:
        """새 PDF 생성"""
        try:
            # brain_id 유효성 검사
            if brain_id is not None:
                brain = self.get_brain(brain_id)
                if not brain:
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 새 ID 생성
            pdf_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO Pdf (pdf_id, pdf_title, pdf_path, type, brain_id) VALUES (?, ?, ?, ?, ?)",
                (pdf_id, pdf_title, pdf_path, type, brain_id)
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
                "brain_id":  brain_id
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
                brain_id
            FROM Pdf
            WHERE brain_id = ?
            ORDER BY pdf_date DESC
        """
        cursor.execute(sql, (brain_id,))
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]

        conn.close()
        return [dict(zip(cols, row)) for row in rows]


    def update_pdf(self, pdf_id: int, pdf_title: str = None, pdf_path: str = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> bool:
        """PDF 정보 업데이트"""
        try:
            # 대상 PDF 존재 확인
            pdf = self.get_pdf(pdf_id)
            if not pdf:
                raise ValueError(f"존재하지 않는 PDF ID: {pdf_id}")

            # brain_id 검사
            if brain_id is not None and brain_id != "null":
                if not self.get_brain(brain_id):
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
                "SELECT pdf_id, pdf_title, pdf_path, pdf_date, type, brain_id FROM Pdf WHERE pdf_id = ?", 
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
                }
            else:
                return None
        except Exception as e:
            logging.error("PDF 조회 오류: %s", str(e))
            return None

    # TextFile 관련 메서드
    def create_textfile(self, txt_title: str, txt_path: str, type: Optional[str] = None, brain_id: Optional[int] = None) -> dict:
        """새 텍스트 파일 생성"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            txt_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO TextFile (txt_id, txt_title, txt_path, type, brain_id) VALUES (?, ?, ?, ?, ?)",
                (txt_id, txt_title, txt_path, type, brain_id)
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
                "brain_id": brain_id

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

    def update_textfile(self, txt_id: int, txt_title: str = None, txt_path: str = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> bool:
        """텍스트 파일 정보 업데이트"""
        try:
            # 대상 텍스트 파일 존재 확인
            textfile = self.get_textfile(txt_id)
            if not textfile:
                raise ValueError(f"존재하지 않는 텍스트 파일 ID: {txt_id}")
            
            # brain_id 유효성 검사
            if brain_id is not None and brain_id != "null":
                if not self.get_brain(brain_id):
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
                "SELECT txt_id, txt_title, txt_path, txt_date, type, brain_id FROM TextFile WHERE txt_id = ?", 
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
                    "brain_id" : textfile[5]
                }
            else:
                return None
        except Exception as e:
            logging.error("텍스트 파일 조회 오류: %s", str(e))
            return None

    def get_textfiles_by_brain(self, brain_id: int) -> List[dict]:
        """
        주어진 brain_id에 해당하는 모든 텍스트 파일(txt) 목록을 반환합니다.
        폴더 여부와 관계없이 brain_id로만 필터링합니다.
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        sql = """
            SELECT
                txt_id,
                txt_title,
                txt_path,
                txt_date,
                type,
                brain_id
            FROM TextFile
            WHERE brain_id = ?
            ORDER BY txt_date DESC
        """
        cursor.execute(sql, (brain_id,))
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]

        conn.close()
        return [dict(zip(cols, row)) for row in rows]
        
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
    
    def search_titles_by_query(self, query: str, brain_id: int) -> List[Dict]:
        """query를 포함하는 제목 검색
        
        Args:
            query (str): 검색할 키워드
            brain_id (int): 브레인 ID
            
        Returns:
            List[Dict]: 검색 결과 목록. 각 항목은 type(pdf/text), id, title을 포함
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # PDF와 TextFile 테이블에서 제목 검색
            cursor.execute("""
                SELECT 'pdf' as type, pdf_id as id, pdf_title as title
                FROM Pdf 
                WHERE brain_id = ? AND pdf_title LIKE ?
                UNION ALL
                SELECT 'text' as type, txt_id as id, txt_title as title
                FROM TextFile 
                WHERE brain_id = ? AND txt_title LIKE ?
            """, (brain_id, f'%{query}%', brain_id, f'%{query}%'))
            
            results = cursor.fetchall()
            conn.close()
            
            return [
                {
                    "type": row[0],
                    "id": row[1],
                    "title": row[2]
                }
                for row in results
            ]
        except Exception as e:
            logging.error("제목 검색 오류: %s", str(e))
            return []
    
   