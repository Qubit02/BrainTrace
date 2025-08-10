# ---------- base (공통) ----------
# Python 3.12 슬림: 경량 베이스
FROM python:3.12-slim AS base

# KoNLPy(JVM 필요) 및 일부 빌드 의존성
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        g++ \
        default-jdk \
    && rm -rf /var/lib/apt/lists/*

# JVM 경로 (KoNLPy용)
ENV JAVA_HOME=/usr/lib/jvm/default-java

# 작업 디렉터리 통일
WORKDIR /app

# 의존성 캐시 레이어: requirements만 먼저 복사
COPY backend/requirements.txt ./requirements.txt

# 패키지 설치 (캐시 극대화, 이미지 용량 절감을 위해 --no-cache-dir)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ---------- dev ----------
# 개발용: 소스 코드 복사 + --reload로 핫 리로드
FROM base AS dev

# 앱 소스 (volumes로 마운트해도 무방; 빌드 단독 실행 가능하도록 복사 유지)
COPY backend/ ./

# 개발 서버 포트 문서화
EXPOSE 8000

# 코드 변경 시 자동 재시작
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
