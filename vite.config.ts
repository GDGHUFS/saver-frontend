import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'KAKAO_KEY')

  return {
    define: {
      'import.meta.env.VITE_KAKAO_MAP_API_KEY': JSON.stringify(env.KAKAO_KEY ?? ''),
    },
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      restoreMocks: true,
    },
  }
})
