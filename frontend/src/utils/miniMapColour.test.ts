import { describe, it, expect } from 'vitest';
import styleSheet from '../index.css?raw';
import canvasSource from '../components/Canvas/NetworkCanvas.tsx?raw';
import { useTemplateStore } from '@/store/templateStore';
import { MINI_MAP_COLOURS, MINI_MAP_FALLBACK, miniMapColour } from './miniMapColour';

describe('the colour of a device on the small map', () => {
  it('is one for each type, and no two types share it', () => {
    const colours = Object.values(MINI_MAP_COLOURS);
    expect(colours).toHaveLength(9);
    expect(new Set(colours).size).toBe(colours.length);
    expect(colours).not.toContain(MINI_MAP_FALLBACK);
  });

  it('every device the app can add has one of its own type', () => {
    const { templates } = useTemplateStore.getState();
    expect(templates.length).toBeGreaterThanOrEqual(20);
    for (const template of templates) {
      expect(miniMapColour(template.type), template.name).not.toBe(MINI_MAP_FALLBACK);
      expect(miniMapColour(template.type), template.name).toBe(MINI_MAP_COLOURS[template.type]);
    }
  });

  it('a type it does not know is grey', () => {
    expect(miniMapColour('Mainframe')).toBe(MINI_MAP_FALLBACK);
    expect(miniMapColour(undefined)).toBe(MINI_MAP_FALLBACK);
  });

  it('the style sheet does not paint the devices of the map one colour over it', () => {
    const sheet = styleSheet.replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /\.react-flow \.react-flow__minimap-node\s*\{([^{}]*)\}/.exec(sheet)?.[1];
    expect(rule).toBeDefined();
    expect(rule).not.toMatch(/fill\s*:/);
  });

  it('the canvas hands the colours to the map', () => {
    expect(canvasSource).toMatch(/<MiniMap[^>]*nodeColor=\{/);
  });
});
