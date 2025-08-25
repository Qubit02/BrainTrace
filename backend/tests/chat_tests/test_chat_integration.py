import requests
import json
import time
import signal
import sys
from typing import Dict, Any

# 테스트 설정
BASE_URL = "http://localhost:8000"

def get_or_create_test_brain():
    """테스트용 Brain을 생성하거나 기존 것을 반환"""
    try:
        # 기존 Brain 목록 조회
        response = requests.get(f"{BASE_URL}/brains/")
        if response.status_code == 200:
            brains = response.json()
            if brains:
                return brains[0]["brain_id"]  # 첫 번째 Brain 사용
        
        # Brain이 없으면 생성
        brain_data = {"brain_name": "테스트용 브레인"}
        response = requests.post(f"{BASE_URL}/brains/", json=brain_data)
        if response.status_code == 201:
            return response.json()["brain_id"]
    except Exception as e:
        print(f"Brain 생성/조회 실패: {e}")
    
    return 1  # 기본값

TEST_BRAIN_ID = get_or_create_test_brain()

class TestChatIntegration:
    """채팅 시스템 통합 테스트"""
    
    def __init__(self):
        self.created_session_ids = []
        self.created_chat_ids = []
        self.session_id = None
        self.chat_ids = []
        # 시그널 핸들러 등록
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """시그널 핸들러 - 강제 종료 시에도 cleanup 실행"""
        print(f"\n시그널 {signum} 수신. 테스트 데이터 정리 중...")
        self.cleanup()
        sys.exit(1)

    def __enter__(self):
        """Context manager 진입"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager 종료 - 예외 발생 여부와 관계없이 cleanup 실행"""
        self.cleanup()

    def setup_method(self):
        """각 테스트 전에 실행되는 설정"""
        self.session_id = None
        self.chat_ids = []
    
    def test_create_chat_session(self):
        """채팅 세션 생성 테스트"""
        try:
            # 채팅 세션 생성
            session_data = {
                "session_name": "테스트 채팅방",
                "brain_id": TEST_BRAIN_ID
            }
            
            response = requests.post(f"{BASE_URL}/chatsession/", json=session_data, timeout=30)
            assert response.status_code == 200
            
            result = response.json()
            assert "session_id" in result
            self.session_id = result["session_id"]
            self.created_session_ids.append(self.session_id)
            
            print(f"채팅 세션 생성 성공: session_id={self.session_id}")
        except Exception as e:
            print(f"채팅 세션 생성 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_fetch_chat_sessions(self):
        """채팅 세션 목록 조회 테스트"""
        try:
            response = requests.get(f"{BASE_URL}/chatsession/", timeout=30)
            assert response.status_code == 200
            
            sessions = response.json()
            assert isinstance(sessions, list)
            
            print(f"채팅 세션 목록 조회 성공: {len(sessions)}개 세션")
        except Exception as e:
            print(f"채팅 세션 목록 조회 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_chat_question_answer(self):
        """질문-답변 테스트"""
        try:
            # 먼저 세션 생성
            session_data = {
                "session_name": "QA 테스트 세션",
                "brain_id": TEST_BRAIN_ID
            }
            response = requests.post(f"{BASE_URL}/chatsession/", json=session_data, timeout=30)
            session_id = response.json()["session_id"]
            self.created_session_ids.append(session_id)
            
            # 질문 전송
            question_data = {
                "question": "안예찬에 대해 알려줘",
                "session_id": session_id,
                "brain_id": TEST_BRAIN_ID,
                "model": "gpt"
            }
            
            response = requests.post(f"{BASE_URL}/brainGraph/answer", json=question_data, timeout=60)
            assert response.status_code == 200
            
            result = response.json()
            assert "answer" in result
            assert "referenced_nodes" in result
            
            print(f"질문-답변 성공: {result['answer'][:50]}...")
            print(f"참조 노드: {result['referenced_nodes']}")
            
            # 채팅 내역 조회
            response = requests.get(f"{BASE_URL}/chat/session/{session_id}", timeout=30)
            assert response.status_code == 200
            
            chat_history = response.json()
            assert len(chat_history) >= 2  # 질문 + 답변
            
            print(f"채팅 내역 조회 성공: {len(chat_history)}개 메시지")
        except Exception as e:
            print(f"질문-답변 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_neo4j_sync_functionality(self):
        """Neo4j 동기화 기능 테스트"""
        try:
            # 임베딩 벡터 DB 내용 확인
            response = requests.get(f"{BASE_URL}/brainGraph/sourceCount/{TEST_BRAIN_ID}", timeout=30)
            assert response.status_code == 200
            
            source_count = response.json()
            print(f"소스 개수 조회: {source_count}")
            
            # 그래프 데이터 조회
            response = requests.get(f"{BASE_URL}/brainGraph/getNodeEdge/{TEST_BRAIN_ID}", timeout=30)
            assert response.status_code == 200
            
            graph_data = response.json()
            assert "nodes" in graph_data
            assert "links" in graph_data
            
            print(f"그래프 데이터 조회: {len(graph_data['nodes'])}개 노드, {len(graph_data['links'])}개 관계")
        except Exception as e:
            print(f"Neo4j 동기화 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_multiple_questions(self):
        """여러 질문 연속 테스트"""
        try:
            # 세션 생성
            session_data = {
                "session_name": "다중 질문 테스트",
                "brain_id": TEST_BRAIN_ID
            }
            response = requests.post(f"{BASE_URL}/chatsession/", json=session_data, timeout=30)
            session_id = response.json()["session_id"]
            self.created_session_ids.append(session_id)
            
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
                
                response = requests.post(f"{BASE_URL}/brainGraph/answer", json=question_data, timeout=60)
                assert response.status_code == 200
                
                result = response.json()
                print(f"질문 {i+1}: {question}")
                print(f"   답변: {result['answer'][:50]}...")
                print(f"   참조 노드: {result['referenced_nodes']}")
                
                # 질문 간 간격
                time.sleep(1)
        except Exception as e:
            print(f"다중 질문 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_chat_session_cleanup(self):
        """채팅 세션 정리 테스트"""
        try:
            # 테스트용 세션 생성
            session_data = {
                "session_name": "정리 테스트 세션",
                "brain_id": TEST_BRAIN_ID
            }
            response = requests.post(f"{BASE_URL}/chatsession/", json=session_data, timeout=30)
            session_id = response.json()["session_id"]
            self.created_session_ids.append(session_id)
            
            # 세션 삭제
            response = requests.delete(f"{BASE_URL}/chatsession/{session_id}", timeout=30)
            assert response.status_code == 200
            
            result = response.json()
            assert result.get("success") == True
            
            print(f"채팅 세션 삭제 성공: session_id={session_id}")
        except Exception as e:
            print(f"채팅 세션 정리 테스트 실패: {e}")
            self.cleanup()
            raise

    def cleanup(self):
        """테스트 데이터 정리"""
        print("\n=== 테스트 데이터 정리 시작 ===")
        
        # 1. 생성된 채팅 세션 삭제
        for session_id in self.created_session_ids:
            try:
                response = requests.delete(f"{BASE_URL}/chatsession/{session_id}", timeout=30)
                if response.status_code in [200, 204]:
                    print(f"[정리] 채팅 세션 삭제 성공: session_id={session_id}")
                else:
                    print(f"[정리] 채팅 세션 삭제 실패: session_id={session_id}, status={response.status_code}")
            except Exception as e:
                print(f"[정리] 채팅 세션 삭제 오류: session_id={session_id}, error={e}")
        
        # 2. 생성된 채팅 메시지 삭제 (세션 삭제로 함께 정리되지만 확인)
        for chat_id in self.created_chat_ids:
            try:
                response = requests.delete(f"{BASE_URL}/chat/{chat_id}", timeout=30)
                if response.status_code in [200, 204]:
                    print(f"[정리] 채팅 메시지 삭제 성공: chat_id={chat_id}")
            except Exception as e:
                print(f"[정리] 채팅 메시지 삭제 오류: chat_id={chat_id}, error={e}")
        
        # 3. Neo4j 테스트 데이터 정리 (필요시)
        try:
            # 테스트용 노드나 관계가 있다면 정리
            # response = requests.delete(f"{BASE_URL}/brainGraph/cleanup-test-data/{TEST_BRAIN_ID}")
            pass
        except Exception as e:
            print(f"[정리] Neo4j 테스트 데이터 정리 오류: {e}")
        
        # 4. 리스트 초기화
        self.created_session_ids.clear()
        self.created_chat_ids.clear()
        
        print("=== 테스트 데이터 정리 완료 ===\n")

if __name__ == "__main__":
    # Context manager를 사용한 안전한 테스트 실행
    with TestChatIntegration() as test_instance:
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
            print("예외 발생으로 인한 데이터 정리 수행...")
            raise  # 예외를 다시 발생시켜서 디버깅 정보 제공 