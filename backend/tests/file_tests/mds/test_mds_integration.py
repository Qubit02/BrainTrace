import requests
import json
import os
import time
import signal
import sys
from typing import Dict, Any
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from test_utils import TestDataManager, test_transaction, add_global_temp_file

# 테스트 설정
BASE_URL = "http://localhost:8000"
TEST_BRAIN_ID = 1

class TestMdsIntegration:
    """MDS 파일 처리 통합 테스트"""
    
    def __init__(self, data_manager: TestDataManager = None):
        """초기화"""
        self.test_file_path = None
        self.uploaded_file_id = None
        self.data_manager = data_manager or TestDataManager()
        self.created_session_ids = []
        self.temp_files = []  # 임시 파일 추적
        
        # 시그널 핸들러 등록
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """시그널 핸들러 - 강제 종료 시에도 cleanup 실행"""
        print(f"\n시그널 {signum} 수신. MDS 테스트 데이터 정리 중...")
        self.cleanup()
        sys.exit(1)
    
    def __enter__(self):
        """Context manager 진입"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager 종료 - 예외 발생 여부와 관계없이 cleanup 실행"""
        self.cleanup()
    
    def _add_temp_file(self, file_path: str):
        """임시 파일 추적에 추가"""
        self.temp_files.append(file_path)
        add_global_temp_file(file_path)  # 전역 추적에도 추가
        print(f"[추적] 임시 파일 추가: {file_path}")
    
    def _cleanup_temp_files(self):
        """임시 파일들 정리"""
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                    print(f"[정리] 임시 파일 삭제: {temp_file}")
                else:
                    print(f"[정리] 임시 파일이 이미 삭제됨: {temp_file}")
            except Exception as e:
                print(f"[정리] 임시 파일 삭제 오류: {temp_file}, error={e}")
        self.temp_files.clear()
    
    def create_test_mds(self):
        """테스트용 MDS 파일 생성"""
        test_file_path = "test_document.md"
        
        with open(test_file_path, 'w', encoding='utf-8') as f:
            f.write("# 테스트 마크다운 문서\n\n")
            f.write("이 문서는 테스트용 마크다운 파일입니다.\n\n")
            f.write("## 주요 내용\n\n")
            f.write("- **안예찬**은 사람의 이름입니다.\n")
            f.write("- **강아지**는 동물입니다.\n")
            f.write("- **태양**은 태양계의 중심에 있는 별입니다.\n\n")
            f.write("## 추가 정보\n\n")
            f.write("마크다운은 다음과 같은 특징을 가집니다:\n\n")
            f.write("1. **간단한 문법**: 쉽게 배울 수 있습니다.\n")
            f.write("2. **가독성**: 읽기 쉬운 형식입니다.\n")
            f.write("3. **호환성**: 다양한 플랫폼에서 지원됩니다.\n\n")
            f.write("### 코드 예제\n\n")
            f.write("```python\n")
            f.write("print('Hello, World!')\n")
            f.write("```\n\n")
            f.write("---\n")
            f.write("*이 문서는 테스트 목적으로 작성되었습니다.*\n")
        
        self.test_file_path = test_file_path
        self._add_temp_file(test_file_path)  # 임시 파일로 추적
        print(f"테스트 MDS 파일 생성: {test_file_path}")
        return test_file_path
    
    def test_mds_upload(self):
        """MDS 파일 업로드 테스트"""
        try:
            # 테스트 파일 생성
            test_file = self.create_test_mds()
            
            # 파일 업로드
            with open(test_file, 'rb') as f:
                files = {'files': (os.path.basename(test_file), f, 'text/markdown')}
                data = {'brain_id': TEST_BRAIN_ID}
                
                response = requests.post(f"{BASE_URL}/md/upload-md", files=files, data=data)
            print(f"[디버그] MDS 업로드 응답 상태 코드: {response.status_code}")
            print(f"[디버그] MDS 업로드 응답 내용: {response.text}")
            
            assert response.status_code == 200
            
            result = response.json()
            assert isinstance(result, list)
            assert len(result) > 0
            self.uploaded_file_id = result[0]["md_id"]
            
            # 데이터 관리자에 추가
            self.data_manager.add_file_id(self.uploaded_file_id, "mds")
            
            print(f"MDS 파일 업로드 성공: file_id={self.uploaded_file_id}")
        except Exception as e:
            print(f"MDS 업로드 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_mds_processing(self):
        """MDS 파일 처리 테스트"""
        try:
            # 먼저 파일 업로드
            self.test_mds_upload()
            
            # 파일 처리 요청 (MDS는 업로드 시 자동으로 텍스트 추출됨)
            # 별도 처리 엔드포인트가 없으므로 생략
            print("MDS 파일은 업로드 시 자동으로 텍스트가 추출됩니다.")
            print("MDS 파일 처리 성공")
            
            # 처리 완료까지 대기
            time.sleep(3)
        except Exception as e:
            print(f"MDS 처리 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_mds_node_generation(self):
        """MDS에서 노드 생성 테스트"""
        try:
            # 파일 업로드 및 처리
            self.test_mds_processing()
            
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
        except Exception as e:
            print(f"MDS 노드 생성 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_mds_content_extraction(self):
        """MDS 내용 추출 테스트"""
        try:
            # 파일 업로드
            self.test_mds_upload()
            
            # 파일 내용 조회
            response = requests.get(f"{BASE_URL}/md/{self.uploaded_file_id}")
            assert response.status_code == 200
            
            result = response.json()
            print(f"[디버그] MDS 조회 응답: {result}")
            
            # MDS API는 md_title 필드를 가짐
            assert "md_title" in result
            assert "md_path" in result
            
            title = result["md_title"]
            file_path = result["md_path"]
            
            print(f"파일 제목: {title}")
            print(f"파일 경로: {file_path}")
            
            # 내용은 별도 엔드포인트로 조회
            content_response = requests.get(f"{BASE_URL}/md/content/{self.uploaded_file_id}")
            print(f"[디버그] MDS content 응답 상태 코드: {content_response.status_code}")
            print(f"[디버그] MDS content 응답 내용: {content_response.text}")
            
            if content_response.status_code == 200:
                content = content_response.text
                print(f"내용 길이: {len(content)} 문자")
                print(f"내용 미리보기: {content[:100]}...")
            else:
                print(f"내용 조회 실패: {content_response.status_code}")
        except Exception as e:
            print(f"MDS 내용 추출 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_mds_file_list(self):
        """MDS 파일 목록 조회 테스트 (별도 엔드포인트가 없으므로 생략)"""
        try:
            print("MDS 파일 목록 조회는 별도 엔드포인트가 없습니다.")
            print("MDS 파일 목록 조회 테스트 완료")
        except Exception as e:
            print(f"MDS 파일 목록 조회 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_mds_chat_integration(self):
        """MDS와 채팅 통합 테스트"""
        try:
            # 파일 업로드 및 처리
            self.test_mds_processing()
            
            # 채팅 세션 생성
            session_data = {
                "session_name": "MDS 채팅 테스트",
                "brain_id": TEST_BRAIN_ID
            }
            response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
            assert response.status_code == 200
            
            session_id = response.json()["session_id"]
            self.created_session_ids.append(session_id)
            self.data_manager.add_session_id(session_id)
            
            # MDS 내용에 대한 질문
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
            
            print(f"MDS 기반 질문-답변: {result['answer'][:50]}...")
            print(f"참조 노드: {result['referenced_nodes']}")
        except Exception as e:
            print(f"MDS 채팅 통합 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_mds_markdown_syntax(self):
        """MDS Markdown 문법 처리 테스트"""
        try:
            # 다양한 Markdown 문법이 포함된 파일 생성
            markdown_file = "test_markdown_syntax.md"
            
            with open(markdown_file, 'w', encoding='utf-8') as f:
                f.write("# 제목 1\n\n")
                f.write("## 제목 2\n\n")
                f.write("### 제목 3\n\n")
                f.write("**굵은 글씨**와 *기울임 글씨*가 있습니다.\n\n")
                f.write("1. 순서가 있는 목록\n")
                f.write("2. 두 번째 항목\n\n")
                f.write("- 순서가 없는 목록\n")
                f.write("- 두 번째 항목\n\n")
                f.write("```python\n")
                f.write("def hello():\n")
                f.write("    print('Hello, World!')\n")
                f.write("```\n\n")
                f.write("> 인용문입니다.\n\n")
                f.write("[링크](https://example.com)\n\n")
                f.write("![이미지](image.jpg)\n\n")
                f.write("| 테이블 | 헤더 |\n")
                f.write("|--------|------|\n")
                f.write("| 셀 1   | 셀 2 |\n")
            
            # 파일 업로드
            with open(markdown_file, 'rb') as f:
                files = {'files': ('test_markdown_syntax.md', f, 'text/markdown')}
                data = {'brain_id': TEST_BRAIN_ID}
                
                response = requests.post(f"{BASE_URL}/md/upload-md", files=files, data=data)
            
            print(f"[디버그] MDS markdown_syntax 업로드 응답 상태 코드: {response.status_code}")
            print(f"[디버그] MDS markdown_syntax 업로드 응답 내용: {response.text}")
            assert response.status_code == 200
            
            # 정리
            if os.path.exists(markdown_file):
                os.remove(markdown_file)
            
            print("MDS Markdown 문법 처리 테스트 완료")
        except Exception as e:
            print(f"MDS Markdown 문법 처리 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_mds_error_handling(self):
        """MDS 에러 처리 테스트"""
        invalid_file = None
        try:
            # 존재하지 않는 파일 ID로 조회
            response = requests.get(f"{BASE_URL}/md/99999")
            # 에러가 발생하더라도 적절히 처리되어야 함
            print(f"존재하지 않는 파일 조회: status_code={response.status_code}")
            
            # 잘못된 파일 형식 업로드 시도
            invalid_file = "test_invalid.txt"
            with open(invalid_file, 'w') as f:
                f.write("This is not a Markdown file")
            
            self._add_temp_file(invalid_file)  # 임시 파일로 추적
            
            with open(invalid_file, 'rb') as f:
                files = {'files': ('test_invalid.md', f, 'text/markdown')}
                data = {'brain_id': TEST_BRAIN_ID}
                
                response = requests.post(f"{BASE_URL}/md/upload-md", files=files, data=data)
            
            print(f"잘못된 파일 형식 업로드: status_code={response.status_code}")
        except Exception as e:
            print(f"MDS 에러 처리 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def cleanup(self):
        """테스트 정리"""
        print("\n=== MDS 테스트 데이터 정리 시작 ===")
        
        # 1. 임시 파일들 정리 (가장 먼저)
        self._cleanup_temp_files()
        
        # 2. 생성된 채팅 세션 삭제
        for session_id in self.created_session_ids:
            try:
                response = requests.delete(f"{BASE_URL}/chatsession/{session_id}")
                if response.status_code in [200, 204]:
                    print(f"[정리] 채팅 세션 삭제 성공: session_id={session_id}")
                else:
                    print(f"[정리] 채팅 세션 삭제 실패: session_id={session_id}, status={response.status_code}")
            except Exception as e:
                print(f"[정리] 채팅 세션 삭제 오류: session_id={session_id}, error={e}")
        
        # 3. 데이터 관리자가 자동으로 정리함 (파일, 메모 등)
        
        # 4. 테스트 파일 삭제
        if self.test_file_path and os.path.exists(self.test_file_path):
            try:
                os.remove(self.test_file_path)
                print(f"[정리] 테스트 파일 삭제: {self.test_file_path}")
            except Exception as e:
                print(f"[정리] 테스트 파일 삭제 오류: {self.test_file_path}, error={e}")
        
        # 5. 리스트 초기화
        self.created_session_ids.clear()
        
        print("=== MDS 테스트 데이터 정리 완료 ===\n")

if __name__ == "__main__":
    # Context manager를 사용한 안전한 테스트 실행
    with test_transaction(BASE_URL) as data_manager:
        with TestMdsIntegration(data_manager) as test_instance:
            print("MDS 통합 테스트 시작")
            print("=" * 50)
            try:
                test_instance.test_mds_upload()
                test_instance.test_mds_processing()
                test_instance.test_mds_node_generation()
                test_instance.test_mds_content_extraction()
                test_instance.test_mds_file_list()
                test_instance.test_mds_chat_integration()
                test_instance.test_mds_error_handling()
                print("=" * 50)
                print("모든 MDS 통합 테스트 통과!")
            except Exception as e:
                print(f"테스트 실패: {str(e)}")
                print("예외 발생으로 인한 데이터 정리 수행...")
                raise 