import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { resolve } from 'node:path';

/** Dev server for the screenshot harness. Never part of the extension build. */
export default defineConfig({
  root: resolve(__dirname, 'screenshots'),
  plugins: [react(), tailwind()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: { port: 5178 },
});
