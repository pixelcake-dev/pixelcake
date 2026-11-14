/**
 * The names of the VLANs of a project: how a VLAN is written with its name,
 * how the list of names is kept, which VLANs a drawing uses, and the table
 * the names are typed in.
 */

import { describe, it, expect } from 'vitest';
import type { ProjectVlan } from '@/types';
import { device, host, link, port, switchWith } from '@/test/networkFixtures';
import {
  VLAN_NAME_MAX_LENGTH,
  isVlanId,
  namedVlans,
  tidyVlanName,
  tidyVlans,
  vlanLabel,
  vlanName,
  vlanRowProblem,
  vlanRows,
  vlanShort,
  vlansInUse,
  type VlanRow,
} from './vlanNames';
import { portVlanText } from './portSummary';

const NAMES: ProjectVlan[] = [
  { id: 10, name: 'Uffici' },
  { id: 20, name: 'Wi-Fi ospiti' },
];

describe('a VLAN written with its name', () => {
  it('by itself: the number, then the name between «»', () => {
    expect(vlanLabel(10, NAMES)).toBe('VLAN 10 «Uffici»');
    expect(vlanLabel(20, NAMES)).toBe('VLAN 20 «Wi-Fi ospiti»');
  });

  it('in a list of numbers: the same, without the word', () => {
    expect(vlanShort(10, NAMES)).toBe('10 «Uffici»');
    expect([10, 30, 20].map((id) => vlanShort(id, NAMES)).join(', ')).toBe('10 «Uffici», 30, 20 «Wi-Fi ospiti»');
  });

  it('a VLAN without a name is its number, as before', () => {
    expect(vlanLabel(30, NAMES)).toBe('VLAN 30');
    expect(vlanShort(30, NAMES)).toBe('30');
    expect(vlanName(30, NAMES)).toBeUndefined();
  });

  it('a project that names no VLAN changes nothing', () => {
    for (const none of [undefined, []]) {
      expect(vlanLabel(10, none)).toBe('VLAN 10');
      expect(vlanShort(10, none)).toBe('10');
      expect(vlanName(10, none)).toBeUndefined();
    }
  });

  it('a number is not taken for another that starts the same', () => {
    expect(vlanLabel(1, NAMES)).toBe('VLAN 1');
    expect(vlanLabel(100, NAMES)).toBe('VLAN 100');
  });
});

describe('a VLAN number', () => {
  it('is a whole number from 1 to 4094', () => {
    for (const good of [1, 10, 4094]) expect(isVlanId(good)).toBe(true);
    for (const bad of [0, -1, 4095, 10.5, Number.NaN, '10', null, undefined]) {
      expect(isVlanId(bad)).toBe(false);
    }
  });
});

describe('the list of names a project keeps', () => {
  it('names are trimmed and no longer than the limit', () => {
    expect(VLAN_NAME_MAX_LENGTH).toBe(32);
    expect(tidyVlanName('  Uffici  ')).toBe('Uffici');
    const long = 'Rete degli uffici del primo piano e del secondo';
    expect(tidyVlanName(long)).toBe('Rete degli uffici del primo pian');
    expect(tidyVlanName(long)).toHaveLength(32);
    // cut on a space, nothing is left hanging
    expect(tidyVlanName(`${'x'.repeat(31)} y`)).toBe('x'.repeat(31));
  });

  it('is in the order of the numbers, one name for a number, without what has no name or no number', () => {
    const typed = [
      { id: 20, name: ' Wi-Fi ' },
      { id: 10, name: 'Uffici' },
      { id: 30, name: '   ' },
      { id: 10, name: 'Altro' },
      { id: 0, name: 'Zero' },
      { id: 4095, name: 'Troppo' },
      { id: 12.5, name: 'Mezzo' },
    ];
    expect(tidyVlans(typed)).toEqual([
      { id: 10, name: 'Uffici' },
      { id: 20, name: 'Wi-Fi' },
    ]);
    expect(tidyVlans([])).toEqual([]);
  });
});

describe('the VLANs a drawing uses', () => {
  it('are those written on a device, on a port and on a cable, lowest first, each once', () => {
    const devices = [
      switchWith('sw', [
        port(1, { portType: 'trunk', vlan: [30, 10] }),
        port(2, { portType: 'access', vlan: 10 }),
        port(3, { portType: 'access', vlan: 20 }),
      ], { vlan: [10, 40] }),
      host('pc', '192.168.1.10'),
    ];
    const connections = [link('pc', 'sw', { vlan: [50, 10] })];
    expect(vlansInUse(devices, connections)).toEqual([10, 20, 30, 40, 50]);
  });

  it('VLAN 1 is one of them when a switch that applies VLANs has ports nobody touched', () => {
    const split = switchWith('sw', [port(1, { vlan: 10 }), port(2), port(3)]);
    expect(vlansInUse([split], [])).toEqual([1, 10]);
    // every port has its own: nobody is left in VLAN 1
    const full = switchWith('sw', [port(1, { vlan: 10 }), port(2, { vlan: 20 })]);
    expect(vlansInUse([full], [])).toEqual([10, 20]);
  });

  it('a drawing where no port has a VLAN uses none, whatever its switches and routers', () => {
    const devices = [
      switchWith('sw', [port(1), port(2, { portType: 'trunk' })]),
      device({ id: 'r', type: 'Router', ports: [port(1, { portType: 'lan' }), port(2, { portType: 'wan' })] }),
      host('pc', '192.168.1.10'),
    ];
    expect(vlansInUse(devices, [link('pc', 'sw')])).toEqual([]);
  });

  it('a router port does not put its untouched siblings in VLAN 1: only a switch does', () => {
    const router = device({ id: 'r', type: 'Router', ports: [port(1, { vlan: 10 }), port(2)] });
    expect(vlansInUse([router], [])).toEqual([10]);
  });

  it('what is not a VLAN number is not counted', () => {
    const odd = switchWith('sw', [port(1, { vlan: 5000 }), port(2, { vlan: [0, 20] })], { vlan: [-3] });
    expect(vlansInUse([odd], [])).toEqual([20]);
  });
});

describe('the VLAN of a port, in words', () => {
  const ports = [
    port(1, { portType: 'trunk', vlan: [20, 10, 30] }),
    port(2, { portType: 'access', vlan: 10 }),
    port(3),
    port(4, { portType: 'trunk' }),
  ];

  it('an access port: its VLAN with its name', () => {
    expect(portVlanText(ports[1], ports, NAMES)).toBe('VLAN 10 «Uffici»');
    expect(portVlanText(ports[1], ports, undefined)).toBe('VLAN 10');
  });

  it('a port nobody touched on a switch that applies VLANs: VLAN 1', () => {
    expect(portVlanText(ports[2], ports, NAMES)).toBe('VLAN 1');
    expect(portVlanText(ports[2], ports, [{ id: 1, name: 'Gestione' }])).toBe('VLAN 1 «Gestione»');
  });

  it('a trunk: what it carries, lowest first, each with its name; or all of them', () => {
    expect(portVlanText(ports[0], ports, NAMES)).toBe('trunk: VLAN 10 «Uffici», 20 «Wi-Fi ospiti», 30');
    expect(portVlanText(ports[3], ports, NAMES)).toBe('trunk: tutte le VLAN');
  });

  it('nothing where the device applies no VLAN: a router, a switch nobody split', () => {
    const plain = [port(1), port(2, { portType: 'trunk' })];
    expect(portVlanText(plain[0], plain, NAMES)).toBe('');
    expect(portVlanText(plain[1], plain, NAMES)).toBe('');
    const routed = [port(1, { portType: 'wan' }), port(2, { portType: 'lan' })];
    expect(portVlanText(routed[1], routed, NAMES)).toBe('');
  });
});

describe('the table the names are typed in', () => {
  const row = (overrides: Partial<VlanRow>): VlanRow => ({
    key: 'k',
    id: '',
    name: '',
    fixed: false,
    inUse: false,
    ...overrides,
  });

  it('starts from the VLANs that have a name and from those the drawing uses without one, lowest first', () => {
    expect(vlanRows(NAMES, [1, 20, 30])).toEqual([
      { key: 'vlan-1', id: '1', name: '', fixed: true, inUse: true },
      { key: 'vlan-10', id: '10', name: 'Uffici', fixed: true, inUse: false },
      { key: 'vlan-20', id: '20', name: 'Wi-Fi ospiti', fixed: true, inUse: true },
      { key: 'vlan-30', id: '30', name: '', fixed: true, inUse: true },
    ]);
    expect(vlanRows(undefined, [])).toEqual([]);
  });

  it('a row left without a name is fine: it is simply not kept', () => {
    const rows = [row({ key: 'a', id: '30', fixed: true, inUse: true }), row({ key: 'b' })];
    expect(rows.map((r) => vlanRowProblem(r, rows))).toEqual([undefined, undefined]);
    expect(namedVlans(rows)).toEqual([]);
  });

  it('a row added by hand needs a number that is a VLAN, and a name', () => {
    const problem = (overrides: Partial<VlanRow>) => {
      const one = row(overrides);
      return vlanRowProblem(one, [one]);
    };
    expect(problem({ id: '30', name: 'Server' })).toBeUndefined();
    expect(problem({ id: ' 30 ', name: ' Server ' })).toBeUndefined();
    expect(problem({ id: '30' })).toBe('Manca il nome della VLAN 30');
    expect(problem({ name: 'Server' })).toBe('Manca il numero della VLAN «Server»');
    for (const bad of ['0', '4095', 'dieci', '10.5', '-3', '1e2']) {
      expect(problem({ id: bad, name: 'Server' })).toBe(`"${bad}" non è una VLAN: il numero va da 1 a 4094`);
    }
    // a number that is not one is said even before a name is typed
    expect(problem({ id: 'x' })).toBe('"x" non è una VLAN: il numero va da 1 a 4094');
  });

  it('a number may be in the list once: the row refused is the second that carries it', () => {
    const rows = [
      row({ key: 'a', id: '10', name: 'Uffici', fixed: true }),
      row({ key: 'b', id: '30', fixed: true, inUse: true }),
      row({ key: 'c', id: '10', name: 'Altro' }),
      row({ key: 'd', id: '30', name: 'Server' }),
      row({ key: 'e', id: '010', name: 'Ancora' }),
    ];
    expect(rows.map((r) => vlanRowProblem(r, rows))).toEqual([
      undefined,
      undefined,
      "La VLAN 10 è già nell'elenco",
      // (the VLAN of the drawing is in the list already, waiting for its name)
      "La VLAN 30 è già nell'elenco",
      "La VLAN 10 è già nell'elenco",
    ]);
  });

  it('gives the names as the project keeps them: tidy, in order, only the rows that have one', () => {
    const rows = [
      row({ key: 'a', id: '20', name: ' Wi-Fi ', fixed: true, inUse: true }),
      row({ key: 'b', id: '30', fixed: true, inUse: true }),
      row({ key: 'c', id: '5', name: 'Gestione' }),
      row({ key: 'd' }),
    ];
    expect(namedVlans(rows)).toEqual([
      { id: 5, name: 'Gestione' },
      { id: 20, name: 'Wi-Fi' },
    ]);
  });
});
