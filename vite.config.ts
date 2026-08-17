import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { resolve } from 'node:path';

/**
 * Builds everything that can be a real ES module inside the extension:
 * the panel UI, the popup UI and the MV3 service worker.
 * The content script has different constraints and is built by
 * `vite.content.config.ts` (classic script, IIFE, no code splitting).
 */
export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome114',
    sourcemap: true,
    // Chrome refuses `modulepreload` hints on extension pages ("cross-world
    // extension resource mismatch") and logs a warning for each one. The
    // chunks load fine from the entry script, so the hints are pure noise.
    modulePreload: false,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'src/panel/index.html'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        format: 'es',
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
