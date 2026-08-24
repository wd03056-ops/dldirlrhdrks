import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import aitDevtools from '@apps-in-toss/devtools/unplugin'

export default defineConfig({
  plugins: [aitDevtools.vite(), react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
  build: {
    // Firebase + AppsInToss SDK 포함 시 단일 청크가 커질 수 있어요
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return

          if (id.includes('firebase')) return 'firebase'
          if (id.includes('@apps-in-toss')) return 'apps-in-toss'
          if (id.includes('react-calendar')) return 'react-calendar'
          if (
            id.includes('react-dom') ||
            id.includes('/react/') ||
            id.endsWith('/react') ||
            id.includes('\\react\\')
          ) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
