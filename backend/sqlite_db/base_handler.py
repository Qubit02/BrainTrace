
"""
로컬 SQLite 핸들러 (초기화 / 시퀀스-ID 발급)
---------------------------------------

이 클래스는 앱 내부에서 사용할 **로컬 SQLite DB**를 초기화하고, 공용 시퀀스 테이블을 통해
증가형 ID를 발급하는 유틸리티입니다.

핵심 기능
- 경로 설정: 인자 미지정 시 현재 파일의 부모 디렉터리 기준 `backend/data/sqlite.db` 생성.
- DB 초기화(`_init_db`):
  - 연결 옵션: `timeout=30`, `check_same_thread=False`
  - PRAGMA: `journal_mode=WAL`, `busy_timeout=30000`
  - 테이블 생성:
    - `Sequence(name PRIMARY KEY, value INTEGER)`  ← 전역 시퀀스 저장
    - `Brain(brain_id AUTOINCREMENT, brain_name, created_at, is_important, deployment_type)`
    - `Memo(memo_id, memo_text, memo_title, memo_date, is_source, type, brain_id, is_deleted)`
    - `Pdf(pdf_id, pdf_title, pdf_date, pdf_path, brain_id, type, pdf_text)`
    - `TextFile(txt_id, txt_title, txt_date, txt_path, brain_id, type, txt_text)`
    - `MDFile(md_id, md_title, md_path, md_date, type, brain_id, md_text)`
    - `DocxFile(docx_id, docx_title, docx_path, docx_date, type, brain_id, docx_text)`
    - `Chat(chat_id, session_id, is_ai, message, referenced_nodes, accuracy)`
    - `ChatSession(session_id AUTOINCREMENT, session_name, created_at, brain_id)`
  - 초기 시퀀스 값: `('content_id', 0)` 삽입(있으면 무시).
  - 완료 후 `commit` 및 로그 출력.
- 시퀀스 발급(`_get_next_id`):
  - 트랜잭션으로 `Sequence` 테이블의 `content_id` 값을 읽어 `+1` 업데이트 후 반환.

동시성/트랜잭션
- WAL 모드 + `busy_timeout`으로 다중 접근에 대비.
- `_get_next_id()`는 `BEGIN TRANSACTION`으로 원자적 증가를 보장.
- **반드시** `_init_db()`가 선행되어 `Sequence` 레코드가 존재해야 함.

사용 예시
- 앱 시작 시 `BaseHandler(...). _init_db()`로 스키마 준비.
- 신규 리소스 ID가 필요할 때 `_get_next_id()` 호출.

주의/안내
- 현재 구현은 예외 발생 시 `finally`에서 `conn` 참조가 없을 수 있으므로, 실제 운용 시에는
  `conn`을 `None`으로 초기화 후 존재 여부 체크 뒤 close 하는 패턴 권장.
- `_get_next_id()` 연결에서는 PRAGMA들이 다시 설정되지 않으므로, 필요 시 동일 PRAGMA를
  재적용하거나 **공용 커넥션/커넥션 팩토리**를 사용하는 구조로 개선 권장.
- 스키마 변경 시 마이그레이션 전략(버전 관리)이 필요할 수 있음.
"""

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
                created_at TEXT,
                is_important BOOLEAN DEFAULT 0,
                deployment_type TEXT DEFAULT 'local'
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
                is_deleted INTEGER DEFAULT 0,
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
                pdf_text TEXT,
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
                txt_text TEXT,
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
                md_text TEXT,
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
                session_id INTEGER,
                is_ai BOOLEAN NOT NULL,
                message TEXT,
                referenced_nodes TEXT,
                accuracy REAL,
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