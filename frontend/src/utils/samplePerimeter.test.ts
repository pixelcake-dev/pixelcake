/**
 * The second sample network (VLANs, DMZ, firewall): its structure, and the
 * questions it is there to answer. If one of these answers changes, either
 * the engine or the sample is wrong.
 */

import { describe, it, expect } from 'vitest';
import { createPerimeterSample } from './samplePerimeter';
import { isValidIP, isValidMAC } from './ipHelpers';
import {
  boundInterface,
  describeForward,
  formatNetwork,
  isVlanAware,
  normalizeBindings,
  planAndEvaluateFlow,
  routingTable,
  sanitizeBindings,
  traceRoute,
} from '@/engine';
import type { FlowResult } from '@/engine';
import type { FlowModelType, NetworkDevice } from '@/types';

const sample = createPerimeterSample();

function device(label: string): NetworkDevice {
  const found = sample.devices.find(d => d.label === label);
  if (!found) throw new Error(`sample has no device "${label}"`);
  return found;
}

function ask(model: FlowModelType, from: string, to: string): FlowResult {
  return planAndEvaluateFlow(model, device(from).id, device(to).id, sample);
}

/** "Router-Core (routed: …)" for every hop of the first leg */
function requestPath(result: FlowResult): string[] {
  return result.legs[0].trace.hops.map(h => (h.note ? `${h.label} (${h.note})` : h.label));
}

const table = (label: string) =>
  routingTable(device(label)).map(e => [formatNetwork(e.network), e.kind, e.nextHop ?? '-', e.out?.iface?.label]);

describe('createPerimeterSample — structure', () => {
  it('is deterministic and its ids are unique', () => {
    expect(createPerimeterSample()).toEqual(createPerimeterSample());
    expect(new Set(sample.devices.map(d => d.id)).size).toBe(sample.devices.length);
    expect(new Set(sample.connections.map(c => c.id)).size).toBe(sample.connections.length);
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

  it('carries only valid addresses and MACs', () => {
    for (const d of sample.devices) {
      for (const ip of [d.ip, d.gateway, ...(d.ports ?? []).map(p => p.ip ?? '')]) {
        if (ip) expect(isValidIP(ip), `${d.label} ${ip}`).toBe(true);
      }
      for (const nic of d.nics ?? []) {
        if (nic.ip) expect(isValidIP(nic.ip), `${d.label} ${nic.name}`).toBe(true);
        expect(nic.mac !== undefined && isValidMAC(nic.mac), `${d.label} ${nic.name}`).toBe(true);
      }
    }
  });

  it('uses the features it is there to show', () => {
    expect(isVlanAware(device('SW-Core'))).toBe(true);
    expect(isVlanAware(device('SW-DMZ'))).toBe(false);
    expect(device('FW-Edge').ports?.map(p => p.securityZone)).toEqual(['trust', 'dmz', 'untrust', undefined]);
    expect(device('FW-Edge').firewallRules).toHaveLength(1);
    // NAT on the port that faces the Internet, and the public site published there
    expect(device('FW-Edge').ports?.map(p => p.nat === true)).toEqual([false, false, true, false]);
    expect(device('FW-Edge').portForwards?.map(describeForward)).toEqual([
      'forward web from interface 3 to 172.16.0.10',
    ]);
  });

  it('gives the two routing devices the tables a person would expect', () => {
    expect(table('Router-Core')).toEqual([
      ['10.0.0.0/30', 'connected', '-', 'port 3'],
      ['192.168.10.0/24', 'connected', '-', 'port 1'],
      ['192.168.20.0/24', 'connected', '-', 'port 2'],
      ['default', 'default', '10.0.0.2', 'port 3'],
    ]);
    expect(table('FW-Edge')).toEqual([
      ['10.0.0.0/30', 'connected', '-', 'port 1'],
      ['172.16.0.0/24', 'connected', '-', 'port 2'],
      ['203.0.113.0/24', 'connected', '-', 'port 3'],
      ['192.168.0.0/16', 'static', '10.0.0.1', 'port 1'],
    ]);
  });
});

describe('createPerimeterSample — the questions it answers', () => {
  it('two PCs of the same VLAN talk through the switch', () => {
    const result = ask('ping', 'PC-Uffici-1', 'PC-Uffici-2');
    expect(result.verdict).toBe('success');
    expect(requestPath(result)).toEqual(['PC-Uffici-1', 'SW-Core (VLAN 10)', 'PC-Uffici-2']);
    expect(result.notes).toEqual([]);
  });

  it('a PC reaches the server of the other VLAN through the router, and back', () => {
    const result = ask('ping', 'PC-Uffici-1', 'Srv-Interno');
    expect(result.verdict).toBe('success');
    expect(requestPath(result)).toEqual([
      'PC-Uffici-1',
      'SW-Core (VLAN 10)',
      'Router-Core (routed: 192.168.20.0/24 is on port 2)',
      'SW-Core (VLAN 20)',
      'Srv-Interno',
    ]);
    expect(result.notes).toEqual([]);
  });

  it('the inside browses the public server: the zone policy lets it, the answer comes back', () => {
    const result = ask('web', 'PC-Uffici-1', 'Web-Public');
    expect(result.verdict).toBe('success');
    expect(requestPath(result)).toEqual([
      'PC-Uffici-1',
      'SW-Core (VLAN 10)',
      'Router-Core (routed: default route via 10.0.0.2 (port 3))',
      'FW-Edge (routed: 172.16.0.0/24 is on port 2; firewall FW-Edge: no rule matches, zone policy trust → dmz allowed)',
      'SW-DMZ',
      'Web-Public',
    ]);
    expect(result.notes).toEqual([
      'HTTP request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed',
      'HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)',
    ]);
  });

  it('the inside reaches the outside, across the Internet symbol, which says it is assumed', () => {
    const result = ask('ping', 'PC-Uffici-1', 'Remote-PC');
    expect(result.verdict).toBe('success');
    expect(result.legs[0].trace.hops.map(h => h.label)).toEqual([
      'PC-Uffici-1',
      'SW-Core',
      'Router-Core',
      'FW-Edge',
      'Internet',
      'Remote-PC',
    ]);
    expect(result.notes).toContain('request: Internet is not simulated: traffic assumed to pass');
  });

  it('the outside opens the public site: the one rule of the firewall', () => {
    const result = ask('web', 'Remote-PC', 'Web-Public');
    expect(result.verdict).toBe('success');
    expect(result.notes).toContain(
      'HTTP request: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)'
    );
  });

  it('the outside reaches the public site at the public address of the firewall', () => {
    const result = ask('web', 'Remote-PC', 'Web-Public');
    expect(result.legs[0].trace.targetIp).toBe('203.0.113.1');
    expect(requestPath(result)).toEqual([
      'Remote-PC',
      'Internet (Internet is not simulated: traffic assumed to pass)',
      'FW-Edge (NAT: destination 203.0.113.1 → 172.16.0.10 (port forward 1); ' +
        'routed: 172.16.0.0/24 is on port 2; ' +
        'firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10))',
      'SW-DMZ',
      'Web-Public',
    ]);
    expect(result.notes[0]).toBe(
      'HTTP request: Web-Public is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)'
    );
  });

  it('the inside goes out with that same address', () => {
    const result = ask('ping', 'PC-Uffici-1', 'Remote-PC');
    expect(result.legs[0].trace.seenSourceIp).toBe('203.0.113.1');
    expect(result.legs[1].trace.reachedIp).toBe('192.168.10.11');
  });

  it('the outside cannot ping the public server: only web is published', () => {
    const result = ask('ping', 'Remote-PC', 'Web-Public');
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'request: Internet does not carry private addresses: 172.16.0.10 is not reachable from ' +
        'outside: no port forward publishes it for ping'
    );
  });

  it('the outside cannot reach the inside at all', () => {
    for (const model of ['ping', 'web'] as const) {
      const result = ask(model, 'Remote-PC', 'Srv-Interno');
      expect(result.verdict).toBe('blocked');
      expect(result.failureReason).toContain(
        `192.168.20.10 is not reachable from outside: no port forward publishes it for ${model}`
      );
    }
  });

  it('the DMZ cannot open a flow towards the inside', () => {
    const result = ask('ping', 'Web-Public', 'Srv-Interno');
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'request: firewall FW-Edge: no rule matches, zone policy dmz → trust denied'
    );
  });

  it('moving a PC to the other VLAN cuts it off from its gateway, and the reason names the port', () => {
    const moved = {
      devices: sample.devices.map(d =>
        d.label === 'SW-Core'
          ? { ...d, ports: d.ports?.map(p => (p.id === 1 ? { ...p, vlan: 20 } : p)) }
          : d
      ),
      connections: sample.connections,
    };
    const result = traceRoute(device('PC-Uffici-1').id, device('Srv-Interno').id, moved);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'VLAN 20 does not leave through port 7 on SW-Core: it is an access port in VLAN 10'
    );
  });
});
