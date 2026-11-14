/**
 * SettingsModal tests — the settings only hold things that change something:
 * no user profile, no language/date/unit preferences, and a shortcut list
 * that matches what the canvas really does (see NetworkCanvas.test.tsx for
 * the behaviour behind the mouse lines).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { answerConfirms, settled } from '@/test/confirm';
import { device, host, nic, port, switchWith } from '@/test/networkFixtures';
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
        ['Elimina i dispositivi selezionati, o il riquadro selezionato', 'Canc'],
        ['Aggiungi o togli un dispositivo dalla selezione', 'Ctrl + Clic'],
        ['Seleziona più dispositivi con un riquadro di selezione', "Trascina su un'area vuota"],
        ['Sposta la vista', 'Tasto destro + trascina'],
        ['Zoom', 'Rotellina del mouse'],
      ]);
      const keys = shortcuts().map(([, combination]) => combination);
      // no auto-layout shortcut exists; selection is with Ctrl, panning with the right button
      expect(keys.join(' | ')).not.toMatch(/Ctrl \+ L|Shift|Middle|centrale/i);
    });
  });

  describe('Rete', () => {
    it('the four values of a new device are in one row, the email mode in its own group with its note', () => {
      render(<SettingsModal />);

      const [network, mask, gateway, dns] = [
        'Classe IP di Partenza',
        'Subnet Mask di Default',
        'Gateway di Default',
        'Server DNS di Default',
      ].map(label => screen.getByLabelText(label));
      const row = network.closest('.grid');
      expect(row).not.toBeNull();
      expect(mask.closest('.grid')).toBe(row);
      expect(gateway.closest('.grid')).toBe(row);
      expect(dns.closest('.grid')).toBe(row);
      // (the row is of four: none of them is wider than a column)
      expect(row?.className).toContain('grid-cols-4');
      for (const field of [network, mask, gateway, dns]) {
        expect(field.parentElement?.className).not.toMatch(/col-span/);
      }
      // a row of fields keeps them apart, across and down
      expect(row?.className).toContain('gap-x-3');
      expect(row?.className).toContain('gap-y-2');
      expect(screen.getByRole('group', { name: 'Nuovi dispositivi' })).toContainElement(network);

      // the line that explains the last field stays with it
      const select = screen.getByLabelText('Modalità Email (SMTP)');
      const hint = screen.getByText(/Determina come viaggiano le email/);
      expect(select.closest('.grid')).toBe(hint.parentElement);
      expect(screen.getByRole('group', { name: 'Simulazione' })).toContainElement(select);
    });

    it('an address that is not one is said under its field, and nothing is saved', () => {
      render(<SettingsModal />);
      const before = useNetworkStore.getState().globalNetworkSettings;

      fireEvent.change(screen.getByLabelText('Gateway di Default'), { target: { value: '192.168.1' } });
      // nothing is said before the user asks to save
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Salva Impostazioni Rete' }));

      expect(screen.getByRole('alert')).toHaveTextContent('"192.168.1" non è un indirizzo IPv4 valido');
      expect(toast.error as Mock).toHaveBeenCalledWith('"192.168.1" non è un indirizzo IPv4 valido');
      expect(useNetworkStore.getState().globalNetworkSettings).toEqual(before);

      // put right, it goes away as it is typed, and the save goes through, trimmed
      fireEvent.change(screen.getByLabelText('Gateway di Default'), { target: { value: ' 192.168.1.254 ' } });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Salva Impostazioni Rete' }));
      expect(useNetworkStore.getState().globalNetworkSettings.gateway).toBe('192.168.1.254');
    });

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

  describe('Rete — the DNS server of new devices', () => {
    const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salva Impostazioni Rete' }));
    const field = () => screen.getByLabelText<HTMLInputElement>('Server DNS di Default');
    const settings = () => useNetworkStore.getState().globalNetworkSettings;

    it('is optional: left empty, the settings are saved without one', () => {
      render(<SettingsModal />);
      expect(field().value).toBe('');
      expect(field().required).toBe(false);

      save();

      expect(toast.error as Mock).not.toHaveBeenCalled();
      expect(toast.success as Mock).toHaveBeenCalledWith('Impostazioni di rete salvate');
      expect(settings().dns).toBeUndefined();
    });

    it('typed, it is saved trimmed, shown again, and counts as a change of the project', () => {
      useNetworkStore.getState().markSaved();
      const view = render(<SettingsModal />);

      fireEvent.change(field(), { target: { value: ' 192.168.1.53 ' } });
      save();

      expect(settings()).toMatchObject({ gateway: '192.168.1.1', dns: '192.168.1.53', emailMode: 'auto' });
      expect(useNetworkStore.getState().hasUnsavedChanges).toBe(true);
      view.unmount();
      render(<SettingsModal />);
      expect(field().value).toBe('192.168.1.53');
    });

    it('emptied again, the project has none', () => {
      useNetworkStore.getState().setGlobalNetworkSettings({ dns: '192.168.1.53' });
      render(<SettingsModal />);
      expect(field().value).toBe('192.168.1.53');

      fireEvent.change(field(), { target: { value: '  ' } });
      save();

      expect(settings().dns).toBeUndefined();
      expect(toast.success as Mock).toHaveBeenCalledWith('Impostazioni di rete salvate');
    });

    it('what is not an address is said under the field, like the other three, and nothing is saved', () => {
      render(<SettingsModal />);
      const before = settings();

      fireEvent.change(field(), { target: { value: 'srv-auth' } });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      save();

      expect(screen.getByRole('alert')).toHaveTextContent('"srv-auth" non è un indirizzo IPv4 valido');
      expect(field()).toHaveAttribute('aria-invalid', 'true');
      expect(toast.error as Mock).toHaveBeenCalledWith('"srv-auth" non è un indirizzo IPv4 valido');
      expect(settings()).toEqual(before);
    });
  });

  describe('Rete — the names of the VLANs of the project', () => {
    const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salva Impostazioni Rete' }));
    const store = () => useNetworkStore.getState();
    const named = () => store().globalNetworkSettings.vlans;
    const group = () => screen.getByRole('group', { name: 'VLAN del progetto' });
    const nameOf = (vlan: number) => screen.getByLabelText<HTMLInputElement>(`Nome della VLAN ${vlan}`);
    const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });
    /** [number, name, what the canvas does with it] of every row of the table */
    const rows = () =>
      within(group())
        .getAllByRole('row')
        .slice(1)
        .filter(row => row.querySelector('input'))
        .map(row => {
          const cells = row.querySelectorAll('td');
          const number = cells[0].querySelector('input')?.value ?? cells[0].textContent;
          return [number, cells[1].querySelector('input')?.value, cells[2].textContent];
        });

    /** A switch split in VLAN 10 and 20 with a trunk that also carries 30, and a port left alone */
    function draw() {
      store().addDevice(
        switchWith('SW', [
          port(1, { portType: 'trunk', vlan: [10, 20, 30] }),
          port(2, { portType: 'access', vlan: 10 }),
          port(3, { portType: 'access', vlan: 20 }),
          port(4),
        ])
      );
    }

    it('is a group of its own, between what a new device starts from and the simulation', () => {
      render(<SettingsModal />);
      const groups = screen.getAllByRole('group').map(g => g.querySelector('legend')?.textContent);
      expect(groups).toEqual(['Nuovi dispositivi', 'VLAN del progetto', 'Simulazione']);
      expect(group()).toHaveTextContent('Un nome per ogni VLAN, scritto una volta');
      // an empty project: nothing to list, and a way to add
      expect(group()).toHaveTextContent('Nessuna VLAN ha un nome, e questo canvas non ne usa.');
      expect(within(group()).queryByRole('table')).not.toBeInTheDocument();
      expect(within(group()).getByRole('button', { name: 'Aggiungi VLAN' })).toBeInTheDocument();
      // there is still one button that saves
      expect(screen.getAllByRole('button', { name: /^Salva/ })).toHaveLength(1);
    });

    it('lists the VLANs the drawing uses, to be named in one go, and those named before', () => {
      draw();
      store().setGlobalNetworkSettings({ vlans: [{ id: 20, name: 'Wi-Fi' }, { id: 99, name: 'Vecchia' }] });
      render(<SettingsModal />);

      expect(rows()).toEqual([
        ['1', '', 'in uso'],
        ['10', '', 'in uso'],
        ['20', 'Wi-Fi', 'in uso'],
        ['30', '', 'in uso'],
        ['99', 'Vecchia', 'non usata'],
      ]);
      // the number of a VLAN that is there is not typed: only its name
      expect(within(group()).queryByLabelText('Numero della nuova VLAN')).not.toBeInTheDocument();
      expect(nameOf(10).placeholder).toBe('senza nome');
      expect(nameOf(10).maxLength).toBe(32);
    });

    it('names typed are saved with the rest, by the one button, in the order of the numbers', () => {
      draw();
      store().markSaved();
      render(<SettingsModal />);

      type(nameOf(30), ' Server ');
      type(nameOf(10), 'Uffici');
      // nothing reaches the project before it is saved
      expect(named()).toBeUndefined();
      type(screen.getByLabelText('Gateway di Default'), '192.168.1.254');
      save();

      expect(toast.error as Mock).not.toHaveBeenCalled();
      expect(toast.success as Mock).toHaveBeenCalledWith('Impostazioni di rete salvate');
      expect(store().globalNetworkSettings).toMatchObject({
        gateway: '192.168.1.254',
        vlans: [
          { id: 10, name: 'Uffici' },
          { id: 30, name: 'Server' },
        ],
      });
      expect(store().hasUnsavedChanges).toBe(true);
      // the rows left without a name are still there to be named, and are not kept
      expect(rows()).toEqual([
        ['1', '', 'in uso'],
        ['10', 'Uffici', 'in uso'],
        ['20', '', 'in uso'],
        ['30', 'Server', 'in uso'],
      ]);
    });

    it('saving without naming any keeps the project without a list', () => {
      draw();
      render(<SettingsModal />);
      save();
      expect(toast.success as Mock).toHaveBeenCalled();
      expect(named()).toBeUndefined();
    });

    it('a VLAN the drawing does not use is added by hand: number and name', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByRole('button', { name: 'Aggiungi VLAN' }));
      type(screen.getByLabelText('Numero della nuova VLAN'), '40');
      type(screen.getByLabelText('Nome della nuova VLAN'), 'Telefoni');
      expect(rows()).toEqual([['40', 'Telefoni', '']]);
      save();

      expect(named()).toEqual([{ id: 40, name: 'Telefoni' }]);
      // saved, it is a VLAN of the project like the others: its number is no longer typed
      expect(rows()).toEqual([['40', 'Telefoni', 'non usata']]);
      expect(screen.queryByLabelText('Numero della nuova VLAN')).not.toBeInTheDocument();
      expect(nameOf(40)).toHaveValue('Telefoni');
    });

    it.each([
      ['4095', 'Telefoni', '"4095" non è una VLAN: il numero va da 1 a 4094'],
      ['dieci', 'Telefoni', '"dieci" non è una VLAN: il numero va da 1 a 4094'],
      ['', 'Telefoni', 'Manca il numero della VLAN «Telefoni»'],
      ['40', '  ', 'Manca il nome della VLAN 40'],
      ['10', 'Altro', "La VLAN 10 è già nell'elenco"],
    ])('a row that is wrong (%j, %j) is said under it and stops the save', (number, name, problem) => {
      draw();
      store().setGlobalNetworkSettings({ vlans: [{ id: 10, name: 'Uffici' }] });
      const before = store().globalNetworkSettings;
      render(<SettingsModal />);

      fireEvent.click(screen.getByRole('button', { name: 'Aggiungi VLAN' }));
      type(screen.getByLabelText('Numero della nuova VLAN'), number);
      type(screen.getByLabelText('Nome della nuova VLAN'), name);
      // nothing is said before the user asks to save
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      save();

      expect(within(group()).getByRole('alert')).toHaveTextContent(problem);
      expect(toast.error as Mock).toHaveBeenCalledWith(problem);
      expect(toast.success as Mock).not.toHaveBeenCalled();
      expect(store().globalNetworkSettings).toEqual(before);

      // put right, it goes away as it is typed, and the save goes through
      type(screen.getByLabelText('Numero della nuova VLAN'), '40');
      type(screen.getByLabelText('Nome della nuova VLAN'), 'Telefoni');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      save();
      expect(named()).toEqual([
        { id: 10, name: 'Uffici' },
        { id: 40, name: 'Telefoni' },
      ]);
    });

    it('a row added and left empty is no row', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByRole('button', { name: 'Aggiungi VLAN' }));
      save();
      expect(toast.error as Mock).not.toHaveBeenCalled();
      expect(named()).toBeUndefined();
      expect(within(group()).queryByRole('table')).not.toBeInTheDocument();
    });

    it('a name is taken away with its button: the VLAN leaves the list, or stays unnamed when the drawing uses it', () => {
      draw();
      store().setGlobalNetworkSettings({
        vlans: [{ id: 10, name: 'Uffici' }, { id: 99, name: 'Vecchia' }],
      });
      render(<SettingsModal />);
      // a VLAN of the drawing that has no name has nothing to take away
      expect(screen.queryByRole('button', { name: 'Togli il nome della VLAN 20' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Togli il nome della VLAN 99' }));
      fireEvent.click(screen.getByRole('button', { name: 'Togli il nome della VLAN 10' }));
      expect(rows()).toEqual([
        ['1', '', 'in uso'],
        ['10', '', 'in uso'],
        ['20', '', 'in uso'],
        ['30', '', 'in uso'],
      ]);
      // (still in the project until it is saved)
      expect(named()).toHaveLength(2);
      save();

      expect(named()).toBeUndefined();
      expect('vlans' in JSON.parse(JSON.stringify(store().globalNetworkSettings))).toBe(false);
    });

    it('a name emptied is a name taken away', () => {
      store().setGlobalNetworkSettings({ vlans: [{ id: 10, name: 'Uffici' }, { id: 20, name: 'Wi-Fi' }] });
      render(<SettingsModal />);
      type(nameOf(10), '   ');
      save();
      expect(toast.error as Mock).not.toHaveBeenCalled();
      expect(named()).toEqual([{ id: 20, name: 'Wi-Fi' }]);
      expect(rows()).toEqual([['20', 'Wi-Fi', 'non usata']]);
    });

    it('a row added by hand can be taken away before it is saved', () => {
      render(<SettingsModal />);
      fireEvent.click(screen.getByRole('button', { name: 'Aggiungi VLAN' }));
      type(screen.getByLabelText('Numero della nuova VLAN'), '40');
      fireEvent.click(screen.getByRole('button', { name: 'Togli la nuova VLAN' }));
      expect(within(group()).queryByRole('table')).not.toBeInTheDocument();
      save();
      expect(named()).toBeUndefined();
    });
  });

  describe('Rete — the DNS server given to the devices that are already there', () => {
    const DNS = '192.168.1.53';
    const store = () => useNetworkStore.getState();
    const cardDns = (label: string) =>
      store().devices.find(d => d.label === label)?.nics?.map(card => card.dns);
    const button = () => screen.queryByRole('button', { name: `Assegna ${DNS}` });

    /** Two PCs that ask nobody, one that asks another server, one on DHCP, a switch */
    function draw() {
      store().addDevice(host('PC-1', '192.168.1.11'));
      store().addDevice(host('PC-2', '192.168.1.12'));
      store().addDevice(host('PC-3', '192.168.1.13', '', { nics: [nic({ ip: '192.168.1.13', dns: '192.168.1.99' })] }));
      store().addDevice(device({ id: 'x', label: 'Portatile', subnet: '', nics: [nic({ dhcp: true, subnet: '' })] }));
      store().addDevice(switchWith('SW', [port(1), port(2)]));
    }

    it('is not offered while the project has no server, nor when every device has one', () => {
      draw();
      const view = render(<SettingsModal />);
      expect(screen.queryByTestId('assign-dns')).not.toBeInTheDocument();
      // typed and not saved: still nothing to give
      fireEvent.change(screen.getByLabelText('Server DNS di Default'), { target: { value: DNS } });
      expect(screen.queryByTestId('assign-dns')).not.toBeInTheDocument();
      view.unmount();

      store().clearAllDevices();
      store().addDevice(host('PC-3', '192.168.1.13', '', { nics: [nic({ ip: '192.168.1.13', dns: '192.168.1.99' })] }));
      store().setGlobalNetworkSettings({ dns: DNS });
      render(<SettingsModal />);
      expect(screen.queryByTestId('assign-dns')).not.toBeInTheDocument();
    });

    it('says how many devices ask nobody, asks, and writes the server on their cards only', async () => {
      draw();
      store().setGlobalNetworkSettings({ dns: DNS });
      store().markSaved();
      const answers = answerConfirms(true);
      render(<SettingsModal />);

      expect(screen.getByTestId('assign-dns')).toHaveTextContent(
        'Su questo canvas 2 dispositivi non hanno un server DNS.'
      );
      fireEvent.click(button()!);
      await settled();

      expect(answers.asked).toEqual([
        {
          title: `Assegnare il server DNS ${DNS} a 2 dispositivi?`,
          detail:
            "Viene scritto sulla scheda di rete di PC-1 e PC-2. Chi ha già un server DNS lo tiene, e le schede in DHCP non vengono toccate: il loro arriva con l'indirizzo.",
          confirmLabel: 'Assegna',
        },
      ]);
      expect(cardDns('PC-1')).toEqual([DNS]);
      expect(cardDns('PC-2')).toEqual([DNS]);
      expect(cardDns('PC-3')).toEqual(['192.168.1.99']);
      expect(cardDns('Portatile')).toEqual([undefined]);
      expect(store().devices.find(d => d.label === 'Portatile')?.nics?.[0]).toMatchObject({ dhcp: true, ip: '' });
      expect(store().hasUnsavedChanges).toBe(true);
      expect(toast.success as Mock).toHaveBeenCalledWith('Server DNS assegnato a 2 dispositivi');
      // nobody is left to give it to: the offer goes away
      expect(screen.queryByTestId('assign-dns')).not.toBeInTheDocument();
    });

    it('a no changes nothing', async () => {
      draw();
      store().setGlobalNetworkSettings({ dns: DNS });
      store().markSaved();
      answerConfirms(false);
      render(<SettingsModal />);

      fireEvent.click(button()!);
      await settled();

      expect(cardDns('PC-1')).toEqual([undefined]);
      expect(store().hasUnsavedChanges).toBe(false);
      expect(toast.success as Mock).not.toHaveBeenCalled();
      expect(screen.getByTestId('assign-dns')).toBeInTheDocument();
    });

    it('one device is named, in the line and in the question', async () => {
      store().addDevice(host('PC-1', '192.168.1.11'));
      store().setGlobalNetworkSettings({ dns: DNS });
      const answers = answerConfirms(true);
      render(<SettingsModal />);

      expect(screen.getByTestId('assign-dns')).toHaveTextContent('Su questo canvas PC-1 non ha un server DNS.');
      fireEvent.click(button()!);
      await settled();

      expect(answers.asked[0].title).toBe(`Assegnare il server DNS ${DNS} a PC-1?`);
      expect(answers.asked[0].detail).toMatch(/^Viene scritto sulla sua scheda di rete\./);
      expect(toast.success as Mock).toHaveBeenCalledWith('Server DNS assegnato a PC-1');
      expect(cardDns('PC-1')).toEqual([DNS]);
    });

    it('gives the server that was saved, whatever is being typed in the field', async () => {
      store().addDevice(host('PC-1', '192.168.1.11'));
      store().setGlobalNetworkSettings({ dns: DNS });
      answerConfirms(true);
      render(<SettingsModal />);

      fireEvent.change(screen.getByLabelText('Server DNS di Default'), { target: { value: '10.9.9.9' } });
      fireEvent.click(button()!);
      await settled();

      expect(cardDns('PC-1')).toEqual([DNS]);
      // what was being typed is still there, not yet saved
      expect(screen.getByLabelText<HTMLInputElement>('Server DNS di Default').value).toBe('10.9.9.9');
      expect(store().globalNetworkSettings.dns).toBe(DNS);
    });
  });
});
