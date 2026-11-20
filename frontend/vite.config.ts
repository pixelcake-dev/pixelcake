import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: true,
  },
  // The preview of the built app is what the checks and the recorder
  // (tools/media) run, the recorder once for every take: it opens no browser.
  // Without this it would take `open` from `server`
  preview: {
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
