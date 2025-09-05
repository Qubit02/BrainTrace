######################## base ########################
# 경량 Node 이미지
FROM node:20.16.0-bookworm-slim AS base

# 작업 디렉터리 통일
WORKDIR /app

# 의존성 레이어 캐시 (package.json, lock만 복사)
COPY ./package*.json ./
RUN npm ci

######################## dev ########################
FROM base AS dev

# 앱 소스 (volumes 마운트와 병행 가능)
COPY ./ ./

# 개발 서버 포트 문서화
EXPOSE 5173

# 브라우저에서 http://localhost:5173 접속
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
