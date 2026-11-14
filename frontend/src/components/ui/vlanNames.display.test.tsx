/**
 * The name the project gave a VLAN is written next to its number wherever
 * the interface shows the number: the summary of a switch, the settings of
 * a port, what a port says under the pointer, the list of VLANs of a
 * device. A VLAN without a name, and a project that names none, show what
 * they showed before. The engine and the terminal keep the numbers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import type { Port, ProjectVlan } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { executeCommand } from '@/terminal/executor';
import { traceRoute } from '@/engine';
import { host, link, port, switchWith } from '@/test/networkFixtures';
import { SwitchPortsOverview } from './PortsOverview';
import PortEditor from './PortEditor';
import PortGrid from './PortGrid';
import { VLANInput } from './VLANInput';

const NAMES: ProjectVlan[] = [
  { id: 10, name: 'Uffici' },
  { id: 20, name: 'Wi-Fi' },
];

const PORTS: Port[] = [
  port(1, { portType: 'trunk', vlan: [20, 10, 30] }),
  port(2, { portType: 'access', vlan: 10 }),
  port(3, { portType: 'access', vlan: 10 }),
  port(4, { portType: 'access', vlan: 20, name: 'Access point' }),
  port(5, { portType: 'access', vlan: 30 }),
  port(6),
];

const nameVlans = (vlans: ProjectVlan[] | undefined) =>
  act(() => useNetworkStore.getState().setGlobalNetworkSettings({ vlans }));

beforeEach(() => {
  localStorage.clear();
  useNetworkStore.getState().clearAllDevices();
  useNetworkStore.getState().setGlobalNetworkSettings({ vlans: undefined });
});

describe('the summary of a switch', () => {
  const lines = () => screen.getAllByRole('listitem').map((item) => item.textContent);
  const show = () =>
    render(<SwitchPortsOverview ports={PORTS} linkedPorts={new Map()} onOpenPort={() => {}} />);

  it('writes each VLAN with its name, and the VLANs of a trunk too', () => {
    nameVlans(NAMES);
    show();
    expect(lines()).toEqual([
      'VLAN 1: porta 6',
      'VLAN 10 «Uffici»: porte 2, 3',
      'VLAN 20 «Wi-Fi»: porta 4',
      'VLAN 30: porta 5',
      'Trunk: porta 1, porta le VLAN 10 «Uffici», 20 «Wi-Fi», 30',
    ]);
  });

  it('without names is as it was', () => {
    show();
    expect(lines()).toEqual([
      'VLAN 1: porta 6',
      'VLAN 10: porte 2, 3',
      'VLAN 20: porta 4',
      'VLAN 30: porta 5',
      'Trunk: porta 1, porta le VLAN 10, 20, 30',
    ]);
  });

  it('follows the names as they are given, changed and taken away', () => {
    show();
    nameVlans([{ id: 30, name: 'Server' }]);
    expect(lines()).toContain('VLAN 30 «Server»: porta 5');
    nameVlans([{ id: 30, name: 'Sala macchine' }]);
    expect(lines()).toContain('VLAN 30 «Sala macchine»: porta 5');
    nameVlans(undefined);
    expect(lines()).toContain('VLAN 30: porta 5');
  });
});

describe('the settings of a switch port', () => {
  function Editor({ start }: { start: Port }) {
    const [value, setValue] = useState(start);
    return <PortEditor port={value} deviceType="Switch" onChange={(patch) => setValue({ ...value, ...patch })} />;
  }
  const names = () => screen.queryByTestId('vlan-names')?.textContent;

  it('the field holds the number; the name of the VLAN is said under it, and follows what is typed', () => {
    nameVlans(NAMES);
    render(<Editor start={PORTS[1]} />);
    const field = screen.getByLabelText('VLAN (singola)');
    expect(field).toHaveValue('10');
    expect(names()).toBe('VLAN 10 «Uffici»');

    fireEvent.change(field, { target: { value: '20' } });
    expect(field).toHaveValue('20');
    expect(names()).toBe('VLAN 20 «Wi-Fi»');
    // what does not read as a VLAN has no name: the line is about what is
    // typed, not about the VLAN the port still has (20)
    fireEvent.change(field, { target: { value: '10, 20' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Una porta di accesso sta in una sola VLAN');
    expect(names()).toBeUndefined();
    fireEvent.change(field, { target: { value: '2x' } });
    expect(names()).toBeUndefined();
    // a VLAN nobody named: nothing to add to its number
    fireEvent.change(field, { target: { value: '30' } });
    expect(names()).toBeUndefined();
    fireEvent.change(field, { target: { value: '' } });
    expect(names()).toBeUndefined();
  });

  it('a trunk says the names of what it carries, in the order typed', () => {
    nameVlans(NAMES);
    render(<Editor start={PORTS[0]} />);
    expect(screen.getByLabelText('VLANs (separati da virgola)')).toHaveValue('20, 10, 30');
    expect(names()).toBe('VLAN 20 «Wi-Fi», 10 «Uffici», 30');
  });

  it('without names nothing is added under the field', () => {
    render(<Editor start={PORTS[1]} />);
    expect(screen.getByLabelText('VLAN (singola)')).toHaveValue('10');
    expect(names()).toBeUndefined();
  });
});

describe('a port under the pointer', () => {
  const titleOf = (id: number) => screen.getByText(String(id), { selector: '.port-number' }).closest('button')?.title;
  const show = (ports: Port[], linked = new Map<number, string>()) =>
    render(<PortGrid ports={ports} selectedPortId={null} onPortSelect={() => {}} linkedPorts={linked} />);

  it('says its VLAN with its name, after its own name and before what it is linked to', () => {
    nameVlans(NAMES);
    show(PORTS, new Map([[2, 'PC-1 (eth0)']]));
    expect(titleOf(2)).toBe('Port 2 — VLAN 10 «Uffici» — collegata a PC-1 (eth0)');
    expect(titleOf(3)).toBe('Port 3 — VLAN 10 «Uffici»');
    expect(titleOf(4)).toBe('Access point — VLAN 20 «Wi-Fi»');
    expect(titleOf(5)).toBe('Port 5 — VLAN 30');
    expect(titleOf(6)).toBe('Port 6 — VLAN 1');
    expect(titleOf(1)).toBe('Port 1 — trunk: VLAN 10 «Uffici», 20 «Wi-Fi», 30');
  });

  it('without names says the numbers', () => {
    show(PORTS);
    expect(titleOf(3)).toBe('Port 3 — VLAN 10');
    expect(titleOf(1)).toBe('Port 1 — trunk: VLAN 10, 20, 30');
  });

  it('says nothing of VLANs where the device applies none', () => {
    nameVlans([{ id: 1, name: 'Gestione' }]);
    const routed = [port(1, { portType: 'wan', name: 'Internet' }), port(2, { portType: 'lan' })];
    show(routed, new Map([[2, 'SW-1 (porta 8)']]));
    expect(titleOf(1)).toBe('Internet');
    expect(titleOf(2)).toBe('Port 2 — collegata a SW-1 (porta 8)');
  });
});

describe('the list of VLANs of a device', () => {
  function List({ start }: { start: number[] }) {
    const [value, setValue] = useState(start);
    return (
      <>
        <VLANInput value={value} onChange={setValue} />
        <output data-testid="kept">{JSON.stringify(value)}</output>
      </>
    );
  }
  const chips = () =>
    Array.from(document.querySelectorAll('.vlan-input-container span'))
      .filter((span) => span.querySelector('button'))
      .map((span) => span.textContent);

  it('shows each VLAN with its name on its tag; what is kept is still the numbers', () => {
    nameVlans(NAMES);
    render(<List start={[10, 30]} />);
    expect(chips()).toEqual(['10 «Uffici»', '30']);

    fireEvent.change(screen.getByLabelText('VLAN'), { target: { value: '20' } });
    fireEvent.keyDown(screen.getByLabelText('VLAN'), { key: 'Enter' });
    expect(chips()).toEqual(['10 «Uffici»', '30', '20 «Wi-Fi»']);
    expect(screen.getByTestId('kept')).toHaveTextContent('[10,30,20]');

    fireEvent.click(screen.getByRole('button', { name: 'Togli la VLAN 10' }));
    expect(chips()).toEqual(['30', '20 «Wi-Fi»']);
    expect(screen.getByTestId('kept')).toHaveTextContent('[30,20]');
  });

  it('without names shows the numbers', () => {
    render(<List start={[10, 30]} />);
    expect(chips()).toEqual(['10', '30']);
  });
});

describe('the engine and the terminal', () => {
  it('keep the numbers: no name of the project reaches their English messages', () => {
    const network = useNetworkStore.getState();
    network.loadTopology(
      [
        host('a', '192.168.1.11'),
        host('b', '192.168.1.12'),
        switchWith('sw', [port(1, { vlan: 10 }), port(2, { vlan: 20 })], { label: 'SW' }),
      ],
      [
        link('a', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
        link('b', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      ]
    );
    nameVlans(NAMES);

    const { devices, connections } = useNetworkStore.getState();
    const [a, b] = devices;
    const answer = traceRoute(a.id, b.id, { devices, connections });
    // (two VLANs and no router between them: the reason names a VLAN)
    expect(answer.verdict).not.toBe('success');
    expect(JSON.stringify(answer)).toMatch(/VLAN (10|20)\b/);

    const printed = [
      ...executeCommand('show vlans', { deviceLabel: null }).lines,
      ...executeCommand('show ports SW', { deviceLabel: null }).lines,
      ...executeCommand('show config SW', { deviceLabel: null }).lines,
    ].map((line) => line.text);
    expect(printed.join('\n')).toMatch(/\b10\b/);
    for (const text of [...printed, JSON.stringify(answer)]) {
      expect(text).not.toMatch(/Uffici|Wi-Fi|«/);
    }
  });
});

describe('the table of the names', () => {
  it('lists a VLAN by number and name, with a row of its own for what is wrong', async () => {
    const { default: VlanNamesTable } = await import('./VlanNamesTable');
    const rows = [
      { key: 'vlan-10', id: '10', name: 'Uffici', fixed: true, inUse: true },
      { key: 'new-1', id: '10', name: 'Altro', fixed: false, inUse: false },
    ];
    render(<VlanNamesTable rows={rows} onChange={() => {}} showProblems />);
    const table = screen.getByRole('table', { name: 'VLAN del progetto' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'VLAN',
      'Nome',
      'Su questo canvas',
      'Togli',
    ]);
    expect(within(table).getByRole('alert')).toHaveTextContent("La VLAN 10 è già nell'elenco");
  });
});
