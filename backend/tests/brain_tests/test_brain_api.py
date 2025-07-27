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

class TestBrainApi:
    """Brain API 테스트"""
    
    def __init__(self, data_manager: TestDataManager = None):
        """초기화"""
        self.created_brain_id = None
        self.data_manager = data_manager or TestDataManager()
    
    def test_brain_creation(self):
        """Brain 생성 테스트"""
        brain_data = {
            "brain_name": "테스트 브레인"
        }
        
        response = requests.post(f"{BASE_URL}/brains/", json=brain_data)
        assert response.status_code == 201
        
        result = response.json()
        assert "brain_id" in result
        self.created_brain_id = result["brain_id"]
        
        # 데이터 관리자에 추가
        self.data_manager.add_brain_id(self.created_brain_id)
        
        print(f"Brain 생성 성공: brain_id={self.created_brain_id}")
    
    def test_brain_retrieval(self):
        """Brain 조회 테스트"""
        # 먼저 Brain 생성
        self.test_brain_creation()
        
        # Brain 조회
        response = requests.get(f"{BASE_URL}/brains/{self.created_brain_id}")
        assert response.status_code == 200
        
        result = response.json()
        assert "brain_name" in result
        assert result["brain_name"] == "테스트 브레인"
        
        print(f"Brain 조회 성공: {result['brain_name']}")
    
    def test_brain_list_retrieval(self):
        """Brain 목록 조회 테스트"""
        response = requests.get(f"{BASE_URL}/brains/")
        assert response.status_code == 200
        
        brains = response.json()
        assert isinstance(brains, list)
        
        print(f"생성된 Brain 수: {len(brains)}")
        
        if brains:
            for brain_info in brains[:3]:  # 처음 3개만 출력
                print(f"  - {brain_info.get('brain_name', 'N/A')} (ID: {brain_info.get('brain_id', 'N/A')})")
    
    def test_brain_update(self):
        """Brain 수정 테스트"""
        # Brain 생성
        brain_data = {
            "brain_name": "업데이트 테스트 브레인"
        }
        
        response = requests.post(f"{BASE_URL}/brains/", json=brain_data)
        assert response.status_code == 201
        
        result = response.json()
        brain_id = result["brain_id"]
        self.data_manager.add_brain_id(brain_id)
        
        # Brain 수정
        update_data = {
            "brain_name": "수정된 테스트 브레인"
        }
        
        response = requests.put(f"{BASE_URL}/brains/{brain_id}", json=update_data)
        print(f"[디버그] PUT 요청 URL: {BASE_URL}/brains/{brain_id}")
        print(f"[디버그] PUT 요청 데이터: {update_data}")
        print(f"[디버그] PUT 응답 상태 코드: {response.status_code}")
        print(f"[디버그] PUT 응답 헤더: {dict(response.headers)}")
        print(f"[디버그] PUT 응답 내용: {response.text}")
        
        # PUT 엔드포인트는 200을 반환해야 함
        if response.status_code != 200:
            print(f"[오류] 예상 상태 코드: 200, 실제 상태 코드: {response.status_code}")
            print(f"[오류] 응답 내용: {response.text}")
        
        assert response.status_code == 200
        
        result = response.json()
        assert "brain_name" in result
        assert result["brain_name"] == "수정된 테스트 브레인"
        
        print("Brain 수정 성공")
        
        # 수정된 내용 확인
        response = requests.get(f"{BASE_URL}/brains/{brain_id}")
        assert response.status_code == 200
        
        result = response.json()
        assert result["brain_name"] == "수정된 테스트 브레인"
        
        print("수정된 내용 확인 완료")
    
    def test_brain_deletion(self):
        """Brain 삭제 테스트"""
        # Brain 생성
        brain_data = {
            "brain_name": "삭제 테스트 브레인"
        }
        
        response = requests.post(f"{BASE_URL}/brains/", json=brain_data)
        assert response.status_code == 201
        
        result = response.json()
        brain_id = result["brain_id"]
        self.data_manager.add_brain_id(brain_id)
        
        # Brain 삭제
        response = requests.delete(f"{BASE_URL}/brains/{brain_id}")
        print(f"[디버그] DELETE 요청 URL: {BASE_URL}/brains/{brain_id}")
        print(f"[디버그] DELETE 응답 상태 코드: {response.status_code}")
        print(f"[디버그] DELETE 응답 헤더: {dict(response.headers)}")
        print(f"[디버그] DELETE 응답 내용: {response.text}")
        
        if response.status_code != 204:
            print(f"[오류] 예상 상태 코드: 204, 실제 상태 코드: {response.status_code}")
            print(f"[오류] 응답 내용: {response.text}")
        
        assert response.status_code == 204
        
        # 삭제 성공 (204 No Content)
        print("Brain 삭제 성공")
        
        # 삭제 확인
        response = requests.get(f"{BASE_URL}/brains/{brain_id}")
        # 삭제된 Brain은 조회할 수 없어야 함
        assert response.status_code == 404
        
        print("삭제 확인 완료")
    
    def test_brain_multiple_creation(self):
        """여러 Brain 생성 테스트"""
        brain_names = ["첫 번째 브레인", "두 번째 브레인", "세 번째 브레인"]
        created_brain_ids = []
        
        for name in brain_names:
            brain_data = {
                "brain_name": name
            }
            
            response = requests.post(f"{BASE_URL}/brains/", json=brain_data)
            assert response.status_code == 201
            
            result = response.json()
            brain_id = result["brain_id"]
            created_brain_ids.append(brain_id)
            self.data_manager.add_brain_id(brain_id)
        
        print(f"{len(created_brain_ids)}개 Brain 생성 완료")
        
        # 생성된 Brain 목록 확인
        response = requests.get(f"{BASE_URL}/brains/")
        assert response.status_code == 200
        
        brains = response.json()
        assert len(brains) >= len(created_brain_ids)
        
        print("여러 Brain 생성 테스트 완료")
    
    def test_brain_error_handling(self):
        """Brain 에러 처리 테스트"""
        # 존재하지 않는 Brain ID로 조회
        response = requests.get(f"{BASE_URL}/brains/99999")
        # 에러가 발생하더라도 적절히 처리되어야 함
        print(f"존재하지 않는 Brain 조회: status_code={response.status_code}")
        
        # 빈 이름으로 Brain 생성 시도
        brain_data = {
            "brain_name": ""
        }
        
        response = requests.post(f"{BASE_URL}/brains/", json=brain_data)
        print(f"빈 이름 Brain 생성: status_code={response.status_code}")
        
        # 잘못된 데이터로 Brain 생성 시도
        brain_data = {
            "invalid_field": "잘못된 필드"
        }
        
        response = requests.post(f"{BASE_URL}/brains/", json=brain_data)
        print(f"잘못된 데이터 Brain 생성: status_code={response.status_code}")
    
    def test_brain_with_chat_integration(self):
        """Brain과 채팅 통합 테스트"""
        # Brain 생성
        brain_data = {
            "brain_name": "채팅 통합 테스트 브레인"
        }
        
        response = requests.post(f"{BASE_URL}/brains/", json=brain_data)
        assert response.status_code == 201
        
        result = response.json()
        brain_id = result["brain_id"]
        self.data_manager.add_brain_id(brain_id)
        
        # 해당 Brain으로 채팅 세션 생성
        session_data = {
            "session_name": "Brain 채팅 테스트",
            "brain_id": brain_id
        }
        response = requests.post(f"{BASE_URL}/chatsession/", json=session_data)
        assert response.status_code == 200
        
        session_id = response.json()["session_id"]
        self.data_manager.add_session_id(session_id)
        
        # 채팅 세션 목록에서 해당 Brain의 세션 확인
        response = requests.get(f"{BASE_URL}/chatsession/")
        assert response.status_code == 200
        
        sessions = response.json()
        brain_sessions = [s for s in sessions if s.get("brain_id") == brain_id]
        assert len(brain_sessions) > 0
        
        print(f"Brain과 채팅 통합 테스트 완료: {len(brain_sessions)}개 세션")
    
    def cleanup(self):
        """테스트 정리"""
        # 데이터 관리자가 자동으로 정리함
        pass

if __name__ == "__main__":
    # 테스트 실행 (트랜잭션 처리)
    with test_transaction(BASE_URL) as data_manager:
        test_instance = TestBrainApi(data_manager)
        
        print("Brain API 통합 테스트 시작")
        print("=" * 50)
        
        try:
            test_instance.test_brain_creation()
            test_instance.test_brain_retrieval()
            test_instance.test_brain_list_retrieval()
            test_instance.test_brain_update()
            test_instance.test_brain_deletion()
            test_instance.test_brain_multiple_creation()
            test_instance.test_brain_error_handling()
            test_instance.test_brain_with_chat_integration()
            
            print("=" * 50)
            print("모든 Brain API 통합 테스트 통과!")
            
        except Exception as e:
            print(f"테스트 실패: {str(e)}")
            raise 