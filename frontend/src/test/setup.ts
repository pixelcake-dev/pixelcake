import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { registerBundledIcons } from '@/utils/bundledIcons';
import { resetConfirms } from './confirm';
import { LANGUAGE_KEY, getLanguage, setLanguage } from '@/i18n';
import { FIRST_TRY_SEEN_KEY, TOUR_SEEN_KEY } from '@/utils/firstSteps';

// Tests read the interface in Italian, the language its words were first
// written in: a test that wants English asks for it (`setLanguage('en')`).
// jsdom presents itself as an English browser, so the browser of the tests
// is made an Italian one: whatever starts the app again in a test (a store
// loaded from scratch) then detects Italian, with nothing remembered
Object.defineProperty(window.navigator, 'language', { value: 'it-IT', configurable: true });
Object.defineProperty(window.navigator, 'languages', { value: ['it-IT', 'it'], configurable: true });
// (the language was detected when this file was loaded, before the two lines above)
setLanguage('it');
localStorage.removeItem(LANGUAGE_KEY);

// The guided tour and the first question of a sample belong to a first
// visit: the browser of the tests has seen both, so that leaving the welcome
// screen or loading the company sample brings up nothing over the screen
// being tested. store/guideStore reads it when it is loaded, after this; the
// tests of the first steps start a visit afresh (`guideAtStart`)
localStorage.setItem(TOUR_SEEN_KEY, 'true');
localStorage.setItem(FIRST_TRY_SEEN_KEY, 'true');

// The app registers its icons at start-up (main.tsx); tests do the same.
// Without this every icon drawn by a test is requested from the icon API,
// and an answer that arrives after the test environment is gone fails the run
registerBundledIcons();

// Cleanup after each test
afterEach(() => {
  cleanup();
  // A question asked in the window of the app does not outlive its test
  resetConfirms();
  // Nor does a language chosen by a test
  if (getLanguage() !== 'it') {
    setLanguage('it');
    localStorage.removeItem(LANGUAGE_KEY);
  }
});
