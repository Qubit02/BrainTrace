########################  base stage  #################################
FROM node:20.16.0-bookworm-slim AS base  
WORKDIR /app

# Electron 의존성 설치 (GLib, GTK 등)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       libglib2.0-0 \
       libgtk-3-0 \
       libnotify4 \
       libnss3 \
       libxss1 \
       libxtst6 \
       libxkbfile1 \
       libasound2 \
       libx11-xcb1 \
       libdrm2 \
  && rm -rf /var/lib/apt/lists/*

# 의존성 레이어 캐시
COPY frontend/package*.json ./
RUN npm ci

########################  dev stage  ###################################
FROM base AS dev
COPY frontend/ .

EXPOSE 5173

# ── 브라우저 전용 테스트 ───────────────────────────────────────────────
# Vite 개발 서버만 띄워서 http://localhost:5173 로 UI 확인
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]

# ── Electron GUI 띄우려면(복잡—X11 포워딩 or xvfb 필요) ─────────────────
# CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

########################  prod build stage ################################
FROM base AS build
COPY frontend/ .
RUN npm run build

########################  prod runtime ####################################
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
