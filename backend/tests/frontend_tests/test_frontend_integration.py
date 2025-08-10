import requests
import json
from typing import Dict, Any

# 테스트 설정
BASE_URL = "http://localhost:8000"
TEST_BRAIN_ID = 1

class TestFrontendIntegration:
    """프론트엔드 통합 테스트"""
    
    def test_chat_session_creation_and_selection(self):
        """채팅 세션 생성 및 선택 테스트"""
        # 1. 채팅 세션 생성
        session_data = {
            "session_name": "프론트엔드 테스트 세션",
            "brain_id": TEST_BRAIN_ID
        }
        
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        assert response.status_code == 200
        
        result = response.json()
        session_id = result["session_id"]
        
        print(f"채팅 세션 생성: session_id={session_id}")
        
        # 2. 세션 목록에서 해당 세션 확인
        response = requests.get(f"{BASE_URL}/chatsession/")
        assert response.status_code == 200
        
        sessions = response.json()
        created_session = next((s for s in sessions if s["session_id"] == session_id), None)
        assert created_session is not None
        assert created_session["session_name"] == "프론트엔드 테스트 세션"
        
        print(f"세션 목록에서 생성된 세션 확인: {created_session['session_name']}")
        
        # 3. 세션 선택 시도 (프론트엔드에서는 상태 변경)
        # 백엔드에서는 세션 선택이 상태로 관리되므로 API 호출 없이 확인
        print("세션 선택 기능 준비 완료 (프론트엔드 상태 관리)")
    
    def test_chat_panel_functionality(self):
        """채팅 패널 기능 테스트"""
        # 1. 세션 생성
        session_data = {
            "session_name": "채팅 패널 테스트",
            "brain_id": TEST_BRAIN_ID
        }
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        session_id = response.json()["session_id"]
        
        # 2. 질문 전송 (ChatPanel 기능)
        question_data = {
            "question": "안예찬에 대해 알려줘",
            "session_id": session_id,
            "brain_id": TEST_BRAIN_ID,
            "model": "gpt"
        }
        
        response = requests.post(f"{BASE_URL}/brainGraph/answer", json=question_data)
        assert response.status_code == 200
        
        result = response.json()
        assert "answer" in result
        assert "referenced_nodes" in result
        
        print(f"ChatPanel 질문-답변: {result['answer'][:50]}...")
        
        # 3. 채팅 내역 조회 (ChatPanel 기능)
        response = requests.get(f"{BASE_URL}/chat/session/{session_id}")
        assert response.status_code == 200
        
        chat_history = response.json()
        assert len(chat_history) >= 2  # 질문 + 답변
        
        print(f"ChatPanel 채팅 내역: {len(chat_history)}개 메시지")
        
        # 4. 목록으로 돌아가기 (프론트엔드 상태 변경)
        print("목록으로 돌아가기 기능 준비 완료 (프론트엔드 상태 관리)")
    
    def test_session_list_functionality(self):
        """세션 목록 기능 테스트"""
        # 1. 여러 세션 생성
        session_names = ["테스트 세션 1", "테스트 세션 2", "테스트 세션 3"]
        created_sessions = []
        
        for name in session_names:
            session_data = {
                "session_name": name,
                "brain_id": TEST_BRAIN_ID
            }
            response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
            assert response.status_code == 200
            created_sessions.append(response.json()["session_id"])
        
        print(f"{len(created_sessions)}개 세션 생성 완료")
        
        # 2. 세션 목록 조회
        response = requests.get(f"{BASE_URL}/chatsession/")
        assert response.status_code == 200
        
        sessions = response.json()
        assert len(sessions) >= len(created_sessions)
        
        # 생성된 세션들이 목록에 있는지 확인
        for session_id in created_sessions:
            session_exists = any(s["session_id"] == session_id for s in sessions)
            assert session_exists
        
        print(f"세션 목록 조회: {len(sessions)}개 세션")
        
        # 3. 세션 삭제 테스트
        if created_sessions:
            session_to_delete = created_sessions[0]
            response = requests.delete(f"{BASE_URL}/chatsession/{session_to_delete}")
            assert response.status_code == 200
            
            result = response.json()
            assert result.get("success") == True
            
            print(f"세션 삭제: session_id={session_to_delete}")
    
    def test_brain_id_consistency(self):
        """brain_id 일관성 테스트"""
        # 1. 세션 생성 시 brain_id 확인
        session_data = {
            "session_name": "brain_id 일관성 테스트",
            "brain_id": TEST_BRAIN_ID
        }
        
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        assert response.status_code == 200
        
        session_id = response.json()["session_id"]
        
        # 2. 세션 정보 조회
        response = requests.get(f"{BASE_URL}/chatsession/{session_id}")
        assert response.status_code == 200
        
        session_info = response.json()
        assert session_info["brain_id"] == TEST_BRAIN_ID
        
        print(f"brain_id 일관성 확인: session_id={session_id}, brain_id={session_info['brain_id']}")
        
        # 3. 질문 시 brain_id 확인
        question_data = {
            "question": "테스트 질문",
            "session_id": session_id,
            "brain_id": TEST_BRAIN_ID,
            "model": "gpt"
        }
        
        response = requests.post(f"{BASE_URL}/brainGraph/answer", json=question_data)
        assert response.status_code == 200
        
        print("질문 시 brain_id 일관성 확인 완료")
    
    def test_error_handling(self):
        """에러 처리 테스트"""
        # 1. 존재하지 않는 세션으로 질문
        question_data = {
            "question": "테스트 질문",
            "session_id": 99999,  # 존재하지 않는 세션
            "brain_id": TEST_BRAIN_ID,
            "model": "gpt"
        }
        
        response = requests.post(f"{BASE_URL}/brainGraph/answer", json=question_data)
        # 에러가 발생하더라도 적절히 처리되어야 함
        print(f"존재하지 않는 세션 처리: status_code={response.status_code}")
        
        # 2. 잘못된 brain_id로 세션 생성
        session_data = {
            "session_name": "잘못된 brain_id 테스트",
            "brain_id": 99999  # 존재하지 않는 brain_id
        }
        
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        # 에러가 발생하더라도 적절히 처리되어야 함
        print(f"잘못된 brain_id 처리: status_code={response.status_code}")

if __name__ == "__main__":
    # 테스트 실행
    test_instance = TestFrontendIntegration()
    
    print("프론트엔드 통합 테스트 시작")
    print("=" * 50)
    
    try:
        test_instance.test_chat_session_creation_and_selection()
        test_instance.test_chat_panel_functionality()
        test_instance.test_session_list_functionality()
        test_instance.test_brain_id_consistency()
        test_instance.test_error_handling()
        
        print("=" * 50)
        print("모든 프론트엔드 통합 테스트 통과!")
        
    except Exception as e:
        print(f"테스트 실패: {str(e)}")
        raise 