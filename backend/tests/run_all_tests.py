#!/usr/bin/env python3
"""
모든 테스트를 실행하는 메인 스크립트
"""

import sys
import os
import time
import subprocess
from typing import List, Dict

# 테스트 파일 목록 (새로운 폴더 구조)
TEST_FILES = [
    "brain_tests/test_brain_api.py",
    "chat_tests/test_chat_integration.py",
    "chat_tests/test_chat_api.py",
    "neo4j_tests/test_neo4j_sync.py", 
    "frontend_tests/test_frontend_integration.py",
    "file_tests/docx/test_docx_integration.py",
    "file_tests/pdf/test_pdf_integration.py",
    "file_tests/textfile/test_textfile_integration.py",
    "file_tests/mds/test_mds_integration.py",
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
        
        # 상세한 결과 분석
        test_result = {
            "file": test_file,
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "duration": duration,
            "returncode": result.returncode,
            "details": analyze_test_output(result.stdout, result.stderr, result.returncode)
        }
        
        # 즉시 결과 출력
        print_test_file_result(test_result)
        
        return test_result
        
    except subprocess.TimeoutExpired:
        test_result = {
            "file": test_file,
            "success": False,
            "stdout": "",
            "stderr": "테스트 타임아웃 (5분 초과)",
            "duration": 300,
            "returncode": -1,
            "details": {"error_type": "timeout", "message": "테스트가 5분을 초과했습니다."}
        }
        print_test_file_result(test_result)
        return test_result
        
    except Exception as e:
        test_result = {
            "file": test_file,
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "duration": 0,
            "returncode": -1,
            "details": {"error_type": "exception", "message": str(e)}
        }
        print_test_file_result(test_result)
        return test_result

def analyze_test_output(stdout: str, stderr: str, returncode: int) -> Dict[str, any]:
    """테스트 출력 분석"""
    details = {
        "test_methods": [],
        "assertion_errors": [],
        "import_errors": [],
        "connection_errors": [],
        "other_errors": [],
        "success_count": 0,
        "failure_count": 0,
        "execution_summary": "",
        "test_start_time": "",
        "test_end_time": "",
        "data_cleanup_info": []
    }
    
    # 성공/실패 패턴 분석
    lines = stdout.split('\n')
    for line in lines:
        line = line.strip()
        
        # 테스트 시작/종료 시간
        if "통합 테스트 시작" in line:
            details["test_start_time"] = line
        elif "통합 테스트" in line and ("통과" in line or "완료" in line):
            details["execution_summary"] = line
            details["test_end_time"] = line
        
        # 테스트 메서드 실행 확인
        if any(keyword in line for keyword in ["테스트", "성공", "완료", "생성", "조회", "삭제", "수정"]):
            if any(success_word in line for success_word in ["성공", "완료", "통과"]):
                details["test_methods"].append(line)
                details["success_count"] += 1
            elif any(test_word in line for test_word in ["테스트", "생성", "조회", "삭제", "수정"]):
                details["test_methods"].append(line)
        
        # 데이터 정리 정보
        if "정리" in line or "삭제" in line:
            details["data_cleanup_info"].append(line)
    
    # 에러 분석
    if stderr:
        error_lines = stderr.split('\n')
        for line in error_lines:
            line = line.strip()
            
            if "AssertionError" in line:
                details["assertion_errors"].append(line)
            elif "ModuleNotFoundError" in line or "ImportError" in line:
                details["import_errors"].append(line)
            elif "ConnectionError" in line or "Connection refused" in line:
                details["connection_errors"].append(line)
            elif "UnicodeEncodeError" in line:
                details["other_errors"].append("인코딩 오류: " + line)
            elif "FileNotFoundError" in line:
                details["other_errors"].append("파일 없음: " + line)
            elif "TimeoutError" in line:
                details["other_errors"].append("타임아웃: " + line)
            elif line and not line.startswith("Traceback") and not line.startswith("  File"):
                details["other_errors"].append(line)
    
    # 실패 카운트 계산
    details["failure_count"] = len(details["assertion_errors"]) + len(details["import_errors"]) + len(details["connection_errors"]) + len(details["other_errors"])
    
    return details

def print_test_file_result(result: Dict[str, any]):
    """개별 테스트 파일 결과 출력"""
    print(f"\n{'='*60}")
    print(f"[결과] {result['file']} 실행 결과")
    print(f"{'='*60}")
    
    # 기본 정보
    status_text = "성공" if result["success"] else "실패"
    print(f"[상태] {status_text}")
    print(f"[시간] 실행 시간: {result['duration']:.2f}초")
    print(f"[코드] 반환 코드: {result['returncode']}")
    
    # 상세 분석 결과
    details = result.get("details", {})
    
    # 테스트 메서드 실행 현황
    if details.get("test_methods"):
        print(f"\n[메서드] 실행된 테스트 메서드:")
        for method in details["test_methods"][:5]:  # 최대 5개만 출력
            print(f"   • {method}")
        if len(details["test_methods"]) > 5:
            print(f"   ... 외 {len(details['test_methods']) - 5}개")
    
    # 성공/실패 통계
    success_count = details.get("success_count", 0)
    failure_count = details.get("failure_count", 0)
    print(f"\n[통계] 실행 통계:")
    print(f"   • 성공: {success_count}개")
    print(f"   • 실패: {failure_count}개")
    
    # 에러 분석
    if details.get("assertion_errors"):
        print(f"\n[에러] AssertionError ({len(details['assertion_errors'])}개):")
        for error in details["assertion_errors"][:3]:  # 최대 3개만 출력
            print(f"   • {error}")
    
    if details.get("import_errors"):
        print(f"\n[에러] ImportError ({len(details['import_errors'])}개):")
        for error in details["import_errors"][:3]:
            print(f"   • {error}")
    
    if details.get("connection_errors"):
        print(f"\n[에러] ConnectionError ({len(details['connection_errors'])}개):")
        for error in details["connection_errors"][:3]:
            print(f"   • {error}")
    
    if details.get("other_errors"):
        print(f"\n[에러] 기타 에러 ({len(details['other_errors'])}개):")
        for error in details["other_errors"][:3]:
            print(f"   • {error}")
    
    # 테스트 시작/종료 정보
    if details.get("test_start_time"):
        print(f"\n[시간] 테스트 시작:")
        print(f"   • {details['test_start_time']}")
    
    if details.get("test_end_time"):
        print(f"\n[시간] 테스트 종료:")
        print(f"   • {details['test_end_time']}")
    
    # 실행 요약
    if details.get("execution_summary"):
        print(f"\n[요약] 실행 요약:")
        print(f"   • {details['execution_summary']}")
    
    # 데이터 정리 정보
    if details.get("data_cleanup_info"):
        print(f"\n[정리] 데이터 정리:")
        for cleanup in details["data_cleanup_info"][:3]:  # 최대 3개만 출력
            print(f"   • {cleanup}")
        if len(details["data_cleanup_info"]) > 3:
            print(f"   ... 외 {len(details['data_cleanup_info']) - 3}개")
    
    # 원본 출력 (간단히)
    if result["stdout"] and len(result["stdout"]) > 200:
        print(f"\n[출력] 출력 미리보기:")
        print(f"   {result['stdout'][:200]}...")
    
    if result["stderr"]:
        print(f"\n[에러] 에러 출력:")
        error_lines = result["stderr"].split('\n')
        for line in error_lines[:5]:  # 최대 5줄만 출력
            if line.strip():
                print(f"   {line}")
        if len(error_lines) > 5:
            print(f"   ... 외 {len(error_lines) - 5}줄")
    
    # 디버깅 정보
    if not result["success"]:
        print(f"\n[디버그] 디버깅 정보:")
        print(f"   • 반환 코드: {result['returncode']}")
        print(f"   • 실행 시간: {result['duration']:.2f}초")
        if details.get("error_type"):
            print(f"   • 에러 타입: {details['error_type']}")
    
    print(f"{'='*60}")

def print_test_results(results: List[Dict[str, any]]):
    """전체 테스트 결과 요약 출력"""
    print(f"\n{'='*60}")
    print("[요약] 전체 테스트 결과 요약")
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
    
    # 실패한 테스트 목록
    if failed_tests > 0:
        print(f"\n[실패] 실패한 테스트:")
        for result in results:
            if not result["success"]:
                print(f"   • {result['file']} ({result['duration']:.2f}초)")
    
    # 성공한 테스트 목록
    if passed_tests > 0:
        print(f"\n[성공] 성공한 테스트:")
        for result in results:
            if result["success"]:
                print(f"   • {result['file']} ({result['duration']:.2f}초)")
    
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

def main():
    """메인 실행 함수"""
    print("[시스템] BrainT 채팅 시스템 테스트 스위트")
    print("="*60)
    
    # 백엔드 서버 상태 확인
    if not check_backend_server():
        print("\n[실패] 백엔드 서버를 먼저 실행한 후 테스트를 다시 실행해주세요.")
        sys.exit(1)
    
    print(f"\n[시작] {len(TEST_FILES)}개 테스트 파일 실행 시작...")
    
    # 테스트 실행
    results = []
    for i, test_file in enumerate(TEST_FILES, 1):
        print(f"\n[진행] 진행률: {i}/{len(TEST_FILES)} ({i/len(TEST_FILES)*100:.1f}%)")
        
        if os.path.exists(test_file):
            result = run_test_file(test_file)
            results.append(result)
        else:
            print(f"[경고] {test_file} 파일을 찾을 수 없습니다.")
            results.append({
                "file": test_file,
                "success": False,
                "stdout": "",
                "stderr": "파일을 찾을 수 없습니다.",
                "duration": 0,
                "returncode": -1,
                "details": {"error_type": "file_not_found", "message": "테스트 파일이 존재하지 않습니다."}
            })
    
    # 최종 결과 출력
    all_passed = print_test_results(results)
    
    # 최종 결과
    print(f"\n{'='*60}")
    if all_passed:
        print("[성공] 모든 테스트가 성공했습니다!")
        print("[확인] 시스템이 정상적으로 작동하고 있습니다.")
        sys.exit(0)
    else:
        print("[실패] 일부 테스트가 실패했습니다.")
        print("[안내] 실패한 테스트를 확인하고 수정해주세요.")
        sys.exit(1)

if __name__ == "__main__":
    main() 