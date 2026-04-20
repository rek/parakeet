import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src'),
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@platform': path.resolve(__dirname, 'src/platform'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@parakeet/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@parakeet/training-engine': path.resolve(__dirname, '../../packages/training-engine/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      // tools/ has no project of its own; co-tested with parakeet.
      '../../tools/scripts/**/*.test.ts',
    ],
  },
});
