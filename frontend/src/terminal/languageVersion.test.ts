/**
 * The version of the language (NCL) is said in three places: the banner that
 * `help` prints, the title of the reference (docs/terminal-commands.md) and
 * the newest "New in" note under it. The first reads the constant; this test
 * holds the other two to it, so that a new version cannot be half announced.
 */

import { describe, it, expect, vi } from 'vitest';
import { executeCommand } from './executor';
import { NCL_VERSION } from './types';
import languageReference from '../../../docs/terminal-commands.md?raw';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

describe('the version of the language', () => {
  it('is a version', () => {
    expect(NCL_VERSION).toMatch(/^\d+\.\d+$/);
  });

  it('is the one the banner of the terminal says', () => {
    const [banner] = executeCommand('help', { deviceLabel: null }).lines;
    expect(banner.text).toBe(
      `PixelCake terminal — NCL v${NCL_VERSION} (Network Command Language, vendor-neutral)`
    );
  });

  it('is the one in the title of the reference', () => {
    const [title] = languageReference.split('\n');
    expect(title.trim()).toBe(`# NCL — Network Command Language v${NCL_VERSION}`);
  });

  it('is the newest version the reference says something new about', () => {
    const noted = [...languageReference.matchAll(/\*\*New in v(\d+\.\d+):\*\*/g)].map(match => match[1]);
    expect(noted.length).toBeGreaterThan(0);
    expect(noted[0]).toBe(NCL_VERSION);
    // newest first, each once
    const numbers = noted.map(Number);
    expect([...numbers].sort((a, b) => b - a)).toEqual(numbers);
    expect(new Set(noted).size).toBe(noted.length);
  });
});
