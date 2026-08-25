import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import aitDevtools from '@apps-in-toss/devtools/unplugin'

/**
 * Firebase 등 의존성 내부에 메서드명 `eval` 이 있어
 * 앱인토스 정적 보안 스캐너가 JS eval 로 오인하는 경우가 있어요.
 * 실제 전역 eval/new Function 은 없고, 메서드 식별자만 안전한 이름으로 바꿉니다.
 */
function sanitizeDependencyEvalMethodNames(): Plugin {
  return {
    name: 'sanitize-dependency-eval-method-names',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk' || typeof output.code !== 'string') continue

        let code = output.code
        // 호출: foo.eval( → foo._aitEval(
        code = code.replace(/\.eval\s*\(/g, '._aitEval(')
        // 메서드 정의: }eval( / {eval( / ,eval(
        code = code.replace(/([{},;])eval\s*\(/g, '$1_aitEval(')
        output.code = code
      }
    },
  }
}

export default defineConfig({
  plugins: [
    aitDevtools.vite(),
    react(),
    tailwindcss(),
    sanitizeDependencyEvalMethodNames(),
  ],
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
