/**
 * Network Engine — DNS
 *
 * A name in place of an address: who is asked, what the question travels
 * through, what comes back. The engine has no clock and no cache, so a name
 * is looked up every time a question uses it, and the lookup is a real
 * exchange that can fail like any other.
 *
 *  - RECORDS: a server keeps a list of names, each with one address
 *    (`dnsRecords`). It answers only for the names written on it. A record
 *    whose name is not a host name, or whose address is not an address, is
 *    not read.
 *  - WHO ASKS WHOM: a network card says which DNS server it asks (`dns`, an
 *    address): written by hand, or handed out with its lease when the card
 *    is on DHCP (see ./dhcp). A device asks the server of its first enabled
 *    card that names one. A device without cards (a router, a firewall, a
 *    switch) asks nobody.
 *  - A LOOKUP IS A ROUND TRIP: a request from the device to the address of
 *    its DNS server and the reply back, as the service `dns`, followed like
 *    any other packet (see ./trace): VLANs, routes, firewall rules, NAT and
 *    simulated failures all apply. Only when both arrive is the record read.
 *
 * Not simulated: a second DNS server to fall back on, forwarders and
 * recursion (a server never asks another), reverse lookup, cache and TTL,
 * wildcards and aliases.
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { DnsRecord, NetworkDevice, NetworkInterfaceCard } from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
import type { Topology } from './types';
import { ownedAddresses } from './addressing';
import { withLeases } from './dhcp';
import { planRoundTrip } from './flows';
import type { FlowResult } from './flows';

/** What the two legs of a lookup are called in results and messages */
const REQUEST = 'DNS request';
const REPLY = 'DNS reply';

/** A name as names are compared: trimmed, lower case, without the dot that may close it */
export function hostNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\.$/, '');
}

/** One part of a host name: letters, digits and hyphens, no hyphen at either end */
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * True for a host name: two or more parts of letters, digits and hyphens
 * joined by dots (`www.azienda.example`). The last part is never a number,
 * so that an address is not taken for a name.
 */
export function isHostName(text: string): boolean {
  const name = hostNameKey(text);
  if (name.length > 253) return false;
  const labels = name.split('.');
  if (labels.length < 2) return false;
  return labels.every(label => LABEL.test(label)) && !/^\d+$/.test(labels[labels.length - 1]);
}

/** True when the device can keep DNS records: a server */
export function servesDns(device: NetworkDevice): boolean {
  return device.type.toLowerCase().includes('server');
}

/**
 * The records a device answers with: those of a server that the engine can
 * read, in list order. None for any other device.
 */
export function dnsRecordsOf(device: NetworkDevice): DnsRecord[] {
  if (!servesDns(device)) return [];
  return (device.dnsRecords ?? []).filter(record => isHostName(record.name) && isValidIP(record.address));
}

/**
 * The card a device asks names through: its first enabled card that names a
 * DNS server. `device` is read as it is: for a card on DHCP, hand in the
 * device of the drawing with its leases (see withLeases in ./dhcp).
 */
export function dnsCardOf(device: NetworkDevice): NetworkInterfaceCard | undefined {
  return (device.nics ?? []).find(nic => nic.enabled !== false && Boolean(nic.dns));
}

/** What became of one lookup */
export interface DnsLookup {
  /** The name asked for, as names are compared (see hostNameKey) */
  name: string;
  /** The address the name stands for; undefined when the lookup failed */
  address?: string;
  /** Why there is no address, in words; undefined when there is one */
  failureReason?: string;
  /** The address of the DNS server that was asked, when the device has one */
  serverIp?: string;
  /** The device that answered, or that was reached and had no answer */
  server?: NetworkDevice;
  /**
   * The request and the reply, as they travelled. Undefined when nothing was
   * sent: the device has no DNS server, nobody has its address, or the
   * device asked is the server itself.
   */
  trip?: FlowResult;
}

/**
 * Look a name up from a device: ask the DNS server of the device, across the
 * network, and read the record (see the header). The answer is the address,
 * or the reason there is none.
 */
export function lookup(drawing: Topology, fromId: string, name: string): DnsLookup {
  // A card on DHCP asks the DNS server that came with its lease (see ./dhcp)
  const topo = withLeases(drawing);
  const key = hostNameKey(name);
  const asker = topo.devices.find(device => device.id === fromId);
  if (!asker) return { name: key, failureReason: `source device "${fromId}" not found` };

  const serverIp = dnsCardOf(asker)?.dns;
  if (!serverIp) {
    return { name: key, failureReason: `${asker.label} has no DNS server: it cannot look up ${key}` };
  }
  const owner = topo.devices.find(device => ownedAddresses(device).includes(serverIp));
  if (!owner) {
    return {
      name: key,
      serverIp,
      failureReason: `${asker.label} asks ${serverIp} for names, an address no device has`,
    };
  }

  // A device that is its own DNS server sends nothing
  const trip =
    owner.id === asker.id
      ? undefined
      : planRoundTrip(asker.id, owner.id, topo, 'dns', REQUEST, REPLY, serverIp);
  if (trip && trip.verdict !== 'success') {
    return { name: key, serverIp, trip, failureReason: trip.failureReason };
  }
  // (a port forward for dns sends the question on to a server inside)
  const answeredId = trip ? trip.legs[0].toId : owner.id;
  const server = topo.devices.find(device => device.id === answeredId) ?? owner;

  const records = dnsRecordsOf(server);
  if (records.length === 0) {
    const who = server.id === owner.id ? `${serverIp} is ${server.label}, which` : server.label;
    const why = servesDns(server) ? ': it keeps no records' : '';
    return {
      name: key,
      serverIp,
      server,
      trip,
      failureReason: `${who} is not a DNS server${why}`,
    };
  }
  const record = records.find(entry => hostNameKey(entry.name) === key);
  if (!record) {
    return { name: key, serverIp, server, trip, failureReason: `${server.label} has no record for ${key}` };
  }
  return { name: key, address: record.address, serverIp, server, trip };
}
