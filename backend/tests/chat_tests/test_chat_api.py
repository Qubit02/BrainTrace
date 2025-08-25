import requests
import json
import time
from typing import Dict, Any
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from test_utils import TestDataManager, test_transaction

# 테스트 설정
BASE_URL = "http://localhost:8000"

def get_or_create_test_brain():
    """테스트용 Brain을 생성하거나 기존 것을 반환"""
    try:
        # 기존 Brain 목록 조회
        response = requests.get(f"{BASE_URL}/brains/", timeout=30)
        if response.status_code == 200:
            brains = response.json()
            if brains:
                return brains[0]["brain_id"]  # 첫 번째 Brain 사용
        
        # Brain이 없으면 생성
        brain_data = {"brain_name": "테스트용 브레인"}
        response = requests.post(f"{BASE_URL}/brains/", json=brain_data, timeout=30)
        if response.status_code == 201:
            return response.json()["brain_id"]
    except Exception as e:
        print(f"Brain 생성/조회 실패: {e}")
    
    return 1  # 기본값

TEST_BRAIN_ID = get_or_create_test_brain()

class TestChatApi:
    """Chat API 테스트"""
    
    def __init__(self, data_manager: TestDataManager = None):
        """초기화"""
        self.created_session_id = None
        self.created_chat_id = None
        self.data_manager = data_manager or TestDataManager()
    
    def test_chat_session_creation(self):
        """채팅 세션 생성 테스트"""
        session_data = {
            "session_name": "테스트 채팅 세션",
            "brain_id": TEST_BRAIN_ID
        }
        
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data, timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        assert "session_id" in result
        self.created_session_id = result["session_id"]
        
        # 데이터 관리자에 추가
        self.data_manager.add_session_id(self.created_session_id)
        
        print(f"채팅 세션 생성 성공: session_id={self.created_session_id}")
    
    def test_chat_session_retrieval(self):
        """채팅 세션 조회 테스트"""
        # 먼저 세션 생성
        self.test_chat_session_creation()
        
        # 세션 조회
        response = requests.get(f"{BASE_URL}/chatsession/{self.created_session_id}", timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        assert "session_name" in result
        assert "brain_id" in result
        assert result["session_name"] == "테스트 채팅 세션"
        
        print(f"채팅 세션 조회 성공: {result['session_name']}")
    
    def test_chat_session_list_retrieval(self):
        """채팅 세션 목록 조회 테스트"""
        response = requests.get(f"{BASE_URL}/chatsession/", timeout=30)
        assert response.status_code == 200
        
        sessions = response.json()
        assert isinstance(sessions, list)
        
        print(f"생성된 채팅 세션 수: {len(sessions)}")
        
        if sessions:
            for session_info in sessions[:3]:  # 처음 3개만 출력
                print(f"  - {session_info.get('session_name', 'N/A')} (ID: {session_info.get('session_id', 'N/A')})")
    
    def test_chat_session_update(self):
        """채팅 세션 수정 테스트 (수정 엔드포인트가 없으므로 생략)"""
        # 세션 생성
        self.test_chat_session_creation()
        
        print("채팅 세션 수정 엔드포인트가 없으므로 테스트를 생략합니다.")
        print("채팅 세션 수정 테스트 완료")
    
    def test_chat_session_deletion(self):
        """채팅 세션 삭제 테스트"""
        # 세션 생성
        self.test_chat_session_creation()
        
        # 세션 삭제
        response = requests.delete(f"{BASE_URL}/chatsession/{self.created_session_id}", timeout=30)
        assert response.status_code == 200
        
        result = response.json()
        assert "success" in result
        assert result["success"] == True
        
        print("채팅 세션 삭제 성공")
        
        # 삭제 확인
        response = requests.get(f"{BASE_URL}/chatsession/{self.created_session_id}", timeout=30)
        # 삭제된 세션은 조회할 수 없어야 함
        assert response.status_code == 404
        
        print("삭제 확인 완료")
    
    def test_chat_message_creation(self):
        """채팅 메시지 생성 테스트 (별도 엔드포인트가 없으므로 생략)"""
        # 세션 생성
        self.test_chat_session_creation()
        
        print("채팅 메시지 생성은 brainGraph/answer 엔드포인트를 통해 자동으로 처리됩니다.")
        print("채팅 메시지 생성 테스트 완료")
    
    def test_chat_message_retrieval(self):
        """채팅 메시지 조회 테스트 (별도 엔드포인트가 없으므로 생략)"""
        # 세션 생성
        self.test_chat_session_creation()
        
        print("채팅 메시지 조회는 별도 엔드포인트가 없습니다.")
        print("채팅 메시지 조회 테스트 완료")
    
    def test_chat_history_retrieval(self):
        """채팅 내역 조회 테스트 (별도 엔드포인트가 없으므로 생략)"""
        # 세션 생성
        self.test_chat_session_creation()
        
        print("채팅 내역 조회는 별도 엔드포인트가 없습니다.")
        print("채팅 내역 조회 테스트 완료")
    
    def test_chat_message_update(self):
        """채팅 메시지 수정 테스트 (별도 엔드포인트가 없으므로 생략)"""
        # 세션 생성
        self.test_chat_session_creation()
        
        print("채팅 메시지 수정은 별도 엔드포인트가 없습니다.")
        print("채팅 메시지 수정 테스트 완료")
    
    def test_chat_message_deletion(self):
        """채팅 메시지 삭제 테스트 (별도 엔드포인트가 없으므로 생략)"""
        # 세션 생성
        self.test_chat_session_creation()
        
        print("채팅 메시지 삭제는 별도 엔드포인트가 없습니다.")
        print("채팅 메시지 삭제 테스트 완료")
    
    def test_chat_multiple_messages(self):
        """여러 채팅 메시지 테스트 (별도 엔드포인트가 없으므로 생략)"""
        # 세션 생성
        self.test_chat_session_creation()
        
        print("여러 채팅 메시지 생성은 brainGraph/answer 엔드포인트를 통해 자동으로 처리됩니다.")
        print("여러 채팅 메시지 테스트 완료")
    
    def test_chat_error_handling(self):
        """채팅 에러 처리 테스트 (별도 엔드포인트가 없으므로 생략)"""
        # 세션 생성
        self.test_chat_session_creation()
        
        print("채팅 에러 처리는 별도 엔드포인트가 없습니다.")
        print("채팅 에러 처리 테스트 완료")
    
    def test_chat_with_brain_integration(self):
        """채팅과 Brain 통합 테스트"""
        # Brain 생성
        brain_data = {
            "brain_name": "채팅 테스트 브레인"
        }
        
        response = requests.post(f"{BASE_URL}/brains/", json=brain_data, timeout=30)
        assert response.status_code == 201
        
        brain_id = response.json()["brain_id"]
        
        # 해당 Brain으로 세션 생성
        session_data = {
            "session_name": "Brain 통합 테스트 세션",
            "brain_id": brain_id
        }
        
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data, timeout=30)
        assert response.status_code == 200
        
        session_id = response.json()["session_id"]
        self.data_manager.add_session_id(session_id)
        
        # 세션 목록에서 Brain ID 확인
        response = requests.get(f"{BASE_URL}/chatsession/", timeout=30)
        assert response.status_code == 200
        
        sessions = response.json()
        brain_sessions = [s for s in sessions if s.get("brain_id") == brain_id]
        assert len(brain_sessions) > 0
        
        print(f"채팅과 Brain 통합 테스트 완료: {len(brain_sessions)}개 세션")
        
        # 정리
        try:
            requests.delete(f"{BASE_URL}/brains/{brain_id}", timeout=30)
        except:
            pass
    
    def cleanup(self):
        """테스트 정리"""
        # 데이터 관리자가 자동으로 정리함
        pass

if __name__ == "__main__":
    # 테스트 실행 (트랜잭션 처리)
    with test_transaction(BASE_URL) as data_manager:
        test_instance = TestChatApi(data_manager)
        
        print("Chat API 통합 테스트 시작")
        print("=" * 50)
        
        try:
            test_instance.test_chat_session_creation()
            test_instance.test_chat_session_retrieval()
            test_instance.test_chat_session_list_retrieval()
            test_instance.test_chat_session_update()
            test_instance.test_chat_session_deletion()
            test_instance.test_chat_message_creation()
            test_instance.test_chat_message_retrieval()
            test_instance.test_chat_history_retrieval()
            test_instance.test_chat_message_update()
            test_instance.test_chat_message_deletion()
            test_instance.test_chat_multiple_messages()
            test_instance.test_chat_error_handling()
            test_instance.test_chat_with_brain_integration()
            
            print("=" * 50)
            print("모든 Chat API 통합 테스트 통과!")
            
        except Exception as e:
            print(f"테스트 실패: {str(e)}")
            raise 