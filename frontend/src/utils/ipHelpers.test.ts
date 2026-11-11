import { describe, it, expect } from 'vitest';
import {
  isValidIP,
  getNetworkAddress,
  areSameNetwork,
  findNextAvailableIP,
  generateMacAddress,
  isValidMAC,
} from './ipHelpers';

/** Minimal device fixture matching the structural type expected by findNextAvailableIP */
function makeDevice(ip: string): { ip: string } {
  return { ip };
}

describe('isValidIP', () => {
  it('accepts valid IPv4 addresses', () => {
    expect(isValidIP('192.168.1.1')).toBe(true);
    expect(isValidIP('10.0.0.255')).toBe(true);
    expect(isValidIP('0.0.0.0')).toBe(true);
    expect(isValidIP('255.255.255.255')).toBe(true);
  });

  it('rejects octets greater than 255', () => {
    expect(isValidIP('256.1.1.1')).toBe(false);
    expect(isValidIP('1.1.1.999')).toBe(false);
  });

  it('rejects an address with fewer than four octets', () => {
    expect(isValidIP('1.2.3')).toBe(false);
  });

  it('rejects non-numeric octets', () => {
    expect(isValidIP('a.b.c.d')).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isValidIP('')).toBe(false);
  });
});

describe('getNetworkAddress', () => {
  it('masks a /24 network correctly', () => {
    expect(getNetworkAddress('192.168.1.57', '255.255.255.0')).toBe('192.168.1.0');
  });

  it('masks a /16 network correctly', () => {
    expect(getNetworkAddress('172.16.42.7', '255.255.0.0')).toBe('172.16.0.0');
  });

  it('returns the IP itself with a /32 mask', () => {
    expect(getNetworkAddress('10.1.2.3', '255.255.255.255')).toBe('10.1.2.3');
  });
});

describe('areSameNetwork', () => {
  it('returns true for two IPs in the same /24', () => {
    expect(areSameNetwork('192.168.1.10', '192.168.1.200', '255.255.255.0')).toBe(true);
  });

  it('returns false for IPs in different /24 subnets', () => {
    expect(areSameNetwork('192.168.1.10', '192.168.2.10', '255.255.255.0')).toBe(false);
  });

  it('returns true across /24 boundaries when the mask is /16', () => {
    expect(areSameNetwork('10.0.1.5', '10.0.200.5', '255.255.0.0')).toBe(true);
  });
});

describe('findNextAvailableIP', () => {
  const settings = { ipClass: '192.168.1.0' };

  it('starts from .2 when no devices exist', () => {
    expect(findNextAvailableIP([], settings)).toBe('192.168.1.2');
  });

  it('returns the first free host address after used IPs', () => {
    const devices = [makeDevice('192.168.1.2'), makeDevice('192.168.1.3')];
    expect(findNextAvailableIP(devices, settings)).toBe('192.168.1.4');
  });

  it('fills gaps between used IPs', () => {
    const devices = [makeDevice('192.168.1.2'), makeDevice('192.168.1.4')];
    expect(findNextAvailableIP(devices, settings)).toBe('192.168.1.3');
  });

  it('ignores devices on other subnets', () => {
    const devices = [makeDevice('10.0.0.2')];
    expect(findNextAvailableIP(devices, settings)).toBe('192.168.1.2');
  });

  it('falls back to .254 when the entire host range is used', () => {
    const devices = Array.from({ length: 253 }, (_, i) => makeDevice(`192.168.1.${i + 2}`));
    expect(findNextAvailableIP(devices, settings)).toBe('192.168.1.254');
  });
});

describe('generateMacAddress', () => {
  it('produces MACs that pass isValidMAC', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidMAC(generateMacAddress())).toBe(true);
    }
  });

  it('is locally administered (starts with 02:)', () => {
    expect(generateMacAddress().startsWith('02:')).toBe(true);
  });
});

describe('isValidMAC', () => {
  it('accepts valid colon-separated MACs in either case', () => {
    expect(isValidMAC('02:1A:2B:3C:4D:5E')).toBe(true);
    expect(isValidMAC('aa:bb:cc:dd:ee:ff')).toBe(true);
  });

  it('rejects malformed strings', () => {
    expect(isValidMAC('')).toBe(false);
    expect(isValidMAC('02:1A:2B:3C:4D')).toBe(false); // only 5 octets
    expect(isValidMAC('02:1A:2B:3C:4D:5E:6F')).toBe(false); // 7 octets
    expect(isValidMAC('GG:1A:2B:3C:4D:5E')).toBe(false); // non-hex chars
    expect(isValidMAC('02-1A-2B-3C-4D-5E')).toBe(false); // dashes not supported
    expect(isValidMAC('021A2B3C4D5E')).toBe(false); // no separators
  });
});
