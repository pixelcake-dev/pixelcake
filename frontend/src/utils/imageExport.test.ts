/**
 * Getting a picture out of the app: its size, its name, and the three ways
 * out — a file where the user chooses, a download, the clipboard.
 *
 * The module remembers that a picker is open, so each test imports it anew.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

async function load() {
  vi.resetModules();
  const { toast } = await import('sonner');
  const images = await import('./imageExport');
  return {
    ...images,
    toast: { success: toast.success as Mock, error: toast.error as Mock },
  };
}

const PNG = new Blob(['png-bytes'], { type: 'image/png' });

/** A file handle that keeps what is written to it */
function fakeHandle(name: string) {
  const written: Blob[] = [];
  const close = vi.fn(async () => undefined);
  return {
    written,
    close,
    handle: {
      name,
      createWritable: vi.fn(async () => ({
        write: async (data: Blob) => {
          written.push(data);
        },
        close,
      })),
    },
  };
}

function abortError(): Error {
  const error = new Error('The user aborted a request.');
  error.name = 'AbortError';
  return error;
}

/** jsdom's Blob cannot read itself */
function textOf(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'showSaveFilePicker');
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('fitScale', () => {
  it('is the scale asked for when the picture can be painted', async () => {
    const { fitScale } = await load();
    expect(fitScale(1088, 925, 1)).toBe(1);
    expect(fitScale(1088, 925, 3)).toBe(3);
    expect(fitScale(4000, 3000, 2)).toBe(2);
  });

  it('comes down to what a browser can paint: no side too long, not too many pixels', async () => {
    const { fitScale, MAX_PNG_SIDE, MAX_PNG_PIXELS } = await load();
    // a very wide drawing: the side is what limits it
    expect(fitScale(10000, 500, 3)).toBe(1.63);
    // a very large one: the area
    expect(fitScale(8000, 8000, 2)).toBe(1);
    expect(fitScale(16000, 16000, 1)).toBe(0.5);

    for (const [width, height] of [
      [10000, 500],
      [8000, 8000],
      [16000, 16000],
      [30000, 200],
      [7001, 6999],
      [123457, 3],
    ]) {
      for (const wanted of [1, 2, 3]) {
        const scale = fitScale(width, height, wanted);
        expect(scale).toBeGreaterThan(0);
        expect(scale).toBeLessThanOrEqual(wanted);
        expect(Math.round(width * scale)).toBeLessThanOrEqual(MAX_PNG_SIDE);
        expect(Math.round(height * scale)).toBeLessThanOrEqual(MAX_PNG_SIDE);
        expect(Math.round(width * scale) * Math.round(height * scale)).toBeLessThanOrEqual(
          MAX_PNG_PIXELS * 1.001
        );
      }
    }
  });

  it('has nothing to limit on an empty picture', async () => {
    const { fitScale } = await load();
    expect(fitScale(0, 0, 2)).toBe(2);
  });
});

describe('imageFileName', () => {
  it('is the project made filename-safe, with the canvas when one is named', async () => {
    const { imageFileName } = await load();
    expect(imageFileName('Sede Milano', null, 'png')).toBe('sede-milano.png');
    expect(imageFileName('Sede Milano', 'Piano 2', 'svg')).toBe('sede-milano-piano-2.svg');
    expect(imageFileName('Città: rete/1', 'Già "pronto"', 'png')).toBe('citta-rete-1-gia-pronto.png');
  });

  it('still has a name when nothing of the names is left', async () => {
    const { imageFileName } = await load();
    expect(imageFileName('', null, 'png')).toBe('disegno.png');
    expect(imageFileName('???', '***', 'svg')).toBe('disegno.svg');
    expect(imageFileName('???', 'Piano 2', 'png')).toBe('piano-2.png');
  });
});

describe('an SVG document as data', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text fill="#222">Città & "Co" 100% 🙂</text></svg>';

  it('becomes an address an image can show, with nothing lost', async () => {
    const { svgDataUrl } = await load();
    const url = svgDataUrl(svg);
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    // '#' would cut the address short, '%' would be read as an escape
    expect(url.slice(url.indexOf(',') + 1)).not.toMatch(/[#"<>\s]/);
    expect(decodeURIComponent(url.slice(url.indexOf(',') + 1))).toBe(svg);
  });

  it('becomes a file of the right kind', async () => {
    const { svgBlob } = await load();
    const blob = svgBlob(svg);
    expect(blob.type).toBe('image/svg+xml;charset=utf-8');
    expect(await textOf(blob)).toBe(svg);
  });
});

describe('rasterizeSvg', () => {
  /** An <img> that loads (or fails) by itself a moment after it is given an address */
  function stubImage(outcome: 'load' | 'error') {
    const created: Array<{ src: string }> = [];
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private address = '';
      constructor() {
        created.push(this);
      }
      get src() {
        return this.address;
      }
      set src(value: string) {
        this.address = value;
        queueMicrotask(() => (outcome === 'load' ? this.onload?.() : this.onerror?.()));
      }
    }
    vi.stubGlobal('Image', FakeImage);
    return created;
  }

  function stubCanvas(options: { context?: boolean; blob?: Blob | null } = {}) {
    const drawImage = vi.fn();
    const canvases: HTMLCanvasElement[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement
    ) {
      canvases.push(this);
      return options.context === false ? null : ({ drawImage } as unknown as CanvasRenderingContext2D);
    } as typeof HTMLCanvasElement.prototype.getContext);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) => {
      callback(options.blob === undefined ? PNG : options.blob);
    });
    return { drawImage, canvases };
  }

  it('paints the document on a canvas of the size asked for, and gives the PNG', async () => {
    const { rasterizeSvg, svgDataUrl } = await load();
    const images = stubImage('load');
    const { drawImage, canvases } = stubCanvas();

    const blob = await rasterizeSvg('<svg/>', 336, 930);

    expect(blob).toBe(PNG);
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe(svgDataUrl('<svg/>'));
    expect([canvases[0].width, canvases[0].height]).toEqual([336, 930]);
    expect(drawImage).toHaveBeenCalledWith(images[0], 0, 0, 336, 930);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
  });

  it('fails, instead of giving an empty picture, when the browser cannot paint it', async () => {
    const { rasterizeSvg } = await load();

    stubImage('error');
    stubCanvas();
    await expect(rasterizeSvg('<svg/>', 10, 10)).rejects.toThrow('could not be painted');

    stubImage('load');
    vi.restoreAllMocks();
    stubCanvas({ context: false });
    await expect(rasterizeSvg('<svg/>', 10, 10)).rejects.toThrow('cannot paint');

    vi.restoreAllMocks();
    stubCanvas({ blob: null });
    await expect(rasterizeSvg('<svg/>', 10, 10)).rejects.toThrow('came out empty');
  });
});

describe('the clipboard', () => {
  class FakeClipboardItem {
    items: Record<string, Blob>;
    constructor(items: Record<string, Blob>) {
      this.items = items;
    }
  }

  function stubClipboard(write: Mock) {
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
  }

  it('can take a picture only where the browser has what it needs', async () => {
    const { canCopyImage } = await load();
    expect(canCopyImage()).toBe(false);

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: vi.fn() } });
    expect(canCopyImage()).toBe(false); // no ClipboardItem

    stubClipboard(vi.fn());
    expect(canCopyImage()).toBe(true);

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {} });
    expect(canCopyImage()).toBe(false); // text only
  });

  it('puts the PNG on it and says so', async () => {
    const { copyImage, toast } = await load();
    const write = vi.fn(async () => undefined);
    stubClipboard(write);

    expect(await copyImage(PNG)).toBe(true);

    expect(write).toHaveBeenCalledTimes(1);
    const [items] = write.mock.calls[0] as unknown as [FakeClipboardItem[]];
    expect(items).toHaveLength(1);
    expect(items[0].items).toEqual({ 'image/png': PNG });
    expect(toast.success).toHaveBeenCalledWith('Immagine copiata negli appunti');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says it could not, and how to get the picture anyway, when the browser refuses', async () => {
    const { copyImage, toast } = await load();
    stubClipboard(vi.fn(async () => Promise.reject(new Error('NotAllowedError'))));

    expect(await copyImage(PNG)).toBe(false);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Impossibile copiare l'immagine", {
      description: 'Il browser non lo ha permesso. Puoi salvarla su file.',
    });
  });
});

describe('saveImage — where the browser lets the user choose', () => {
  it('asks where, suggesting the name and the kind of file, and writes the picture there', async () => {
    const { saveImage, canChooseWhereToSave, toast } = await load();
    const file = fakeHandle('rete.png');
    const picker = vi.fn(async () => file.handle);
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker });

    expect(canChooseWhereToSave()).toBe(true);
    expect(await saveImage(PNG, 'sede-milano.png', 'png')).toBe('saved');

    expect(picker).toHaveBeenCalledWith({
      suggestedName: 'sede-milano.png',
      types: [{ description: 'Immagine PNG', accept: { 'image/png': ['.png'] } }],
    });
    expect(file.written).toEqual([PNG]);
    expect(file.close).toHaveBeenCalledTimes(1);
    // the name said back is the one the user chose, not the one suggested
    expect(toast.success).toHaveBeenCalledWith('Immagine salvata', { description: 'rete.png' });
  });

  it('offers the SVG kind for an SVG', async () => {
    const { saveImage } = await load();
    const picker = vi.fn(async () => fakeHandle('rete.svg').handle);
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker });

    await saveImage(new Blob(['<svg/>']), 'rete.svg', 'svg');

    expect(picker).toHaveBeenCalledWith({
      suggestedName: 'rete.svg',
      types: [{ description: 'Immagine SVG', accept: { 'image/svg+xml': ['.svg'] } }],
    });
  });

  it('does nothing and says nothing when the user closes the picker', async () => {
    const { saveImage, toast } = await load();
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn(async () => Promise.reject(abortError())),
    });

    expect(await saveImage(PNG, 'rete.png', 'png')).toBe('cancelled');
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says so when the picker cannot be opened', async () => {
    const { saveImage, toast } = await load();
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn(async () => Promise.reject(new Error('not allowed here'))),
    });

    expect(await saveImage(PNG, 'rete.png', 'png')).toBe('failed');
    expect(toast.error).toHaveBeenCalledWith("Impossibile scegliere dove salvare l'immagine", {
      description: 'not allowed here',
    });
  });

  it('says so when the file cannot be written', async () => {
    const { saveImage, toast } = await load();
    const handle = {
      name: 'rete.png',
      createWritable: vi.fn(async () => Promise.reject(new Error('disk full'))),
    };
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn(async () => handle),
    });

    expect(await saveImage(PNG, 'rete.png', 'png')).toBe('failed');
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Impossibile salvare su "rete.png"', {
      description: "Riprova scegliendo un altro file o un'altra cartella.",
    });
  });

  it('opens one picker at a time, and can open another once the first is closed', async () => {
    const { saveImage } = await load();
    let release: (handle: unknown) => void = () => undefined;
    const picker = vi.fn(
      () =>
        new Promise(resolve => {
          release = resolve;
        })
    );
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker });

    const first = saveImage(PNG, 'rete.png', 'png');
    expect(await saveImage(PNG, 'rete.png', 'png')).toBe('cancelled');
    expect(picker).toHaveBeenCalledTimes(1);

    release(fakeHandle('rete.png').handle);
    expect(await first).toBe('saved');

    const again = saveImage(PNG, 'rete.png', 'png');
    expect(picker).toHaveBeenCalledTimes(2);
    release(fakeHandle('rete.png').handle);
    expect(await again).toBe('saved');
  });
});

describe('saveImage — where the browser cannot ask', () => {
  it('downloads the picture under the suggested name', async () => {
    const { saveImage, canChooseWhereToSave, toast } = await load();
    const createObjectURL = vi.fn(() => 'blob:picture');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clicked: Array<{ href: string; download: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked.push({ href: this.href, download: this.download });
    });

    expect(canChooseWhereToSave()).toBe(false);
    expect(await saveImage(PNG, 'sede-milano.png', 'png')).toBe('downloaded');

    expect(createObjectURL).toHaveBeenCalledWith(PNG);
    expect(clicked).toEqual([{ href: 'blob:picture', download: 'sede-milano.png' }]);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:picture');
    // nothing is left on the page
    expect(document.querySelector('a[download]')).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Immagine scaricata come sede-milano.png');
  });
});
