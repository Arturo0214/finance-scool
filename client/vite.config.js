import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  cacheDir: '/tmp/vite-cache-financescool',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // VITE_API_LOCAL=1 → backend local (npm run server); default → Railway
        target: process.env.VITE_API_LOCAL ? 'http://localhost:3001' : 'https://finance-scool-production.up.railway.app',
        changeOrigin: true,
        secure: !process.env.VITE_API_LOCAL
      }
    }
  },
  build: { outDir: 'dist', sourcemap: false, emptyOutDir: false }
})
