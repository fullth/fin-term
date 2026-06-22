import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 시 /api 요청을 BFF(8787)로 프록시. 운영은 BFF 가 정적 빌드를 함께 서빙.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist' },
});
