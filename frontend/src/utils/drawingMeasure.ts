/**
 * What the picture of a drawing needs from the browser: the size each device
 * has on screen, the shape of its icon, the width of a piece of text.
 *
 * Kept apart from utils/drawingImage, which only does arithmetic.
 */

import { getIcon } from '@iconify/react';
import {
  FONT_FAMILY,
  approximateTextWidth,
  isPlainDrawing,
  type IconShape,
  type Size,
  type TextMeasure,
} from './drawingImage';

/**
 * The size of every device on the canvas, as it is laid out (zoom does not
 * count). A device that is selected, or picked out by "Magnifica", has a
 * thicker border on screen: the picture shows it as it normally is.
 */
export function measureDeviceSizes(root: ParentNode = document): Map<string, Size> {
  const sizes = new Map<string, Size>();
  root.querySelectorAll<HTMLElement>('.react-flow__node[data-id]').forEach(node => {
    const id = node.dataset.id;
    const box = node.querySelector<HTMLElement>('.network-device') ?? node;
    if (!id || box.offsetWidth === 0 || box.offsetHeight === 0) return;
    const thicker =
      node.classList.contains('selected') || box.classList.contains('device-magnified') ? 2 : 0;
    sizes.set(id, { width: box.offsetWidth - thicker, height: box.offsetHeight - thicker });
  });
  return sizes;
}

/** The shape of an icon the app has loaded; null for one it does not have, or would not embed */
export function iconShapeOf(name: string): IconShape | null {
  const icon = getIcon(name);
  if (!icon || !icon.body || !isPlainDrawing(icon.body)) return null;
  return {
    body: icon.body,
    width: icon.width,
    height: icon.height,
    left: icon.left,
    top: icon.top,
  };
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
    canvas.font = `${font.weight} ${font.size}px ${FONT_FAMILY}`;
    return canvas.measureText(text).width;
  };
}
