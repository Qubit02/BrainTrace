import sqlite3, json, logging, os, hashlib, datetime
from typing import List, Dict, Any, Optional


class BaseHandler:
    def __init__(self, db_path=None):
        if db_path is None:
            # 기본 경로 설정 (backend 폴더 아래 data/sqlite.db)
            self.db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "sqlite.db")
            # 경로 생성
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        else:
            self.db_path = db_path
    
    def _init_db(self):
        """SQLite 데이터베이스와 테이블 초기화"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30, check_same_thread=False)
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

            # MDFile 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS MDFile (
                md_id INTEGER PRIMARY KEY,
                md_title TEXT NOT NULL,
                md_path TEXT NOT NULL,
                md_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                type TEXT,
                brain_id INTEGER,
                FOREIGN KEY (brain_id) REFERENCES Brain(brain_id)
            )
            ''')

            # DocxFile 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS DocxFile (
                docx_id INTEGER PRIMARY KEY,
                docx_title TEXT NOT NULL,
                docx_path TEXT NOT NULL,
                docx_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                type TEXT,
                brain_id INTEGER,
                docx_text TEXT,
                FOREIGN KEY (brain_id) REFERENCES Brain(brain_id)
            )
            ''')

            # Chat 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS Chat (
                chat_id INTEGER PRIMARY KEY,
                session_id INTEGER,  -- 채팅 세션 ID
                is_ai BOOLEAN NOT NULL,
                message TEXT,
                referenced_nodes TEXT,
                FOREIGN KEY (session_id) REFERENCES ChatSession(session_id)
            )
            ''')

            # ChatSession 테이블 생성
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS ChatSession (
                session_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                brain_id INTEGER,
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