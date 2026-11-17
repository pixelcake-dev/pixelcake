// The figures of the pages "Devices" of the documentation: the 24 drawings of
// the devices, and the states the upper layer of a drawing tells. Not a scenario
// of the recorder: run it with node, from the root of the repository
//
//   node tools/media/scenarios/building-figures.mjs
//
// It reads the drawings the app is built from (frontend/src/data/deviceDrawings.ts)
// and writes SVG files, in the light and in the dark theme, in
// documentation/media/devices/. The colours are those of the app (index.css).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const { DEVICE_DRAWINGS, DEVICE_DRAWING_CUT, DEVICE_DRAWING_SIZE } = await import(
  pathToFileURL(resolve(root, 'frontend/src/data/deviceDrawings.ts')).href
);
const out = resolve(root, 'documentation/media/devices');
mkdirSync(out, { recursive: true });

const THEMES = {
  light: { ground: '#ffffff', lower: '#22313b', upper: '#5e8096', text: '#22313b', quiet: '#5c6b76' },
  dark: { ground: '#111315', lower: '#8fb0c6', upper: '#c9d8e2', text: '#f4f6f8', quiet: '#93a0aa' },
};
const STATES = { rest: null, selected: '#f07d2a', ok: '#2fa866', warning: '#f2c230', error: '#e0483e', off: '#9aa7b0' };
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** One drawing at (x, y), `size` px square, its upper layer in the colour of `state` */
function drawing(id, x, y, size, state = 'rest') {
  const { layer, shapes } = DEVICE_DRAWINGS[id];
  const cutTop = layer - DEVICE_DRAWING_CUT / 2;
  const scale = size / DEVICE_DRAWING_SIZE;
  return (
    `<g class="d s-${state}" transform="translate(${x} ${y}) scale(${scale})">` +
    `<g class="lower">${shapes}</g>` +
    `<svg class="upper" width="${DEVICE_DRAWING_SIZE}" height="${layer}" viewBox="0 0 ${DEVICE_DRAWING_SIZE} ${layer}">${shapes}</svg>` +
    `<svg class="cut" y="${cutTop}" width="${DEVICE_DRAWING_SIZE}" height="${DEVICE_DRAWING_CUT}" viewBox="0 ${cutTop} ${DEVICE_DRAWING_SIZE} ${DEVICE_DRAWING_CUT}">${shapes}</svg>` +
    `</g>`
  );
}

function style(c) {
  const states = Object.entries(STATES)
    .map(([name, colour]) => `.s-${name} .upper .l{fill:${colour ?? c.upper}}`)
    .join('');
  return (
    `<style>.lower .l{fill:${c.lower}}.d .g{fill:${c.ground}}.cut .l{fill:${c.ground}}${states}` +
    `text{font-family:${FONT}}.n{font-size:13px;font-weight:600;fill:${c.text};text-anchor:middle}` +
    `.q{font-size:12px;font-weight:400;fill:${c.quiet};text-anchor:middle}</style>`
  );
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function svg({ width, height, label, body, theme }) {
  const c = THEMES[theme];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(label)}">` +
    `<title>${escape(label)}</title>${style(c)}<rect width="${width}" height="${height}" fill="${c.ground}"/>${body}</svg>`
  );
}

// 1. The 24 kinds, in the order of the panel "Add", six to a row
const KINDS = [
  ['pc', 'PC'], ['switch', 'Switch'], ['router', 'Router'], ['server', 'Server'], ['firewall', 'Firewall'], ['access-point', 'Access Point'],
  ['load-balancer', 'Load Balancer'], ['database', 'Database'], ['cloud', 'Cloud'], ['server-mail', 'Mail Server'], ['server-vps', 'VPS'], ['server-web', 'Web Server'],
  ['server-proxy', 'Proxy Server'], ['storage-s3', 'Storage S3'], ['nas', 'NAS'], ['server-dns', 'DNS Server'], ['server-dhcp', 'DHCP Server'], ['iot', 'IoT Gateway'],
  ['telecamera-ip', 'IP Camera'], ['stampante', 'Printer'], ['laptop', 'Laptop'], ['smartphone', 'Smartphone'], ['tablet', 'Tablet'], ['telefono-ip', 'IP Phone'],
];
{
  const cols = 6, cellW = 160, cellH = 124, size = 72;
  const width = cols * cellW, height = Math.ceil(KINDS.length / cols) * cellH + 8;
  for (const theme of Object.keys(THEMES)) {
    const body = KINDS.map(([id, name], i) => {
      const cx = (i % cols) * cellW + cellW / 2, top = Math.floor(i / cols) * cellH + 10;
      return drawing(id, cx - size / 2, top, size) + `<text class="n" x="${cx}" y="${top + size + 24}">${escape(name)}</text>`;
    }).join('');
    writeFileSync(resolve(out, `kinds${theme === 'dark' ? '.dark' : ''}.svg`), svg({ width, height, theme, body, label: 'The 24 kinds of device, each with its drawing and its name' }));
  }
}

// 2. The states of the upper layer, in each language
const LAMP = {
  en: {
    label: 'The six colours the upper layer of a drawing can have: slate at rest, orange selected, green where the answer arrives, red where it stops, yellow waiting for an address, grey broken.',
    cells: [['rest', 'At rest'], ['selected', 'Selected'], ['ok', 'The answer arrives'], ['error', 'The answer stops'], ['warning', 'Waits for an address'], ['off', 'Broken']],
  },
  it: {
    label: 'I sei colori che può avere lo strato superiore di un disegno: ardesia a riposo, arancione se selezionato, verde dove arriva la risposta, rosso dove si ferma, giallo se attende un indirizzo, grigio se guasto.',
    cells: [['rest', 'A riposo'], ['selected', 'Selezionato'], ['ok', 'Qui arriva la risposta'], ['error', 'Qui si ferma la risposta'], ['warning', 'Attende un indirizzo'], ['off', 'Guasto']],
  },
};
for (const [lang, { label, cells }] of Object.entries(LAMP)) {
  const cellW = 170, size = 72, width = cells.length * cellW, height = 134;
  for (const theme of Object.keys(THEMES)) {
    const body = cells
      .map(([state, name], i) => {
        const cx = i * cellW + cellW / 2;
        return drawing('pc', cx - size / 2, 12, size, state) + `<text class="n" x="${cx}" y="${12 + size + 26}">${escape(name)}</text>`;
      })
      .join('');
    writeFileSync(resolve(out, `lamp.${lang}${theme === 'dark' ? '.dark' : ''}.svg`), svg({ width, height, theme, body, label }));
  }
}
console.log('written to ' + out);
