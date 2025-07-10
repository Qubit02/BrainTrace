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
            
            # User 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS User (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL UNIQUE,
                user_pw TEXT NOT NULL
            )
            ''')
            
            # Brain 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS Brain (
                brain_id   INTEGER PRIMARY KEY AUTOINCREMENT,
                brain_name TEXT    NOT NULL,
                user_id    INTEGER NOT NULL,
                created_at TEXT,
                FOREIGN KEY (user_id) REFERENCES User(user_id)
            )
            ''')
            
            # Folder 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS Folder (
                folder_id INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_name TEXT NOT NULL,
                brain_id INTEGER NOT NULL,
                is_default BOOLEAN DEFAULT 0,
                FOREIGN KEY (brain_id) REFERENCES Brain(brain_id)
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
                folder_id INTEGER,
                brain_id INTEGER,
                FOREIGN KEY (folder_id) REFERENCES Folder(folder_id),
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
                folder_id INTEGER,
                brain_id INTEGER,
                type TEXT,
                FOREIGN KEY (folder_id) REFERENCES Folder(folder_id),
                FOREIGN KEY (brain_id) REFERENCES Brain(brain_id)
            )
            ''')

            # Voice 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS Voice (
                voice_id INTEGER PRIMARY KEY,
                voice_title TEXT,
                voice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                voice_path TEXT,
                folder_id INTEGER,
                brain_id INTEGER,
                type TEXT,
                FOREIGN KEY (folder_id) REFERENCES Folder(folder_id),
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
                folder_id INTEGER,
                brain_id INTEGER,
                type TEXT,
                FOREIGN KEY (folder_id) REFERENCES Folder(folder_id),
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
    
    def _hash_password(self, password: str) -> str:
        """비밀번호를 SHA-256 해시로 변환"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def create_user(self, username: str, password: str) -> dict:
        """새 사용자 생성"""
        try:
            hashed_pw = self._hash_password(password)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "INSERT INTO User (user_name, user_pw) VALUES (?, ?)",
                (username, hashed_pw)
            )
            user_id = cursor.lastrowid
            
            conn.commit()
            conn.close()
            
            logging.info("사용자 생성 완료: user_id=%s, username=%s", user_id, username)
            return {"user_id": user_id, "user_name": username}
        except sqlite3.IntegrityError:
            logging.error("사용자 생성 실패: 이미 존재하는 사용자명")
            raise ValueError("이미 존재하는 사용자명입니다")
        except Exception as e:
            logging.error("사용자 생성 오류: %s", str(e))
            raise RuntimeError(f"사용자 생성 오류: {str(e)}")
    
    def delete_user(self, user_id: int) -> bool:
        """사용자 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM User WHERE user_id = ?", (user_id,))
            deleted = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if deleted:
                logging.info("사용자 삭제 완료: user_id=%s", user_id)
            else:
                logging.warning("사용자 삭제 실패: 존재하지 않는 user_id=%s", user_id)
            
            return deleted
        except Exception as e:
            logging.error("사용자 삭제 오류: %s", str(e))
            raise RuntimeError(f"사용자 삭제 오류: {str(e)}")
    
    def update_username(self, user_id: int, new_username: str) -> bool:
        """사용자 이름 업데이트"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "UPDATE User SET user_name = ? WHERE user_id = ?",
                (new_username, user_id)
            )
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("사용자 이름 업데이트 완료: user_id=%s, new_username=%s", user_id, new_username)
            else:
                logging.warning("사용자 이름 업데이트 실패: 존재하지 않는 user_id=%s", user_id)
            
            return updated
        except sqlite3.IntegrityError:
            logging.error("사용자 이름 업데이트 실패: 이미 존재하는 사용자명")
            raise ValueError("이미 존재하는 사용자명입니다")
        except Exception as e:
            logging.error("사용자 이름 업데이트 오류: %s", str(e))
            raise RuntimeError(f"사용자 이름 업데이트 오류: {str(e)}")
    
    def update_password(self, user_id: int, new_password: str) -> bool:
        """사용자 비밀번호 업데이트"""
        try:
            hashed_pw = self._hash_password(new_password)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "UPDATE User SET user_pw = ? WHERE user_id = ?",
                (hashed_pw, user_id)
            )
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("사용자 비밀번호 업데이트 완료: user_id=%s", user_id)
            else:
                logging.warning("사용자 비밀번호 업데이트 실패: 존재하지 않는 user_id=%s", user_id)
            
            return updated
        except Exception as e:
            logging.error("사용자 비밀번호 업데이트 오류: %s", str(e))
            raise RuntimeError(f"사용자 비밀번호 업데이트 오류: {str(e)}")
    
    def get_user(self, user_id: int) -> Optional[dict]:
        """사용자 정보 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT user_id, user_name FROM User WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            conn.close()
            
            if user:
                return {"user_id": user[0], "user_name": user[1]}
            else:
                return None
        except Exception as e:
            logging.error("사용자 조회 오류: %s", str(e))
            return None
    
    def get_all_users(self) -> List[dict]:
        """모든 사용자 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT user_id, user_name FROM User")
            users = cursor.fetchall()
            
            conn.close()
            
            return [{"user_id": user[0], "user_name": user[1]} for user in users]
        except Exception as e:
            logging.error("사용자 목록 조회 오류: %s", str(e))
            return []
            
    def authenticate_user(self, username: str, password: str) -> Optional[dict]:
        """사용자 인증"""
        try:
            hashed_pw = self._hash_password(password)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT user_id, user_name FROM User WHERE user_name = ? AND user_pw = ?",
                (username, hashed_pw)
            )
            user = cursor.fetchone()
            conn.close()
            
            if user:
                return {"user_id": user[0], "user_name": user[1]}
            else:
                return None
        except Exception as e:
            logging.error("사용자 인증 오류: %s", str(e))
            return None
    
    # Brain 관련 메서드
    def create_brain(self, brain_name: str, user_id: int,
                     created_at: str | None = None) -> dict:
        try:
            # 사용자 존재 확인
            if not self.get_user(user_id):
                raise ValueError("존재하지 않는 사용자")
            
            # 2) created_at 기본값: 오늘
            if created_at is None:
                created_at = datetime.date.today().isoformat()   # '2025-05-07'

            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """INSERT INTO Brain
                     (brain_name, user_id, created_at)
                   VALUES (?,?,?)""",
                (
                    brain_name,
                    user_id,
                    created_at
                )
            )
            brain_id = cur.lastrowid
            conn.commit(); conn.close()

            return {
                "brain_id":   brain_id,
                "brain_name": brain_name,
                "user_id":    user_id,
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
                
                logging.info("🧹 Voice 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Voice WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 TextFile 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM TextFile WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 Chat 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Chat WHERE brain_id = ?", (brain_id,))
                
                logging.info("🧹 Folder 테이블에서 brain_id=%s 삭제 시도", brain_id)
                cursor.execute("DELETE FROM Folder WHERE brain_id = ?", (brain_id,))
                
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
                """SELECT brain_id, brain_name, user_id,
                        created_at
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
                "user_id":    row[2],
                "created_at": row[3],
            }
        except Exception as e:
            logging.error("브레인 조회 오류: %s", e)
            return None
         
    def get_user_brains(self, user_id: int) -> List[dict]:
        """특정 사용자의 모든 브레인"""
        try:
            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """SELECT brain_id, brain_name, user_id,
                          created_at
                     FROM Brain WHERE user_id=?""",
                (user_id,)
            )
            rows = cur.fetchall(); conn.close()
            return [
                {
                    "brain_id":   r[0],
                    "brain_name": r[1],
                    "user_id":    r[2],
                    "created_at": r[3],
                } for r in rows
            ]
        except Exception as e:
            logging.error("사용자 브레인 목록 조회 오류: %s", e)
            return []
    
    def get_all_brains(self) -> List[dict]:
        """시스템의 모든 브레인"""
        try:
            conn = sqlite3.connect(self.db_path)
            cur  = conn.cursor()
            cur.execute(
                """SELECT brain_id, brain_name, user_id,
                          created_at
                     FROM Brain"""
            )
            rows = cur.fetchall(); conn.close()
            return [
                {
                    "brain_id":   r[0],
                    "brain_name": r[1],
                    "user_id":    r[2],
                    "created_at": r[3],
                } for r in rows
            ]
        except Exception as e:
            logging.error("브레인 목록 조회 오류: %s", e)
            return []
    
    # Folder 관련 메서드
    def create_folder(self, folder_name: str, brain_id: int, is_default: bool = False) -> dict:
        """새 폴더 생성"""
        try:
            # 먼저 브레인이 존재하는지 확인
            brain = self.get_brain(brain_id)
            if not brain:
                raise ValueError(f"존재하지 않는 브레인 ID: {brain_id}")
                
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "INSERT INTO Folder (folder_name, brain_id, is_default) VALUES (?, ?, ?)",
                (folder_name, brain_id, 1 if is_default else 0)
            )
            folder_id = cursor.lastrowid
            
            conn.commit()
            conn.close()
            
            logging.info("폴더 생성 완료: folder_id=%s, folder_name=%s, brain_id=%s, is_default=%s", 
                        folder_id, folder_name, brain_id, is_default)
            return {
                "folder_id": folder_id, 
                "folder_name": folder_name, 
                "brain_id": brain_id,
                "is_default": is_default
            }
        except ValueError as e:
            logging.error("폴더 생성 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("폴더 생성 오류: %s", str(e))
            raise RuntimeError(f"폴더 생성 오류: {str(e)}")
    
    def delete_folder(self, folder_id: int) -> bool:
        """폴더 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM Folder WHERE folder_id = ?", (folder_id,))
            deleted = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if deleted:
                logging.info("폴더 삭제 완료: folder_id=%s", folder_id)
            else:
                logging.warning("폴더 삭제 실패: 존재하지 않는 folder_id=%s", folder_id)
            
            return deleted
        except Exception as e:
            logging.error("폴더 삭제 오류: %s", str(e))
            raise RuntimeError(f"폴더 삭제 오류: {str(e)}")
        
    def delete_folder_with_memos(self, folder_id: int, brain_id: int) -> dict:
        """폴더와 그 안의 모든 메모 및 파일(txt/pdf/voice) 삭제"""
        try:
            folder = self.get_folder(folder_id)
            if not folder:
                raise ValueError(f"존재하지 않는 폴더 ID: {folder_id}")

            if folder['brain_id'] != brain_id:
                raise ValueError("해당 brain_id에 속하지 않은 폴더입니다")

            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("DELETE FROM TextFile WHERE folder_id = ?", (folder_id,))
            deleted_txt_count = cursor.rowcount

            cursor.execute("DELETE FROM Pdf WHERE folder_id = ?", (folder_id,))
            deleted_pdf_count = cursor.rowcount

            cursor.execute("DELETE FROM Voice WHERE folder_id = ?", (folder_id,))
            deleted_voice_count = cursor.rowcount

            cursor.execute("DELETE FROM Folder WHERE folder_id = ?", (folder_id,))
            folder_deleted_count = cursor.rowcount

            conn.commit()
            conn.close()

            logging.info(
                "[폴더 삭제] folder_id=%s | 텍스트:%d, PDF:%d, 오디오:%d, 폴더:%d",
                folder_id, deleted_txt_count, deleted_pdf_count, deleted_voice_count, folder_deleted_count
            )

            return {
                "folder_id": folder_id,
                "deleted_memos_count": deleted_txt_count + deleted_pdf_count + deleted_voice_count,
                "success": folder_deleted_count > 0
            }

        except ValueError as e:
            logging.error("폴더 삭제 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("폴더 삭제 오류: %s", str(e))
            raise RuntimeError(f"폴더 삭제 오류: {str(e)}")



    def update_folder(self, folder_id: int, folder_name: str = None, is_default: bool = None) -> bool:
        """폴더 정보 업데이트"""
        try:
            # 폴더가 존재하는지 확인
            folder = self.get_folder(folder_id)
            if not folder:
                raise ValueError(f"존재하지 않는 폴더 ID: {folder_id}")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 업데이트할 필드 지정
            update_fields = []
            params = []
            
            if folder_name is not None:
                update_fields.append("folder_name = ?")
                params.append(folder_name)
                
            if is_default is not None:
                update_fields.append("is_default = ?")
                params.append(1 if is_default else 0)
                
            if not update_fields:
                return False  # 업데이트할 내용 없음
            
            # 쿼리 구성
            query = f"UPDATE Folder SET {', '.join(update_fields)} WHERE folder_id = ?"
            params.append(folder_id)
            
            cursor.execute(query, params)
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("폴더 업데이트 완료: folder_id=%s", folder_id)
            else:
                logging.warning("폴더 업데이트 실패: 존재하지 않는 folder_id=%s", folder_id)
            
            return updated
        except ValueError as e:
            logging.error("폴더 업데이트 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("폴더 업데이트 오류: %s", str(e))
            raise RuntimeError(f"폴더 업데이트 오류: {str(e)}")
    
    def get_folder(self, folder_id: int) -> Optional[dict]:
        """폴더 정보 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT folder_id, folder_name, brain_id, is_default FROM Folder WHERE folder_id = ?", 
                (folder_id,)
            )
            folder = cursor.fetchone()
            
            conn.close()
            
            if folder:
                return {
                    "folder_id": folder[0], 
                    "folder_name": folder[1], 
                    "brain_id": folder[2],
                    "is_default": bool(folder[3])
                }
            else:
                return None
        except Exception as e:
            logging.error("폴더 조회 오류: %s", str(e))
            return None
    
    def get_brain_folders(self, brain_id: int) -> List[dict]:
        """브레인의 모든 폴더 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT folder_id, folder_name, brain_id, is_default FROM Folder WHERE brain_id = ?", 
                (brain_id,)
            )
            folders = cursor.fetchall()
            
            conn.close()
            
            return [
                {
                    "folder_id": folder[0], 
                    "folder_name": folder[1], 
                    "brain_id": folder[2],
                    "is_default": bool(folder[3])
                } 
                for folder in folders
            ]
        except Exception as e:
            logging.error("브레인 폴더 목록 조회 오류: %s", str(e))
            return []
    
    def get_default_folder(self, brain_id: int) -> Optional[dict]:
        """브레인의 기본 폴더 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT folder_id, folder_name, brain_id, is_default FROM Folder WHERE brain_id = ? AND is_default = 1", 
                (brain_id,)
            )
            folder = cursor.fetchone()
            
            conn.close()
            
            if folder:
                return {
                    "folder_id": folder[0], 
                    "folder_name": folder[1], 
                    "brain_id": folder[2],
                    "is_default": bool(folder[3])
                }
            else:
                return None
        except Exception as e:
            logging.error("기본 폴더 조회 오류: %s", str(e))
            return None
    
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

    def create_memo(self, memo_title: str, memo_text: str, folder_id: Optional[int] = None, is_source: bool = False, type: Optional[str] = None, brain_id: Optional[int] = None) -> dict:
        """새 메모 생성"""
        logging.info("✅ create_memo() 호출됨: brain_id=%s", brain_id)
        try:
            # folder_id가 주어진 경우에만 폴더 존재 여부 확인
            if folder_id is not None:
                folder = self.get_folder(folder_id)
                if not folder:
                    raise ValueError(f"존재하지 않는 폴더 ID: {folder_id}")
                    
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
                "INSERT INTO Memo (memo_id, memo_title, memo_text, folder_id, is_source, type, brain_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (memo_id, memo_title, memo_text, folder_id, 1 if is_source else 0, type, brain_id)
            )
            
            # 현재 날짜 가져오기 (자동 생성됨)
            cursor.execute("SELECT memo_date FROM Memo WHERE memo_id = ?", (memo_id,))
            memo_date = cursor.fetchone()[0]
            
            conn.commit()
            conn.close()
            
            logging.info("메모 생성 완료: memo_id=%s, memo_title=%s, folder_id=%s, brain_id=%s", 
                        memo_id, memo_title, folder_id, brain_id)
            return {
                "memo_id": memo_id, 
                "memo_title": memo_title, 
                "memo_text": memo_text,
                "memo_date": memo_date,
                "is_source": is_source,
                "type": type,
                "folder_id": folder_id,
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
    
    def update_memo(self, memo_id: int, memo_title: str = None, memo_text: str = None, is_source: bool = None, folder_id: Optional[int] = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> bool:
        """메모 정보 업데이트"""
        try:
            # 메모가 존재하는지 확인
            memo = self.get_memo(memo_id)
            if not memo:
                raise ValueError(f"존재하지 않는 메모 ID: {memo_id}")
            
            # folder_id가 주어진 경우에만 폴더 존재 여부 확인
            if folder_id is not None and folder_id != "null":
                folder = self.get_folder(folder_id)
                if not folder:
                    raise ValueError(f"존재하지 않는 폴더 ID: {folder_id}")

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
                
            # folder_id가 None이거나 "null"이면 NULL로 설정
            if folder_id is None or folder_id == "null":
                update_fields.append("folder_id = NULL")
            elif folder_id is not None:
                update_fields.append("folder_id = ?")
                params.append(folder_id)

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
                "SELECT memo_id, memo_title, memo_text, memo_date, is_source, type, folder_id, brain_id FROM Memo WHERE memo_id = ?", 
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
                    "folder_id": memo[6],
                    "brain_id": memo[7]
                }
            else:
                return None
        except Exception as e:
            logging.error("메모 조회 오류: %s", str(e))
            return None
    
    def get_folder_memos(self, folder_id: int) -> List[dict]:
        """폴더의 모든 메모 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT memo_id, memo_title, memo_text, memo_date, is_source, folder_id FROM Memo WHERE folder_id = ? ORDER BY memo_date DESC", 
                (folder_id,)
            )
            memos = cursor.fetchall()
            
            conn.close()
            
            return [
                {
                    "memo_id": memo[0], 
                    "memo_title": memo[1], 
                    "memo_text": memo[2],
                    "memo_date": memo[3],
                    "is_source": bool(memo[4]),
                    "folder_id": memo[5]
                } 
                for memo in memos
            ]
        except Exception as e:
            logging.error("폴더 메모 목록 조회 오류: %s", str(e))
            return []
            
    def get_folder_memo_titles(self, folder_id: int) -> List[dict]:
        """폴더의 모든 메모 제목만 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT memo_id, memo_title, memo_date, is_source FROM Memo WHERE folder_id = ? ORDER BY memo_date DESC", 
                (folder_id,)
            )
            memos = cursor.fetchall()
            
            conn.close()
            
            return [
                {
                    "memo_id": memo[0], 
                    "memo_title": memo[1],
                    "memo_date": memo[2],
                    "is_source": bool(memo[3])
                } 
                for memo in memos
            ]
        except Exception as e:
            logging.error("폴더 메모 제목 목록 조회 오류: %s", str(e))
            return []

    def get_default_memos(self) -> List[dict]:
        """폴더가 없는 모든 메모 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT memo_id, memo_title, memo_text, memo_date, is_source, folder_id FROM Memo WHERE folder_id IS NULL ORDER BY memo_date DESC"
            )
            memos = cursor.fetchall()
            
            conn.close()
            
            return [
                {
                    "memo_id": memo[0], 
                    "memo_title": memo[1],
                    "memo_text": memo[2],
                    "memo_date": memo[3],
                    "is_source": bool(memo[4]),
                    "folder_id": memo[5]
                } 
                for memo in memos
            ]
        except Exception as e:
            logging.error("폴더 없는 메모 목록 조회 오류: %s", str(e))
            return []

    def get_default_memo_titles(self) -> List[dict]:
        """폴더가 없는 모든 메모의 제목만 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT memo_id, memo_title, memo_date, is_source FROM Memo WHERE folder_id IS NULL ORDER BY memo_date DESC"
            )
            memos = cursor.fetchall()
            
            conn.close()
            
            return [
                {
                    "memo_id": memo[0], 
                    "memo_title": memo[1],
                    "memo_date": memo[2],
                    "is_source": bool(memo[3])
                } 
                for memo in memos
            ]
        except Exception as e:
            logging.error("폴더 없는 메모 제목 목록 조회 오류: %s", str(e))
            return []

    # PDF 관련 메서드
    def create_pdf(self, pdf_title: str, pdf_path: str, folder_id: Optional[int] = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> dict:
        """새 PDF 생성"""
        try:
            # 1) folder_id 유효성 검사
            if folder_id is not None:
                folder = self.get_folder(folder_id)
                if not folder:
                    raise ValueError(f"존재하지 않는 폴더 ID: {folder_id}")

            # 2) brain_id 유효성 검사
            if brain_id is not None:
                brain = self.get_brain(brain_id)
                if not brain:
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 새 ID 생성
            pdf_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO Pdf (pdf_id, pdf_title, pdf_path, folder_id, type, brain_id) VALUES (?, ?, ?, ?, ?, ?)",
                (pdf_id, pdf_title, pdf_path, folder_id, type, brain_id)
            )
            
            # 현재 날짜 가져오기 (자동 생성됨)
            cursor.execute("SELECT pdf_date FROM Pdf WHERE pdf_id = ?", (pdf_id,))
            pdf_date = cursor.fetchone()[0]
            
            conn.commit()
            conn.close()
            
            logging.info(
                "PDF 생성 완료: pdf_id=%s, pdf_title=%s, folder_id=%s, brain_id=%s",
                pdf_id, pdf_title, folder_id, brain_id
            )
            
            return {
                "pdf_id": pdf_id, 
                "pdf_title": pdf_title, 
                "pdf_path": pdf_path,
                "pdf_date": pdf_date,
                "type": type,
                "folder_id": folder_id,
                "brain_id":  brain_id
            }
        except ValueError as e:
            logging.error("PDF 생성 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("PDF 생성 오류: %s", str(e))
            raise RuntimeError(f"PDF 생성 오류: {str(e)}")
        
    def get_pdfs_by_folder(self, folder_id: int) -> List[Dict[str, Any]]:
        """특정 폴더에 속한 PDF 목록을 조회합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT pdf_id, pdf_title, pdf_path, pdf_date, type, folder_id, brain_id
                FROM Pdf
                WHERE folder_id = ?
                ORDER BY pdf_date DESC
            """, (folder_id,))
            rows = cursor.fetchall()
            conn.close()

            return [
                {
                    "pdf_id": row[0],
                    "pdf_title": row[1],
                    "pdf_path": row[2],
                    "pdf_date": row[3],
                    "type": row[4],
                    "folder_id": row[5],
                    "brain_id":  row[6],
                }
                for row in rows

            ]
        except Exception as e:
            logging.error("get_pdfs_by_folder 오류: %s", str(e))
            return []


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
        
    def get_pdfs_by_brain_and_folder(
        self,
        brain_id: int,
        folder_id: Optional[int] = None
    ) -> List[dict]:
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        if folder_id is None:
            # 루트(폴더 없음) PDF만
            where  = "brain_id = ? AND folder_id IS NULL"
            params = (brain_id,)
        else:
            # 폴더가 있는(어느 폴더든) PDF 모두
            where  = "brain_id = ? AND folder_id IS NOT NULL"
            params = (brain_id,)

        sql = f"""
            SELECT
                pdf_id, pdf_title, pdf_path,
                pdf_date, type, folder_id, brain_id
            FROM Pdf
            WHERE {where}
            ORDER BY pdf_date DESC
        """
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        conn.close()

        return [ dict(zip(cols, r)) for r in rows ]

    def update_pdf(self, pdf_id: int, pdf_title: str = None, pdf_path: str = None, folder_id: Optional[int] = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> bool:
        """PDF 정보 업데이트"""
        try:
            # 1) 대상 PDF 존재 확인
            pdf = self.get_pdf(pdf_id)
            if not pdf:
                raise ValueError(f"존재하지 않는 PDF ID: {pdf_id}")

            # 2) folder_id 검사
            if folder_id is not None and folder_id != "null":
                if not self.get_folder(folder_id):
                    raise ValueError(f"존재하지 않는 폴더 ID: {folder_id}")

            # 3) brain_id 검사
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

            # folder_id가 None이거나 "null"이면 NULL로 설정
            if folder_id is None or folder_id == "null":
                update_fields.append("folder_id = NULL")
            elif folder_id is not None:
                update_fields.append("folder_id = ?")
                params.append(folder_id)            
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
                "SELECT pdf_id, pdf_title, pdf_path, pdf_date, type, folder_id, brain_id FROM Pdf WHERE pdf_id = ?", 
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
                    "folder_id": pdf[5],
                    "brain_id":  pdf[6],
                }
            else:
                return None
        except Exception as e:
            logging.error("PDF 조회 오류: %s", str(e))
            return None

    def get_folder_pdfs(self, folder_id: int) -> List[dict]:
        """폴더의 모든 PDF 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT pdf_id, pdf_title, pdf_path, pdf_date, type, folder_id, brain_id FROM Pdf WHERE folder_id = ? ORDER BY pdf_date DESC", 
                (folder_id,)
            )
            pdfs = cursor.fetchall()
            
            conn.close()
            
            return [
                {
                    "pdf_id": pdf[0], 
                    "pdf_title": pdf[1], 
                    "pdf_path": pdf[2],
                    "pdf_date": pdf[3],
                    "type": pdf[4],
                    "folder_id": pdf[5],
                    "brain_id":  pdf[6],
                } 
                for pdf in pdfs
            ]
        except Exception as e:
            logging.error("폴더 PDF 목록 조회 오류: %s", str(e))
            return []

    # Voice 관련 메서드
    def create_voice(self, voice_title: str, voice_path: str, folder_id: Optional[int] = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> dict:
        """새 음성 파일 생성"""
        try:
            # 1) folder_id 검사
            if folder_id is not None:
                if not self.get_folder(folder_id):
                    raise ValueError(f"존재하지 않는 폴더 ID: {folder_id}")
            # 2) brain_id 검사
            if brain_id is not None:
                if not self.get_brain(brain_id):
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
                    
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            voice_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO Voice (voice_id, voice_title, voice_path, folder_id, type, brain_id) VALUES (?, ?, ?, ?, ?, ?)",
                (voice_id, voice_title, voice_path, folder_id, type, brain_id)
            )
            
            cursor.execute("SELECT voice_date FROM Voice WHERE voice_id = ?", (voice_id,))
            voice_date = cursor.fetchone()[0]
            
            conn.commit()
            conn.close()
            
            logging.info("음성 파일 생성 완료: voice_id=%s, voice_title=%s, folder_id=%s, brain_id=%s", 
                        voice_id, voice_title, folder_id, brain_id)
            return {
                "voice_id": voice_id, 
                "voice_title": voice_title, 
                "voice_path": voice_path,
                "voice_date": voice_date,
                "type": type,
                "folder_id": folder_id,
                "brain_id": brain_id
            }
        except ValueError as e:
            logging.error("음성 파일 생성 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("음성 파일 생성 오류: %s", str(e))
            raise RuntimeError(f"음성 파일 생성 오류: {str(e)}")
    
    def get_voices_by_brain_and_folder(
        self,
        brain_id: int,
        folder_id: Optional[int] = None
    ) -> List[Dict]:
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        if folder_id is None:
            where  = "brain_id = ? AND folder_id IS NULL"
            params = (brain_id,)
        else:
            where  = "brain_id = ? AND folder_id IS NOT NULL"
            params = (brain_id,)

        sql = f"""
            SELECT
                voice_id,
                voice_title,
                voice_path,
                voice_date,
                type,
                folder_id,
                brain_id
            FROM Voice
            WHERE {where}
            ORDER BY voice_date DESC
        """
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        conn.close()
        return [dict(zip(cols, r)) for r in rows]
        
    def get_folder_voices(self, folder_id: int) -> List[dict]:
        """폴더에 속한 음성 파일 목록 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
        
            cursor.execute(
                "SELECT voice_id, voice_title, voice_path, voice_date, type, folder_id, brain_id FROM Voice WHERE folder_id = ? ORDER BY voice_date DESC", 
                (folder_id,)
            )
            voices = cursor.fetchall()
        
            conn.close()
        
            return [
                {
                    "voice_id": row[0],
                    "voice_title": row[1],
                    "voice_path": row[2],
                    "voice_date": row[3],
                    "type": row[4],
                    "folder_id": row[5],
                    "brain_id": row[6],
                }
                for row in voices
            ]
        except Exception as e:
            logging.error("폴더 음성 파일 목록 조회 오류: %s", str(e))
            return []

    def delete_voice(self, voice_id: int) -> bool:
        """음성 파일 삭제"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM Voice WHERE voice_id = ?", (voice_id,))
            deleted = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if deleted:
                logging.info("음성 파일 삭제 완료: voice_id=%s", voice_id)
            else:
                logging.warning("음성 파일 삭제 실패: 존재하지 않는 voice_id=%s", voice_id)
            
            return deleted
        except Exception as e:
            logging.error("음성 파일 삭제 오류: %s", str(e))
            raise RuntimeError(f"음성 파일 삭제 오류: {str(e)}")

    def update_voice(self, voice_id: int, voice_title: str = None, voice_path: str = None, folder_id: Optional[int] = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> bool:
        """음성 파일 정보 업데이트"""
        try:
            # 1) 대상 음성 파일 존재 확인
            voice = self.get_voice(voice_id)
            if not voice:
                raise ValueError(f"존재하지 않는 음성 파일 ID: {voice_id}")

            # 2) folder_id 유효성 검사
            if folder_id is not None and folder_id != "null":
                if not self.get_folder(folder_id):
                    raise ValueError(f"존재하지 않는 폴더 ID: {folder_id}")

            # 3) brain_id 유효성 검사
            if brain_id is not None and brain_id != "null":
                if not self.get_brain(brain_id):
                    raise ValueError(f"존재하지 않는 Brain ID: {brain_id}")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            update_fields = []
            params = []
            
            if voice_title is not None:
                update_fields.append("voice_title = ?")
                params.append(voice_title)
                
            if voice_path is not None:
                update_fields.append("voice_path = ?")
                params.append(voice_path)
                
            if type is not None:
                update_fields.append("type = ?")
                params.append(type)

            # folder_id 처리: null 또는 값
            if folder_id is None or folder_id == "null":
                update_fields.append("folder_id = NULL")
            else:
                update_fields.append("folder_id = ?")
                params.append(folder_id)

            # brain_id 처리: null 또는 값
            if brain_id is None or brain_id == "null":
                update_fields.append("brain_id = NULL")
            else:
                update_fields.append("brain_id = ?")
                params.append(brain_id)

            if not update_fields:
                conn.close()
                return False  # 변경할 내용 없음
            
            update_fields.append("voice_date = CURRENT_TIMESTAMP")
            
            query = f"UPDATE Voice SET {', '.join(update_fields)} WHERE voice_id = ?"
            params.append(voice_id)
            
            cursor.execute(query, params)
            updated = cursor.rowcount > 0
            
            conn.commit()
            conn.close()
            
            if updated:
                logging.info("음성 파일 업데이트 완료: voice_id=%s", voice_id)
            else:
                logging.warning("음성 파일 업데이트 실패: 존재하지 않는 voice_id=%s", voice_id)
            
            return updated
        except ValueError as e:
            logging.error("음성 파일 업데이트 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("음성 파일 업데이트 오류: %s", str(e))
            raise RuntimeError(f"음성 파일 업데이트 오류: {str(e)}")

    def get_voice(self, voice_id: int) -> Optional[dict]:
        """음성 파일 정보 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT voice_id, voice_title, voice_path, voice_date, type, folder_id, brain_id FROM Voice WHERE voice_id = ?", 
                (voice_id,)
            )
            voice = cursor.fetchone()
            
            conn.close()
            
            if voice:
                return {
                    "voice_id": voice[0], 
                    "voice_title": voice[1], 
                    "voice_path": voice[2],
                    "voice_date": voice[3],
                    "type": voice[4],
                    "folder_id": voice[5],
                    "brain_id": voice[6],

                }
            else:
                return None
        except Exception as e:
            logging.error("음성 파일 조회 오류: %s", str(e))
            return None

    def get_folder_voices(self, folder_id: int) -> List[dict]:
        """폴더의 모든 음성 파일 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT voice_id, voice_title, voice_path, voice_date, type, folder_id, brain_id FROM Voice WHERE folder_id = ? ORDER BY voice_date DESC", 
                (folder_id,)
            )
            voices = cursor.fetchall()
            
            conn.close()
            
            return [
                {
                    "voice_id": voice[0], 
                    "voice_title": voice[1], 
                    "voice_path": voice[2],
                    "voice_date": voice[3],
                    "type": voice[4],
                    "folder_id": voice[5],
                    "brain_id": voice[6],
                } 
                for voice in voices
            ]
        except Exception as e:
            logging.error("폴더 음성 파일 목록 조회 오류: %s", str(e))
            return []

    # TextFile 관련 메서드
    def create_textfile(self, txt_title: str, txt_path: str, folder_id: Optional[int] = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> dict:
        """새 텍스트 파일 생성"""
        try:
            if folder_id is not None:
                folder = self.get_folder(folder_id)
                if not folder:
                    raise ValueError(f"존재하지 않는 폴더 ID: {folder_id}")
                    
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            txt_id = self._get_next_id()
            
            cursor.execute(
                "INSERT INTO TextFile (txt_id, txt_title, txt_path, folder_id, type, brain_id) VALUES (?, ?, ?, ?, ?, ?)",
                (txt_id, txt_title, txt_path, folder_id, type, brain_id)
            )
            
            cursor.execute("SELECT txt_date FROM TextFile WHERE txt_id = ?", (txt_id,))
            txt_date = cursor.fetchone()[0]
            
            conn.commit()
            conn.close()
            
            logging.info("텍스트 파일 생성 완료: txt_id=%s, txt_title=%s, folder_id=%s, brain_id=%s", 
                        txt_id, txt_title, folder_id, brain_id)
            return {
                "txt_id": txt_id, 
                "txt_title": txt_title, 
                "txt_path": txt_path,
                "txt_date": txt_date,
                "type": type,
                "folder_id": folder_id,
                "brain_id": brain_id

            }
        except ValueError as e:
            logging.error("텍스트 파일 생성 실패: %s", str(e))
            raise
        except Exception as e:
            logging.error("텍스트 파일 생성 오류: %s", str(e))
            raise RuntimeError(f"텍스트 파일 생성 오류: {str(e)}")
    
    def get_textfiles_by_brain_and_folder(
        self,
        brain_id: int,
        folder_id: Optional[int] = None
    ) -> List[Dict]:
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        if folder_id is None:
            where  = "brain_id = ? AND folder_id IS NULL"
            params = (brain_id,)
        else:
            where  = "brain_id = ? AND folder_id IS NOT NULL"
            params = (brain_id,)

        sql = f"""
            SELECT
                txt_id,
                txt_title,
                txt_path,
                txt_date,
                type,
                folder_id,
                brain_id
            FROM TextFile
            WHERE {where}
            ORDER BY txt_date DESC
        """
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        conn.close()
        return [dict(zip(cols, r)) for r in rows]
        
    def get_folder_textfiles(self, folder_id: int) -> List[dict]:
        """폴더에 속한 텍스트 파일 목록 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT txt_id, txt_title, txt_path, txt_date, type, folder_id, brain_id "
                "FROM TextFile WHERE folder_id = ? ORDER BY txt_date DESC",
                (folder_id,)
            )
            rows = cursor.fetchall()
            conn.close()
            return [
                {
                    "txt_id": row[0],
                    "txt_title": row[1],
                    "txt_path": row[2],
                    "txt_date": row[3],
                    "type": row[4],
                    "folder_id": row[5],
                    "brain_id" : row[6]
                }
                for row in rows
            ]
        except Exception as e:
            logging.error("get_folder_textfiles 오류: %s", str(e))
            return []

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

    def update_textfile(self, txt_id: int, txt_title: str = None, txt_path: str = None, folder_id: Optional[int] = None, type: Optional[str] = None, brain_id: Optional[int] = None) -> bool:
        """텍스트 파일 정보 업데이트"""
        try:
            # 1) 대상 텍스트 파일 존재 확인
            textfile = self.get_textfile(txt_id)
            if not textfile:
                raise ValueError(f"존재하지 않는 텍스트 파일 ID: {txt_id}")

            # 2) folder_id 유효성 검사
            if folder_id is not None and folder_id != "null":
                if not self.get_folder(folder_id):
                    raise ValueError(f"존재하지 않는 폴더 ID: {folder_id}")

            # 3) brain_id 유효성 검사
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

            # folder_id가 None이거나 "null"이면 NULL로 설정
            if folder_id is None or folder_id == "null":
                update_fields.append("folder_id = NULL")
            else:
                update_fields.append("folder_id = ?")
                params.append(folder_id)

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
                "SELECT txt_id, txt_title, txt_path, txt_date, type, folder_id, brain_id FROM TextFile WHERE txt_id = ?", 
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
                    "folder_id": textfile[5],
                    "brain_id" : textfile[6]
                }
            else:
                return None
        except Exception as e:
            logging.error("텍스트 파일 조회 오류: %s", str(e))
            return None

    def get_textfiles_by_folder(self, folder_id: int) -> List[dict]:
        """폴더의 모든 텍스트 파일 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT txt_id, txt_title, txt_path, txt_date, type, folder_id, brain_id FROM TextFile WHERE folder_id = ? ORDER BY txt_date DESC", 
                (folder_id,)
            )
            textfiles = cursor.fetchall()
            
            conn.close()
            
            return [
                {
                    "txt_id": textfile[0], 
                    "txt_title": textfile[1], 
                    "txt_path": textfile[2],
                    "txt_date": textfile[3],
                    "type": textfile[4],
                    "folder_id": textfile[5],
                    "brain_id" : textfile[6]
                }
                for textfile in textfiles
            ]
        except Exception as e:
            logging.error("폴더 텍스트 파일 목록 조회 오류: %s", str(e))
            return []
        
    def get_default_memos(self) -> List[Dict[str, Any]]:
        """folder_id가 NULL인 메모(루트 메모) 목록 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT memo_id, memo_title, memo_text, memo_date, is_source, type, folder_id
                FROM Memo
                WHERE folder_id IS NULL
                ORDER BY memo_date DESC
            """)
            rows = cursor.fetchall()
            conn.close()

            return [
                {
                    "memo_id": row[0],
                    "memo_title": row[1],
                    "memo_text": row[2],
                    "memo_date": row[3],
                    "is_source": bool(row[4]),
                    "type": row[5],
                    "folder_id": row[6]
                }
                for row in rows
            ]
        except Exception as e:
            logging.error("get_default_memos 오류: %s", e)
            return []

    def get_default_pdfs(self) -> List[Dict[str, Any]]:
        """folder_id가 NULL인 PDF(루트 PDF) 목록 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT pdf_id, pdf_title, pdf_path, pdf_date, type, folder_id, brain_id
                FROM Pdf
                WHERE folder_id IS NULL
                ORDER BY pdf_date DESC
            """)
            rows = cursor.fetchall()
            conn.close()

            return [
                {
                    "pdf_id":   row[0],
                    "pdf_title": row[1],
                    "pdf_path":  row[2],
                    "pdf_date":  row[3],
                    "type":      row[4],
                    "folder_id": row[5],
                    "brain_id" : row[6]
                }
                for row in rows
            ]
        except Exception as e:
            logging.error("get_default_pdfs 오류: %s", e)
            return []

    def get_default_textfiles(self) -> List[Dict[str, Any]]:
        """folder_id가 NULL인 텍스트 파일(루트 TXT) 목록 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT txt_id, txt_title, txt_path, txt_date, type, folder_id, brain_id
                FROM TextFile
                WHERE folder_id IS NULL
                ORDER BY txt_date DESC
            """)
            rows = cursor.fetchall()
            conn.close()

            return [
                {
                    "txt_id":    row[0],
                    "txt_title": row[1],
                    "txt_path":  row[2],
                    "txt_date":  row[3],
                    "type":      row[4],
                    "folder_id": row[5],
                    "brain_id" : row[6]
                }
                for row in rows
            ]
        except Exception as e:
            logging.error("get_default_textfiles 오류: %s", e)
            return []

    def get_default_voices(self) -> List[Dict[str, Any]]:
        """folder_id가 NULL인 음성 파일(루트 VOICE) 목록 조회"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT voice_id, voice_title, voice_path, voice_date, type, folder_id, brain_id
                FROM Voice
                WHERE folder_id IS NULL
                ORDER BY voice_date DESC
            """)
            rows = cursor.fetchall()
            conn.close()

            return [
                {
                    "voice_id":    row[0],
                    "voice_title": row[1],
                    "voice_path":  row[2],
                    "voice_date":  row[3],
                    "type":        row[4],
                    "folder_id":   row[5],
                    "brain_id" :   row[6]
                }
                for row in rows
            ]
        except Exception as e:
            logging.error("get_default_voices 오류: %s", e)
            return []

    def get_memos_by_brain_and_folder(
        self,
        brain_id: int,
        folder_id: Optional[int] = None
    ) -> List[Dict]:
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        if folder_id is None:
            where  = "brain_id = ? AND folder_id IS NULL"
            params = (brain_id,)
        else:
            where  = "brain_id = ? AND folder_id IS NOT NULL"
            params = (brain_id,)

        sql = f"""
            SELECT
                memo_id,
                memo_title,
                memo_text,
                memo_date,
                is_source,
                type,
                folder_id,
                brain_id
            FROM Memo
            WHERE {where}
            ORDER BY memo_date DESC
        """
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        cols = [c[0] for c in cursor.description]
        conn.close()
        return [dict(zip(cols, r)) for r in rows]

    def get_trash_bin_memos(self, brain_id: int) -> List[Dict]:
        """특정 Brain의 휴지통에 있는 모든 메모를 조회합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT memo_id, memo_title, memo_text, memo_date, 
                       is_source, type, folder_id, brain_id
                FROM Memo 
                WHERE brain_id = ? AND is_delete = 1
                ORDER BY memo_date DESC
            """, (brain_id,))
            
            rows = cursor.fetchall()
            cols = [c[0] for c in cursor.description]
            conn.close()
            
            return [dict(zip(cols, r)) for r in rows]
        except Exception as e:
            logging.error("휴지통 메모 조회 오류: %s", str(e))
            return []

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
    
    def get_brain_id_by_folder(self, folder_id: int) -> Optional[int]:
        """폴더 ID로 브레인 ID를 조회합니다."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT brain_id FROM Folder WHERE folder_id = ?", 
                (folder_id,)
            )
            result = cursor.fetchone()
            
            conn.close()
            
            return result[0] if result else None
        except Exception as e:
            logging.error("폴더의 브레인 ID 조회 오류: %s", str(e))
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
    
   