"""
통합 SQLite 핸들러
모든 도메인별 핸들러를 통합하여 제공합니다.
"""
from .base_handler import BaseHandler
from .brain_handler import BrainHandler
from .memo_handler import MemoHandler
from .pdf_handler import PdfHandler
from .textfile_handler import TextFileHandler
from .mdfile_handler import MDFileHandler
from .chat_handler import ChatHandler
from .search_handler import SearchHandler


class SQLiteHandler(BrainHandler, MemoHandler, PdfHandler, TextFileHandler, MDFileHandler, ChatHandler, SearchHandler):
    """
    통합 SQLite 핸들러 클래스
    모든 도메인별 핸들러의 기능을 상속받아 제공합니다.
    """
    def __init__(self, db_path=None):
        super().__init__(db_path) 