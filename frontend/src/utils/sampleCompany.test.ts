/**
 * The sample network the welcome screen loads (a small company: offices,
 * Wi-Fi, servers, a DMZ, a firewall): its structure, and the questions it is
 * there to answer. If one of these answers changes, either the engine or the
 * sample is wrong.
 */

import { describe, it, expect } from 'vitest';
import { createCompanySample } from './sampleCompany';
import { drawnSize } from './sampleNetwork';
import { isValidIP, isValidMAC } from './ipHelpers';
import {
  assessImpact,
  boundInterface,
  formatNetwork,
  forwardingRole,
  isVlanAware,
  normalizeBindings,
  planAndEvaluateFlow,
  portVlanMode,
  routingTable,
  sanitizeBindings,
  withFailures,
} from '@/engine';
import { describeForward, forwardProblem, isPrivateAddress } from '@/engine';
import { normalizeAddressing, resolveDhcp, withLeases } from '@/engine';
import { dnsCardOf, dnsRecordsOf, isHostName, lookup } from '@/engine';
import type { Failures, FlowResult } from '@/engine';
import type { FlowModelType, NetworkDevice } from '@/types';

const sample = createCompanySample();

function device(label: string): NetworkDevice {
  const found = sample.devices.find(d => d.label === label);
  if (!found) throw new Error(`sample has no device "${label}"`);
  return found;
}

const labelOf = (id: string) => sample.devices.find(d => d.id === id)?.label ?? id;

/** Failures by device label and by cable id */
const broken = (devices: string[] = [], connections: string[] = []): Failures => ({
  devices: devices.map(label => device(label).id),
  connections,
});

function ask(model: FlowModelType, from: string, to: string, failures?: Failures): FlowResult {
  return planAndEvaluateFlow(model, device(from).id, device(to).id, withFailures(sample, failures));
}

/** "Router-Core (routed: …)" for every hop of a leg (the first, unless told) */
const path = (result: FlowResult, leg = 0): string[] =>
  result.legs[leg].trace.hops.map(h => (h.note ? `${h.label} (${h.note})` : h.label));

/** The devices of a leg, by label */
const way = (result: FlowResult, leg = 0) => result.legs[leg].trace.hops.map(h => h.label).join(' > ');

const table = (label: string) =>
  routingTable(device(label)).map(e => [formatNetwork(e.network), e.kind, e.nextHop ?? '-', e.out?.iface?.label]);

/** The public addresses a device has on its ports and cards */
const ownedPublic = (d: NetworkDevice): string[] =>
  [...(d.ports ?? []).map(p => p.ip ?? ''), ...(d.nics ?? []).map(n => n.ip)].filter(
    ip => ip !== '' && !isPrivateAddress(ip)
  );

const OFFICES = ['PC-Contabilità', 'PC-Vendite', 'Stampante'];
const WIFI = ['Portatile-1', 'Portatile-2'];
const SERVERS = ['Srv-Auth', 'DB-Gestionale', 'Web-Gestionale', 'Mail', 'NAS'];

describe('createCompanySample — structure', () => {
  it('is deterministic and its ids are unique', () => {
    expect(createCompanySample()).toEqual(createCompanySample());
    expect(new Set(sample.devices.map(d => d.id)).size).toBe(sample.devices.length);
    expect(new Set(sample.connections.map(c => c.id)).size).toBe(sample.connections.length);
    expect(new Set(sample.devices.map(d => d.label)).size).toBe(sample.devices.length);
  });

  it('is a company of twenty devices: every kind a small one has', () => {
    expect(sample.devices).toHaveLength(20);
    expect(sample.connections).toHaveLength(20);

    const count = (templateId: string) => sample.devices.filter(d => d.templateId === templateId).length;
    expect({
      cloud: count('tpl-cloud'),
      firewall: count('tpl-firewall'),
      router: count('tpl-router'),
      switches: count('tpl-switch'),
      accessPoints: count('tpl-accesspoint'),
      pcs: count('tpl-pc'),
      laptops: count('tpl-laptop'),
      printers: count('tpl-printer'),
      servers: count('tpl-server'),
      webServers: count('tpl-webserver'),
      mailServers: count('tpl-mailserver'),
      databases: count('tpl-database'),
      nas: count('tpl-nas'),
    }).toEqual({
      cloud: 1,
      firewall: 1,
      router: 1,
      switches: 4,
      accessPoints: 1,
      pcs: 3,
      // (the two that come and go on the Wi-Fi)
      laptops: 2,
      printers: 1,
      servers: 1,
      webServers: 2,
      mailServers: 1,
      databases: 1,
      nas: 1,
    });
  });

  it('has every link attached to an interface at both ends, with nothing to repair', () => {
    for (const connection of sample.connections) {
      const source = sample.devices.find(d => d.id === connection.source);
      const target = sample.devices.find(d => d.id === connection.target);
      expect(source && boundInterface(connection, source, 'source'), connection.id).toBeDefined();
      expect(target && boundInterface(connection, target, 'target'), connection.id).toBeDefined();
    }
    expect(sanitizeBindings(sample.devices, sample.connections)).toBe(sample.connections);
    expect(normalizeBindings(sample.devices, sample.connections)).toBe(sample.connections);
  });

  it('no interface carries two cables', () => {
    const used = sample.connections.flatMap(c => [
      `${c.source}/${c.sourcePort ?? c.sourceNic}`,
      `${c.target}/${c.targetPort ?? c.targetNic}`,
    ]);
    expect(new Set(used).size).toBe(used.length);
  });

  it('carries only valid addresses and MACs, and no address twice', () => {
    const addresses: string[] = [];
    for (const d of sample.devices) {
      for (const ip of [d.ip, d.gateway, ...(d.ports ?? []).map(p => p.ip ?? '')]) {
        if (ip) expect(isValidIP(ip), `${d.label} ${ip}`).toBe(true);
      }
      for (const nic of d.nics ?? []) {
        if (nic.ip) expect(isValidIP(nic.ip), `${d.label} ${nic.name}`).toBe(true);
        expect(nic.mac !== undefined && isValidMAC(nic.mac), `${d.label} ${nic.name}`).toBe(true);
      }
      // The addresses a device answers to: those of its ports or cards, or its own
      const own = [...(d.ports ?? []).map(p => p.ip ?? ''), ...(d.nics ?? []).map(n => n.ip)].filter(Boolean);
      addresses.push(...(own.length > 0 ? own : [d.ip].filter(Boolean)));
    }
    expect(new Set(addresses).size).toBe(addresses.length);

    const macs = sample.devices.flatMap(d => (d.nics ?? []).map(n => n.mac));
    expect(new Set(macs).size).toBe(macs.length);
  });

  it('a device with network cards shows the address of its first card', () => {
    for (const d of sample.devices) {
      const first = d.nics?.[0];
      if (!first) continue;
      expect([d.ip, d.gateway], d.label).toEqual([first.ip, first.gateway]);
    }
  });

  it('uses the features it is there to show: VLANs on ports, a trunk, zones, rules', () => {
    // Offices and Wi-Fi share a switch and are kept apart by the VLAN of each port
    expect(isVlanAware(device('SW-Uffici'))).toBe(true);
    expect(isVlanAware(device('SW-Core'))).toBe(true);
    expect(isVlanAware(device('SW-Server'))).toBe(true);
    expect(isVlanAware(device('SW-DMZ'))).toBe(false);

    const mode = (label: string, port: number) =>
      portVlanMode(device(label).ports?.find(p => p.id === port));
    expect(mode('SW-Uffici', 1)).toEqual({ kind: 'access', vlan: 10, explicit: true });
    expect(mode('SW-Uffici', 4)).toEqual({ kind: 'access', vlan: 20, explicit: true });
    // One cable carries both VLANs between the two switches
    expect(mode('SW-Uffici', 8)).toEqual({ kind: 'trunk', vlans: [10, 20] });
    expect(mode('SW-Core', 1)).toEqual({ kind: 'trunk', vlans: [10, 20] });
    expect(mode('SW-Server', 8)).toEqual({ kind: 'access', vlan: 30, explicit: true });

    expect(device('FW-Edge').ports?.map(p => p.securityZone)).toEqual(['trust', 'dmz', 'untrust', undefined]);
    expect(device('FW-Edge').firewallRules?.map(r => `${r.action} ${r.service} ${r.source} > ${r.destination}`)).toEqual([
      'allow web untrust > 172.16.0.10',
      'allow email untrust > 192.168.30.40',
      'allow web 172.16.0.10 > 192.168.30.20',
    ]);
  });

  it('does NAT on the port that faces the Internet, and publishes there what is reached from outside', () => {
    const firewall = device('FW-Edge');
    expect(firewall.ports?.map(p => p.nat === true)).toEqual([false, false, true, false]);
    expect(firewall.portForwards?.map(describeForward)).toEqual([
      'forward web from interface 3 to 172.16.0.10',
      'forward email from interface 3 to 192.168.30.40',
    ]);
    for (const forward of firewall.portForwards ?? []) {
      expect(forwardProblem(firewall, forward), forward.id).toBeUndefined();
    }
    // a forward says where the traffic goes: for each there is the rule that says it may
    const allowed = firewall.firewallRules?.filter(r => r.source === 'untrust').map(r => `${r.service} ${r.destination}`);
    expect(firewall.portForwards?.map(f => `${f.service} ${f.to}`)).toEqual(allowed);
    // the address everything is published at is the only public one inside the company
    expect(sample.devices.flatMap(d => (d.id === 'cliente-remoto' ? [] : ownedPublic(d)))).toEqual(['203.0.113.1']);
  });

  it('the rules of the firewall name devices that are there', () => {
    expect(device('Portale-Clienti').ip).toBe('172.16.0.10');
    expect(device('Mail').ip).toBe('192.168.30.40');
    expect(device('DB-Gestionale').ip).toBe('192.168.30.20');
  });

  it('the access point is a bridge with a radio card for each device on the Wi-Fi', () => {
    const accessPoint = device('AP-Uffici');
    expect(forwardingRole(accessPoint)).toBe('bridge');
    expect(accessPoint.nics?.map(n => n.name)).toEqual(['eth0', 'wlan0', 'wlan1']);
    const onRadio = sample.connections.filter(
      c => c.target === accessPoint.id && c.targetNic !== 'nic-1'
    );
    expect(onRadio.map(c => labelOf(c.source)).sort()).toEqual(WIFI);
    expect(onRadio.every(c => c.label === 'Wi-Fi')).toBe(true);
  });

  it('gives the two routing devices the tables a person would expect', () => {
    expect(table('Router-Core')).toEqual([
      ['10.0.0.0/30', 'connected', '-', 'port 4'],
      ['192.168.10.0/24', 'connected', '-', 'port 1'],
      ['192.168.20.0/24', 'connected', '-', 'port 2'],
      ['192.168.30.0/24', 'connected', '-', 'port 3'],
      ['default', 'default', '10.0.0.2', 'port 4'],
    ]);
    expect(table('FW-Edge')).toEqual([
      ['10.0.0.0/30', 'connected', '-', 'port 1'],
      ['172.16.0.0/24', 'connected', '-', 'port 2'],
      ['203.0.113.0/24', 'connected', '-', 'port 3'],
      ['192.168.0.0/16', 'static', '10.0.0.1', 'port 1'],
    ]);
  });

  it('is laid out with no device over another', () => {
    // A device is the frame it is drawn in, a name longer than it sticking out
    // a little: two frames keep at least 24 between them, side by side or one
    // above the other
    const GAP = 24;
    for (const a of sample.devices) {
      for (const b of sample.devices) {
        if (a.id >= b.id) continue;
        const [left, right] = a.position.x <= b.position.x ? [a, b] : [b, a];
        const [upper, lower] = a.position.y <= b.position.y ? [a, b] : [b, a];
        const apart =
          right.position.x - (left.position.x + drawnSize(left).width) >= GAP ||
          lower.position.y - (upper.position.y + drawnSize(upper).height) >= GAP;
        expect(apart, `${a.label} and ${b.label}`).toBe(true);
      }
    }
  });
});

describe('createCompanySample — the questions it answers', () => {
  it('two PCs of the offices talk through their switch, and so does the printer', () => {
    const result = ask('ping', 'PC-Contabilità', 'PC-Vendite');
    expect(result.verdict).toBe('success');
    expect(path(result)).toEqual(['PC-Contabilità', 'SW-Uffici (VLAN 10)', 'PC-Vendite']);
    expect(result.notes).toEqual([]);

    expect(path(ask('ping', 'PC-Vendite', 'Stampante'))).toEqual([
      'PC-Vendite',
      'SW-Uffici (VLAN 10)',
      'Stampante',
    ]);
  });

  it('two laptops on the Wi-Fi talk through the access point alone', () => {
    const result = ask('ping', 'Portatile-1', 'Portatile-2');
    expect(result.verdict).toBe('success');
    expect(path(result)).toEqual(['Portatile-1', 'AP-Uffici', 'Portatile-2']);
  });

  it('a PC opens the management software: trunk, router, the VLAN of the servers', () => {
    const result = ask('web', 'PC-Contabilità', 'Web-Gestionale');
    expect(result.verdict).toBe('success');
    expect(path(result)).toEqual([
      'PC-Contabilità',
      'SW-Uffici (VLAN 10)',
      'SW-Core (VLAN 10)',
      'Router-Core (routed: 192.168.30.0/24 is on port 3)',
      'SW-Server (VLAN 30)',
      'Web-Gestionale',
    ]);
    expect(path(result, 1)).toEqual([
      'Web-Gestionale',
      'SW-Server (VLAN 30)',
      'Router-Core (routed: 192.168.10.0/24 is on port 1)',
      'SW-Core (VLAN 10)',
      'SW-Uffici (VLAN 10)',
      'PC-Contabilità',
    ]);
    expect(result.notes).toEqual([]);
  });

  it('a laptop on the Wi-Fi does the same in its own VLAN, on the same trunk', () => {
    const result = ask('web', 'Portatile-1', 'Web-Gestionale');
    expect(result.verdict).toBe('success');
    expect(path(result)).toEqual([
      'Portatile-1',
      'AP-Uffici',
      'SW-Uffici (VLAN 20)',
      'SW-Core (VLAN 20)',
      'Router-Core (routed: 192.168.30.0/24 is on port 3)',
      'SW-Server (VLAN 30)',
      'Web-Gestionale',
    ]);
  });

  it('the Wi-Fi and the offices are two networks on one switch: between them is the router', () => {
    const result = ask('ping', 'Portatile-1', 'PC-Vendite');
    expect(result.verdict).toBe('success');
    expect(path(result)).toEqual([
      'Portatile-1',
      'AP-Uffici',
      'SW-Uffici (VLAN 20)',
      'SW-Core (VLAN 20)',
      'Router-Core (routed: 192.168.10.0/24 is on port 1)',
      'SW-Core (VLAN 10)',
      'SW-Uffici (VLAN 10)',
      'PC-Vendite',
    ]);
  });

  it('every device inside reaches every server', () => {
    for (const from of [...OFFICES, ...WIFI]) {
      for (const to of SERVERS) {
        expect(ask('ping', from, to).verdict, `${from} > ${to}`).toBe('success');
      }
    }
  });

  it('a mail between two PCs goes to the mail server and from there to the other PC', () => {
    const result = ask('email', 'PC-Contabilità', 'PC-Vendite');
    expect(result.verdict).toBe('success');
    expect(result.legs.map(leg => leg.purpose)).toEqual(['SMTP submit', 'delivery']);
    expect(way(result, 0)).toBe('PC-Contabilità > SW-Uffici > SW-Core > Router-Core > SW-Server > Mail');
    expect(way(result, 1)).toBe('Mail > SW-Server > Router-Core > SW-Core > SW-Uffici > PC-Vendite');
  });

  it('the inside browses the portal in the DMZ: the zone policy lets it, the answer comes back', () => {
    const result = ask('web', 'PC-Vendite', 'Portale-Clienti');
    expect(result.verdict).toBe('success');
    expect(path(result)).toEqual([
      'PC-Vendite',
      'SW-Uffici (VLAN 10)',
      'SW-Core (VLAN 10)',
      'Router-Core (routed: default route via 10.0.0.2 (port 4))',
      'FW-Edge (routed: 172.16.0.0/24 is on port 2; firewall FW-Edge: no rule matches, zone policy trust → dmz allowed)',
      'SW-DMZ',
      'Portale-Clienti',
    ]);
    expect(result.notes).toEqual([
      'HTTP request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed',
      'HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)',
    ]);
  });

  it('the inside reaches the outside with the public address of the firewall, and the reply finds the PC', () => {
    const result = ask('ping', 'PC-Vendite', 'Cliente-Remoto');
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe(
      'PC-Vendite > SW-Uffici > SW-Core > Router-Core > FW-Edge > Internet > Cliente-Remoto'
    );
    expect(path(result)[4]).toBe(
      'FW-Edge (routed: 203.0.113.0/24 is on port 3; ' +
        'firewall FW-Edge: no rule matches, zone policy trust → untrust allowed; ' +
        'NAT: source 192.168.10.12 → 203.0.113.1)'
    );
    expect(result.legs[0].trace.seenSourceIp).toBe('203.0.113.1');
    expect(result.notes).toContain('request: Internet is not simulated: traffic assumed to pass');

    // the customer answers the firewall, which knows whom the answer is for
    expect(result.legs[1].trace.targetIp).toBe('203.0.113.1');
    expect(path(result, 1)[2]).toBe(
      'FW-Edge (NAT: destination 203.0.113.1 → 192.168.10.12 (reply to a translated flow); ' +
        'routed: 192.168.0.0/16 via 10.0.0.1 (port 1); ' +
        'firewall FW-Edge: no rule matches, zone policy untrust → trust allowed (reply to an allowed flow))'
    );
    expect(way(result, 1)).toBe(
      'Cliente-Remoto > Internet > FW-Edge > Router-Core > SW-Core > SW-Uffici > PC-Vendite'
    );
  });

  it('every device inside goes out the same way: the customer only ever sees one address', () => {
    for (const from of [...OFFICES, ...WIFI, ...SERVERS, 'Portale-Clienti']) {
      const result = ask('ping', from, 'Cliente-Remoto');
      expect(result.verdict, from).toBe('success');
      expect(result.legs[0].trace.seenSourceIp, from).toBe('203.0.113.1');
    }
  });

  it('a customer outside opens the portal at the public address: the first forward, the first rule', () => {
    const result = ask('web', 'Cliente-Remoto', 'Portale-Clienti');
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('Cliente-Remoto > Internet > FW-Edge > SW-DMZ > Portale-Clienti');
    expect(result.legs[0].trace.targetIp).toBe('203.0.113.1');
    expect(result.legs[0].trace.reachedIp).toBe('172.16.0.10');
    expect(path(result)[2]).toBe(
      'FW-Edge (NAT: destination 203.0.113.1 → 172.16.0.10 (port forward 1); ' +
        'routed: 172.16.0.0/24 is on port 2; ' +
        'firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10))'
    );
    expect(result.notes).toEqual([
      'HTTP request: Portale-Clienti is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)',
      'HTTP request: Internet is not simulated: traffic assumed to pass',
      'HTTP request: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)',
      'HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → untrust allowed',
      'HTTP response: Internet is not simulated: traffic assumed to pass',
    ]);
    // the page comes back from the address the customer asked
    expect(result.legs[1].trace.seenSourceIp).toBe('203.0.113.1');
  });

  it('the customer cannot ping the portal: only web is published', () => {
    const result = ask('ping', 'Cliente-Remoto', 'Portale-Clienti');
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'request: Internet does not carry private addresses: 172.16.0.10 is not reachable from ' +
        'outside: no port forward publishes it for ping'
    );
    expect(path(result)).toEqual([
      'Cliente-Remoto',
      'Internet (Internet does not carry private addresses: 172.16.0.10 is not reachable from ' +
        'outside: no port forward publishes it for ping)',
    ]);
  });

  it('the customer reaches nothing inside: not the database, not the management software', () => {
    for (const to of ['DB-Gestionale', 'Web-Gestionale', 'Srv-Auth', 'NAS', 'PC-Vendite', 'Portatile-1']) {
      for (const model of ['ping', 'web'] as const) {
        const result = ask(model, 'Cliente-Remoto', to);
        expect(result.verdict, `${model} > ${to}`).toBe('blocked');
        expect(result.failureReason, `${model} > ${to}`).toContain(
          `is not reachable from outside: no port forward publishes it for ${model}`
        );
        // it does not get as far as the firewall
        expect(way(result), `${model} > ${to}`).toBe('Cliente-Remoto > Internet');
      }
    }
  });

  it('the firewall itself answers the customer at its public address', () => {
    const result = ask('ping', 'Cliente-Remoto', 'FW-Edge');
    expect(result.verdict).toBe('success');
    expect(result.legs[0].trace.targetIp).toBe('203.0.113.1');
    expect(result.notes[0]).toBe(
      'request: FW-Edge is reached from outside at 203.0.113.1, its public address'
    );
  });

  it('mail from outside comes in to the mail server, by the second forward and rule, and goes on to the PC', () => {
    const result = ask('email', 'Cliente-Remoto', 'PC-Contabilità');
    expect(result.verdict).toBe('success');
    expect(result.legs[0].trace.targetIp).toBe('203.0.113.1');
    expect(result.notes).toContain(
      'SMTP submit: Mail is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 2)'
    );
    expect(way(result, 0)).toBe('Cliente-Remoto > Internet > FW-Edge > Router-Core > SW-Server > Mail');
    expect(way(result, 1)).toBe('Mail > SW-Server > Router-Core > SW-Core > SW-Uffici > PC-Contabilità');
    expect(result.notes).toContain(
      'SMTP submit: firewall FW-Edge: allowed by rule 2 (allow email from untrust to 192.168.30.40)'
    );
  });

  it('the portal reads its database: the third rule, for that server alone', () => {
    const result = ask('web', 'Portale-Clienti', 'DB-Gestionale');
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('Portale-Clienti > SW-DMZ > FW-Edge > Router-Core > SW-Server > DB-Gestionale');
    expect(result.notes).toContain(
      'HTTP request: firewall FW-Edge: allowed by rule 3 (allow web from 172.16.0.10 to 192.168.30.20)'
    );
  });

  it('and nothing else inside: were the portal broken into, the way stops at the firewall', () => {
    for (const [model, to] of [
      ['ping', 'DB-Gestionale'],
      ['ping', 'Srv-Auth'],
      ['web', 'Web-Gestionale'],
      ['web', 'NAS'],
      ['ping', 'PC-Contabilità'],
    ] as const) {
      const result = ask(model, 'Portale-Clienti', to);
      expect(result.verdict, `${model} > ${to}`).toBe('blocked');
      expect(result.failureReason, `${model} > ${to}`).toContain('zone policy dmz → trust denied');
    }
  });

  it('the switches are managed on a network of their own, which nothing routes', () => {
    const result = ask('ping', 'PC-Contabilità', 'SW-Uffici');
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('request: FW-Edge has no route to 10.99.0.3');
    // The router, the firewall and the access point are reachable from the offices
    for (const to of ['Router-Core', 'FW-Edge', 'AP-Uffici']) {
      expect(ask('ping', 'PC-Contabilità', to).verdict, to).toBe('success');
    }
  });

  it('with everything working, 111 of the 132 pings between end devices arrive: the firewall stops the rest', () => {
    const report = assessImpact(sample, broken(), { flow: 'ping' });
    expect(report.broken).toEqual([]);
    expect(report.rerouted).toEqual([]);
    // 12 end devices; the customer reaches none of the other 11, the portal none of the 10 inside
    expect(report.unchanged).toBe(12 * 11 - 11 - 10);
  });
});

describe('createCompanySample — what happens if this breaks', () => {
  it('the trunk: offices and Wi-Fi are cut off from the rest, and still work among themselves', () => {
    const failures = broken([], ['link-trunk-uffici']);

    const toServer = ask('ping', 'PC-Vendite', 'NAS', failures);
    expect(toServer.verdict).toBe('blocked');
    expect(toServer.failureReason).toBe('request: link SW-Uffici–SW-Core is down');
    expect(ask('ping', 'Portatile-1', 'PC-Vendite', failures).verdict).toBe('blocked');

    expect(ask('ping', 'PC-Vendite', 'Stampante', failures).verdict).toBe('success');
    expect(ask('ping', 'Portatile-1', 'Portatile-2', failures).verdict).toBe('success');

    const report = assessImpact(sample, failures, { flow: 'ping' });
    expect(report.rerouted).toEqual([]);
    expect(report.broken).toHaveLength(72);
    expect(report.unchanged).toBe(39);
  });

  it('the cable of the router in the Wi-Fi VLAN: only the Wi-Fi loses the rest', () => {
    const failures = broken([], ['link-vlan-20']);

    const result = ask('ping', 'Portatile-1', 'Web-Gestionale', failures);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('request: link SW-Core–Router-Core is down');
    expect(ask('ping', 'Portatile-1', 'Portatile-2', failures).verdict).toBe('success');
    expect(ask('ping', 'PC-Vendite', 'NAS', failures).verdict).toBe('success');

    const report = assessImpact(sample, failures, { flow: 'ping' });
    expect(new Set(report.broken.flatMap(f => [labelOf(f.sourceId), labelOf(f.targetId)]))).toContain('Portatile-1');
    expect(report.broken.every(f => WIFI.includes(labelOf(f.sourceId)) || WIFI.includes(labelOf(f.targetId)))).toBe(true);
    expect(report.broken).toHaveLength(36);
  });

  it('the switch of the servers: no server is reachable, the offices still reach the portal and the outside', () => {
    const failures = broken(['SW-Server']);
    for (const to of SERVERS) {
      expect(ask('ping', 'PC-Contabilità', to, failures).verdict, to).toBe('blocked');
    }
    expect(ask('web', 'PC-Contabilità', 'Portale-Clienti', failures).verdict).toBe('success');
    expect(ask('ping', 'PC-Contabilità', 'Cliente-Remoto', failures).verdict).toBe('success');

    const report = assessImpact(sample, failures, { flow: 'ping' });
    expect(report.broken).toHaveLength(80);
    expect(report.unchanged).toBe(31);
  });

  it('the access point: the Wi-Fi is gone, nobody else notices', () => {
    const report = assessImpact(sample, broken(['AP-Uffici']), { flow: 'ping' });
    expect(report.broken.every(f => WIFI.includes(labelOf(f.sourceId)) || WIFI.includes(labelOf(f.targetId)))).toBe(true);
    expect(report.broken).toHaveLength(38);
    expect(report.unchanged).toBe(73);
  });

  it('the mail server: a mail between two PCs stops there', () => {
    const result = ask('email', 'PC-Contabilità', 'PC-Vendite', broken(['Mail']));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('SMTP submit: Mail is down');
  });

  it('the firewall: the inside goes on working, the portal and the outside are gone', () => {
    const failures = broken(['FW-Edge']);
    expect(ask('web', 'PC-Vendite', 'Web-Gestionale', failures).verdict).toBe('success');
    expect(ask('web', 'PC-Vendite', 'Portale-Clienti', failures).verdict).toBe('blocked');
    expect(ask('web', 'Cliente-Remoto', 'Portale-Clienti', failures).verdict).toBe('blocked');

    const report = assessImpact(sample, failures, { flow: 'ping' });
    expect(report.broken).toHaveLength(21);
    expect(report.unchanged).toBe(90);
  });
});

describe('createCompanySample — DHCP', () => {
  const dhcp = resolveDhcp(sample);
  const pools = dhcp.pools.map(pool => [pool.name, pool.pool.start, pool.pool.end, pool.gateway, pool.leases.length, pool.free]);

  it('the router hands out the offices and the Wi-Fi, a hundred addresses each, with itself as gateway', () => {
    expect(pools).toEqual([
      ['Router-Core port 1', '192.168.10.100', '192.168.10.199', '192.168.10.1', 0, 100],
      ['Router-Core port 2', '192.168.20.100', '192.168.20.199', '192.168.20.1', 2, 98],
    ]);
    expect(dhcp.pools.every(pool => pool.problem === undefined)).toBe(true);
    expect(dhcp.warnings).toEqual([]);
  });

  it('the two laptops take their address from it, in the order they are drawn; nobody else does', () => {
    expect(dhcp.leases.map(lease => [labelOf(lease.deviceId), lease.ip, lease.mask, lease.gateway])).toEqual([
      ['Portatile-1', '192.168.20.100', '255.255.255.0', '192.168.20.1'],
      ['Portatile-2', '192.168.20.101', '255.255.255.0', '192.168.20.1'],
    ]);
    expect(dhcp.unserved).toEqual([]);
    const onDhcp = sample.devices.filter(d => (d.nics ?? []).some(n => n.dhcp)).map(d => d.label);
    expect(onDhcp).toEqual(WIFI);
  });

  it('a laptop is kept with no address of its own: nothing to mistake for the one it is leased', () => {
    for (const label of WIFI) {
      expect(device(label)).toMatchObject({ ip: '', gateway: '', nics: [{ dhcp: true, ip: '', subnet: '', gateway: '' }] });
    }
    // loading it changes nothing of it (see normalizeAddressing)
    for (const d of sample.devices) expect(normalizeAddressing(d), d.label).toBe(d);
  });

  it('no address written by hand sits inside a range', () => {
    const inRange = (ip: string) => {
      const last = Number(ip.split('.')[3]);
      return /^192\.168\.(10|20)\./.test(ip) && last >= 100 && last <= 199;
    };
    const written = sample.devices.flatMap(d => [
      d.ip,
      ...(d.ports ?? []).map(p => p.ip ?? ''),
      ...(d.nics ?? []).map(n => n.ip),
    ]);
    expect(written.filter(inRange)).toEqual([]);
  });

  it('a third laptop on the Wi-Fi would be given the next address, an office PC one of the offices', () => {
    const more = createCompanySample();
    const card = { id: 'nic-1', name: 'eth0', enabled: true, speed: 'auto' as const, ip: '', subnet: '', gateway: '', dhcp: true };
    const guest = { ...more.devices.find(d => d.label === 'Portatile-2')!, id: 'portatile-3', label: 'Portatile-3', nics: [card] };
    const desk = { ...more.devices.find(d => d.label === 'PC-Vendite')!, id: 'pc-nuovo', label: 'PC-Nuovo', ip: '', gateway: '', nics: [card] };
    more.devices.push(guest, desk);
    // the access point has no free radio card: the cable is not attached to one there
    more.connections.push(
      { id: 'link-portatile-3', source: 'portatile-3', target: 'ap-uffici', sourceNic: 'nic-1' },
      { id: 'link-pc-nuovo', source: 'pc-nuovo', target: 'sw-uffici', sourceNic: 'nic-1', targetPort: 5 }
    );
    more.devices.find(d => d.label === 'SW-Uffici')!.ports![4].vlan = 10;
    const leases = resolveDhcp(more).leases.map(lease => [
      more.devices.find(d => d.id === lease.deviceId)?.label,
      lease.ip,
    ]);
    expect(leases).toEqual([
      ['Portatile-1', '192.168.20.100'],
      ['Portatile-2', '192.168.20.101'],
      ['Portatile-3', '192.168.20.102'],
      ['PC-Nuovo', '192.168.10.100'],
    ]);
  });

  it('with the router down the laptops keep their address, and talk to each other and to nobody else', () => {
    const failures = broken(['Router-Core']);
    expect(ask('ping', 'Portatile-1', 'Portatile-2', failures)).toMatchObject({ verdict: 'success' });
    expect(ask('ping', 'Portatile-1', 'Portatile-2', failures).legs[0].trace).toMatchObject({
      sourceIp: '192.168.20.100',
      targetIp: '192.168.20.101',
    });
    expect(ask('web', 'Portatile-1', 'Web-Gestionale', failures).verdict).toBe('blocked');
  });
});

describe('createCompanySample — DNS', () => {
  const leased = withLeases(sample);
  const find = (from: string, name: string, failures?: Failures) =>
    lookup(withFailures(sample, failures), device(from).id, name);
  const NAMES = [
    ['gestionale.azienda.example', 'Web-Gestionale', '192.168.30.30'],
    ['posta.azienda.example', 'Mail', '192.168.30.40'],
    ['portale.azienda.example', 'Portale-Clienti', '172.16.0.10'],
  ];

  it('Srv-Auth keeps the names of the inside, each the address of the device it is for', () => {
    expect(dnsRecordsOf(device('Srv-Auth')).map(record => [record.name, record.address])).toEqual(
      NAMES.map(([name, , address]) => [name, address])
    );
    // (every record is one the engine reads: none is left out)
    expect(device('Srv-Auth').dnsRecords).toHaveLength(NAMES.length);
    for (const [name, label, address] of NAMES) {
      expect(isHostName(name), name).toBe(true);
      expect(device(label).nics?.[0].ip, name).toBe(address);
    }
    const keepers = sample.devices.filter(d => d.dnsRecords !== undefined).map(d => d.label);
    expect(keepers).toEqual(['Srv-Auth']);
  });

  it('the offices name it on their cards, the laptops are handed it with their lease, nobody else asks', () => {
    for (const label of OFFICES) expect(device(label).nics?.[0].dns, label).toBe('192.168.30.10');
    // no other card carries the field, not even empty
    const named = sample.devices.filter(d => (d.nics ?? []).some(card => 'dns' in card)).map(d => d.label);
    expect(named).toEqual(OFFICES);
    // a laptop keeps none of its own
    for (const label of WIFI) expect(device(label).nics?.[0], label).not.toHaveProperty('dns');
    expect(resolveDhcp(sample).pools.map(pool => pool.pool.dns)).toEqual(['192.168.30.10', '192.168.30.10']);
    expect(resolveDhcp(sample).leases.map(lease => lease.dns)).toEqual(['192.168.30.10', '192.168.30.10']);

    const asking = leased.devices.filter(d => dnsCardOf(d) !== undefined);
    expect(asking.map(d => d.label)).toEqual([...OFFICES, ...WIFI]);
    expect(asking.map(d => dnsCardOf(d)?.dns)).toEqual(Array(5).fill('192.168.30.10'));
    expect(device('Srv-Auth').nics?.[0].ip).toBe('192.168.30.10');
  });

  it('a PC of the offices looks a name up: through the trunk and the router, to the server and back', () => {
    const result = find('PC-Vendite', 'gestionale.azienda.example');
    expect(result).toMatchObject({ address: '192.168.30.30', serverIp: '192.168.30.10' });
    expect(result.server?.label).toBe('Srv-Auth');
    expect(result.trip && way(result.trip, 0)).toBe(
      'PC-Vendite > SW-Uffici > SW-Core > Router-Core > SW-Server > Srv-Auth'
    );
    expect(result.trip && way(result.trip, 1)).toBe(
      'Srv-Auth > SW-Server > Router-Core > SW-Core > SW-Uffici > PC-Vendite'
    );
    expect(result.trip?.notes).toEqual([]);
  });

  it('every device that asks finds every name', () => {
    for (const from of [...OFFICES, ...WIFI]) {
      for (const [name, , address] of NAMES) {
        expect(find(from, name).address, `${from}: ${name}`).toBe(address);
      }
    }
  });

  it('a laptop asks from the address it is leased', () => {
    const result = find('Portatile-1', 'posta.azienda.example');
    expect(result.trip?.legs[0].trace).toMatchObject({ sourceIp: '192.168.20.100', targetIp: '192.168.30.10' });
    expect(result.address).toBe('192.168.30.40');
  });

  it('what a name resolves to is reached as the address would be', () => {
    for (const [name, label] of NAMES) {
      const address = find('PC-Vendite', name).address;
      const flow = planAndEvaluateFlow('web', device('PC-Vendite').id, device(label).id, sample, { targetIp: address });
      expect(flow.verdict, name).toBe('success');
      expect(flow.legs[0].trace.targetIp, name).toBe(address);
    }
  });

  it('a name nobody wrote has no record, and the customer outside has nobody to ask', () => {
    expect(find('PC-Vendite', 'intranet.azienda.example').failureReason).toBe(
      'Srv-Auth has no record for intranet.azienda.example'
    );
    expect(find('Cliente-Remoto', 'portale.azienda.example')).toEqual({
      name: 'portale.azienda.example',
      failureReason: 'Cliente-Remoto has no DNS server: it cannot look up portale.azienda.example',
    });
    // a server of the inside asks nobody either: its card names no DNS server
    expect(find('Web-Gestionale', 'posta.azienda.example').failureReason).toBe(
      'Web-Gestionale has no DNS server: it cannot look up posta.azienda.example'
    );
  });

  it('with Srv-Auth down no name is found, and every address still answers', () => {
    const failures = broken(['Srv-Auth']);
    expect(find('PC-Vendite', 'gestionale.azienda.example', failures).failureReason).toBe(
      'DNS request: Srv-Auth is down'
    );
    expect(ask('web', 'PC-Vendite', 'Web-Gestionale', failures).verdict).toBe('success');
  });

  it('with the trunk cut the offices and the Wi-Fi lose the names with the rest', () => {
    const failures = broken([], ['link-trunk-uffici']);
    expect(find('PC-Vendite', 'gestionale.azienda.example', failures).failureReason).toBe(
      'DNS request: link SW-Uffici–SW-Core is down'
    );
    expect(find('Portatile-1', 'gestionale.azienda.example', failures).address).toBeUndefined();
  });
});
