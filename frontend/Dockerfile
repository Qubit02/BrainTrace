######################## base stage ########################
 # 기본 Node.js 슬림 이미지를 사용 : 경량화
FROM node:20.19.0-bookworm-slim AS base
WORKDIR /app  


# 의존성 레이어 캐시: package.json과 package-lock.json 기준으로 설치
COPY frontend/package*.json ./
RUN npm ci  

######################## dev stage ########################
 # 개발용 스테이지
FROM base AS dev
# 전체 소스 코드 복사
COPY frontend/ .
# Vite 개발 서버 포트 열기
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]