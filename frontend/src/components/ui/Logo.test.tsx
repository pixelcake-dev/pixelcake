/**
 * Logo — which of its four files is shown: with the name or the symbol
 * alone, in colour on a light page or in its negative on a dark one. And
 * the rule of the logo with the name: never so small that it cannot be read.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { APP_NAME } from '@/constants/brand';
import LogoColour from '@/assets/pixelcake-orizzontale-colore.svg';
import LogoNegative from '@/assets/pixelcake-orizzontale-negativo.svg';
import SymbolColour from '@/assets/pixelcake-simbolo-colore.svg';
import SymbolNegative from '@/assets/pixelcake-simbolo-negativo.svg';
import Logo from './Logo';

const sources = import.meta.glob<string>('/src/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const fileOf = (image: HTMLElement) => image.getAttribute('src') ?? '';

describe('Logo', () => {
  beforeEach(() => {
    useUIStore.setState({ darkMode: false });
  });

  it('has four files, each different from the others', () => {
    expect(new Set([LogoColour, LogoNegative, SymbolColour, SymbolNegative]).size).toBe(4);
  });

  it('with the name, in colour on a light page', () => {
    render(<Logo />);
    const logo = screen.getByAltText(`${APP_NAME} Logo`);
    expect(fileOf(logo)).toBe(LogoColour);
  });

  it('with the name, in its negative on a dark page', () => {
    useUIStore.setState({ darkMode: true });
    render(<Logo />);
    expect(fileOf(screen.getByAltText(`${APP_NAME} Logo`))).toBe(LogoNegative);
  });

  it('the symbol alone has its own files and its own name', () => {
    const { unmount } = render(<Logo symbol size={18} />);
    const symbol = screen.getByAltText(`${APP_NAME} Icon`);
    expect(fileOf(symbol)).toBe(SymbolColour);
    // its size is its height: the symbol is not a wide picture
    expect(symbol.style.height).toBe('18px');
    unmount();

    useUIStore.setState({ darkMode: true });
    render(<Logo symbol size={18} />);
    expect(fileOf(screen.getByAltText(`${APP_NAME} Icon`))).toBe(SymbolNegative);
  });

  it('the logo with the name is never asked narrower than 110 pixels: a small place takes the symbol', () => {
    const uses = Object.entries(sources)
      .filter(([path]) => !path.endsWith('.test.tsx'))
      .flatMap(([path, text]) => [...text.matchAll(/<Logo\b([^>]*)\/>/g)].map(match => ({ path, props: match[1] })));
    expect(uses.length).toBeGreaterThan(2);

    const tooSmall = uses.filter(({ props }) => {
      if (/\bsymbol\b/.test(props)) return false;
      const size = /size=\{(\d+)\}/.exec(props);
      return size !== null && Number(size[1]) < 110;
    });
    expect(tooSmall).toEqual([]);
  });
});
