import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { registerBundledIcons } from '@/utils/bundledIcons';
import { resetConfirms } from './confirm';

// The app registers its icons at start-up (main.tsx); tests do the same.
// Without this every icon drawn by a test is requested from the icon API,
// and an answer that arrives after the test environment is gone fails the run
registerBundledIcons();

// Cleanup after each test
afterEach(() => {
  cleanup();
  // A question asked in the window of the app does not outlive its test
  resetConfirms();
});
