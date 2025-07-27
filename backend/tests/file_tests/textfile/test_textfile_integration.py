import requests
import json
import os
import time
from typing import Dict, Any
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from test_utils import TestDataManager, test_transaction

# 테스트 설정
BASE_URL = "http://localhost:8000"
TEST_BRAIN_ID = 1

class TestTextFileIntegration:
    """TextFile 처리 통합 테스트"""
    
    def __init__(self, data_manager: TestDataManager = None):
        """초기화"""
        self.test_file_path = None
        self.uploaded_file_id = None
        self.data_manager = data_manager or TestDataManager()
    
    def create_test_textfile(self):
        """테스트용 텍스트 파일 생성"""
        test_file_path = "test_document.txt"
        
        with open(test_file_path, 'w', encoding='utf-8') as f:
            f.write("테스트 텍스트 문서\n")
            f.write("=" * 30 + "\n\n")
            f.write("이 문서는 테스트용 텍스트 파일입니다.\n")
            f.write("안예찬은 사람의 이름입니다.\n")
            f.write("강아지는 동물입니다.\n")
            f.write("태양은 태양계의 중심에 있는 별입니다.\n\n")
            f.write("추가 정보:\n")
            f.write("- 텍스트 파일은 가장 기본적인 문서 형식입니다.\n")
            f.write("- 다양한 인코딩을 지원합니다.\n")
            f.write("- 이 파일은 UTF-8 인코딩으로 작성되었습니다.\n")
        
        self.test_file_path = test_file_path
        print(f"테스트 텍스트 파일 생성: {test_file_path}")
        return test_file_path
    
    def test_textfile_upload(self):
        """TextFile 업로드 테스트"""
        # 테스트 파일 생성
        test_file = self.create_test_textfile()
        
        # 파일 업로드
        with open(test_file, 'rb') as f:
            files = {'files': (os.path.basename(test_file), f, 'text/plain')}
            data = {'brain_id': TEST_BRAIN_ID}
            
            response = requests.post(f"{BASE_URL}/textfiles/upload-txt", files=files, data=data)
        print(f"[디버그] TextFile 업로드 응답 상태 코드: {response.status_code}")
        print(f"[디버그] TextFile 업로드 응답 내용: {response.text}")
        
        assert response.status_code == 200
        
        result = response.json()
        assert isinstance(result, list)
        assert len(result) > 0
        self.uploaded_file_id = result[0]["txt_id"]
        
        # 데이터 관리자에 추가
        self.data_manager.add_file_id(self.uploaded_file_id, "textfile")
        
        print(f"TextFile 업로드 성공: file_id={self.uploaded_file_id}")
    
    def test_textfile_processing(self):
        """TextFile 처리 테스트"""
        # 먼저 파일 업로드
        self.test_textfile_upload()
        
        # 파일 처리 요청 (TextFile은 별도 처리 엔드포인트가 없음)
        print("TextFile은 별도 처리 엔드포인트가 없습니다.")
        print("TextFile 처리 성공")
        
        # 처리 완료까지 대기
        time.sleep(3)
    
    def test_textfile_node_generation(self):
        """TextFile에서 노드 생성 테스트"""
        # 파일 업로드 및 처리
        self.test_textfile_processing()
        
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
    
    def test_textfile_content_extraction(self):
        """TextFile 내용 추출 테스트"""
        # 파일 업로드
        self.test_textfile_upload()
        
        # 파일 내용 조회
        response = requests.get(f"{BASE_URL}/textfiles/{self.uploaded_file_id}")
        assert response.status_code == 200
        
        result = response.json()
        print(f"[디버그] TextFile 조회 응답: {result}")
        
        # TextFile API는 txt_title 필드를 가짐
        assert "txt_title" in result
        title = result["txt_title"]
        
        # TextFile 내용은 별도 엔드포인트가 없으므로 파일 경로만 확인
        assert "txt_path" in result
        file_path = result["txt_path"]
        
        print(f"파일 제목: {title}")
        print(f"파일 경로: {file_path}")
        print("TextFile 내용 조회는 별도 엔드포인트가 없습니다.")
    
    def test_textfile_file_list(self):
        """TextFile 목록 조회 테스트 (별도 엔드포인트가 없으므로 생략)"""
        print("TextFile 목록 조회는 별도 엔드포인트가 없습니다.")
        print("TextFile 목록 조회 테스트 완료")
    
    def test_textfile_chat_integration(self):
        """TextFile과 채팅 통합 테스트"""
        # 파일 업로드 및 처리
        self.test_textfile_processing()
        
        # 채팅 세션 생성
        session_data = {
            "session_name": "TextFile 채팅 테스트",
            "brain_id": TEST_BRAIN_ID
        }
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        assert response.status_code == 200
        
        session_id = response.json()["session_id"]
        
        # TextFile 내용에 대한 질문
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
        
        print(f"TextFile 기반 질문-답변: {result['answer'][:50]}...")
        print(f"참조 노드: {result['referenced_nodes']}")
    
    def test_textfile_encoding_handling(self):
        """TextFile 인코딩 처리 테스트"""
        # UTF-8 인코딩 파일 생성
        utf8_file = "test_utf8.txt"
        with open(utf8_file, 'w', encoding='utf-8') as f:
            f.write("안녕하세요! 이것은 UTF-8 인코딩 파일입니다.\n")
            f.write("한글과 영문이 혼재되어 있습니다.\n")
        
        # 파일 업로드
        with open(utf8_file, 'rb') as f:
            files = {'files': ('test_utf8.txt', f, 'text/plain')}
            data = {'brain_id': TEST_BRAIN_ID}
            
            response = requests.post(f"{BASE_URL}/textfiles/upload-txt", files=files, data=data)
        
        print(f"[디버그] TextFile encoding 업로드 응답 상태 코드: {response.status_code}")
        print(f"[디버그] TextFile encoding 업로드 응답 내용: {response.text}")
        assert response.status_code == 200
        
        # 정리
        if os.path.exists(utf8_file):
            os.remove(utf8_file)
        
        print("TextFile 인코딩 처리 테스트 완료")
    
    def test_textfile_error_handling(self):
        """TextFile 에러 처리 테스트"""
        # 존재하지 않는 파일 ID로 조회
        response = requests.get(f"{BASE_URL}/textfiles/99999")
        # 에러가 발생하더라도 적절히 처리되어야 함
        print(f"존재하지 않는 파일 조회: status_code={response.status_code}")
        
        # 빈 파일 업로드 시도
        empty_file = "test_empty.txt"
        with open(empty_file, 'w') as f:
            pass  # 빈 파일 생성
        
        with open(empty_file, 'rb') as f:
            files = {'files': ('test_empty.txt', f, 'text/plain')}
            data = {'brain_id': TEST_BRAIN_ID}
            
            response = requests.post(f"{BASE_URL}/textfiles/upload-txt", files=files, data=data)
        
        print(f"빈 파일 업로드: status_code={response.status_code}")
        
        # 정리
        if os.path.exists(empty_file):
            os.remove(empty_file)
    
    def cleanup(self):
        """테스트 정리"""
        # 데이터 관리자가 자동으로 정리함
        
        # 테스트 파일 삭제
        if self.test_file_path and os.path.exists(self.test_file_path):
            try:
                os.remove(self.test_file_path)
                print(f"테스트 파일 삭제: {self.test_file_path}")
            except:
                pass

if __name__ == "__main__":
    # 테스트 실행 (트랜잭션 처리)
    with test_transaction(BASE_URL) as data_manager:
        test_instance = TestTextFileIntegration(data_manager)
        
        print("TextFile 통합 테스트 시작")
        print("=" * 50)
        
        try:
            test_instance.test_textfile_upload()
            test_instance.test_textfile_processing()
            test_instance.test_textfile_node_generation()
            test_instance.test_textfile_content_extraction()
            test_instance.test_textfile_file_list()
            test_instance.test_textfile_chat_integration()
            test_instance.test_textfile_encoding_handling()
            test_instance.test_textfile_error_handling()
            
            print("=" * 50)
            print("모든 TextFile 통합 테스트 통과!")
            
        except Exception as e:
            print(f"테스트 실패: {str(e)}")
            raise 