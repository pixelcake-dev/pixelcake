/**
 * SettingsModal tests — the settings only hold things that change something:
 * no user profile, no language/date/unit preferences, and a shortcut list
 * that matches what the canvas really does (see NetworkCanvas.test.tsx for
 * the behaviour behind the mouse lines).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import SettingsModal from './SettingsModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** The tabs of the modal itself (a tab may have sub-tabs of its own) */
function tabs(): HTMLElement[] {
  const bar = document.querySelector('.modal-header-custom .settings-tabs');
  return Array.from(bar?.querySelectorAll<HTMLElement>('button') ?? []);
}

const activeTab = () => tabs().find(tab => tab.classList.contains('active'))?.textContent;

function openTab(label: string) {
  fireEvent.click(tabs().find(tab => tab.textContent === label)!);
}

/** [action, keys] of every line of the shortcut list */
function shortcuts(): Array<[string, string]> {
  return Array.from(document.querySelectorAll('kbd')).map(keys => [
    keys.previousElementSibling?.textContent ?? '',
    keys.textContent ?? '',
  ]);
}

describe('SettingsModal', () => {
  beforeEach(() => {
    localStorage.clear();
    createNewProject({ name: 'Sede Milano' });
    useUIStore.setState(state => ({ modals: { ...state.modals, settings: true } }));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has the tabs Rete, Aspetto, Template and Avanzate, and opens on Rete', () => {
    render(<SettingsModal />);

    expect(tabs().map(tab => tab.textContent)).toEqual(['Rete', 'Aspetto', 'Template', 'Avanzate']);
    expect(activeTab()).toBe('Rete');
    expect(screen.getByText('Impostazioni Rete Globale')).toBeInTheDocument();
  });

  it('has no user profile', () => {
    render(<SettingsModal />);

    expect(tabs().map(tab => tab.textContent)).not.toContain('Utente');
    for (const label of tabs().map(tab => tab.textContent ?? '')) {
      openTab(label);
      expect(screen.queryByText(/Profilo/)).toBeNull();
      expect(screen.queryByText('Nome Completo')).toBeNull();
      expect(screen.queryByText('Informazioni Applicazione')).toBeNull();
    }
  });

  it('goes back to Rete when it is closed and opened again', () => {
    render(<SettingsModal />);
    openTab('Avanzate');
    expect(activeTab()).toBe('Avanzate');

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(useUIStore.getState().modals.settings).toBe(false);
    act(() => useUIStore.getState().openModal('settings'));

    expect(activeTab()).toBe('Rete');
  });

  describe('Avanzate', () => {
    it('has no preferences that change nothing', () => {
      render(<SettingsModal />);
      openTab('Avanzate');

      expect(screen.getByText('Statistiche Utilizzo')).toBeInTheDocument();
      expect(screen.queryByText('Preferenze Generali')).toBeNull();
      expect(screen.queryByText('Lingua Interfaccia')).toBeNull();
      expect(screen.queryByText('Formato Data')).toBeNull();
      expect(screen.queryByText('Sistema di Unità')).toBeNull();
      expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('lists the shortcuts that exist, and only those', () => {
      render(<SettingsModal />);
      openTab('Avanzate');

      expect(shortcuts()).toEqual([
        ['Salva il progetto su file', 'Ctrl + S'],
        ['Copia i dispositivi selezionati', 'Ctrl + C'],
        ['Incolla i dispositivi copiati', 'Ctrl + V'],
        ['Elimina i dispositivi selezionati', 'Canc'],
        ['Aggiungi o togli un dispositivo dalla selezione', 'Ctrl + Clic'],
        ['Seleziona più dispositivi con un riquadro', "Trascina su un'area vuota"],
        ['Sposta la vista', 'Tasto destro + trascina'],
        ['Zoom', 'Rotellina del mouse'],
      ]);
      const keys = shortcuts().map(([, combination]) => combination);
      // no auto-layout shortcut exists; selection is with Ctrl, panning with the right button
      expect(keys.join(' | ')).not.toMatch(/Ctrl \+ L|Shift|Middle|centrale/i);
    });
  });

  describe('Rete', () => {
    it('confirms a save with a toast, not with a native alert', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      render(<SettingsModal />);

      fireEvent.change(screen.getByLabelText('Gateway di Default'), {
        target: { value: '192.168.1.254' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Salva Impostazioni Rete' }));

      expect(useNetworkStore.getState().globalNetworkSettings.gateway).toBe('192.168.1.254');
      expect(toast.success as Mock).toHaveBeenCalledWith('Impostazioni di rete salvate');
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('refuses an empty field with a toast and saves nothing', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const before = useNetworkStore.getState().globalNetworkSettings;
      render(<SettingsModal />);

      fireEvent.change(screen.getByLabelText('Gateway di Default'), { target: { value: ' ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salva Impostazioni Rete' }));

      expect(toast.error as Mock).toHaveBeenCalledWith('Tutti i campi sono obbligatori');
      expect(toast.success as Mock).not.toHaveBeenCalled();
      expect(useNetworkStore.getState().globalNetworkSettings).toEqual(before);
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });
});
