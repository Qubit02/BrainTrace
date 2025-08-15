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

class TestDocxIntegration:
    """DOCX 파일 처리 통합 테스트"""
    
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
        print(f"\n시그널 {signum} 수신. DOCX 테스트 데이터 정리 중...")
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
    
    def create_test_docx(self):
        """테스트용 DOCX 파일 생성"""
        try:
            from docx import Document
            from docx.shared import Inches
            
            # 테스트용 DOCX 파일 생성
            doc = Document()
            doc.add_heading('테스트 문서', 0)
            
            doc.add_paragraph('이 문서는 테스트용입니다.')
            doc.add_paragraph('안예찬은 사람의 이름입니다.')
            doc.add_paragraph('강아지는 동물입니다.')
            doc.add_paragraph('태양은 태양계의 중심에 있는 별입니다.')
            
            # 테이블 추가
            table = doc.add_table(rows=1, cols=3)
            hdr_cells = table.rows[0].cells
            hdr_cells[0].text = '이름'
            hdr_cells[1].text = '설명'
            hdr_cells[2].text = '분류'
            
            row_cells = table.add_row().cells
            row_cells[0].text = '안예찬'
            row_cells[1].text = '사람의 이름'
            row_cells[2].text = '사람'
            
            row_cells = table.add_row().cells
            row_cells[0].text = '강아지'
            row_cells[1].text = '반려동물'
            row_cells[2].text = '동물'
            
            # 파일 저장
            test_file_path = "test_document.docx"
            doc.save(test_file_path)
            self.test_file_path = test_file_path
            self._add_temp_file(test_file_path)  # 임시 파일로 추적
            
            print(f"테스트 DOCX 파일 생성: {test_file_path}")
            return test_file_path
            
        except ImportError:
            print("python-docx 라이브러리가 설치되지 않았습니다. 간단한 텍스트 파일로 대체합니다.")
            # 간단한 텍스트 파일 생성
            test_file_path = "test_document.txt"
            with open(test_file_path, 'w', encoding='utf-8') as f:
                f.write("테스트 문서\n")
                f.write("안예찬은 사람의 이름입니다.\n")
                f.write("강아지는 동물입니다.\n")
                f.write("태양은 태양계의 중심에 있는 별입니다.\n")
            
            self.test_file_path = test_file_path
            self._add_temp_file(test_file_path)  # 임시 파일로 추적
            return test_file_path
    
    def test_docx_upload(self):
        """DOCX 파일 업로드 테스트"""
        try:
            # 테스트 파일 생성
            test_file = self.create_test_docx()
            
            # 파일 업로드
            with open(test_file, 'rb') as f:
                files = {'files': (os.path.basename(test_file), f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                data = {'brain_id': TEST_BRAIN_ID}
                
                response = requests.post(f"{BASE_URL}/docxfiles/upload-docx", files=files, data=data)
            print(f"[디버그] DOCX 업로드 응답 상태 코드: {response.status_code}")
            print(f"[디버그] DOCX 업로드 응답 내용: {response.text}")
            
            assert response.status_code == 200
            
            result = response.json()
            assert isinstance(result, list)
            assert len(result) > 0
            self.uploaded_file_id = result[0]["docx_id"]
            
            # 데이터 관리자에 추가
            self.data_manager.add_file_id(self.uploaded_file_id, "docx")
            
            print(f"DOCX 파일 업로드 성공: file_id={self.uploaded_file_id}")
        except Exception as e:
            print(f"DOCX 업로드 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_docx_processing(self):
        """DOCX 파일 처리 테스트"""
        try:
            # 먼저 파일 업로드
            self.test_docx_upload()
            
            # 파일 처리 요청 (DOCX는 업로드 시 자동으로 텍스트 추출됨)
            # 별도 처리 엔드포인트가 없으므로 생략
            print("DOCX 파일은 업로드 시 자동으로 텍스트가 추출됩니다.")
            print("DOCX 파일 처리 성공")
            
            # 처리 완료까지 대기
            time.sleep(3)
        except Exception as e:
            print(f"DOCX 처리 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_docx_node_generation(self):
        """DOCX에서 노드 생성 테스트"""
        try:
            # 파일 업로드 및 처리
            self.test_docx_processing()
            
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
            print(f"DOCX 노드 생성 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_docx_content_extraction(self):
        """DOCX 내용 추출 테스트"""
        try:
            # 파일 업로드
            self.test_docx_upload()
            
            # 파일 내용 조회
            response = requests.get(f"{BASE_URL}/docxfiles/{self.uploaded_file_id}")
            assert response.status_code == 200
            
            result = response.json()
            print(f"[디버그] DOCX 조회 응답: {result}")
            
            # DOCX API는 docx_text 필드를 가짐
            assert "docx_text" in result
            assert "docx_title" in result
            
            content = result["docx_text"]
            title = result["docx_title"]
            
            print(f"파일 제목: {title}")
            print(f"내용 길이: {len(content)} 문자")
            print(f"내용 미리보기: {content[:100]}...")
        except Exception as e:
            print(f"DOCX 내용 추출 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_docx_file_list(self):
        """DOCX 파일 목록 조회 테스트 (별도 엔드포인트가 없으므로 생략)"""
        try:
            print("DOCX 파일 목록 조회는 별도 엔드포인트가 없습니다.")
            print("DOCX 파일 목록 조회 테스트 완료")
        except Exception as e:
            print(f"DOCX 파일 목록 조회 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_docx_chat_integration(self):
        """DOCX와 채팅 통합 테스트"""
        try:
            # 파일 업로드 및 처리
            self.test_docx_processing()
            
            # 채팅 세션 생성
            session_data = {
                "session_name": "DOCX 채팅 테스트",
                "brain_id": TEST_BRAIN_ID
            }
            response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
            assert response.status_code == 200
            
            session_id = response.json()["session_id"]
            self.created_session_ids.append(session_id)
            self.data_manager.add_session_id(session_id)
            
            # DOCX 내용에 대한 질문
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
            
            print(f"DOCX 기반 질문-답변: {result['answer'][:50]}...")
            print(f"참조 노드: {result['referenced_nodes']}")
        except Exception as e:
            print(f"DOCX 채팅 통합 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def test_docx_error_handling(self):
        """DOCX 에러 처리 테스트"""
        invalid_file = None
        try:
            # 존재하지 않는 파일 ID로 조회
            response = requests.get(f"{BASE_URL}/docx/99999")
            # 에러가 발생하더라도 적절히 처리되어야 함
            print(f"존재하지 않는 파일 조회: status_code={response.status_code}")
            
            # 잘못된 파일 형식 업로드 시도
            invalid_file = "test_invalid.txt"
            with open(invalid_file, 'w') as f:
                f.write("This is not a DOCX file")
            
            self._add_temp_file(invalid_file)  # 임시 파일로 추적
            
            with open(invalid_file, 'rb') as f:
                files = {'files': ('test_invalid.docx', f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                data = {'brain_id': TEST_BRAIN_ID}
                
                response = requests.post(f"{BASE_URL}/docx/upload-docx", files=files, data=data)
            
            print(f"잘못된 파일 형식 업로드: status_code={response.status_code}")
        except Exception as e:
            print(f"DOCX 에러 처리 테스트 실패: {e}")
            self.cleanup()
            raise
    
    def cleanup(self):
        """테스트 정리"""
        print("\n=== DOCX 테스트 데이터 정리 시작 ===")
        
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
        
        print("=== DOCX 테스트 데이터 정리 완료 ===\n")

if __name__ == "__main__":
    # Context manager를 사용한 안전한 테스트 실행
    with test_transaction(BASE_URL) as data_manager:
        with TestDocxIntegration(data_manager) as test_instance:
            print("DOCX 통합 테스트 시작")
            print("=" * 50)
            try:
                test_instance.test_docx_upload()
                test_instance.test_docx_processing()
                test_instance.test_docx_node_generation()
                test_instance.test_docx_content_extraction()
                test_instance.test_docx_file_list()
                test_instance.test_docx_chat_integration()
                test_instance.test_docx_error_handling()
                print("=" * 50)
                print("모든 DOCX 통합 테스트 통과!")
            except Exception as e:
                print(f"테스트 실패: {str(e)}")
                print("예외 발생으로 인한 데이터 정리 수행...")
                raise 