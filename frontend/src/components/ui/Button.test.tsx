/**
 * Button — the one thing it must never do: look ready when it is not.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('a button that cannot be pressed is dimmed, whatever its kind, and does nothing', () => {
    const onClick = vi.fn();
    render(
      <>
        <Button variant="primary" disabled onClick={onClick}>
          Salva
        </Button>
        <Button variant="secondary" disabled onClick={onClick}>
          Copia
        </Button>
        <Button variant="danger" disabled onClick={onClick}>
          Elimina
        </Button>
      </>
    );

    for (const name of ['Salva', 'Copia', 'Elimina']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      // the style of the disabled state is on every kind of button
      expect(button.className).toContain('disabled:opacity-50');
      expect(button.className).toContain('disabled:cursor-not-allowed');
      fireEvent.click(button);
    }
    expect(onClick).not.toHaveBeenCalled();
  });

  it('a button that can be pressed is, and keeps the classes it is given', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" className="w-full" onClick={onClick}>
        Salva
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Salva' });
    expect(button).toBeEnabled();
    expect(button.className).toContain('w-full');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
