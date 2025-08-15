import requests
import time
import signal
import sys
import logging
import os
import glob
from typing import List, Dict, Any, Optional
from contextlib import contextmanager

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 전역 임시 파일 추적
GLOBAL_TEMP_FILES = []

def add_global_temp_file(file_path: str):
    """전역 임시 파일 추적에 추가"""
    GLOBAL_TEMP_FILES.append(file_path)
    logger.debug(f"전역 임시 파일 추가: {file_path}")

def cleanup_global_temp_files():
    """전역 임시 파일들 정리"""
    logger.info(f"전역 임시 파일 정리 시작... ({len(GLOBAL_TEMP_FILES)}개)")
    
    for temp_file in GLOBAL_TEMP_FILES:
        try:
            if os.path.exists(temp_file):
                os.remove(temp_file)
                logger.debug(f"전역 임시 파일 삭제: {temp_file}")
            else:
                logger.debug(f"전역 임시 파일이 이미 삭제됨: {temp_file}")
        except Exception as e:
            logger.error(f"전역 임시 파일 삭제 오류: {temp_file}, error={e}")
    
    GLOBAL_TEMP_FILES.clear()
    logger.info("전역 임시 파일 정리 완료")

def cleanup_test_files_pattern():
    """테스트 파일 패턴으로 정리"""
    patterns = [
        "test_*.txt",
        "test_*.pdf", 
        "test_*.docx",
        "test_*.md",
        "test_document.*",
        "test_invalid.*",
        "test_utf8.*",
        "test_empty.*"
    ]
    
    # 검색할 디렉토리들
    search_dirs = [
        ".",  # 현재 디렉토리
        "..",  # 상위 디렉토리
        "../..",  # 상위의 상위 디렉토리
        "backend/tests/",  # 테스트 디렉토리
        "backend/",  # 백엔드 디렉토리
        "backend/tests/file_tests/",  # 파일 테스트 디렉토리
        "backend/tests/file_tests/textfile/",  # 텍스트 파일 테스트 디렉토리
        "backend/tests/file_tests/pdf/",  # PDF 테스트 디렉토리
        "backend/tests/file_tests/docx/",  # DOCX 테스트 디렉토리
        "backend/tests/file_tests/mds/",  # MDS 테스트 디렉토리
    ]
    
    logger.info("테스트 파일 패턴 정리 시작...")
    
    for search_dir in search_dirs:
        for pattern in patterns:
            try:
                # 절대 경로로 변환
                if os.path.isabs(search_dir):
                    search_path = search_dir
                else:
                    search_path = os.path.abspath(search_dir)
                
                if not os.path.exists(search_path):
                    continue
                
                # 패턴으로 파일 검색
                pattern_path = os.path.join(search_path, pattern)
                files = glob.glob(pattern_path)
                
                for file_path in files:
                    try:
                        if os.path.exists(file_path):
                            os.remove(file_path)
                            logger.debug(f"패턴 파일 삭제: {file_path}")
                    except Exception as e:
                        logger.error(f"패턴 파일 삭제 오류: {file_path}, error={e}")
            except Exception as e:
                logger.error(f"패턴 {pattern} 처리 오류 (디렉토리: {search_dir}): {e}")
    
    logger.info("테스트 파일 패턴 정리 완료")

def force_cleanup_all_test_files():
    """모든 테스트 파일을 강제로 정리하는 함수"""
    logger.info("강제 테스트 파일 정리 시작...")
    
    # 특정 파일명들 직접 삭제
    specific_files = [
        "test_empty.txt",
        "test_utf8.txt", 
        "test_invalid.pdf",
        "test_invalid.md",
        "test_document.txt",
        "test_document.pdf",
        "test_document.docx",
        "test_document.md"
    ]
    
    # 검색할 디렉토리들 (절대 경로 포함)
    search_dirs = [
        os.getcwd(),  # 현재 작업 디렉토리
        os.path.dirname(os.path.abspath(__file__)),  # 현재 스크립트 디렉토리
        os.path.join(os.getcwd(), "backend"),
        os.path.join(os.getcwd(), "backend", "tests"),
        os.path.join(os.getcwd(), "backend", "tests", "file_tests"),
        os.path.join(os.getcwd(), "backend", "tests", "file_tests", "textfile"),
        os.path.join(os.getcwd(), "backend", "tests", "file_tests", "pdf"),
        os.path.join(os.getcwd(), "backend", "tests", "file_tests", "docx"),
        os.path.join(os.getcwd(), "backend", "tests", "file_tests", "mds"),
        # 추가 디렉토리들
        os.path.abspath("."),
        os.path.abspath(".."),
        os.path.abspath("../.."),
        os.path.abspath("backend"),
        os.path.abspath("backend/tests"),
        os.path.abspath("backend/tests/file_tests"),
        os.path.abspath("backend/tests/file_tests/textfile"),
        os.path.abspath("backend/tests/file_tests/pdf"),
        os.path.abspath("backend/tests/file_tests/docx"),
        os.path.abspath("backend/tests/file_tests/mds"),
    ]
    
    # uploaded 폴더들 추가
    uploaded_dirs = [
        os.path.join(os.getcwd(), "..", "uploaded_docx"),
        os.path.join(os.getcwd(), "..", "uploaded_pdfs"),
        os.path.join(os.getcwd(), "..", "uploaded_txts"),
        os.path.join(os.getcwd(), "..", "uploaded_mds"),
        os.path.join(os.getcwd(), "uploaded_docx"),
        os.path.join(os.getcwd(), "uploaded_pdfs"),
        os.path.join(os.getcwd(), "uploaded_txts"),
        os.path.join(os.getcwd(), "uploaded_mds"),
    ]
    
    deleted_count = 0
    
    for search_dir in search_dirs:
        if not os.path.exists(search_dir):
            continue
            
        for filename in specific_files:
            file_path = os.path.join(search_dir, filename)
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"강제 삭제: {file_path}")
                    deleted_count += 1
            except Exception as e:
                logger.error(f"강제 삭제 실패: {file_path}, error={e}")
    
    # 추가: 현재 디렉토리에서 직접 파일 검색
    current_dir = os.getcwd()
    for filename in specific_files:
        file_path = os.path.join(current_dir, filename)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"현재 디렉토리에서 강제 삭제: {file_path}")
                deleted_count += 1
        except Exception as e:
            logger.error(f"현재 디렉토리에서 강제 삭제 실패: {file_path}, error={e}")
    
    # uploaded 폴더에서 테스트 파일 검색 및 삭제
    logger.info("uploaded 폴더에서 테스트 파일 검색 중...")
    for uploaded_dir in uploaded_dirs:
        try:
            if not os.path.exists(uploaded_dir):
                continue
                
            logger.info(f"uploaded 폴더 검색: {uploaded_dir}")
            
            # uploaded 폴더의 모든 파일 검색
            for root, dirs, files in os.walk(uploaded_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    
                    # 테스트 파일인지 확인 (파일명에 test_ 포함)
                    if "test_" in file.lower():
                        try:
                            os.remove(file_path)
                            logger.info(f"uploaded 폴더에서 삭제: {file_path}")
                            deleted_count += 1
                        except Exception as e:
                            logger.error(f"uploaded 폴더에서 삭제 실패: {file_path}, error={e}")
                            
        except Exception as e:
            logger.error(f"uploaded 폴더 처리 오류: {uploaded_dir}, error={e}")
    
    logger.info(f"강제 테스트 파일 정리 완료 (삭제된 파일: {deleted_count}개)")

class TestDataManager:
    """테스트 데이터 관리 클래스"""
    
    def __init__(self, base_url: str = "http://localhost:8000", max_retries: int = 3):
        self.base_url = base_url
        self.max_retries = max_retries
        self.created_brain_ids = []
        self.created_session_ids = []
        self.created_chat_ids = []
        self.created_memo_ids = []
        self.uploaded_file_ids = []
        self.neo4j_test_data = []  # Neo4j 테스트 데이터 추적
        
        # 시그널 핸들러 등록
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """시그널 핸들러 - 강제 종료 시에도 cleanup 실행"""
        logger.warning(f"시그널 {signum} 수신. 테스트 데이터 정리 중...")
        self.cleanup_all()
        cleanup_global_temp_files()
        cleanup_test_files_pattern()
        force_cleanup_all_test_files()  # 강제 정리 추가
        sys.exit(1)
    
    def add_brain_id(self, brain_id: int):
        """생성된 Brain ID 추가"""
        self.created_brain_ids.append(brain_id)
        logger.debug(f"Brain ID 추가: {brain_id}")
    
    def add_session_id(self, session_id: int):
        """생성된 세션 ID 추가"""
        self.created_session_ids.append(session_id)
        logger.debug(f"세션 ID 추가: {session_id}")
    
    def add_chat_id(self, chat_id: int):
        """생성된 채팅 ID 추가"""
        self.created_chat_ids.append(chat_id)
        logger.debug(f"채팅 ID 추가: {chat_id}")
    
    def add_memo_id(self, memo_id: int):
        """생성된 메모 ID 추가"""
        self.created_memo_ids.append(memo_id)
        logger.debug(f"메모 ID 추가: {memo_id}")
    
    def add_file_id(self, file_id: int, file_type: str):
        """업로드된 파일 ID 추가"""
        self.uploaded_file_ids.append((file_id, file_type))
        logger.debug(f"파일 ID 추가: {file_type}_id={file_id}")
    
    def add_neo4j_data(self, node_id: str, node_type: str):
        """Neo4j 테스트 데이터 추가"""
        self.neo4j_test_data.append((node_id, node_type))
        logger.debug(f"Neo4j 데이터 추가: {node_type}_id={node_id}")
    
    def _make_request_with_retry(self, method: str, url: str, **kwargs) -> Optional[requests.Response]:
        """재시도 로직이 포함된 HTTP 요청"""
        for attempt in range(self.max_retries):
            try:
                response = requests.request(method, url, timeout=30, **kwargs)
                return response
            except requests.exceptions.RequestException as e:
                logger.warning(f"요청 실패 (시도 {attempt + 1}/{self.max_retries}): {e}")
                if attempt == self.max_retries - 1:
                    logger.error(f"최대 재시도 횟수 초과: {url}")
                    return None
                time.sleep(1)  # 재시도 전 대기
        return None
    
    def cleanup_all(self):
        """모든 테스트 데이터 정리"""
        logger.info("테스트 데이터 정리 시작...")
        
        cleanup_stats = {
            "chat_messages": {"success": 0, "failed": 0},
            "chat_sessions": {"success": 0, "failed": 0},
            "files": {"success": 0, "failed": 0},
            "memos": {"success": 0, "failed": 0},
            "brains": {"success": 0, "failed": 0},
            "neo4j_data": {"success": 0, "failed": 0}
        }
        
        # 1. 채팅 메시지 삭제
        logger.info(f"채팅 메시지 삭제 중... ({len(self.created_chat_ids)}개)")
        for chat_id in self.created_chat_ids:
            try:
                response = self._make_request_with_retry("DELETE", f"{self.base_url}/chat/{chat_id}")
                if response and response.status_code in [200, 204]:
                    logger.debug(f"채팅 메시지 삭제 성공: chat_id={chat_id}")
                    cleanup_stats["chat_messages"]["success"] += 1
                else:
                    logger.warning(f"채팅 메시지 삭제 실패: chat_id={chat_id}")
                    cleanup_stats["chat_messages"]["failed"] += 1
            except Exception as e:
                logger.error(f"채팅 메시지 삭제 오류: chat_id={chat_id}, error={e}")
                cleanup_stats["chat_messages"]["failed"] += 1
        
        # 2. 채팅 세션 삭제
        logger.info(f"채팅 세션 삭제 중... ({len(self.created_session_ids)}개)")
        for session_id in self.created_session_ids:
            try:
                response = self._make_request_with_retry("DELETE", f"{self.base_url}/chatsession/{session_id}")
                if response and response.status_code in [200, 204]:
                    logger.debug(f"채팅 세션 삭제 성공: session_id={session_id}")
                    cleanup_stats["chat_sessions"]["success"] += 1
                else:
                    logger.warning(f"채팅 세션 삭제 실패: session_id={session_id}")
                    cleanup_stats["chat_sessions"]["failed"] += 1
            except Exception as e:
                logger.error(f"채팅 세션 삭제 오류: session_id={session_id}, error={e}")
                cleanup_stats["chat_sessions"]["failed"] += 1
        
        # 3. 파일 삭제
        logger.info(f"파일 삭제 중... ({len(self.uploaded_file_ids)}개)")
        for file_id, file_type in self.uploaded_file_ids:
            try:
                if file_type == "docx":
                    url = f"{self.base_url}/docxfiles/{file_id}"
                elif file_type == "pdf":
                    url = f"{self.base_url}/pdfs/{file_id}"
                elif file_type == "textfile":
                    url = f"{self.base_url}/textfiles/{file_id}"
                elif file_type == "mds":
                    url = f"{self.base_url}/md/{file_id}"
                else:
                    logger.warning(f"알 수 없는 파일 타입: {file_type}")
                    continue
                
                response = self._make_request_with_retry("DELETE", url)
                if response and response.status_code in [200, 204]:
                    logger.debug(f"파일 삭제 성공: {file_type}_id={file_id}")
                    cleanup_stats["files"]["success"] += 1
                else:
                    logger.warning(f"파일 삭제 실패: {file_type}_id={file_id}")
                    cleanup_stats["files"]["failed"] += 1
            except Exception as e:
                logger.error(f"파일 삭제 오류: {file_type}_id={file_id}, error={e}")
                cleanup_stats["files"]["failed"] += 1
        
        # 4. 메모 삭제
        logger.info(f"메모 삭제 중... ({len(self.created_memo_ids)}개)")
        for memo_id in self.created_memo_ids:
            try:
                response = self._make_request_with_retry("DELETE", f"{self.base_url}/memos/{memo_id}")
                if response and response.status_code in [200, 204]:
                    logger.debug(f"메모 삭제 성공: memo_id={memo_id}")
                    cleanup_stats["memos"]["success"] += 1
                else:
                    logger.warning(f"메모 삭제 실패: memo_id={memo_id}")
                    cleanup_stats["memos"]["failed"] += 1
            except Exception as e:
                logger.error(f"메모 삭제 오류: memo_id={memo_id}, error={e}")
                cleanup_stats["memos"]["failed"] += 1
        
        # 5. Brain 삭제 (마지막에 삭제 - 다른 데이터들이 참조할 수 있음)
        logger.info(f"Brain 삭제 중... ({len(self.created_brain_ids)}개)")
        for brain_id in self.created_brain_ids:
            try:
                response = self._make_request_with_retry("DELETE", f"{self.base_url}/brains/{brain_id}")
                if response and response.status_code in [200, 204]:
                    logger.debug(f"Brain 삭제 성공: brain_id={brain_id}")
                    cleanup_stats["brains"]["success"] += 1
                else:
                    logger.warning(f"Brain 삭제 실패: brain_id={brain_id}")
                    cleanup_stats["brains"]["failed"] += 1
            except Exception as e:
                logger.error(f"Brain 삭제 오류: brain_id={brain_id}, error={e}")
                cleanup_stats["brains"]["failed"] += 1
        
        # 6. Neo4j 테스트 데이터 정리
        if self.neo4j_test_data:
            logger.info(f"Neo4j 테스트 데이터 정리 중... ({len(self.neo4j_test_data)}개)")
            for node_id, node_type in self.neo4j_test_data:
                try:
                    # Neo4j 정리 엔드포인트가 있다면 사용
                    response = self._make_request_with_retry("DELETE", f"{self.base_url}/brainGraph/cleanup-test-data/{node_id}")
                    if response and response.status_code in [200, 204]:
                        logger.debug(f"Neo4j 데이터 정리 성공: {node_type}_id={node_id}")
                        cleanup_stats["neo4j_data"]["success"] += 1
                    else:
                        logger.warning(f"Neo4j 데이터 정리 실패: {node_type}_id={node_id}")
                        cleanup_stats["neo4j_data"]["failed"] += 1
                except Exception as e:
                    logger.error(f"Neo4j 데이터 정리 오류: {node_type}_id={node_id}, error={e}")
                    cleanup_stats["neo4j_data"]["failed"] += 1
        
        # 정리 통계 출력
        self._print_cleanup_stats(cleanup_stats)
        
        # 상태 초기화
        self.reset()
        
        logger.info("테스트 데이터 정리 완료!")
    
    def _print_cleanup_stats(self, stats: Dict[str, Dict[str, int]]):
        """정리 통계 출력"""
        print("\n" + "="*60)
        print("[정리] 테스트 데이터 정리 통계")
        print("="*60)
        
        total_success = 0
        total_failed = 0
        
        for category, counts in stats.items():
            success = counts["success"]
            failed = counts["failed"]
            total = success + failed
            
            if total > 0:
                success_rate = (success / total * 100) if total > 0 else 0
                print(f"[{category.upper()}] 성공: {success}개, 실패: {failed}개 (성공률: {success_rate:.1f}%)")
                total_success += success
                total_failed += failed
        
        total_items = total_success + total_failed
        if total_items > 0:
            overall_success_rate = (total_success / total_items * 100)
            print(f"\n[전체] 총 {total_items}개 항목 중 {total_success}개 성공 (전체 성공률: {overall_success_rate:.1f}%)")
        
        print("="*60)
    
    def reset(self):
        """관리자 상태 초기화"""
        self.created_brain_ids.clear()
        self.created_session_ids.clear()
        self.created_chat_ids.clear()
        self.created_memo_ids.clear()
        self.uploaded_file_ids.clear()
        self.neo4j_test_data.clear()
        logger.debug("TestDataManager 상태 초기화 완료")

@contextmanager
def test_transaction(base_url: str = "http://localhost:8000", max_retries: int = 3):
    """테스트 트랜잭션 컨텍스트 매니저"""
    manager = TestDataManager(base_url, max_retries)
    try:
        logger.info("테스트 트랜잭션 시작")
        yield manager
        logger.info("테스트 트랜잭션 성공")
    except Exception as e:
        logger.error(f"테스트 실행 중 예외 발생: {e}")
        raise
    finally:
        logger.info("테스트 데이터 정리 시작 (finally 블록)")
        try:
            manager.cleanup_all()
            # 전역 임시 파일 정리
            cleanup_global_temp_files()
            # 테스트 파일 패턴 정리
            cleanup_test_files_pattern()
            # 강제 테스트 파일 정리
            force_cleanup_all_test_files()
        except Exception as cleanup_error:
            logger.error(f"데이터 정리 중 예외 발생: {cleanup_error}")

def cleanup_test_data(base_url: str = "http://localhost:8000"):
    """전역 테스트 데이터 정리 함수"""
    logger.info("전역 테스트 데이터 정리 시작")
    manager = TestDataManager(base_url)
    manager.cleanup_all()
    cleanup_global_temp_files()
    cleanup_test_files_pattern()

def force_cleanup_all(base_url: str = "http://localhost:8000"):
    """강제로 모든 테스트 데이터 정리 (예외 처리 포함)"""
    logger.info("강제 테스트 데이터 정리 시작")
    try:
        manager = TestDataManager(base_url)
        manager.cleanup_all()
        cleanup_global_temp_files()
        cleanup_test_files_pattern()
        logger.info("강제 정리 완료")
    except Exception as e:
        logger.error(f"강제 정리 중 예외 발생: {e}")

def check_server_health(base_url: str = "http://localhost:8000") -> bool:
    """서버 상태 확인"""
    try:
        response = requests.get(f"{base_url}/docs", timeout=10)
        if response.status_code == 200:
            logger.info("서버 상태 확인 성공")
            return True
        else:
            logger.warning(f"서버 응답 오류: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        logger.error(f"서버 연결 실패: {e}")
        return False

def wait_for_server(base_url: str = "http://localhost:8000", max_wait: int = 60) -> bool:
    """서버 시작 대기"""
    logger.info(f"서버 시작 대기 중... (최대 {max_wait}초)")
    
    for i in range(max_wait):
        if check_server_health(base_url):
            logger.info(f"서버 준비 완료 ({i+1}초 소요)")
            return True
        time.sleep(1)
    
    logger.error(f"서버 시작 대기 시간 초과 ({max_wait}초)")
    return False 