/**
 * The fifth sample network, the multinational: about two hundred devices on
 * ten sites in Italy. Its structure, and the questions a network engineer
 * would ask it, each with the answer expected: what arrives, what is blocked
 * and by what, what a cut line changes. If one of these answers changes,
 * either the engine or the sample is wrong.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { setLanguage, type Language } from '@/i18n';
import { useTemplateStore } from '@/store/templateStore';
import {
  assessImpact,
  boundInterface,
  lookup,
  normalizeBindings,
  planAndEvaluateFlow,
  resolveDhcp,
  sanitizeBindings,
  withFailures,
} from '@/engine';
import type { Failures, FlowResult } from '@/engine';
import type { FlowModelType, NetworkDevice } from '@/types';
import { createMultinationalSample } from './sampleMultinational';
import { areaAround } from './canvasAreas';
import { drawnSize, type SampleArea } from './sampleNetwork';
import { areSameNetwork, isValidIP, isValidMAC } from './ipHelpers';

const LANGUAGES: Language[] = ['it', 'en'];

afterEach(() => setLanguage('it'));

const sample = createMultinationalSample();

function device(id: string): NetworkDevice {
  const found = sample.devices.find((one) => one.id === id);
  if (!found) throw new Error(`the sample has no device "${id}"`);
  return found;
}

/** The cable between two devices */
function cable(a: string, b: string): string {
  const found = sample.connections.find(
    (one) => (one.source === a && one.target === b) || (one.source === b && one.target === a)
  );
  if (!found) throw new Error(`no cable between ${a} and ${b}`);
  return found.id;
}

const cut = (...connections: string[]): Failures => ({ devices: [], connections });

function ask(model: FlowModelType, from: string, to: string, options: { targetIp?: string; failures?: Failures } = {}): FlowResult {
  return planAndEvaluateFlow(model, from, to, withFailures(sample, options.failures), {
    ...(options.targetIp ? { targetIp: options.targetIp } : {}),
  });
}

/** The devices of a leg, by id */
const way = (result: FlowResult, leg = 0) => result.legs[leg].trace.hops.map((hop) => hop.deviceId);

/** The sites by the code their device names carry */
const ROMA = (id: string) => /-rm(-|$)/.test(id);

describe('the multinational — structure', () => {
  it('is the same every time, about two hundred devices, every name and id its own', () => {
    expect(createMultinationalSample()).toEqual(sample);
    expect(sample.devices.length).toBeGreaterThanOrEqual(180);
    expect(sample.devices.length).toBeLessThanOrEqual(220);
    expect(new Set(sample.devices.map((one) => one.id)).size).toBe(sample.devices.length);
    expect(new Set(sample.connections.map((one) => one.id)).size).toBe(sample.connections.length);
    for (const language of LANGUAGES) {
      setLanguage(language);
      const labels = createMultinationalSample().devices.map((one) => one.label);
      expect(new Set(labels).size, language).toBe(labels.length);
    }
  });

  it('has a device of every kind the panel offers', () => {
    const kinds = useTemplateStore.getState().templates.filter((template) => !template.isCustom).map((template) => template.id);
    expect(new Set(sample.devices.map((one) => one.templateId))).toEqual(new Set(kinds));
  });

  it('has every cable attached to an interface at both ends, never two on one, with nothing to repair', () => {
    const used = new Set<string>();
    for (const connection of sample.connections) {
      for (const end of ['source', 'target'] as const) {
        const owner = device(connection[end]);
        const iface = boundInterface(connection, owner, end);
        expect(iface, `${connection.id} ${end}`).toBeDefined();
        const key = `${owner.id}/${iface?.key}`;
        expect(used.has(key), key).toBe(false);
        used.add(key);
      }
    }
    expect(sanitizeBindings(sample.devices, sample.connections)).toBe(sample.connections);
    expect(normalizeBindings(sample.devices, sample.connections)).toBe(sample.connections);
  });

  it('carries only valid addresses, and a MAC address of its own on every card', () => {
    const macs: string[] = [];
    for (const one of sample.devices) {
      for (const ip of [one.ip, one.gateway, ...(one.ports ?? []).map((port) => port.ip ?? '')]) {
        if (ip) expect(isValidIP(ip), `${one.label} ${ip}`).toBe(true);
      }
      for (const card of one.nics ?? []) {
        if (card.ip) expect(isValidIP(card.ip), `${one.label} ${card.name}`).toBe(true);
        expect(card.mac !== undefined && isValidMAC(card.mac), `${one.label} ${card.name}`).toBe(true);
        macs.push(card.mac!);
      }
    }
    expect(new Set(macs).size).toBe(macs.length);
  });
});

describe('the multinational — addresses and names', () => {
  it('every card on DHCP is leased an address, with a gateway on its network and a DNS server', () => {
    const cards = sample.devices.flatMap((one) => (one.nics ?? []).filter((card) => card.dhcp).map((card) => `${one.id}/${card.id}`));
    const { leases, unserved } = resolveDhcp(sample);
    expect(unserved).toEqual([]);
    expect(leases.map((lease) => `${lease.deviceId}/${lease.nicId}`).sort()).toEqual(cards.sort());
    for (const lease of leases) {
      expect(areSameNetwork(lease.ip, lease.gateway, lease.mask), `${lease.deviceId} ${lease.ip} ${lease.gateway}`).toBe(true);
      // the company asks DNS-1, the guests the public DNS of the DMZ
      expect(lease.dns, lease.deviceId).toBe(lease.ip.startsWith('10.250.') ? '172.16.10.53' : '10.10.100.53');
    }
  });

  it('every name of the company answers from every site, as DNS-1 knows it', () => {
    const records = device('dns-1').dnsRecords ?? [];
    expect(records.length).toBe(7);
    // one desk of each site, on DHCP or with its address written
    for (const from of ['pc-mi-101', 'pc-rm-101', 'erp-app-dr', 'pc-to-101', 'pc-ve-1', 'pc-fi-1', 'pc-na-1', 'pc-ba-1', 'pc-pa-1', 'pc-ca-1']) {
      for (const record of records) {
        expect(lookup(sample, from, record.name).address, `${record.name} from ${from}`).toBe(record.address);
      }
    }
    // the two other servers know the same names
    expect(device('dns-2').dnsRecords).toEqual(records);
    expect(device('dns-3').dnsRecords).toEqual(records);
  });

  it('outside, and to the guests, the public DNS gives the public addresses, and nothing of the inside', () => {
    setLanguage('en');
    const names = createMultinationalSample();
    const www = 'www.group.example';
    expect(lookup(names, 'customer', www).address).toBe('203.0.113.1');
    expect(lookup(names, 'remote-worker', 'vpn.group.example').address).toBe('198.51.100.1');
    expect(lookup(names, 'guest-pa-1', www).address).toBe('203.0.113.1');
    expect(lookup(names, 'guest-mi-1', 'mail.group.example').address).toBe('203.0.113.1');
    expect(lookup(names, 'guest-pa-1', 'erp.group.example').failureReason).toBe('DNS-PUB has no record for erp.group.example');
    // and from inside the website is the server in the DMZ
    expect(lookup(names, 'pc-mi-101', www).address).toBe('172.16.10.11');
  });
});

describe('the multinational — what arrives', () => {
  it.each([
    ['Torino', 'pc-to-101'],
    ['Venezia', 'pc-ve-1'],
    ['Firenze', 'pc-fi-1'],
    ['Napoli', 'pc-na-1'],
    ['Bari', 'pc-ba-1'],
    ['Palermo', 'pc-pa-1'],
    ['Cagliari', 'pc-ca-1'],
  ])('a PC of %s opens the ERP in Milano, over MPLS', (_, from) => {
    const result = ask('web', from, 'erp-app');
    expect(result.verdict).toBe('success');
    expect(way(result)).toEqual(expect.arrayContaining(['mpls', 'r-mi-wan', 'r-mi', 'sw-mi-dc']));
  });

  it('Roma and the DR data centre reach Milano over their direct lines, not over MPLS', () => {
    for (const [from, to] of [['pc-rm-101', 'erp-app'], ['erp-app-dr', 'erp-db']]) {
      const result = ask('ping', from, to);
      expect(result.verdict, from).toBe('success');
      expect(way(result), from).not.toContain('mpls');
    }
  });

  it('a laptop in Roma sends its mail through the mail server of Milano', () => {
    const result = ask('email', 'lap-rm-101', 'mail-mi');
    expect(result.verdict).toBe('success');
    expect(way(result)).toEqual(['lap-rm-101', 'ap-rm-1', 'sw-rm-01', 'sw-rm-c', 'r-rm', 'r-mi-wan', 'r-mi', 'sw-mi-dc', 'mail-mi']);
  });

  it('a customer on the Internet opens the public website: the firewall forwards it to WWW-1', () => {
    const result = ask('web', 'customer', 'fw-mi', { targetIp: '203.0.113.1' });
    expect(result.verdict).toBe('success');
    expect(way(result).at(-1)).toBe('www-1');
    expect(result.notes).toContain('203.0.113.1 is FW-MI, which forwards web to WWW-1 (port forward 1)');
    expect(result.notes).toContain('HTTP request: firewall FW-MI: allowed by rule 4 (allow web from untrust to 172.16.10.11)');
  });

  it('a remote worker comes in through the second provider to the remote access, which reaches the applications', () => {
    const entry = ask('web', 'remote-worker', 'fw-mi', { targetIp: '198.51.100.1' });
    expect(entry.verdict).toBe('success');
    expect(way(entry)).toEqual(['remote-worker', 'inet-b', 'fw-mi', 'sw-mi-dmz', 'vpn-gw']);
    const inside = ask('web', 'vpn-gw', 'erp-app');
    expect(inside.verdict).toBe('success');
    expect(inside.notes).toContain('HTTP request: firewall FW-MI: allowed by rule 8 (allow web from 172.16.10.30 to 10.10.100.0/24)');
  });

  it('the proxy browses for the staff, and the website reads the catalogue from the ERP', () => {
    expect(ask('web', 'proxy', 'customer').notes).toContain(
      'HTTP request: firewall FW-MI: allowed by rule 9 (allow web from 172.16.10.40 to untrust)'
    );
    expect(ask('web', 'proxy', 'customer').verdict).toBe('success');
    expect(ask('web', 'www-1', 'erp-app').verdict).toBe('success');
  });

  it('the guests browse the Internet, at the head office and in the shop, always through Milano', () => {
    expect(ask('web', 'guest-mi-1', 'customer').verdict).toBe('success');
    const shop = ask('web', 'guest-pa-1', 'customer');
    expect(shop.verdict).toBe('success');
    expect(way(shop)).toEqual(['guest-pa-1', 'ap-pa-guests', 'sw-pa', 'fw-pa', 'mpls', 'r-mi-wan', 'r-mi', 'fw-mi', 'inet-a', 'customer']);
  });

  it('the tills reach their server, the sensors the archive, the cameras their recorder', () => {
    expect(ask('web', 'pos-pa-1', 'pos-srv').verdict).toBe('success');
    expect(ask('web', 'iot-ba', 's3-mi').verdict).toBe('success');
    expect(ask('ping', 'cam-ba-1', 'nvr-ba').verdict).toBe('success');
    expect(way(ask('ping', 'cam-ba-1', 'nvr-ba'))).toEqual(['cam-ba-1', 'sw-ba', 'nvr-ba']);
  });

  it('two branches talk through Milano, as every branch has its default route there', () => {
    const result = ask('ping', 'pc-na-1', 'pc-ca-1');
    expect(result.verdict).toBe('success');
    expect(way(result)).toEqual(['pc-na-1', 'sw-na', 'r-na', 'mpls', 'r-mi-wan', 'mpls', 'r-ca', 'sw-ca', 'pc-ca-1']);
  });
});

describe('the multinational — what is blocked, and by what', () => {
  it.each([
    ['the guests of the head office, to the servers', 'ping', 'guest-mi-1', 'erp-app', 'request: firewall FW-MI: denied by rule 1 (deny any from 10.250.0.0/16 to 10.0.0.0/8)'],
    ['the guests of the shop, to the servers', 'web', 'guest-pa-1', 'erp-app', 'HTTP request: firewall FW-PA: denied by rule 3 (deny any from 10.250.106.0/24 to 10.0.0.0/8)'],
    ['a camera, to anything but its recorder', 'ping', 'cam-ba-1', 'erp-app', 'request: firewall FW-BA: denied by rule 1 (deny any from 10.105.60.0/24 to any)'],
    ['the IoT gateway, to anything but the archive', 'ping', 'iot-ba', 'erp-app', 'request: firewall FW-BA: denied by rule 3 (deny any from 10.105.70.0/24 to any)'],
    ['a till, to anything but its server', 'ping', 'pos-pa-1', 'erp-app', 'request: firewall FW-PA: denied by rule 2 (deny any from 10.106.80.0/24 to any)'],
    ['the staff, browsing without the proxy', 'web', 'pc-mi-101', 'customer', 'HTTP request: firewall FW-MI: denied by rule 10 (deny web from 10.0.0.0/8 to untrust)'],
    ['the DMZ, to the inside', 'web', 'dns-pub', 'erp-app', 'HTTP request: firewall FW-MI: no rule matches, zone policy dmz → trust denied'],
  ] as const)('%s', (_, model, from, to, reason) => {
    const result = ask(model, from, to);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(reason);
  });

  it('the Internet, to the inside: nothing published, a private address is not carried', () => {
    for (const [model, to] of [['ping', 'pc-mi-101'], ['web', 'erp-app']] as const) {
      const result = ask(model, 'customer', to);
      expect(result.verdict, to).toBe('blocked');
      expect(result.failureReason, to).toMatch(/^(request|HTTP request): Internet A does not carry private addresses/);
    }
    // while a ping from inside goes out, and its reply comes back
    expect(ask('ping', 'pc-mi-101', 'customer').verdict).toBe('success');
  });
});

describe('the multinational — when a line is cut', () => {
  const mainLine = cable('r-mi-wan', 'r-rm');
  const romaMpls = cable('r-rm', 'mpls');
  const fibre = cable('r-mi-wan', 'r-dr');

  it('the main line of Roma: both ends take MPLS, and the notes say which route gave way', () => {
    const result = ask('ping', 'pc-rm-101', 'erp-app', { failures: cut(mainLine) });
    expect(result.verdict).toBe('success');
    expect(way(result)).toEqual(['pc-rm-101', 'sw-rm-01', 'sw-rm-c', 'r-rm', 'mpls', 'r-mi-wan', 'r-mi', 'sw-mi-dc', 'erp-app']);
    expect(way(result, 1)).toContain('mpls');
    expect(result.notes).toContain(
      'request: R-RM: the default route via 10.254.20.1 is unusable (link R-RM–R-MI-WAN is down), the default route via 10.255.0.1 is used instead'
    );
    expect(result.notes).toContain(
      'reply: R-MI-WAN: the route 10.20.0.0/16 via 10.254.20.2 is unusable (link R-MI-WAN–R-RM is down), the route 10.20.0.0/16 via 10.255.0.20 is used instead'
    );
  });

  it(
    'the main line of Roma, on every pair of end devices: nothing is lost, only what crosses to or from Roma moves',
    () => {
      const report = assessImpact(sample, cut(mainLine), { flow: 'ping' });
      expect(report.broken).toEqual([]);
      expect(report.rerouted.length).toBeGreaterThan(0);
      expect(report.rerouted.every((flow) => ROMA(flow.sourceId) !== ROMA(flow.targetId))).toBe(true);
      expect(report.rerouted.length + report.unchanged).toBe(report.working);
      expect({ endpoints: report.endpoints.length, working: report.working, rerouted: report.rerouted.length }).toEqual({
        endpoints: 132,
        working: 14891,
        rerouted: 4422,
      });
    },
    120_000
  );

  it('both lines of Roma: Roma is alone, and inside it everything goes on', () => {
    const failures = cut(mainLine, romaMpls);
    const out = ask('ping', 'pc-rm-101', 'erp-app', { failures });
    expect(out.verdict).toBe('blocked');
    expect(ask('ping', 'pc-rm-101', 'pc-rm-201', { failures }).verdict).toBe('success');
  });

  it('the fibre of the DR data centre: the replica goes on over MPLS', () => {
    const result = ask('ping', 'erp-app-dr', 'erp-db', { failures: cut(fibre) });
    expect(result.verdict).toBe('success');
    expect(way(result)).toContain('mpls');
  });

  it('the MPLS network: the branches are cut off, Roma and the DR data centre still reach Milano', () => {
    const failures: Failures = { devices: ['mpls'], connections: [] };
    expect(ask('web', 'pc-ve-1', 'erp-app', { failures }).verdict).toBe('blocked');
    expect(ask('ping', 'pc-rm-101', 'erp-app', { failures }).verdict).toBe('success');
    expect(ask('ping', 'erp-app-dr', 'erp-db', { failures }).verdict).toBe('success');
  });
});

/* ── the areas ─────────────────────────────────────────────────────────── */

type Box = { x: number; y: number; width: number; height: number };
const boxOfArea = (area: SampleArea): Box => ({ ...area.position, ...area.size });
const boxOfDevice = (one: NetworkDevice): Box => ({ ...one.position, ...drawnSize(one) });
const touch = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const holds = (outer: Box, inner: Box) =>
  outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;

const AREAS: Record<Language, string[]> = {
  it: [
    'Internet', 'DMZ', 'Sala server', 'Piano 1', 'Piano 2', 'Piano 3', 'Piano 4', 'Milano · Sede centrale',
    'Roma · Sede', 'Bologna · DC di disaster recovery', 'Torino · Filiale', 'Venezia · Filiale', 'Firenze · Filiale',
    'Napoli · Filiale', 'Bari · Magazzino', 'Palermo · Negozio', 'Cagliari · Filiale',
  ],
  en: [
    'Internet', 'DMZ', 'Server room', 'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Milan · Head office',
    'Rome · Office', 'Bologna · Disaster recovery DC', 'Turin · Branch', 'Venice · Branch', 'Florence · Branch',
    'Naples · Branch', 'Bari · Warehouse', 'Palermo · Shop', 'Cagliari · Branch',
  ],
};

describe('the multinational — its areas', () => {
  it.each(LANGUAGES)('%s: one for each site, and inside the head office its DMZ, server room and floors', (language) => {
    setLanguage(language);
    const { areas } = createMultinationalSample();
    expect(areas.map((area) => area.label)).toEqual(AREAS[language]);
    const milano = areas[7];
    const held = areas.filter((area) => area !== milano && holds(boxOfArea(milano), boxOfArea(area)));
    expect(held.map((area) => area.label)).toEqual(AREAS[language].slice(1, 7));
    // a held area has a colour of its own, not that of the one around it
    for (const area of held) expect(area.color, area.label).not.toBe(milano.color);
  });

  it.each(LANGUAGES)('%s: no two cross, no device is half in one, nothing else holds another', (language) => {
    setLanguage(language);
    const { areas, devices } = createMultinationalSample();
    const boxes = areas.map(boxOfArea);
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const pair = `${areas[a].label} and ${areas[b].label}`;
        const apart = !touch(boxes[a], boxes[b]);
        const nested = holds(boxes[a], boxes[b]) || holds(boxes[b], boxes[a]);
        expect(apart || nested, pair).toBe(true);
        if (nested) expect(a === 7 || b === 7, pair).toBe(true);
      }
    }
    for (const one of devices) {
      for (const [index, box] of boxes.entries()) {
        expect(!touch(box, boxOfDevice(one)) || holds(box, boxOfDevice(one)), `${one.label} and ${areas[index].label}`).toBe(true);
      }
    }
  });

  it('an area that holds no other is the one «Racchiudi in un riquadro» gives its devices', () => {
    for (const [index, area] of sample.areas.entries()) {
      if (index === 7) continue;
      const inside = sample.devices.filter((one) => touch(boxOfArea(area), boxOfDevice(one)));
      const around = areaAround(inside.map(boxOfDevice));
      expect({ position: area.position, size: area.size }, area.label).toEqual({ position: around?.position, size: around?.size });
    }
  });
});
