/**
 * Getting the picture of a drawing out of the app: from SVG to PNG, into a
 * file, onto the clipboard.
 *
 * Like utils/projectFileAccess this layer talks to the user (the picker, the
 * toasts). Saving a picture says nothing about the project: its "changed"
 * mark is not touched.
 */

import { toast } from 'sonner';
import { fileSlug } from './projectFile';
import { getT } from '@/i18n';

export type ImageFormat = 'png' | 'svg';

/** How many pixels a PNG gives to each unit of the drawing: what the user picks from */
export const PNG_SCALES = [1, 2, 3] as const;
export type PngScale = (typeof PNG_SCALES)[number];

/**
 * The largest picture every current browser can paint (the tightest limits
 * are Safari's): beyond them the picture would come out empty.
 */
export const MAX_PNG_SIDE = 16384;
export const MAX_PNG_PIXELS = 64_000_000;

/**
 * The scale a PNG is made at: the one asked for, or the largest the browser
 * can paint when the drawing is too big for it.
 */
export function fitScale(width: number, height: number, wanted: number): number {
  if (width <= 0 || height <= 0) return wanted;
  const bySide = MAX_PNG_SIDE / Math.max(width, height);
  const byArea = Math.sqrt(MAX_PNG_PIXELS / (width * height));
  const limit = Math.min(bySide, byArea);
  // Two decimals, rounded down: never a pixel over the limit
  return wanted <= limit ? wanted : Math.floor(limit * 100) / 100;
}

/** File name suggested for a picture: project (and canvas, when given) made filename-safe */
export function imageFileName(
  projectName: string,
  canvasName: string | null,
  format: ImageFormat
): string {
  const parts = [fileSlug(projectName), canvasName ? fileSlug(canvasName) : ''].filter(Boolean);
  return `${parts.join('-') || getT().exportImage.fileName}.${format}`;
}

export function svgBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

/** An SVG document as an address an `<img>` can show */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Paint an SVG document as a PNG of the given size in pixels. The document
 * must declare that same size, so that it is painted sharp and not stretched.
 */
export function rasterizeSvg(svg: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('this browser cannot paint pictures');
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('the picture came out empty'));
        }, 'image/png');
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    image.onerror = () => reject(new Error('the drawing could not be painted'));
    image.src = svgDataUrl(svg);
  });
}

// ---------- the clipboard ----------

/** True where the browser lets a page put a picture on the clipboard */
export function canCopyImage(): boolean {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'
  );
}

/** Put a PNG on the clipboard, ready to be pasted into a document or a message */
export async function copyImage(png: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  } catch (error) {
    console.error('[Image] Copy failed:', error);
    const { notices } = getT().exportImage;
    toast.error(notices.cannotCopy, { description: notices.cannotCopyDetail });
    return false;
  }
  toast.success(getT().exportImage.notices.copied);
  return true;
}

// ---------- the file ----------
// (showSaveFilePicker is not in TypeScript's DOM lib: only what is used here)

interface ImageFileHandle {
  readonly name: string;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

interface SavePickerHost {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<ImageFileHandle>;
}

const FILE_ACCEPT: Record<ImageFormat, Record<string, string[]>> = {
  png: { 'image/png': ['.png'] },
  svg: { 'image/svg+xml': ['.svg'] },
};

/** Read when the picker opens: its words are in the language of that moment */
function fileType(format: ImageFormat): { description: string; accept: Record<string, string[]> } {
  return { description: getT().exportImage.fileTypes[format], accept: FILE_ACCEPT[format] };
}

/** A native picker is open: a second one would be refused by the browser */
let pickerOpen = false;

/** True where saving asks the user where; elsewhere the file is downloaded */
export function canChooseWhereToSave(): boolean {
  const host: Window & SavePickerHost = window;
  return typeof host.showSaveFilePicker === 'function';
}

export type ImageSaveOutcome = 'saved' | 'downloaded' | 'cancelled' | 'failed';

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

function download(content: Blob, fileName: string): void {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Save a picture to a file. Where the browser can, the user chooses where;
 * elsewhere the file is downloaded. The picker must be reached straight from
 * the click: the picture is made before, not here.
 */
export async function saveImage(
  content: Blob,
  fileName: string,
  format: ImageFormat
): Promise<ImageSaveOutcome> {
  const host: Window & SavePickerHost = window;

  if (typeof host.showSaveFilePicker !== 'function') {
    download(content, fileName);
    toast.success(getT().exportImage.notices.downloaded(fileName));
    return 'downloaded';
  }

  if (pickerOpen) return 'cancelled';
  pickerOpen = true;
  let handle: ImageFileHandle;
  try {
    handle = await host.showSaveFilePicker({ suggestedName: fileName, types: [fileType(format)] });
  } catch (error) {
    if (isAbort(error)) return 'cancelled';
    console.error('[Image] Save picker failed:', error);
    toast.error(getT().exportImage.notices.cannotChooseWhere, {
      description: error instanceof Error && error.message ? error.message : undefined,
    });
    return 'failed';
  } finally {
    pickerOpen = false;
  }

  try {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (error) {
    if (isAbort(error)) return 'cancelled';
    console.error('[Image] Write failed:', error);
    const { notices } = getT().exportImage;
    toast.error(notices.cannotSaveTo(handle.name), { description: notices.tryElsewhere });
    return 'failed';
  }

  toast.success(getT().exportImage.notices.saved, { description: handle.name });
  return 'saved';
}
