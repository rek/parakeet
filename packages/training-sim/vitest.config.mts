import { defineConfig } from 'vitest/config'
import * as path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@parakeet/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@parakeet/training-engine': path.resolve(__dirname, '../../packages/training-engine/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
  },
})
