import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,  // 개발 서버 포트 설정
    strictPort: true,  // 포트 충돌 시 실행 중지
    open: false,  // Electron에서 실행하므로 브라우저 자동 열기 비활성화
  },
  build: {
    outDir: 'dist', // 빌드 결과물 저장 위치
  }
})
