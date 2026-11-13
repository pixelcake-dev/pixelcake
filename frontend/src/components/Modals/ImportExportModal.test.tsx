/**
 * ImportExportModal tests — the export formats. YAML is the one that can be
 * loaded back, so it comes first; the Terraform export is a sketch that
 * cannot be applied, and says so whenever it is the one on screen.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import ImportExportModal from './ImportExportModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const WARNING = /non si può applicare con Terraform/;

const format = () => screen.getByLabelText('Formato:') as HTMLSelectElement;
const choose = (value: string) => fireEvent.change(format(), { target: { value } });
const preview = () => document.querySelector('pre')?.textContent ?? '';

describe('ImportExportModal — export formats', () => {
  beforeEach(() => {
    localStorage.clear();
    createNewProject({ name: 'Sede Milano' });
    useNetworkStore.getState().addDevice({
      type: 'PC',
      label: 'PC-1',
      ip: '192.168.1.10',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      position: { x: 0, y: 0 },
    });
    useUIStore.setState(state => ({ modals: { ...state.modals, importExport: true } }));
    vi.clearAllMocks();
  });

  it('opens on YAML, with no warning', () => {
    render(<ImportExportModal />);

    expect(format().value).toBe('yaml');
    expect(preview()).toContain('PC-1');
    expect(preview()).not.toContain('resource "');
    expect(screen.getByRole('button', { name: /Scarica .*\.yaml$/ })).toBeInTheDocument();
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('offers Terraform as a draft, after YAML', () => {
    render(<ImportExportModal />);

    expect(Array.from(format().options).map(option => [option.value, option.text])).toEqual([
      ['yaml', 'YAML (.yaml)'],
      ['terraform', 'Terraform HCL (bozza)'],
    ]);
  });

  it('warns that the Terraform draft cannot be applied, only while it is selected', () => {
    render(<ImportExportModal />);

    choose('terraform');
    expect(preview()).toContain('resource "compute_instance" "pc_1"');
    expect(screen.getByRole('button', { name: /Scarica .*\.tf$/ })).toBeInTheDocument();
    const warning = screen.getByRole('note');
    expect(warning).toHaveClass('modal-info-box');
    expect(warning).toHaveTextContent(WARNING);
    expect(warning).toHaveTextContent('È una bozza');

    choose('yaml');
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('shows the warning on an empty canvas too', () => {
    useNetworkStore.getState().removeDevice('dev-0');
    render(<ImportExportModal />);

    expect(screen.queryByRole('note')).toBeNull();
    choose('terraform');
    expect(screen.getByRole('note')).toHaveTextContent(WARNING);
  });

  it('never shows it on the import tab', () => {
    render(<ImportExportModal />);
    choose('terraform');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('ImportExportModal — the buttons at the bottom', () => {
  beforeEach(() => {
    localStorage.clear();
    createNewProject({ name: 'Sede Milano' });
    useUIStore.setState(state => ({ modals: { ...state.modals, importExport: true } }));
  });

  it.each([
    ['export', /^Copia negli appunti$/],
    ['export', /^Scarica .*\.yaml$/],
    ['import', /^Importa$/],
  ])('on the %s tab, %s has its icon on the line of its label', (tabName, name) => {
    render(<ImportExportModal />);
    if (tabName === 'import') fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const button = screen.getByRole('button', { name });
    const icon = button.querySelector('svg');

    expect(button.closest('.modal-actions')).not.toBeNull();
    expect(icon).not.toBeNull();
    // the row is the button's doing (see Button.test.tsx): icon and label are
    // its two children, and the icon carries no layout of its own
    expect(button.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['inline-flex', 'items-center', 'gap-1'])
    );
    expect(icon?.parentElement).toBe(button);
    expect(icon?.getAttribute('style')).toBeNull();
  });
});
