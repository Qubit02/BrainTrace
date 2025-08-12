#!/usr/bin/env python3
"""
파일 처리 테스트들을 실행하는 스크립트
"""

import sys
import os
import time
import subprocess
from typing import List, Dict

# 파일 처리 테스트 파일 목록 (새로운 폴더 구조)
FILE_TEST_FILES = [
    "file_tests/docx/test_docx_integration.py",
    "file_tests/pdf/test_pdf_integration.py",
    "file_tests/textfile/test_textfile_integration.py",
    "file_tests/mds/test_mds_integration.py"
]

# 메모 테스트 파일 (별도 분류)
MEMO_TEST_FILES = [
    "memo_tests/test_memo_integration.py"
]

def run_test_file(test_file: str) -> Dict[str, any]:
    """개별 테스트 파일 실행"""
    print(f"\n{'='*60}")
    print(f"{test_file} 실행 중...")
    print(f"{'='*60}")
    
    start_time = time.time()
    
    try:
        # 테스트 파일 실행
        result = subprocess.run(
            [sys.executable, test_file],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            capture_output=True,
            text=True,
            timeout=300  # 5분 타임아웃
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        return {
            "file": test_file,
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "duration": duration,
            "returncode": result.returncode
        }
        
    except subprocess.TimeoutExpired:
        return {
            "file": test_file,
            "success": False,
            "stdout": "",
            "stderr": "테스트 타임아웃 (5분 초과)",
            "duration": 300,
            "returncode": -1
        }
    except Exception as e:
        return {
            "file": test_file,
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "duration": 0,
            "returncode": -1
        }

def print_test_results(results: List[Dict[str, any]], test_type: str):
    """테스트 결과 출력"""
    print(f"\n{'='*60}")
    print(f"{test_type} 테스트 결과 요약")
    print(f"{'='*60}")
    
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r["success"])
    failed_tests = total_tests - passed_tests
    
    print(f"총 테스트 파일: {total_tests}개")
    print(f"성공: {passed_tests}개")
    print(f"실패: {failed_tests}개")
    
    total_duration = sum(r["duration"] for r in results)
    print(f"총 실행 시간: {total_duration:.2f}초")
    
    print(f"\n{'='*60}")
    print("상세 결과")
    print(f"{'='*60}")
    
    for result in results:
        status = "성공" if result["success"] else "실패"
        print(f"{result['file']}: {status} ({result['duration']:.2f}초)")
        
        if not result["success"]:
            print(f"  에러: {result['stderr']}")
            if result["stdout"]:
                print(f"  출력: {result['stdout'][:200]}...")
    
    return passed_tests == total_tests

def check_backend_server():
    """백엔드 서버 상태 확인"""
    import requests
    
    try:
        response = requests.get("http://localhost:8000/docs", timeout=5)
        if response.status_code == 200:
            print("백엔드 서버가 실행 중입니다.")
            return True
        else:
            print("백엔드 서버가 응답하지 않습니다.")
            return False
    except requests.exceptions.RequestException:
        print("백엔드 서버에 연결할 수 없습니다.")
        print("   백엔드 서버를 먼저 실행해주세요: python main.py")
        return False

def main():
    """메인 실행 함수"""
    print("BrainT 파일 처리 시스템 테스트 스위트")
    print("="*60)
    
    # 백엔드 서버 상태 확인
    if not check_backend_server():
        print("\n백엔드 서버를 먼저 실행한 후 테스트를 다시 실행해주세요.")
        sys.exit(1)
    
    # 실행할 테스트 타입 선택
    if len(sys.argv) > 1:
        test_type = sys.argv[1].lower()
    else:
        print("테스트 타입을 선택하세요:")
        print("1. file - 파일 업로드 테스트 (DOCX, PDF, TextFile, MDS)")
        print("2. memo - 메모 테스트")
        print("3. all - 모든 파일 관련 테스트")
        test_type = input("선택 (file/memo/all): ").lower()
    
    # 테스트 실행
    results = []
    
    if test_type in ["file", "all"]:
        print(f"\n{'='*60}")
        print("파일 업로드 테스트 실행")
        print(f"{'='*60}")
        
        file_results = []
        for test_file in FILE_TEST_FILES:
            if os.path.exists(test_file):
                result = run_test_file(test_file)
                file_results.append(result)
            else:
                print(f"경고: {test_file} 파일을 찾을 수 없습니다.")
        
        file_success = print_test_results(file_results, "파일 업로드")
        results.extend(file_results)
    
    if test_type in ["memo", "all"]:
        print(f"\n{'='*60}")
        print("메모 테스트 실행")
        print(f"{'='*60}")
        
        memo_results = []
        for test_file in MEMO_TEST_FILES:
            if os.path.exists(test_file):
                result = run_test_file(test_file)
                memo_results.append(result)
            else:
                print(f"경고: {test_file} 파일을 찾을 수 없습니다.")
        
        memo_success = print_test_results(memo_results, "메모")
        results.extend(memo_results)
    
    # 최종 결과
    print(f"\n{'='*60}")
    if results:
        all_passed = all(r["success"] for r in results)
        if all_passed:
            print("모든 파일 처리 테스트가 성공했습니다!")
            sys.exit(0)
        else:
            print("일부 파일 처리 테스트가 실패했습니다.")
            sys.exit(1)
    else:
        print("실행할 테스트가 없습니다.")
        sys.exit(1)

if __name__ == "__main__":
    main() 