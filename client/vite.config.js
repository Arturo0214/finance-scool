import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  cacheDir: '/tmp/vite-cache-financescool',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://finance-scool-production.up.railway.app',
        changeOrigin: true,
        secure: true
      }
    }
  },
  build: { outDir: 'dist', sourcemap: false, emptyOutDir: false }
})
