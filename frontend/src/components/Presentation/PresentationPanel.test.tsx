/**
 * PresentationPanel — the question, the answer, the simulated failures and
 * what they do, on the third sample network (two sites, two lines, a ring of
 * switches). The engine is the real one: what the panel says is what the
 * engine answers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import { device, host, link, port } from '@/test/networkFixtures';
import PresentationPanel from './PresentationPanel';

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();
const simulation = () => useSimulationStore.getState();

const id = (label: string) => {
  const found = network().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found.id;
};

/** The id the store gave to the cable between two devices of the sample */
const cable = (a: string, b: string) => {
  const [first, second] = [id(a), id(b)];
  const found = network().connections.find(
    c => (c.source === first && c.target === second) || (c.source === second && c.target === first)
  );
  if (!found) throw new Error(`no cable between "${a}" and "${b}"`);
  return found.id;
};

const section = (name: string) => screen.getByRole('region', { name });
const verdict = () => screen.getByRole('status');

beforeEach(() => {
  localStorage.clear();
  presentation().exit();
  simulation().resetSimulation();
  const sample = createRedundancySample();
  network().clearAllDevices();
  network().loadTopology(sample.devices, sample.connections);
  presentation().enter();
});

describe('PresentationPanel — the question', () => {
  it('starts by saying what to do, with nothing asked and nothing broken', () => {
    render(<PresentationPanel />);

    expect(within(section('Risposta')).getByText(/Scegli da dove parte e dove arriva/)).toBeInTheDocument();
    expect(within(section('Guasti simulati')).getByText(/Cosa succede se si rompe/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Percorso' })).toBeNull();
    expect(screen.getByRole('button', { name: /Mostra di nuovo/ })).toBeDisabled();
    expect(simulation().isRunning).toBe(false);
    expect(presentation().route).toBeNull();
  });

  it('asks for the missing end once one is chosen', () => {
    render(<PresentationPanel />);

    act(() => presentation().setSource(id('PC-Sede-1')));
    expect(screen.getByText('Ora scegli dove arriva.')).toBeInTheDocument();

    act(() => presentation().swapEnds());
    expect(screen.getByText('Ora scegli da dove parte.')).toBeInTheDocument();
  });

  it('lists every device in its two menus, by name, and takes the choice', () => {
    render(<PresentationPanel />);

    fireEvent.click(screen.getByRole('button', { name: /^Da / }));
    const options = screen.getAllByRole('button', { name: /\(\d+\.\d+\.\d+\.\d+\)$/ }).map(b => b.textContent);
    expect(options).toHaveLength(12);
    expect(options[0]).toBe('PC-Filiale-1 (192.168.2.11)');
    expect([...options].sort((a, b) => (a ?? '').localeCompare(b ?? ''))).toEqual(options);

    fireEvent.click(screen.getByRole('button', { name: 'PC-Sede-1 (192.168.1.11)' }));
    expect(presentation().sourceId).toBe(id('PC-Sede-1'));
    expect(screen.getByRole('button', { name: 'Da PC-Sede-1 (192.168.1.11)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^A / }));
    fireEvent.click(screen.getByRole('button', { name: 'Srv-File (192.168.1.10)' }));
    expect(presentation().targetId).toBe(id('Srv-File'));
  });

  it('swaps the two ends', () => {
    render(<PresentationPanel />);
    expect(screen.getByRole('button', { name: 'Inverti partenza e arrivo' })).toBeDisabled();

    act(() => presentation().ask(id('PC-Sede-1'), id('Srv-File')));
    fireEvent.click(screen.getByRole('button', { name: 'Inverti partenza e arrivo' }));

    expect(presentation()).toMatchObject({ sourceId: id('Srv-File'), targetId: id('PC-Sede-1') });
    expect(verdict()).toHaveTextContent('PC-Sede-1 risponde a Srv-File.');
  });

  it('changes the kind of exchange', () => {
    render(<PresentationPanel />);
    act(() => presentation().ask(id('PC-Sede-1'), id('Srv-File')));
    expect(screen.getByRole('button', { name: 'Ping' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Web' }));

    expect(presentation().flow).toBe('web');
    expect(screen.getByRole('button', { name: 'Web' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ping' })).toHaveAttribute('aria-pressed', 'false');
    expect(verdict()).toHaveTextContent('PC-Sede-1 apre la pagina di Srv-File.');
    expect(within(section('Percorso')).getByText('Richiesta della pagina')).toBeInTheDocument();
    expect(simulation().flowModel).toBe('web');
  });
});

describe('PresentationPanel — the answer', () => {
  it('says it arrives, shows the way there, and folds a reply that comes back the same way', () => {
    render(<PresentationPanel />);

    act(() => presentation().ask(id('PC-Filiale-1'), id('Srv-File')));

    expect(verdict()).toHaveTextContent('Arriva');
    expect(verdict()).toHaveTextContent('Srv-File risponde a PC-Filiale-1.');

    const way = section('Percorso');
    const there = within(way).getByText('Andata').closest('.presentation-leg') as HTMLElement;
    expect(within(there).getAllByRole('listitem').map(li => li.querySelector('.presentation-step-label')?.textContent)).toEqual([
      'PC-Filiale-1',
      'SW-Filiale',
      'R-Filiale',
      'R-Sede',
      'SW-Core',
      'Srv-File',
    ]);
    expect(within(there).getByText('routed: 192.168.1.0/24 via 10.0.0.1 (port 2)')).toBeInTheDocument();

    const back = within(way).getByText('Ritorno').closest('details') as HTMLDetailsElement;
    expect(back.open).toBe(false);
    expect(within(back).getByText('per la stessa strada')).toBeInTheDocument();
    // nothing left to assume in this drawing
    expect(within(way).queryByText('Note del motore')).toBeNull();
  });

  it('compares with "no failures" only when something is broken', () => {
    render(<PresentationPanel />);
    act(() => presentation().ask(id('PC-Sede-1'), id('Srv-File')));
    expect(document.querySelector('.presentation-whatif')).toBeNull();

    // a failure that has nothing to do with this question is still worth a line
    act(() => presentation().toggleDeviceFailure(id('R-Riserva')));
    expect(screen.getByText('I guasti non toccano questo percorso: va come prima.')).toBeInTheDocument();

    act(() => presentation().repairAll());
    expect(document.querySelector('.presentation-whatif')).toBeNull();
  });

  it('sets the packet off on the very cables of the answer, and marks its way on the canvas', () => {
    render(<PresentationPanel />);

    act(() => presentation().ask(id('PC-Sede-1'), id('Srv-File')));

    expect(simulation().isRunning).toBe(true);
    expect(simulation().path).toEqual(
      ['PC-Sede-1', 'SW-Piano-1', 'SW-Core', 'Srv-File', 'SW-Core', 'SW-Piano-1', 'PC-Sede-1'].map(id)
    );
    expect(simulation().links).toEqual(
      [
        ['PC-Sede-1', 'SW-Piano-1'],
        ['SW-Piano-1', 'SW-Core'],
        ['SW-Core', 'Srv-File'],
        ['SW-Core', 'Srv-File'],
        ['SW-Piano-1', 'SW-Core'],
        ['PC-Sede-1', 'SW-Piano-1'],
      ].map(([a, b]) => cable(a, b))
    );
    expect(presentation().route).toEqual({
      links: [cable('PC-Sede-1', 'SW-Piano-1'), cable('SW-Piano-1', 'SW-Core'), cable('SW-Core', 'Srv-File')],
      arrives: true,
      dropDeviceId: null,
    });
  });

  it('follows the packet down the list while it travels', () => {
    render(<PresentationPanel />);
    act(() => presentation().ask(id('PC-Sede-1'), id('Srv-File')));
    const rows = () =>
      within(within(section('Percorso')).getByText('Andata').closest('.presentation-leg') as HTMLElement)
        .getAllByRole('listitem')
        .map(li => `${li.querySelector('.presentation-step-label')?.textContent}:${li.className.replace(/status-\w+ ?/, '').trim()}`);

    // leaving PC-Sede-1
    act(() => {
      simulation().setCurrentHop(0);
      simulation().setActiveDevice(id('PC-Sede-1'));
    });
    expect(rows()).toEqual(['PC-Sede-1:current', 'SW-Piano-1:pending', 'SW-Core:pending', 'Srv-File:pending']);

    // arrived on SW-Piano-1
    act(() => simulation().setActiveDevice(id('SW-Piano-1')));
    expect(rows()).toEqual(['PC-Sede-1:', 'SW-Piano-1:current', 'SW-Core:pending', 'Srv-File:pending']);

    // the run is over: the whole answer is shown again
    act(() => simulation().stopSimulation());
    expect(rows()).toEqual(['PC-Sede-1:', 'SW-Piano-1:', 'SW-Core:', 'Srv-File:']);
  });

  it('does not take another packet on the canvas (one of the terminal) for its own', () => {
    render(<PresentationPanel />);
    act(() => presentation().ask(id('PC-Sede-1'), id('Srv-File')));

    act(() => {
      simulation().startSimulation([id('PC-Sede-2'), id('SW-Piano-2')], 'ping');
      simulation().setActiveDevice(id('PC-Sede-2'));
    });

    expect(section('Percorso').querySelector('.pending, .current')).toBeNull();
  });

  it('shows it again on request, and can stop it', () => {
    render(<PresentationPanel />);
    act(() => presentation().ask(id('PC-Sede-1'), id('Srv-File')));
    const firstRun = simulation().runId;

    fireEvent.click(screen.getByRole('button', { name: /Ferma/ }));
    expect(simulation().isRunning).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Mostra di nuovo/ }));
    expect(simulation().isRunning).toBe(true);
    expect(simulation().runId).toBe(firstRun + 1);
  });

  it('says where the packet stops and why, in the words of the engine', () => {
    render(<PresentationPanel />);
    act(() => {
      presentation().ask(id('PC-Sede-1'), id('Srv-File'));
      presentation().toggleDeviceFailure(id('SW-Core'));
    });

    expect(verdict()).toHaveTextContent('Non arriva');
    expect(verdict()).toHaveTextContent('Si ferma su SW-Piano-1 (andata).');
    expect(screen.getByText('SW-Core is down')).toBeInTheDocument();
    expect(screen.getByText('Senza guasti arrivava.')).toBeInTheDocument();
    expect(presentation().route).toMatchObject({ arrives: false, dropDeviceId: id('SW-Piano-1') });
    // the packet still goes as far as it gets
    expect(simulation().path).toEqual([id('PC-Sede-1'), id('SW-Piano-1')]);
  });

  it('has nothing to animate when the packet does not even leave', () => {
    render(<PresentationPanel />);
    act(() => {
      presentation().ask(id('PC-Sede-1'), id('Srv-File'));
      presentation().toggleDeviceFailure(id('PC-Sede-1'));
    });

    expect(verdict()).toHaveTextContent('Non esce nemmeno da PC-Sede-1 (andata).');
    expect(simulation().isRunning).toBe(false);
    expect(screen.getByRole('button', { name: /Mostra di nuovo/ })).toBeDisabled();
  });

  it('shows the notes of the engine when there are some', () => {
    render(<PresentationPanel />);
    act(() => {
      presentation().ask(id('PC-Filiale-1'), id('Srv-File'));
      presentation().toggleConnectionFailure(cable('R-Sede', 'R-Filiale'));
    });

    const notes = within(section('Percorso')).getByText('Note del motore').closest('div') as HTMLElement;
    expect(within(notes).getAllByRole('listitem')).toHaveLength(2);
    expect(notes).toHaveTextContent(
      'request: R-Filiale: the route 192.168.1.0/24 via 10.0.0.1 is unusable (link R-Filiale–R-Sede is down)'
    );
  });
});

describe('PresentationPanel — what happens if this breaks', () => {
  it('the main line: the answer takes the backup line and says so; nothing is lost', () => {
    render(<PresentationPanel />);
    act(() => presentation().ask(id('PC-Filiale-1'), id('Srv-File')));
    const before = simulation().runId;

    act(() => presentation().toggleConnectionFailure(cable('R-Sede', 'R-Filiale')));

    expect(verdict()).toHaveTextContent('Arriva');
    expect(screen.getByText("Arriva lo stesso, per un'altra strada: ora passa da R-Riserva.")).toBeInTheDocument();
    // the packet is set off again, along the new way
    expect(simulation().runId).toBe(before + 1);
    expect(simulation().path).toContain(id('R-Riserva'));
    expect(simulation().links).not.toContain(cable('R-Sede', 'R-Filiale'));

    const failures = section('Guasti simulati');
    expect(within(failures).getByRole('button', { name: 'Ripara il cavo R-Sede – R-Filiale' })).toBeInTheDocument();
    expect(failures).toHaveTextContent('Ping tra i 5 dispositivi finali: 20 comunicazioni che senza guasti funzionano.');
    expect(failures).toHaveTextContent('Nessuna si interrompe');
    expect(failures).toHaveTextContent("12 passano da un'altra strada");
    expect(failures).toHaveTextContent('8 non cambiano');
    expect(failures).toHaveTextContent('spanning tree non sono simulati');
  });

  it('the core switch: counts what stops, device by device', () => {
    render(<PresentationPanel />);

    act(() => presentation().toggleDeviceFailure(id('SW-Core')));

    const failures = section('Guasti simulati');
    expect(within(failures).getByRole('button', { name: 'Ripara SW-Core' })).toBeInTheDocument();
    expect(failures).toHaveTextContent('16 si interrompono');
    expect(failures).toHaveTextContent('4 non cambiano');
    expect(failures).not.toHaveTextContent("da un'altra strada");
    const groups = [...failures.querySelectorAll('.presentation-impact-groups li')].map(li => li.textContent);
    expect(groups).toEqual([
      'Srv-File → PC-Sede-1PC-Sede-2PC-Filiale-1PC-Filiale-2',
      'PC-Sede-1 → Srv-FilePC-Filiale-1PC-Filiale-2',
      'PC-Sede-2 → Srv-FilePC-Filiale-1PC-Filiale-2',
      'PC-Filiale-1 → Srv-FilePC-Sede-1PC-Sede-2',
      'PC-Filiale-2 → Srv-FilePC-Sede-1PC-Sede-2',
    ]);
  });

  it('counts one exchange in the singular', () => {
    // A firewall between an outside PC and a server in the DMZ: with ping,
    // only the server reaches the PC (the zone policy), so one exchange works
    act(() => {
      network().clearAllDevices();
      network().loadTopology(
        [
          host('out', '203.0.113.50', '203.0.113.1'),
          host('web', '172.16.0.10', '172.16.0.1', { type: 'Server' }),
          device({
            id: 'fw',
            type: 'Firewall',
            ports: [
              port(1, { ip: '203.0.113.1', subnet: '255.255.255.0', securityZone: 'untrust' }),
              port(2, { ip: '172.16.0.1', subnet: '255.255.255.0', securityZone: 'dmz' }),
            ],
          }),
        ],
        [
          link('out', 'fw', { sourceNic: 'nic-1', targetPort: 1 }),
          link('web', 'fw', { sourceNic: 'nic-1', targetPort: 2 }),
        ]
      );
    });
    render(<PresentationPanel />);

    act(() => presentation().toggleDeviceFailure(id('fw')));

    const failures = section('Guasti simulati');
    expect(failures).toHaveTextContent('Ping tra i 2 dispositivi finali: 1 comunicazione che senza guasti funziona.');
    expect(failures).toHaveTextContent('1 si interrompe');
    expect(failures).not.toHaveTextContent('si interrompono');
    expect([...failures.querySelectorAll('.presentation-impact-groups li')].map(li => li.textContent)).toEqual([
      'web → out',
    ]);
  });

  it('cuts a long list short, says how much is left, and shows it all on request', () => {
    // nine PCs on one switch: with the switch down each loses the other eight
    act(() => {
      network().clearAllDevices();
      network().loadTopology(
        [
          device({
            id: 'sw',
            type: 'Switch',
            ports: Array.from({ length: 16 }, (_, i) => port(i + 1)),
          }),
          ...Array.from({ length: 9 }, (_, i) => host(`pc${i + 1}`, `192.168.1.${11 + i}`)),
        ],
        Array.from({ length: 9 }, (_, i) =>
          link(`pc${i + 1}`, 'sw', { sourceNic: 'nic-1', targetPort: i + 1 })
        )
      );
    });
    render(<PresentationPanel />);

    act(() => presentation().toggleDeviceFailure(id('sw')));

    const failures = section('Guasti simulati');
    expect(failures).toHaveTextContent('72 si interrompono');
    const rows = () => [...failures.querySelectorAll('.presentation-impact-groups li')].map(li => li.textContent);
    expect(rows()).toEqual([
      'pc1 → pc2pc3pc4pc5pc6e altri 3',
      'pc2 → pc1pc3pc4pc5pc6e altri 3',
      'pc3 → pc1pc2pc4pc5pc6e altri 3',
      'pc4 → pc1pc2pc3pc5pc6e altri 3',
      'pc5 → pc1pc2pc3pc4pc6e altri 3',
      'pc6 → pc1pc2pc3pc4pc5e altri 3',
      'e altri 3 dispositivi',
    ]);

    fireEvent.click(within(failures).getByRole('button', { name: 'Mostra tutto' }));
    expect(rows()).toHaveLength(9);
    expect(rows()[8]).toBe('pc9 → pc1pc2pc3pc4pc5pc6pc7pc8');
    expect(within(failures).getByRole('button', { name: 'Mostra meno' })).toHaveAttribute('aria-expanded', 'true');

    // an exchange far down the list can now be asked for
    fireEvent.click(within(failures).getByRole('button', { name: 'Mostra da pc9 a pc8' }));
    expect(presentation()).toMatchObject({ sourceId: id('pc9'), targetId: id('pc8') });

    fireEvent.click(within(failures).getByRole('button', { name: 'Mostra meno' }));
    expect(rows()).toHaveLength(7);
  });

  it('a short list is shown whole, with nothing to unfold', () => {
    render(<PresentationPanel />);
    act(() => presentation().toggleDeviceFailure(id('SW-Core')));

    const failures = section('Guasti simulati');
    expect(within(failures).queryByRole('button', { name: 'Mostra tutto' })).toBeNull();
    expect(failures.querySelector('.presentation-impact-more')).toBeNull();
  });

  it('needs two end devices to measure anything', () => {
    act(() => {
      for (const label of ['PC-Sede-1', 'PC-Sede-2', 'PC-Filiale-1', 'PC-Filiale-2']) {
        network().removeDevice(id(label));
      }
    });
    render(<PresentationPanel />);

    act(() => presentation().toggleDeviceFailure(id('SW-Core')));

    expect(section('Guasti simulati')).toHaveTextContent(
      "Per misurare l'effetto servono almeno due dispositivi finali"
    );
  });

  it('a click on a lost destination asks that very question', () => {
    render(<PresentationPanel />);
    act(() => presentation().toggleDeviceFailure(id('SW-Core')));

    fireEvent.click(screen.getByRole('button', { name: 'Mostra da PC-Filiale-1 a Srv-File' }));

    expect(presentation()).toMatchObject({ sourceId: id('PC-Filiale-1'), targetId: id('Srv-File') });
    expect(verdict()).toHaveTextContent('Non arriva');
    expect(screen.getByRole('button', { name: 'Mostra da PC-Filiale-1 a Srv-File' })).toHaveAttribute(
      'title',
      'SW-Core is down'
    );
  });

  it('repairs one thing with a click on it, or everything at once', () => {
    render(<PresentationPanel />);
    act(() => {
      presentation().toggleDeviceFailure(id('SW-Core'));
      presentation().toggleDeviceFailure(id('R-Riserva'));
      presentation().toggleConnectionFailure(cable('R-Sede', 'R-Filiale'));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ripara SW-Core' }));
    expect(presentation().failedDevices).toEqual([id('R-Riserva')]);

    fireEvent.click(screen.getByRole('button', { name: /Ripara tutto/ }));
    expect(presentation().failedDevices).toEqual([]);
    expect(presentation().failedConnections).toEqual([]);
    expect(within(section('Guasti simulati')).getByText(/Cosa succede se si rompe/)).toBeInTheDocument();
  });

  it('measures the effect with the kind of exchange chosen', () => {
    render(<PresentationPanel />);
    act(() => presentation().toggleDeviceFailure(id('SW-Core')));

    fireEvent.click(screen.getByRole('button', { name: 'Web' }));

    expect(section('Guasti simulati')).toHaveTextContent('Web tra i 5 dispositivi finali');
  });

  it('says so when nothing worked to begin with', () => {
    // without its switches the drawing has no cable left to an end device
    act(() => {
      for (const device of network().devices) {
        if (device.type === 'Switch') network().removeDevice(device.id);
      }
    });
    render(<PresentationPanel />);

    act(() => presentation().toggleDeviceFailure(id('R-Sede')));

    expect(section('Guasti simulati')).toHaveTextContent(
      'Con Ping nessuna comunicazione tra i dispositivi finali funzionava già prima dei guasti.'
    );
  });
});

describe('PresentationPanel — keeping up with the drawing', () => {
  it('shows a change made to the drawing (from the terminal) without setting the packet off again', () => {
    render(<PresentationPanel />);
    act(() => presentation().ask(id('PC-Sede-1'), id('Srv-File')));
    act(() => simulation().stopSimulation());
    const runs = simulation().runId;

    act(() => network().updateDevice(id('Srv-File'), { label: 'Archivio' }));

    expect(verdict()).toHaveTextContent('Archivio risponde a PC-Sede-1.');
    expect(simulation().runId).toBe(runs);
    expect(simulation().isRunning).toBe(false);
  });

  it('forgets a device that is removed from the drawing', () => {
    render(<PresentationPanel />);
    act(() => {
      presentation().ask(id('PC-Sede-1'), id('Srv-File'));
      presentation().toggleDeviceFailure(id('PC-Sede-2'));
    });
    const gone = id('PC-Sede-2');
    const target = id('Srv-File');

    act(() => {
      network().removeDevice(gone);
      network().removeDevice(target);
    });

    expect(presentation().failedDevices).toEqual([]);
    expect(presentation().targetId).toBeNull();
    expect(screen.getByText('Ora scegli dove arriva.')).toBeInTheDocument();
  });

  it('starts again from nothing when another canvas comes on screen', () => {
    render(<PresentationPanel />);
    act(() => {
      presentation().ask(id('PC-Sede-1'), id('Srv-File'));
      presentation().toggleDeviceFailure(id('SW-Core'));
    });

    act(() => useNetworkStore.setState(state => ({ canvasRevision: state.canvasRevision + 1 })));

    expect(presentation()).toMatchObject({ sourceId: null, targetId: null, failedDevices: [] });
    expect(simulation().isRunning).toBe(false);
    expect(screen.getByText(/Scegli da dove parte e dove arriva/)).toBeInTheDocument();
  });
});

describe('PresentationPanel — closed', () => {
  it('leaves room to the drawing and keeps working', () => {
    render(<PresentationPanel />);
    act(() => presentation().ask(id('PC-Sede-1'), id('Srv-File')));

    fireEvent.click(screen.getByRole('button', { name: 'Chiudi il pannello' }));
    expect(screen.queryByRole('region', { name: 'Risposta' })).toBeNull();
    expect(presentation().route?.arrives).toBe(true);

    // a failure chosen on the canvas still changes the answer and its way
    act(() => presentation().toggleDeviceFailure(id('SW-Core')));
    expect(presentation().route).toMatchObject({ arrives: false, dropDeviceId: id('SW-Piano-1') });
    expect(simulation().path).toEqual([id('PC-Sede-1'), id('SW-Piano-1')]);

    fireEvent.click(screen.getByRole('button', { name: 'Apri il pannello' }));
    expect(verdict()).toHaveTextContent('Non arriva');
  });
});
