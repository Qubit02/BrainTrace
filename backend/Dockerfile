# ---------- build 단계 ----------
FROM python:3.12-slim AS base

RUN apt-get update && \
apt-get install -y --no-install-recommends \
    build-essential default-jdk g++ && \
  rm -rf /var/lib/apt/lists/* 
    
  # 의존성만 캐싱
  COPY backend/requirements.txt .
  RUN pip install --no-cache-dir --upgrade pip && \
  pip install --no-cache-dir -r requirements.txt

  # ---------- dev 단계 ----------
  FROM base AS dev
  COPY backend/ .
  ENV JAVA_HOME=/usr/lib/jvm/default-java
  ENV PYTHONUNBUFFERED=1
  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    
  # ---------- prod 단계 ----------
  FROM base AS prod
  COPY backend/ .
  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
    