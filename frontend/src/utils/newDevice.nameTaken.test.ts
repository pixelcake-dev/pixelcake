import { describe, expect, it } from 'vitest';
import { isNameTaken, newDeviceName } from './newDevice';

const devices = [
  { id: 'a', label: 'PC-1' },
  { id: 'b', label: 'Web Server' },
];

describe('isNameTaken', () => {
  it('finds a name another device has, whatever the case and the spaces around it', () => {
    expect(isNameTaken('PC-1', devices)).toBe(true);
    expect(isNameTaken('pc-1', devices)).toBe(true);
    expect(isNameTaken('  PC-1 ', devices)).toBe(true);
  });

  it('takes a run of spaces for one space, as the terminal does', () => {
    expect(isNameTaken('web   server', devices)).toBe(true);
  });

  it('does not count the device being renamed', () => {
    expect(isNameTaken('pc-1', devices, 'a')).toBe(false);
    expect(isNameTaken('Web Server', devices, 'a')).toBe(true);
  });

  it('says no for a free name and for an empty one', () => {
    expect(isNameTaken('PC-2', devices)).toBe(false);
    expect(isNameTaken('   ', devices)).toBe(false);
  });

  it('agrees with the name proposed for a new device', () => {
    const proposed = newDeviceName('PC', devices);
    expect(proposed).toBe('PC-2');
    expect(isNameTaken(proposed, devices)).toBe(false);
  });
});
