import { describe, it, expect } from 'vitest';
import type { NetworkInterfaceCard, Port } from '@/types';
import {
  firstInterfaceProblem,
  nicProblems,
  portProblems,
  readVlanText,
  tidyNic,
  tidyPort,
  vlanText,
} from './interfaceProblems';

const MASK = '255.255.255.0';
const port = (overrides: Partial<Port> = {}): Port => ({ id: 2, enabled: true, ...overrides });
const card = (overrides: Partial<NetworkInterfaceCard> = {}): NetworkInterfaceCard => ({
  id: 'nic-1',
  name: 'eth0',
  enabled: true,
  speed: 'auto',
  ip: '192.168.1.10',
  subnet: MASK,
  gateway: '192.168.1.1',
  ...overrides,
});

describe('what is wrong with a port as typed', () => {
  it('nothing, for a port with a good address, or with none', () => {
    expect(portProblems('Router', port({ ip: '192.168.10.1', subnet: MASK }))).toEqual({});
    expect(portProblems('Router', port({ ip: ' 192.168.10.1 ' }))).toEqual({});
    expect(portProblems('Firewall', port())).toEqual({});
  });

  it('an address or a mask that is not one, and a mask without an address', () => {
    expect(portProblems('Router', port({ ip: '192.168.10.999' })).address).toBe(
      '"192.168.10.999" non è un indirizzo IPv4 valido'
    );
    expect(portProblems('Router', port({ ip: '192.168.10.1', subnet: '255.255.255' })).address).toBe(
      '"255.255.255" non è una subnet mask valida'
    );
    expect(portProblems('Firewall', port({ subnet: MASK })).address).toBe(
      'Inserisci un indirizzo IP oppure svuota la subnet mask'
    );
  });

  it('the port of a switch has no address to be wrong', () => {
    expect(portProblems('Switch', port({ ip: 'nonsense', subnet: 'x' }))).toEqual({});
  });

  it('a DHCP range that cannot work on the address as typed; one left empty is not a problem', () => {
    const lan = { ip: '192.168.10.1', subnet: MASK };
    expect(portProblems('Router', port({ ...lan, dhcpServer: { start: '192.168.10.100', end: '192.168.10.199' } }))).toEqual({});
    expect(portProblems('Router', port({ ...lan, dhcpServer: { start: '10.0.0.5', end: '10.0.0.9' } })).pool).toBe(
      '10.0.0.5 è fuori dalla rete della porta (192.168.10.0/24)'
    );
    expect(portProblems('Router', port({ dhcpServer: { start: '192.168.10.100', end: '192.168.10.199' } })).pool).toMatch(
      /la porta non ha un indirizzo/
    );
    expect(portProblems('Router', port({ ...lan, dhcpServer: { start: ' ', end: '' } }))).toEqual({});
    // no mask typed: the range is read against the mask the port will be kept with
    expect(
      portProblems('Router', port({ ip: '192.168.10.1', dhcpServer: { start: '192.168.10.100', end: '192.168.10.199' } }))
    ).toEqual({});
  });

  it('a VLAN kept on a switch port that is not a VLAN number', () => {
    expect(portProblems('Switch', port({ portType: 'access', vlan: 5000 })).vlan).toBe(
      '5000 non è una VLAN: il numero va da 1 a 4094'
    );
    expect(portProblems('Switch', port({ portType: 'access', vlan: 4094 }))).toEqual({});
  });
});

describe('a port as it is kept', () => {
  it('trims, gives an address its mask, and takes both away together', () => {
    expect(tidyPort('Router', port({ ip: ' 192.168.10.1 ', subnet: ' 255.255.0.0 ', name: ' LAN ' }))).toMatchObject({
      ip: '192.168.10.1',
      subnet: '255.255.0.0',
      name: 'LAN',
    });
    expect(tidyPort('Firewall', port({ ip: '10.0.0.1' }))).toMatchObject({ ip: '10.0.0.1', subnet: MASK });
    const cleared = tidyPort('Router', port({ ip: '', subnet: MASK, name: ' ', description: '' }));
    expect(cleared.ip).toBeUndefined();
    expect(cleared.subnet).toBeUndefined();
    expect(cleared.name).toBeUndefined();
    expect(cleared.description).toBeUndefined();
  });

  it('keeps a DHCP range trimmed, and does not keep one left empty', () => {
    const lan = { ip: '192.168.10.1', subnet: MASK };
    expect(tidyPort('Router', port({ ...lan, dhcpServer: { start: ' 192.168.10.100', end: '192.168.10.199 ', gateway: '' } })).dhcpServer).toEqual({
      start: '192.168.10.100',
      end: '192.168.10.199',
    });
    expect(tidyPort('Router', port({ ...lan, dhcpServer: { start: '', end: ' ' } })).dhcpServer).toBeUndefined();
  });

  it('does not write address fields on the port of a switch', () => {
    const kept = tidyPort('Switch', port({ portType: 'access', vlan: 10, name: 'PC' }));
    expect('ip' in kept).toBe(false);
    expect('subnet' in kept).toBe(false);
    expect(kept).toMatchObject({ vlan: 10, name: 'PC' });
  });

  it('is the same port when there is nothing to tidy', () => {
    const tidy = port({ ip: '192.168.10.1', subnet: MASK, name: 'LAN', nat: true });
    expect(tidyPort('Router', tidy)).toBe(tidy);
    const plain = port({ portType: 'access' });
    expect(tidyPort('Switch', plain)).toBe(plain);
  });
});

describe('what is wrong with a card as typed', () => {
  it('nothing, for a card as the app makes it', () => {
    expect(nicProblems(card())).toEqual({});
    expect(nicProblems(card({ dns: ' 192.168.1.53 ' }))).toEqual({});
  });

  it('a card with no name', () => {
    expect(nicProblems(card({ name: '  ' })).name).toBe('La scheda deve avere un nome, per esempio eth0');
  });

  it('a DNS server that is not an address', () => {
    expect(nicProblems(card({ dns: 'srv-auth' })).dns).toBe(
      '"srv-auth" non è un indirizzo IPv4 valido: il server DNS si indica con il suo indirizzo'
    );
  });

  it('a DHCP range outside the network of the card', () => {
    expect(nicProblems(card({ dhcpServer: { start: '192.168.9.50', end: '192.168.9.59' } })).pool).toBe(
      '192.168.9.50 è fuori dalla rete della scheda (192.168.1.0/24)'
    );
    expect(nicProblems(card({ dhcpServer: { start: '192.168.1.50', end: '192.168.1.59' } }))).toEqual({});
  });

  it('on DHCP nothing typed before is looked at: none of it is kept', () => {
    expect(
      nicProblems(card({ dhcp: true, dns: 'srv-auth', dhcpServer: { start: 'x', end: 'y' } }))
    ).toEqual({});
  });
});

describe('a card as it is kept', () => {
  it('trims what was typed', () => {
    expect(tidyNic(card({ ip: ' 192.168.1.20 ', dns: ' 192.168.1.53 ', mac: ' ', description: ' uplink ' }))).toMatchObject({
      ip: '192.168.1.20',
      subnet: MASK,
      gateway: '192.168.1.1',
      dns: '192.168.1.53',
      description: 'uplink',
    });
    expect(tidyNic(card({ mac: ' ' })).mac).toBeUndefined();
    expect(tidyNic(card()).dhcp).toBeUndefined();
  });

  it('on DHCP has no address, DNS server or DHCP range of its own', () => {
    const kept = tidyNic(
      card({ dhcp: true, dns: '192.168.1.53', dhcpServer: { start: '192.168.1.50', end: '192.168.1.59' } })
    );
    expect(kept).toMatchObject({ dhcp: true, ip: '', subnet: '', gateway: '', name: 'eth0' });
    expect(kept.dns).toBeUndefined();
    expect(kept.dhcpServer).toBeUndefined();
  });

  it('keeps a DHCP range trimmed, and does not keep one left empty', () => {
    expect(tidyNic(card({ dhcpServer: { start: ' 192.168.1.100', end: '192.168.1.110 ' } })).dhcpServer).toEqual({
      start: '192.168.1.100',
      end: '192.168.1.110',
    });
    expect(tidyNic(card({ dhcpServer: { start: '', end: '' } })).dhcpServer).toBeUndefined();
  });

  it('is the same card when there is nothing to tidy', () => {
    const tidy = card({ mac: '02:00:00:00:00:01' });
    expect(tidyNic(tidy)).toBe(tidy);
  });
});

describe('the first thing wrong among the ports and the cards of a device', () => {
  it('is nothing when all is fine', () => {
    expect(firstInterfaceProblem('Router', [port({ ip: '192.168.10.1' })], [])).toBeUndefined();
    expect(firstInterfaceProblem('PC', [], [card()])).toBeUndefined();
  });

  it('names the port, or the card', () => {
    expect(firstInterfaceProblem('Router', [port({ id: 1 }), port({ id: 2, ip: 'abc' })], [])).toBe(
      'Porta 2: "abc" non è un indirizzo IPv4 valido'
    );
    expect(firstInterfaceProblem('Server', [], [card({ dns: 'srv' })])).toBe(
      'Scheda eth0: "srv" non è un indirizzo IPv4 valido: il server DNS si indica con il suo indirizzo'
    );
    expect(firstInterfaceProblem('Server', [], [card({ name: '' })])).toBe(
      'Scheda nic-1: La scheda deve avere un nome, per esempio eth0'
    );
  });

  it('two cards may not have one name', () => {
    expect(firstInterfaceProblem('Server', [], [card(), card({ id: 'nic-2', name: ' ETH0 ' })])).toBe(
      'Due schede si chiamano ETH0: ogni scheda ha un nome suo'
    );
    expect(firstInterfaceProblem('Server', [], [card(), card({ id: 'nic-2', name: 'eth1' })])).toBeUndefined();
  });
});

describe('the VLAN field of a switch port', () => {
  it('reads one number on an access port', () => {
    expect(readVlanText('access', '10')).toEqual({ vlan: 10 });
    expect(readVlanText('access', ' 4094 ')).toEqual({ vlan: 4094 });
    expect(readVlanText('access', '')).toEqual({ vlan: undefined });
  });

  it('reads a list on a trunk, however it is separated, and while it is being typed', () => {
    expect(readVlanText('trunk', '10, 20,30')).toEqual({ vlan: [10, 20, 30] });
    expect(readVlanText('trunk', '10 20;30')).toEqual({ vlan: [10, 20, 30] });
    expect(readVlanText('trunk', '10,')).toEqual({ vlan: [10] });
    expect(readVlanText('trunk', '10, 10')).toEqual({ vlan: [10] });
    expect(readVlanText('trunk', '  ')).toEqual({ vlan: undefined });
  });

  it('says what is not a VLAN', () => {
    expect(readVlanText('access', '5000').error).toBe('5000 non è una VLAN: il numero va da 1 a 4094');
    expect(readVlanText('access', '0').error).toBe('0 non è una VLAN: il numero va da 1 a 4094');
    expect(readVlanText('trunk', '10, venti').error).toBe('venti non è una VLAN: il numero va da 1 a 4094');
    expect(readVlanText('trunk', '10, 2.5').error).toBe('2.5 non è una VLAN: il numero va da 1 a 4094');
    expect(readVlanText('access', '10, 20').error).toBe(
      'Una porta di accesso sta in una sola VLAN: per più VLAN serve un trunk'
    );
  });

  it('shows the VLAN a port has', () => {
    expect(vlanText(undefined)).toBe('');
    expect(vlanText(10)).toBe('10');
    expect(vlanText([10, 20, 30])).toBe('10, 20, 30');
  });
});
