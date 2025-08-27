##### 0) base ########################################################
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

##### 1) deps ########################################################
FROM base AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-21-jre-headless \
 && rm -rf /var/lib/apt/lists/*
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64

##### 2) builder: 의존성 설치 후 /install 로 복사 ####################
FROM deps AS builder
COPY requirements.txt .
# --prefix=/install  👉  파이썬 패키지를 지정 경로로 “설치본만” 배출
RUN pip install --upgrade pip \
 && pip install --no-cache-dir --prefix=/install -r requirements.txt \
 && pip cache purge

##### 3) dev #########################################################
FROM deps AS dev
# 설치본만 복사 (휠 X)
COPY --from=builder /install /usr/local
# 코드 볼륨으로 마운트할 거라면 COPY 생략 가능
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
