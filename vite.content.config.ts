import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Content scripts are classic scripts: no ESM, no dynamic import, no code
 * splitting. They also must not carry React or any heavy dependency — the
 * content script only detects the page, injects the launcher and hosts the
 * panel iframe. All product UI lives in the extension-origin iframe.
 */
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome114',
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'PintoContent',
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: { assetFileNames: 'content.[ext]', inlineDynamicImports: true },
    },
  },
});
