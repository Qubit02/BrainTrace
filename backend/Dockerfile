######################## build & dev stage ########################
# Python 3.12 슬림 이미지를 베이스로 사용 : 경량화
FROM python:3.12-slim AS base

# 시스템 빌드 의존성 설치 및 캐시 정리
# jdk는 KoNLPy 패키지에서 필요
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential default-jdk g++ && \
    rm -rf /var/lib/apt/lists/*  # APT 캐시 삭제로 이미지 용량 절감

# 의존성만 먼저 복사하여 Docker 레이어 캐시 활용
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt  # 빠른 재빌드를 위한 의존성 설치

######################## dev stage ########################
# 개발용 스테이지
FROM base AS dev  
# 작업 디렉터리 설정
WORKDIR /app  

# 애플리케이션 소스 코드 복사
COPY backend/ .

# JVM 경로 환경 변수 설정
ENV JAVA_HOME=/usr/lib/jvm/default-java
# Python 출력 즉시 표시 (버퍼 비활성화)
ENV PYTHONUNBUFFERED=1

# 개발 서버 실행 (코드 변경 감지 시 자동 재시작)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]