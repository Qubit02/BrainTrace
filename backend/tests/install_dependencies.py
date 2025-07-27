#!/usr/bin/env python3
"""
테스트에 필요한 의존성 라이브러리 설치 스크립트
"""

import subprocess
import sys
import os

def install_package(package):
    """패키지 설치"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✅ {package} 설치 완료")
        return True
    except subprocess.CalledProcessError:
        print(f"❌ {package} 설치 실패")
        return False

def main():
    """메인 실행 함수"""
    print("BrainT 테스트 의존성 라이브러리 설치")
    print("=" * 50)
    
    # 필요한 패키지 목록
    packages = [
        "requests",
        "python-docx",
        "reportlab",
        "PyPDF2",
        "markdown"
    ]
    
    success_count = 0
    total_count = len(packages)
    
    for package in packages:
        if install_package(package):
            success_count += 1
    
    print("=" * 50)
    print(f"설치 완료: {success_count}/{total_count}")
    
    if success_count == total_count:
        print("✅ 모든 의존성 라이브러리 설치 완료!")
        print("\n이제 테스트를 실행할 수 있습니다:")
        print("  python run_all_tests.py")
    else:
        print("❌ 일부 패키지 설치에 실패했습니다.")
        print("수동으로 설치해주세요:")
        for package in packages:
            print(f"  pip install {package}")

if __name__ == "__main__":
    main() 