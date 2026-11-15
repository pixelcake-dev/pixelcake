/**
 * Vista → Disposizione automatica asks first: every device will be moved,
 * and it cannot be undone. A no leaves the drawing as it was; a yes lays it
 * out, its areas with it, and the view is fitted to the drawing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import { answerConfirms, settled } from '@/test/confirm';
import TopMenuBar from './TopMenuBar';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const network = () => useNetworkStore.getState();
const places = () => [...network().devices.map((one) => one.position), ...network().areas.map((one) => one.position)];

beforeEach(() => {
  vi.mocked(toast.info).mockClear();
  localStorage.clear();
  createNewProject({ name: 'Due sedi' });
  network().loadSample(createRedundancySample());
  network().markSaved();
});

describe('Vista → Disposizione automatica', () => {
  it('asks first, saying that every device is moved and that it cannot be undone', async () => {
    const answers = answerConfirms(false);
    render(<TopMenuBar />);
    const before = places();
    const fits = network().fitViewRequest;

    fireEvent.click(screen.getByText('Verticale'));
    await settled();

    expect(answers.asked).toHaveLength(1);
    expect(answers.asked[0]).toMatchObject({ title: 'Disporre di nuovo il disegno?', confirmLabel: 'Disponi' });
    expect(answers.asked[0].detail).toContain('Ogni dispositivo sarà spostato');
    expect(answers.asked[0].detail).toContain('Non si può annullare');
    // no: nothing moves, nothing changes
    expect(places()).toEqual(before);
    expect(network().hasUnsavedChanges).toBe(false);
    expect(network().fitViewRequest).toBe(fits);
  });

  it('yes: the devices and their areas are laid out, and the view shows the whole drawing', async () => {
    answerConfirms(true);
    render(<TopMenuBar />);
    const before = places();
    const fits = network().fitViewRequest;

    fireEvent.click(screen.getByText('Orizzontale'));
    await settled();

    expect(places()).not.toEqual(before);
    expect(network().hasUnsavedChanges).toBe(true);
    expect(network().fitViewRequest).toBe(fits + 1);
    expect(network().fitViewNodes).toBeNull();
  });

  it('on an empty canvas there is nothing to lay out: no question, a notice', async () => {
    const answers = answerConfirms(true);
    network().clearAllDevices();
    render(<TopMenuBar />);

    fireEvent.click(screen.getByText('Verticale'));
    await settled();

    expect(answers.asked).toHaveLength(0);
    expect(toast.info).toHaveBeenCalledWith("Nessun dispositivo sul canvas: non c'è nulla da disporre");
  });
});
