/**
 * The window that imports and exports the network as YAML: «replacing» asks
 * first and says what goes, «adding» puts the file beside the drawing, and
 * the areas go out with the network and come back.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { answerConfirms, settled } from '@/test/confirm';
import { getT } from '@/i18n';
import { DEVICE_METRICS } from '@/utils/deviceGeometry';
import { IMPORT_GAP } from '@/utils/importPlacement';
import ImportExportModal from './ImportExportModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const FILE = [
  'pixelcake:',
  '  devices:',
  '    - name: Imported-A',
  '      position: {x: 100, y: 100}',
  '    - name: PC-1',
  '      position: {x: 300, y: 100}',
  '  connections:',
  '    - source: Imported-A',
  '      target: PC-1',
  '  areas:',
  '    - label: Group',
  '      color: teal',
  '      position: {x: 60, y: 40}',
  '      size: {width: 400, height: 200}',
].join('\n');

const store = () => useNetworkStore.getState();

function seedBoard() {
  store().clearAllDevices();
  store().addDevice({ type: 'PC', label: 'PC-1', ip: '', subnet: '', gateway: '', position: { x: 0, y: 0 } });
  store().addDevice({ type: 'PC', label: 'PC-2', ip: '', subnet: '', gateway: '', position: { x: 500, y: 300 } });
  store().addArea({ label: 'Old', color: 'slate', position: { x: -20, y: -20 }, size: { width: 700, height: 500 } });
}

/** Open the import tab, choose the file, and pick the mode */
async function chooseFile(mode: 'replace' | 'append') {
  useUIStore.getState().openModal('importExport');
  const view = render(<ImportExportModal />);
  fireEvent.click(screen.getByRole('button', { name: /Import$|Importa$/ }));
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([FILE], 'lab.yaml', { type: 'text/yaml' });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText('lab.yaml');
  const label = getT().importExport.importTab[mode];
  fireEvent.click(screen.getByLabelText(label));
  return view;
}

const importButton = () =>
  screen.getAllByRole('button', { name: getT().importExport.importTab.confirm }).pop() as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  useUIStore.getState().closeModal('importExport');
  seedBoard();
});

describe('importing in place of the drawing', () => {
  it('asks first, says what will be removed, and changes nothing on a no', async () => {
    const answers = answerConfirms(false);
    await chooseFile('replace');
    fireEvent.click(importButton());
    await settled();
    expect(answers.asked).toHaveLength(1);
    expect(answers.asked[0].detail).toBe(getT().importExport.importTab.replaceDetail(2, 0, 1));
    expect(answers.asked[0].danger).toBe(true);
    expect(store().devices.map((d) => d.label)).toEqual(['PC-1', 'PC-2']);
    expect(store().areas).toHaveLength(1);
  });

  it('on a yes, puts the file in its place, areas included', async () => {
    answerConfirms(true);
    await chooseFile('replace');
    fireEvent.click(importButton());
    await waitFor(() => expect(store().devices.map((d) => d.label)).toEqual(['Imported-A', 'PC-1']));
    expect(store().connections).toHaveLength(1);
    expect(store().areas.map((a) => a.label)).toEqual(['Group']);
    expect(store().devices[0].position).toEqual({ x: 100, y: 100 });
  });

  it('asks nothing of an empty board', async () => {
    store().clearAllDevices();
    const answers = answerConfirms(false);
    await chooseFile('replace');
    fireEvent.click(importButton());
    await waitFor(() => expect(store().devices).toHaveLength(2));
    expect(answers.asked).toHaveLength(0);
  });
});

describe('importing in addition to the drawing', () => {
  it('puts the group beside the drawing, keeping its layout, the area with its devices', async () => {
    await chooseFile('append');
    fireEvent.click(importButton());
    await waitFor(() => expect(store().devices).toHaveLength(4));
    const [, , a, b] = store().devices;
    // the drawing ends at its area, 680 across (-20 + 700)
    const groupLeft = Math.min(a.position.x, store().areas[1].position.x);
    expect(groupLeft).toBe(680 + IMPORT_GAP);
    // the layout inside the group is the one of the file
    expect(b.position.x - a.position.x).toBe(200);
    expect(b.position.y - a.position.y).toBe(0);
    expect(a.position.x - store().areas[1].position.x).toBe(40);
    expect(a.position.y - store().areas[1].position.y).toBe(60);
    expect(store().areas[1].position.y).toBe(-20);
    expect(a.position.x).toBeGreaterThan(500 + DEVICE_METRICS.width);
    // the cable of the file came, between the two new devices
    expect(store().connections).toHaveLength(1);
    // the area of the board stayed
    expect(store().areas[0].label).toBe('Old');
  });

  it('gives a device a free name when the board has the name already', async () => {
    await chooseFile('append');
    fireEvent.click(importButton());
    await waitFor(() => expect(store().devices).toHaveLength(4));
    expect(store().devices.map((d) => d.label)).toEqual(['PC-1', 'PC-2', 'Imported-A', 'PC-1-1']);
  });
});

describe('exporting', () => {
  it('writes the areas of the board in the YAML', () => {
    useUIStore.getState().openModal('importExport');
    render(<ImportExportModal />);
    const text = document.querySelector('pre')?.textContent ?? '';
    expect(text).toContain('  areas:');
    expect(text).toContain('label: Old');
  });
});
