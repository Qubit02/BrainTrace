import requests
import json
import time
from typing import Dict, Any

# 테스트 설정
BASE_URL = "http://localhost:8000"
TEST_BRAIN_ID = 1

class TestChatIntegration:
    """채팅 시스템 통합 테스트"""
    
    def setup_method(self):
        """각 테스트 전에 실행되는 설정"""
        self.session_id = None
        self.chat_ids = []
    
    def test_create_chat_session(self):
        """채팅 세션 생성 테스트"""
        # 채팅 세션 생성
        session_data = {
            "session_name": "테스트 채팅방",
            "brain_id": TEST_BRAIN_ID
        }
        
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        assert response.status_code == 200
        
        result = response.json()
        assert "session_id" in result
        self.session_id = result["session_id"]
        
        print(f"채팅 세션 생성 성공: session_id={self.session_id}")
    
    def test_fetch_chat_sessions(self):
        """채팅 세션 목록 조회 테스트"""
        response = requests.get(f"{BASE_URL}/chatsession/")
        assert response.status_code == 200
        
        sessions = response.json()
        assert isinstance(sessions, list)
        
        print(f"채팅 세션 목록 조회 성공: {len(sessions)}개 세션")
    
    def test_chat_question_answer(self):
        """질문-답변 테스트"""
        # 먼저 세션 생성
        session_data = {
            "session_name": "QA 테스트 세션",
            "brain_id": TEST_BRAIN_ID
        }
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        session_id = response.json()["session_id"]
        
        # 질문 전송
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
        
        print(f"질문-답변 성공: {result['answer'][:50]}...")
        print(f"참조 노드: {result['referenced_nodes']}")
        
        # 채팅 내역 조회
        response = requests.get(f"{BASE_URL}/chat/session/{session_id}")
        assert response.status_code == 200
        
        chat_history = response.json()
        assert len(chat_history) >= 2  # 질문 + 답변
        
        print(f"채팅 내역 조회 성공: {len(chat_history)}개 메시지")
    
    def test_neo4j_sync_functionality(self):
        """Neo4j 동기화 기능 테스트"""
        # 임베딩 벡터 DB 내용 확인
        response = requests.get(f"{BASE_URL}/brainGraph/sourceCount/{TEST_BRAIN_ID}")
        assert response.status_code == 200
        
        source_count = response.json()
        print(f"소스 개수 조회: {source_count}")
        
        # 그래프 데이터 조회
        response = requests.get(f"{BASE_URL}/brainGraph/getNodeEdge/{TEST_BRAIN_ID}")
        assert response.status_code == 200
        
        graph_data = response.json()
        assert "nodes" in graph_data
        assert "links" in graph_data
        
        print(f"그래프 데이터 조회: {len(graph_data['nodes'])}개 노드, {len(graph_data['links'])}개 관계")
    
    def test_multiple_questions(self):
        """여러 질문 연속 테스트"""
        # 세션 생성
        session_data = {
            "session_name": "다중 질문 테스트",
            "brain_id": TEST_BRAIN_ID
        }
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        session_id = response.json()["session_id"]
        
        questions = [
            "안예찬에 대해 알려줘",
            "강아지에 대해 알려줘",
            "태양에 대해 알려줘"
        ]
        
        for i, question in enumerate(questions):
            question_data = {
                "question": question,
                "session_id": session_id,
                "brain_id": TEST_BRAIN_ID,
                "model": "gpt"
            }
            
            response = requests.post(f"{BASE_URL}/brainGraph/answer", json=question_data)
            assert response.status_code == 200
            
            result = response.json()
            print(f"질문 {i+1}: {question}")
            print(f"   답변: {result['answer'][:50]}...")
            print(f"   참조 노드: {result['referenced_nodes']}")
            
            # 질문 간 간격
            time.sleep(1)
    
    def test_chat_session_cleanup(self):
        """채팅 세션 정리 테스트"""
        # 테스트용 세션 생성
        session_data = {
            "session_name": "정리 테스트 세션",
            "brain_id": TEST_BRAIN_ID
        }
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        session_id = response.json()["session_id"]
        
        # 세션 삭제
        response = requests.delete(f"{BASE_URL}/chatsession/{session_id}")
        assert response.status_code == 200
        
        result = response.json()
        assert result.get("success") == True
        
        print(f"채팅 세션 삭제 성공: session_id={session_id}")

if __name__ == "__main__":
    # 테스트 실행
    test_instance = TestChatIntegration()
    
    print("채팅 통합 테스트 시작")
    print("=" * 50)
    
    try:
        test_instance.test_create_chat_session()
        test_instance.test_fetch_chat_sessions()
        test_instance.test_chat_question_answer()
        test_instance.test_neo4j_sync_functionality()
        test_instance.test_multiple_questions()
        test_instance.test_chat_session_cleanup()
        
        print("=" * 50)
        print("모든 테스트 통과!")
        
    except Exception as e:
        print(f"테스트 실패: {str(e)}")
        raise 