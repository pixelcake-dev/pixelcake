/**
 * A sentence of the dictionary with something inside it: words shown as
 * code, a piece the screen draws itself. The sentence stays one text, so
 * each language puts the pieces where its word order wants them.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Rich } from './Rich';
import { richPieces } from './richPieces';

describe('Rich', () => {
  it('shows a plain text as it is', () => {
    const { container } = render(<Rich text="No rules: only the zone policy decides." />);

    expect(container.innerHTML).toBe('No rules: only the zone policy decides.');
  });

  it('shows the words between backticks as code', () => {
    const { container } = render(<Rich text="Type `help` in the terminal, or `show routes R1`." />);

    expect(container.textContent).toBe('Type help in the terminal, or show routes R1.');
    expect([...container.querySelectorAll('code')].map((code) => code.textContent)).toEqual([
      'help',
      'show routes R1',
    ]);
  });

  it('lets the screen draw the code its own way', () => {
    const { container } = render(
      <Rich text="A file `.yaml`" code={(words) => <kbd className="mono">{words}</kbd>} />
    );

    expect(container.querySelector('kbd.mono')?.textContent).toBe('.yaml');
    expect(container.querySelector('code')).toBeNull();
  });

  it('hands a named piece to whoever draws it, wherever the language puts it', () => {
    const parts = { link: (words: string) => <button type="button">{words}</button> };

    const italian = render(<Rich text="Per darne uno a un'altra: <link>scheda «Porte»</link>." parts={parts} />);
    expect(italian.container.querySelector('button')?.textContent).toBe('scheda «Porte»');
    expect(italian.container.textContent).toBe("Per darne uno a un'altra: scheda «Porte».");
    italian.unmount();

    const english = render(<Rich text="To give one to another port, go to the <link>“Ports” tab</link>." parts={parts} />);
    expect(english.container.querySelector('button')?.textContent).toBe('“Ports” tab');
    expect(english.container.textContent).toBe('To give one to another port, go to the “Ports” tab.');
  });

  it('a piece without words is a place for a value: what a person typed never goes through the text', () => {
    const name = 'PC `one` <b>';
    const { container } = render(<Rich text="Linked to <peer/>." parts={{ peer: () => <strong>{name}</strong> }} />);

    expect(container.querySelector('strong')?.textContent).toBe(name);
    expect(container.textContent).toBe(`Linked to ${name}.`);
    expect(container.querySelector('code')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('never loses the words of a piece nobody draws', () => {
    const { container } = render(<Rich text="Go to the <link>“Ports” tab</link>." />);

    expect(container.textContent).toBe('Go to the “Ports” tab.');
  });

  it('reads the pieces of a text in order', () => {
    expect(richPieces('<port/>: `x` and <problem>no address</problem>.')).toEqual([
      { kind: 'part', name: 'port', words: '' },
      { kind: 'text', words: ': ' },
      { kind: 'code', words: 'x' },
      { kind: 'text', words: ' and ' },
      { kind: 'part', name: 'problem', words: 'no address' },
      { kind: 'text', words: '.' },
    ]);
    // (what only looks like a mark is text: 1 < 2, a lone backtick)
    expect(richPieces('1 < 2 and `')).toEqual([{ kind: 'text', words: '1 < 2 and `' }]);
  });
});
