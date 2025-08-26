# Python 3.12 slim : 경량 이미지
FROM python:3.12-slim AS base

WORKDIR /app

############### 1) builder ────────────────────────────────────────────
FROM base AS builder

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential default-jdk-headless \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir --prefix=/install -r requirements.txt

############### 2) dev (hot-reload) ───────────────────────────────────
FROM base AS dev

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      default-jdk-headless \
 && rm -rf /var/lib/apt/lists/*

# 빌드 결과물 복사
COPY --from=builder /install /usr/local

# 애플리케이션 소스
COPY . .

ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

############### 3) prod (slim runtime) ────────────────────────────────
FROM base AS prod

COPY --from=builder /install /usr/local
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
