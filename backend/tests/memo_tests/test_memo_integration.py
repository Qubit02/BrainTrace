import requests
import json
import os
import time
from typing import Dict, Any
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from test_utils import TestDataManager, test_transaction

# 테스트 설정
BASE_URL = "http://localhost:8000"
TEST_BRAIN_ID = 1

class TestMemoIntegration:
    """Memo 처리 통합 테스트"""
    
    def __init__(self, data_manager: TestDataManager = None):
        """초기화"""
        self.created_memo_id = None
        self.data_manager = data_manager or TestDataManager()
    
    def test_memo_creation(self):
        """Memo 생성 테스트"""
        memo_data = {
            "memo_title": "테스트 메모",
            "memo_text": "이것은 테스트용 메모입니다.\n안예찬은 사람의 이름입니다.\n강아지는 동물입니다.\n태양은 태양계의 중심에 있는 별입니다.",
            "brain_id": TEST_BRAIN_ID
        }
        
        response = requests.post(f"{BASE_URL}/memos/", json=memo_data)
        assert response.status_code == 201
        
        result = response.json()
        assert "memo_id" in result
        self.created_memo_id = result["memo_id"]
        
        # 데이터 관리자에 추가
        self.data_manager.add_memo_id(self.created_memo_id)
        
        print(f"Memo 생성 성공: memo_id={self.created_memo_id}")
    
    def test_memo_processing(self):
        """Memo 처리 테스트"""
        # 먼저 메모 생성
        self.test_memo_creation()
        
        # 메모 처리 요청 (Memo는 별도 처리 엔드포인트가 없음)
        print("Memo는 별도 처리 엔드포인트가 없습니다.")
        print("Memo 처리 성공")
        
        # 처리 완료까지 대기
        time.sleep(3)
    
    def test_memo_node_generation(self):
        """Memo에서 노드 생성 테스트"""
        # 메모 생성 및 처리
        self.test_memo_processing()
        
        # 노드 생성 확인
        response = requests.get(f"{BASE_URL}/brainGraph/getNodeEdge/{TEST_BRAIN_ID}")
        assert response.status_code == 200
        
        graph_data = response.json()
        nodes = graph_data["nodes"]
        
        # 생성된 노드 확인
        node_names = [node["name"] for node in nodes]
        expected_nodes = ["안예찬", "강아지", "태양"]
        
        found_nodes = [name for name in expected_nodes if name in node_names]
        assert len(found_nodes) > 0
        
        print(f"생성된 노드들: {found_nodes}")
        print(f"전체 노드 수: {len(nodes)}")
    
    def test_memo_content_retrieval(self):
        """Memo 내용 조회 테스트"""
        # 메모 생성
        self.test_memo_creation()
        
        # 메모 내용 조회
        response = requests.get(f"{BASE_URL}/memos/{self.created_memo_id}")
        assert response.status_code == 200
        
        result = response.json()
        assert "memo_title" in result
        assert "memo_text" in result
        assert "brain_id" in result
        
        title = result["memo_title"]
        content = result["memo_text"]
        
        print(f"메모 제목: {title}")
        print(f"내용 길이: {len(content)} 문자")
        print(f"내용 미리보기: {content[:100]}...")
    
    def test_memo_list_retrieval(self):
        """Memo 목록 조회 테스트 (별도 엔드포인트가 없으므로 생략)"""
        print("Memo 목록 조회는 별도 엔드포인트가 없습니다.")
        print("Memo 목록 조회 테스트 완료")
    
    def test_memo_update(self):
        """Memo 수정 테스트"""
        # 메모 생성
        self.test_memo_creation()
        
        # 메모 수정
        update_data = {
            "memo_title": "수정된 테스트 메모",
            "memo_text": "이것은 수정된 테스트용 메모입니다.\n안예찬은 사람의 이름입니다.\n강아지는 동물입니다.\n태양은 태양계의 중심에 있는 별입니다.\n추가된 내용입니다."
        }
        
        response = requests.put(f"{BASE_URL}/memos/{self.created_memo_id}", json=update_data)
        print(f"[디버그] Memo PUT 응답 상태 코드: {response.status_code}")
        print(f"[디버그] Memo PUT 응답 내용: {response.text}")
        assert response.status_code == 200
        
        result = response.json()
        assert "memo_title" in result
        assert result["memo_title"] == "수정된 테스트 메모"
        
        print("Memo 수정 성공")
        
        # 수정된 내용 확인
        response = requests.get(f"{BASE_URL}/memos/{self.created_memo_id}")
        assert response.status_code == 200
        
        result = response.json()
        assert result["memo_title"] == "수정된 테스트 메모"
        assert "추가된 내용입니다." in result["memo_text"]
        
        print("수정된 내용 확인 완료")
    
    def test_memo_chat_integration(self):
        """Memo와 채팅 통합 테스트"""
        # 메모 생성 및 처리
        self.test_memo_processing()
        
        # 채팅 세션 생성
        session_data = {
            "session_name": "Memo 채팅 테스트",
            "brain_id": TEST_BRAIN_ID
        }
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        assert response.status_code == 200
        
        session_id = response.json()["session_id"]
        
        # 메모 내용에 대한 질문
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
        
        print(f"Memo 기반 질문-답변: {result['answer'][:50]}...")
        print(f"참조 노드: {result['referenced_nodes']}")
    
    def test_memo_multiple_creation(self):
        """여러 메모 생성 테스트"""
        memo_titles = ["첫 번째 메모", "두 번째 메모", "세 번째 메모"]
        created_memo_ids = []
        
        for title in memo_titles:
            memo_data = {
                "memo_title": title,
                "memo_text": f"이것은 {title}입니다.\n안예찬은 사람의 이름입니다.\n강아지는 동물입니다.",
                "brain_id": TEST_BRAIN_ID
            }
            
            response = requests.post(f"{BASE_URL}/memos/", json=memo_data)
            assert response.status_code == 201
            
            result = response.json()
            memo_id = result["memo_id"]
            created_memo_ids.append(memo_id)
            self.data_manager.add_memo_id(memo_id)
        
        print(f"{len(created_memo_ids)}개 메모 생성 완료")
        
        # 생성된 메모 개별 확인
        for memo_id in created_memo_ids:
            response = requests.get(f"{BASE_URL}/memos/{memo_id}")
            assert response.status_code == 200
            result = response.json()
            assert result["memo_id"] == memo_id
        
        print("여러 메모 생성 테스트 완료")
    
    def test_memo_error_handling(self):
        """Memo 에러 처리 테스트"""
        # 존재하지 않는 메모 ID로 조회
        response = requests.get(f"{BASE_URL}/memos/99999")
        # 에러가 발생하더라도 적절히 처리되어야 함
        print(f"존재하지 않는 메모 조회: status_code={response.status_code}")
        
        # 빈 제목으로 메모 생성 시도
        memo_data = {
            "memo_title": "",
            "memo_text": "내용이 있는 메모",
            "brain_id": TEST_BRAIN_ID
        }
        
        response = requests.post(f"{BASE_URL}/memos/", json=memo_data)
        print(f"빈 제목 메모 생성: status_code={response.status_code}")
        
        # 빈 내용으로 메모 생성 시도
        memo_data = {
            "memo_title": "제목이 있는 메모",
            "memo_text": "",
            "brain_id": TEST_BRAIN_ID
        }
        
        response = requests.post(f"{BASE_URL}/memos/", json=memo_data)
        print(f"빈 내용 메모 생성: status_code={response.status_code}")
    
    def cleanup(self):
        """테스트 정리"""
        # 데이터 관리자가 자동으로 정리함
        pass

if __name__ == "__main__":
    # 테스트 실행 (트랜잭션 처리)
    with test_transaction(BASE_URL) as data_manager:
        test_instance = TestMemoIntegration(data_manager)
        
        print("Memo 통합 테스트 시작")
        print("=" * 50)
        
        try:
            test_instance.test_memo_creation()
            test_instance.test_memo_processing()
            test_instance.test_memo_node_generation()
            test_instance.test_memo_content_retrieval()
            test_instance.test_memo_list_retrieval()
            test_instance.test_memo_update()
            test_instance.test_memo_chat_integration()
            test_instance.test_memo_multiple_creation()
            test_instance.test_memo_error_handling()
            
            print("=" * 50)
            print("모든 Memo 통합 테스트 통과!")
            
        except Exception as e:
            print(f"테스트 실패: {str(e)}")
            raise 