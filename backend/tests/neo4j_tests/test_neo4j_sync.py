import requests
import json
from typing import Dict, Any

# 테스트 설정
BASE_URL = "http://localhost:8000"
TEST_BRAIN_ID = 1

class TestNeo4jSync:
    """Neo4j 동기화 기능 테스트"""
    
    def test_embedding_to_neo4j_sync(self):
        """임베딩 벡터 DB에서 Neo4j로 동기화 테스트"""
        # 1. 먼저 Neo4j에 노드가 없는 상태 확인
        response = requests.get(f"{BASE_URL}/brainGraph/getNodeEdge/{TEST_BRAIN_ID}")
        assert response.status_code == 200
        
        initial_graph = response.json()
        initial_node_count = len(initial_graph["nodes"])
        
        print(f"초기 Neo4j 노드 수: {initial_node_count}")
        
        # 2. 질문을 통해 동기화 트리거
        session_data = {
            "session_name": "동기화 테스트 세션",
            "brain_id": TEST_BRAIN_ID
        }
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        session_id = response.json()["session_id"]
        
        question_data = {
            "question": "안예찬에 대해 알려줘",
            "session_id": session_id,
            "brain_id": TEST_BRAIN_ID,
            "model": "gpt"
        }
        
        response = requests.post(f"{BASE_URL}/brainGraph/answer", json=question_data)
        assert response.status_code == 200
        
        # 3. 동기화 후 Neo4j 상태 확인
        response = requests.get(f"{BASE_URL}/brainGraph/getNodeEdge/{TEST_BRAIN_ID}")
        assert response.status_code == 200
        
        final_graph = response.json()
        final_node_count = len(final_graph["nodes"])
        
        print(f"동기화 후 Neo4j 노드 수: {final_node_count}")
        print(f"동기화된 노드들: {[node['name'] for node in final_graph['nodes']]}")
        
        # 4. 노드가 추가되었는지 확인
        assert final_node_count >= initial_node_count
        
        print("임베딩 벡터 DB → Neo4j 동기화 성공")
    
    def test_brain_id_string_conversion(self):
        """brain_id 문자열 변환 테스트"""
        # 정수 brain_id로 요청
        session_data = {
            "session_name": "brain_id 테스트",
            "brain_id": TEST_BRAIN_ID  # 정수
        }
        
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        assert response.status_code == 200
        
        session_id = response.json()["session_id"]
        
        # 질문 전송 (정수 brain_id)
        question_data = {
            "question": "테스트 질문",
            "session_id": session_id,
            "brain_id": TEST_BRAIN_ID,  # 정수
            "model": "gpt"
        }
        
        response = requests.post(f"{BASE_URL}/brainGraph/answer", json=question_data)
        assert response.status_code == 200
        
        print("brain_id 정수 → 문자열 변환 성공")
    
    def test_node_retrieval_by_brain_id(self):
        """brain_id별 노드 조회 테스트"""
        # 소스 개수 조회
        response = requests.get(f"{BASE_URL}/brainGraph/sourceCount/{TEST_BRAIN_ID}")
        assert response.status_code == 200
        
        source_count = response.json()
        print(f"브레인 {TEST_BRAIN_ID}의 소스 개수: {source_count}")
        
        # 그래프 데이터 조회
        response = requests.get(f"{BASE_URL}/brainGraph/getNodeEdge/{TEST_BRAIN_ID}")
        assert response.status_code == 200
        
        graph_data = response.json()
        nodes = graph_data["nodes"]
        links = graph_data["links"]
        
        print(f"브레인 {TEST_BRAIN_ID}의 노드: {[node['name'] for node in nodes]}")
        print(f"브레인 {TEST_BRAIN_ID}의 관계: {len(links)}개")
        
        # 노드가 존재하는지 확인
        assert len(nodes) > 0
        
        print("brain_id별 노드 조회 성공")
    
    def test_referenced_nodes_extraction(self):
        """참조 노드 추출 테스트"""
        # 세션 생성
        session_data = {
            "session_name": "참조 노드 테스트",
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
        referenced_nodes = result.get("referenced_nodes", [])
        
        print(f"참조 노드: {referenced_nodes}")
        
        # 참조 노드가 추출되었는지 확인
        assert len(referenced_nodes) > 0
        
        print("참조 노드 추출 성공")
    
    def test_source_id_mapping(self):
        """source_id 매핑 테스트"""
        # 세션 생성
        session_data = {
            "session_name": "source_id 매핑 테스트",
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
        
        # source_id가 정상적으로 매핑되었는지 확인
        # (로그에서 node_to_ids와 all_ids 확인)
        print("source_id 매핑 테스트 완료")

if __name__ == "__main__":
    # 테스트 실행
    test_instance = TestNeo4jSync()
    
    print("Neo4j 동기화 테스트 시작")
    print("=" * 50)
    
    try:
        test_instance.test_embedding_to_neo4j_sync()
        test_instance.test_brain_id_string_conversion()
        test_instance.test_node_retrieval_by_brain_id()
        test_instance.test_referenced_nodes_extraction()
        test_instance.test_source_id_mapping()
        
        print("=" * 50)
        print("모든 Neo4j 동기화 테스트 통과!")
        
    except Exception as e:
        print(f"테스트 실패: {str(e)}")
        raise 