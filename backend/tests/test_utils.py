import requests
import time
from typing import List, Dict, Any
from contextlib import contextmanager

class TestDataManager:
    """테스트 데이터 관리 클래스"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.created_brain_ids = []
        self.created_session_ids = []
        self.created_chat_ids = []
        self.created_memo_ids = []
        self.uploaded_file_ids = []
    
    def add_brain_id(self, brain_id: int):
        """생성된 Brain ID 추가"""
        self.created_brain_ids.append(brain_id)
    
    def add_session_id(self, session_id: int):
        """생성된 세션 ID 추가"""
        self.created_session_ids.append(session_id)
    
    def add_chat_id(self, chat_id: int):
        """생성된 채팅 ID 추가"""
        self.created_chat_ids.append(chat_id)
    
    def add_memo_id(self, memo_id: int):
        """생성된 메모 ID 추가"""
        self.created_memo_ids.append(memo_id)
    
    def add_file_id(self, file_id: int, file_type: str):
        """업로드된 파일 ID 추가"""
        self.uploaded_file_ids.append((file_id, file_type))
    
    def cleanup_all(self):
        """모든 테스트 데이터 정리"""
        print("\n[정리] 테스트 데이터 정리 시작...")
        
        # 채팅 메시지 삭제
        for chat_id in self.created_chat_ids:
            try:
                response = requests.delete(f"{self.base_url}/chat/{chat_id}")
                if response.status_code in [200, 204]:
                    print(f"  [성공] 채팅 메시지 삭제: chat_id={chat_id}")
            except Exception as e:
                print(f"  ❌ 채팅 메시지 삭제 실패: chat_id={chat_id}, error={e}")
        
        # 채팅 세션 삭제
        for session_id in self.created_session_ids:
            try:
                response = requests.delete(f"{self.base_url}/chatsession/{session_id}")
                if response.status_code in [200, 204]:
                    print(f"  [성공] 채팅 세션 삭제: session_id={session_id}")
            except Exception as e:
                print(f"  ❌ 채팅 세션 삭제 실패: session_id={session_id}, error={e}")
        
        # 파일 삭제
        for file_id, file_type in self.uploaded_file_ids:
            try:
                if file_type == "docx":
                    response = requests.delete(f"{self.base_url}/docxfiles/{file_id}")
                elif file_type == "pdf":
                    response = requests.delete(f"{self.base_url}/pdfs/{file_id}")
                elif file_type == "textfile":
                    response = requests.delete(f"{self.base_url}/textfiles/{file_id}")
                elif file_type == "mds":
                    response = requests.delete(f"{self.base_url}/md/{file_id}")
                
                if response.status_code in [200, 204]:
                    print(f"  [성공] 파일 삭제: {file_type}_id={file_id}")
            except Exception as e:
                print(f"  ❌ 파일 삭제 실패: {file_type}_id={file_id}, error={e}")
        
        # 메모 삭제
        for memo_id in self.created_memo_ids:
            try:
                response = requests.delete(f"{self.base_url}/memos/{memo_id}")
                if response.status_code in [200, 204]:
                    print(f"  [성공] 메모 삭제: memo_id={memo_id}")
            except Exception as e:
                print(f"  ❌ 메모 삭제 실패: memo_id={memo_id}, error={e}")
        
        # Brain 삭제 (마지막에 삭제 - 다른 데이터들이 참조할 수 있음)
        for brain_id in self.created_brain_ids:
            try:
                response = requests.delete(f"{self.base_url}/brains/{brain_id}")
                if response.status_code in [200, 204]:
                    print(f"  [성공] Brain 삭제: brain_id={brain_id}")
            except Exception as e:
                print(f"  ❌ Brain 삭제 실패: brain_id={brain_id}, error={e}")
        
        print("[완료] 테스트 데이터 정리 완료!")
    
    def reset(self):
        """관리자 상태 초기화"""
        self.created_brain_ids.clear()
        self.created_session_ids.clear()
        self.created_chat_ids.clear()
        self.created_memo_ids.clear()
        self.uploaded_file_ids.clear()

@contextmanager
def test_transaction(base_url: str = "http://localhost:8000"):
    """테스트 트랜잭션 컨텍스트 매니저"""
    manager = TestDataManager(base_url)
    try:
        yield manager
    except Exception as e:
        print(f"[오류] 테스트 실행 중 예외 발생: {e}")
        raise
    finally:
        print("[정리] 테스트 데이터 정리 시작 (finally 블록)")
        try:
            manager.cleanup_all()
        except Exception as cleanup_error:
            print(f"[오류] 데이터 정리 중 예외 발생: {cleanup_error}")

def cleanup_test_data():
    """전역 테스트 데이터 정리 함수"""
    manager = TestDataManager()
    manager.cleanup_all()

def force_cleanup_all():
    """강제로 모든 테스트 데이터 정리 (예외 처리 포함)"""
    try:
        manager = TestDataManager()
        manager.cleanup_all()
        print("[완료] 강제 정리 완료")
    except Exception as e:
        print(f"[오류] 강제 정리 중 예외 발생: {e}") 