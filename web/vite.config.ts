import { defineConfig } from 'vite'

// Use relative asset paths so the app can live under any subpath
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      }
    }
  }
})
