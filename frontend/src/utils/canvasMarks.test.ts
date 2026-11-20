/**
 * The marks of annotation mode («Modalità appunti») as data: their ids, the words of a
 * mark of words, and a list of them read from outside (a project file, the
 * browser's storage) as the app keeps it.
 */

import { describe, it, expect } from 'vitest';
import type { CanvasMark } from '@/types';
import styleSheet from '../index.css?raw';
import {
  MARK_PALETTE,
  MARK_TEXT_MAX_LENGTH,
  nextMarkId,
  readMarks,
  tidyMark,
  tidyMarkText,
} from './canvasMarks';

const tick: CanvasMark = {
  id: 'mark-1',
  kind: 'tick',
  color: 'green',
  width: 'thick',
  points: [10, 20, 40, 50],
  seed: 7,
};
const words: CanvasMark = {
  id: 'mark-2',
  kind: 'text',
  color: 'ink',
  width: 'thin',
  points: [100, 80],
  text: 'Punto unico di guasto',
  seed: 12,
};

describe('the id of a new mark', () => {
  it('is mark-N, one above the highest there is', () => {
    expect(nextMarkId([])).toBe('mark-1');
    expect(nextMarkId([{ id: 'mark-1' }, { id: 'mark-7' }, { id: 'other' }])).toBe('mark-8');
  });
});

describe('the words of a mark', () => {
  it('keep their lines, without the spaces around them and the empty lines at the ends', () => {
    expect(tidyMarkText('  \r\n Core giù \r\nda qui  \n\n')).toBe('Core giù\nda qui');
  });

  it('are cut when longer than a mark of words can be', () => {
    expect(tidyMarkText('x'.repeat(MARK_TEXT_MAX_LENGTH + 40))).toHaveLength(MARK_TEXT_MAX_LENGTH);
  });
});

describe('a new mark, as the store keeps it', () => {
  it('has its points rounded to a tenth and its words tidy', () => {
    expect(
      tidyMark({ kind: 'text', color: 'red', width: 'thin', points: [10.04, 20.06], text: ' Giù ', seed: 3 })
    ).toEqual({ kind: 'text', color: 'red', width: 'thin', points: [10, 20.1], text: 'Giù', seed: 3 });
  });

  it('is no mark without the points it needs, or a mark of words without words', () => {
    expect(tidyMark({ ...tick, points: [10, 20] })).toBeNull();
    expect(tidyMark({ ...words, text: '   ' })).toBeNull();
    expect(tidyMark({ ...tick, points: [10, Number.NaN, 3, 4] })).toBeNull();
    // (a line by hand of one point is a dot)
    expect(tidyMark({ kind: 'pen', color: 'ink', width: 'thin', points: [5, 5], seed: 1 })).not.toBeNull();
  });

  it('keeps no words on a mark that is not one of words', () => {
    expect(tidyMark({ ...tick, text: 'ok' })).not.toHaveProperty('text');
  });
});

describe('a list of marks read from outside', () => {
  it('is kept as it was when every mark is whole', () => {
    expect(readMarks([tick, words])).toEqual({ marks: [tick, words], dropped: 0, repaired: 0 });
  });

  it('is no list when there is none, and nothing when it is not a list', () => {
    expect(readMarks(undefined)).toEqual({ marks: [], dropped: 0, repaired: 0 });
    expect(readMarks('marks')).toEqual({ marks: [], dropped: 1, repaired: 0 });
  });

  it('leaves out what cannot be drawn: no kind, too few points, a point that is no number, words without words', () => {
    const read = readMarks([
      tick,
      { ...tick, id: 'mark-3', kind: 'star' },
      { ...tick, id: 'mark-4', points: [1, 2] },
      { ...tick, id: 'mark-5', points: [1, 2, 'x', 4] },
      { ...words, id: 'mark-6', text: '' },
      null,
    ]);
    expect(read.marks).toEqual([tick]);
    expect(read.dropped).toBe(5);
  });

  it('completes the rest: a colour, a thickness, a seed, an id, a lone number at the end', () => {
    const read = readMarks([
      { ...tick, color: 'purple', width: 'huge', seed: 'x', id: '' },
      { ...words, id: 'mark-2', points: [100, 80, 3] },
      { ...tick, id: 'mark-2' },
    ]);
    expect(read.dropped).toBe(0);
    expect(read.repaired).toBe(3);
    expect(read.marks.map((mark) => mark.id)).toEqual(['mark-3', 'mark-2', 'mark-4']);
    expect(read.marks[0]).toMatchObject({ color: 'accent', width: 'thin', points: [10, 20, 40, 50] });
    expect(Number.isInteger(read.marks[0].seed)).toBe(true);
    expect(read.marks[1].points).toEqual([100, 80]);
  });

  it('gives a mark read without a seed the same seed every time: it is drawn the same after every load', () => {
    const { seed, ...withoutSeed } = tick;
    void seed;
    expect(readMarks([withoutSeed]).marks[0].seed).toBe(readMarks([withoutSeed]).marks[0].seed);
  });
});

describe('the colours of the marker', () => {
  const sheet = styleSheet.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const valueOf = (selector: string, name: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = new RegExp(`(?:^|[};])\\s*${escaped}\\s*\\{([^{}]*)\\}`).exec(sheet)?.[1] ?? '';
    return new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1].trim().toLowerCase();
  };

  it('are those of the style sheet, in the light theme and in the dark: the image draws them as the screen does', () => {
    for (const [theme, selector] of [
      ['light', ':root'],
      ['dark', '.dark'],
    ] as const) {
      for (const [colour, value] of Object.entries(MARK_PALETTE[theme])) {
        expect(valueOf(selector, `--mark-${colour}`), `${theme} ${colour}`).toBe(value.toLowerCase());
      }
    }
  });

  it('the accent is the orange of the logo, and the ink is the text of each theme', () => {
    expect(MARK_PALETTE.light.accent.toLowerCase()).toBe('#f07d2a');
    expect(MARK_PALETTE.dark.accent.toLowerCase()).toBe('#f07d2a');
    expect(MARK_PALETTE.light.ink).toBe(valueOf(':root', '--text-color'));
    expect(MARK_PALETTE.dark.ink).toBe(valueOf('.dark', '--text-color'));
  });
});
