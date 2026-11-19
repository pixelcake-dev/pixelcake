/**
 * What is asked of the browser about the drawing on screen: the width of a
 * piece of text, for the picture of the drawing, and the size each device
 * has, for an area drawn around some.
 *
 * Kept apart from utils/drawingImage, which only does arithmetic.
 */

import {
  FONT_FAMILY,
  MONO_FONT_FAMILY,
  approximateTextWidth,
  type Size,
  type TextMeasure,
} from './drawingImage';
import { HAND_FONT } from './canvasMarks';

/**
 * The size of every device on the canvas, as it is laid out (zoom does not
 * count): its frame, which is as large selected or not.
 */
export function measureDeviceSizes(root: ParentNode = document): Map<string, Size> {
  const sizes = new Map<string, Size>();
  root.querySelectorAll<HTMLElement>('.react-flow__node[data-id]').forEach(node => {
    const id = node.dataset.id;
    const box = node.querySelector<HTMLElement>('.network-device') ?? node;
    if (!id || box.offsetWidth === 0 || box.offsetHeight === 0) return;
    sizes.set(id, { width: box.offsetWidth, height: box.offsetHeight });
  });
  return sizes;
}

/**
 * Measure text the way the browser will draw it. Where there is nothing to
 * measure with, widths are estimated.
 */
export function createTextMeasure(): TextMeasure {
  let context: CanvasRenderingContext2D | null = null;
  try {
    // Asked for only where it exists, so that nothing is reported as missing
    if (typeof CanvasRenderingContext2D !== 'undefined') {
      context = document.createElement('canvas').getContext('2d');
    }
  } catch {
    context = null;
  }
  if (!context) return approximateTextWidth;

  const canvas = context;
  return (text, font) => {
    const family = font.hand ? HAND_FONT.family : font.mono ? MONO_FONT_FAMILY : FONT_FAMILY;
    canvas.font = `${font.weight} ${font.size}px ${family}`;
    return canvas.measureText(text).width;
  };
}
