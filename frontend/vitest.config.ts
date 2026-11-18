import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Whole screens are rendered in jsdom, many files at a time: on a busy
    // machine a test that takes 300 ms alone can take seconds. A slow test is
    // not a failed test, so the limits are well above the default 5 s
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Node 25 and later have a localStorage of their own, empty unless a file
    // is given, and it hides the one of jsdom: the tests use jsdom's. (The
    // flag has this name from Node 22 on, where it was still experimental.)
    execArgv: ['--no-experimental-webstorage'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
