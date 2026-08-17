import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // DOM-dependent suites opt in with a `@vitest-environment jsdom` docblock.
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
