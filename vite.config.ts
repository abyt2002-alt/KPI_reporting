import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8002'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5175,
      proxy: {
        '/health': { target: proxyTarget, changeOrigin: true },
        '/upload': { target: proxyTarget, changeOrigin: true },
        '/ingest': { target: proxyTarget, changeOrigin: true },
        '/analysis': { target: proxyTarget, changeOrigin: true },
        '/predict': { target: proxyTarget, changeOrigin: true },
        '/kalman': { target: proxyTarget, changeOrigin: true },
        '/ai': { target: proxyTarget, changeOrigin: true },
        '/api/db': { target: proxyTarget, changeOrigin: true },
      },
    },
  }
})
