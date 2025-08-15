#!/usr/bin/env python3
"""
파일 처리 테스트들을 실행하는 스크립트
"""

import sys
import os
import time
import subprocess
import signal
import atexit
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

# 전역 변수로 현재 실행 중인 프로세스 추적
current_process = None
test_results = []

def signal_handler(signum, frame):
    """시그널 핸들러 - 강제 종료 시 정리"""
    print(f"\n[중단] 시그널 {signum} 수신. 파일 테스트 실행을 중단하고 정리 중...")
    
    # 현재 실행 중인 프로세스 종료
    if current_process and current_process.poll() is None:
        try:
            current_process.terminate()
            current_process.wait(timeout=10)
            print("[정리] 현재 테스트 프로세스가 종료되었습니다.")
        except subprocess.TimeoutExpired:
            current_process.kill()
            print("[정리] 현재 테스트 프로세스가 강제 종료되었습니다.")
        except Exception as e:
            print(f"[오류] 프로세스 종료 중 오류: {e}")
    
    # 결과 출력
    if test_results:
        print("\n[결과] 현재까지의 테스트 결과:")
        print_test_results(test_results, "파일 처리")
    
    print("[종료] 파일 테스트 스위트가 중단되었습니다.")
    sys.exit(1)

def cleanup_on_exit():
    """프로그램 종료 시 정리"""
    if current_process and current_process.poll() is None:
        try:
            current_process.terminate()
            current_process.wait(timeout=5)
        except:
            pass

# 시그널 핸들러 등록
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# 종료 시 정리 함수 등록
atexit.register(cleanup_on_exit)

def run_test_file(test_file: str) -> Dict[str, any]:
    """개별 테스트 파일 실행"""
    global current_process
    
    print(f"\n{'='*60}")
    print(f"{test_file} 실행 중...")
    print(f"{'='*60}")
    
    start_time = time.time()
    
    try:
        # 테스트 파일 실행
        current_process = subprocess.Popen(
            [sys.executable, test_file],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # 실시간 출력 처리
        stdout_lines = []
        stderr_lines = []
        
        while True:
            # stdout 읽기
            stdout_line = current_process.stdout.readline()
            if stdout_line:
                stdout_lines.append(stdout_line)
                print(stdout_line.rstrip())
            
            # stderr 읽기
            stderr_line = current_process.stderr.readline()
            if stderr_line:
                stderr_lines.append(stderr_line)
                print(f"[에러] {stderr_line.rstrip()}")
            
            # 프로세스 종료 확인
            if current_process.poll() is not None:
                break
            
            # 타임아웃 체크 (5분)
            if time.time() - start_time > 300:
                current_process.terminate()
                try:
                    current_process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    current_process.kill()
                raise subprocess.TimeoutExpired("테스트 타임아웃", 300)
        
        # 남은 출력 읽기
        remaining_stdout, remaining_stderr = current_process.communicate()
        stdout_lines.extend(remaining_stdout.splitlines() if remaining_stdout else [])
        stderr_lines.extend(remaining_stderr.splitlines() if remaining_stderr else [])
        
        end_time = time.time()
        duration = end_time - start_time
        
        return {
            "file": test_file,
            "success": current_process.returncode == 0,
            "stdout": "\n".join(stdout_lines),
            "stderr": "\n".join(stderr_lines),
            "duration": duration,
            "returncode": current_process.returncode
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
    finally:
        current_process = None

def print_test_results(results: List[Dict[str, any]], test_type: str):
    """테스트 결과 출력"""
    print(f"\n{'='*60}")
    print(f"{test_type} 테스트 결과 요약")
    print(f"{'='*60}")
    
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r["success"])
    failed_tests = total_tests - passed_tests
    
    print(f"[파일] 총 테스트 파일: {total_tests}개")
    print(f"[성공] 성공: {passed_tests}개")
    print(f"[실패] 실패: {failed_tests}개")
    
    total_duration = sum(r["duration"] for r in results)
    print(f"[시간] 총 실행 시간: {total_duration:.2f}초")
    
    # 성공률 계산
    success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    print(f"[비율] 성공률: {success_rate:.1f}%")
    
    print(f"\n{'='*60}")
    print("상세 결과")
    print(f"{'='*60}")
    
    # 성공한 테스트 목록
    if passed_tests > 0:
        print(f"\n[성공] 성공한 테스트:")
        for result in results:
            if result["success"]:
                print(f"   • {result['file']} ({result['duration']:.2f}초)")
    
    # 실패한 테스트 목록
    if failed_tests > 0:
        print(f"\n[실패] 실패한 테스트:")
        for result in results:
            if not result["success"]:
                print(f"   • {result['file']} ({result['duration']:.2f}초)")
                if result["stderr"]:
                    print(f"     에러: {result['stderr'][:100]}...")
                if result["stdout"]:
                    print(f"     출력: {result['stdout'][:100]}...")
    
    return passed_tests == total_tests

def check_backend_server():
    """백엔드 서버 상태 확인"""
    import requests
    
    print("[확인] 백엔드 서버 상태 확인 중...")
    
    try:
        response = requests.get("http://localhost:8000/docs", timeout=5)
        if response.status_code == 200:
            print("[성공] 백엔드 서버가 정상적으로 실행 중입니다.")
            return True
        else:
            print(f"[실패] 백엔드 서버가 응답하지 않습니다. (상태 코드: {response.status_code})")
            return False
    except requests.exceptions.ConnectionError:
        print("[실패] 백엔드 서버에 연결할 수 없습니다.")
        print("   [안내] 백엔드 서버를 먼저 실행해주세요:")
        print("   cd backend && python main.py")
        return False
    except requests.exceptions.Timeout:
        print("[실패] 백엔드 서버 응답 시간이 초과되었습니다.")
        print("   [안내] 서버가 실행 중인지 확인해주세요.")
        return False
    except Exception as e:
        print(f"[실패] 백엔드 서버 확인 중 오류 발생: {str(e)}")
        return False

def validate_test_files(test_files: List[str]) -> List[str]:
    """테스트 파일 유효성 검사"""
    valid_files = []
    invalid_files = []
    
    for test_file in test_files:
        if os.path.exists(test_file):
            valid_files.append(test_file)
        else:
            invalid_files.append(test_file)
            print(f"[경고] {test_file} 파일을 찾을 수 없습니다.")
    
    if invalid_files:
        print(f"\n[경고] {len(invalid_files)}개의 테스트 파일을 찾을 수 없습니다:")
        for file in invalid_files:
            print(f"   • {file}")
    
    return valid_files

def main():
    """메인 실행 함수"""
    global test_results
    
    print("[시스템] BrainT 파일 처리 시스템 테스트 스위트")
    print("="*60)
    
    # 백엔드 서버 상태 확인
    if not check_backend_server():
        print("\n[실패] 백엔드 서버를 먼저 실행한 후 테스트를 다시 실행해주세요.")
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
    test_results = []
    
    if test_type in ["file", "all"]:
        print(f"\n{'='*60}")
        print("파일 업로드 테스트 실행")
        print(f"{'='*60}")
        
        # 파일 유효성 검사
        valid_file_tests = validate_test_files(FILE_TEST_FILES)
        
        if valid_file_tests:
            file_results = []
            for i, test_file in enumerate(valid_file_tests, 1):
                print(f"\n[진행] 파일 테스트 진행률: {i}/{len(valid_file_tests)} ({i/len(valid_file_tests)*100:.1f}%)")
                result = run_test_file(test_file)
                file_results.append(result)
            
            file_success = print_test_results(file_results, "파일 업로드")
            test_results.extend(file_results)
        else:
            print("[경고] 실행할 파일 테스트가 없습니다.")
    
    if test_type in ["memo", "all"]:
        print(f"\n{'='*60}")
        print("메모 테스트 실행")
        print(f"{'='*60}")
        
        # 파일 유효성 검사
        valid_memo_tests = validate_test_files(MEMO_TEST_FILES)
        
        if valid_memo_tests:
            memo_results = []
            for i, test_file in enumerate(valid_memo_tests, 1):
                print(f"\n[진행] 메모 테스트 진행률: {i}/{len(valid_memo_tests)} ({i/len(valid_memo_tests)*100:.1f}%)")
                result = run_test_file(test_file)
                memo_results.append(result)
            
            memo_success = print_test_results(memo_results, "메모")
            test_results.extend(memo_results)
        else:
            print("[경고] 실행할 메모 테스트가 없습니다.")
    
    # 최종 결과
    print(f"\n{'='*60}")
    if test_results:
        all_passed = all(r["success"] for r in test_results)
        total_tests = len(test_results)
        passed_tests = sum(1 for r in test_results if r["success"])
        total_duration = sum(r["duration"] for r in test_results)
        
        print("[최종] 전체 테스트 결과 요약")
        print(f"   • 총 테스트: {total_tests}개")
        print(f"   • 성공: {passed_tests}개")
        print(f"   • 실패: {total_tests - passed_tests}개")
        print(f"   • 총 시간: {total_duration:.2f}초")
        
        if all_passed:
            print("\n[성공] 모든 파일 처리 테스트가 성공했습니다!")
            print("[확인] 파일 처리 시스템이 정상적으로 작동하고 있습니다.")
            sys.exit(0)
        else:
            print("\n[실패] 일부 파일 처리 테스트가 실패했습니다.")
            print("[안내] 실패한 테스트를 확인하고 수정해주세요.")
            sys.exit(1)
    else:
        print("[경고] 실행할 테스트가 없습니다.")
        print("[안내] 테스트 파일이 올바른 위치에 있는지 확인해주세요.")
        sys.exit(1)

if __name__ == "__main__":
    main() 