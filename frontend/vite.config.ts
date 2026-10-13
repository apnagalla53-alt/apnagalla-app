import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Development-only proxy lets LAN browsers use their current host for the API.
  // Production deployments provide the reverse proxy described in deployment docs.
  server: {
    proxy: {
      '/api': {
        target: process.env.DEV_API_TARGET || 'http://127.0.0.1:8010',
        changeOrigin: true,
      },
    },
  },
})
