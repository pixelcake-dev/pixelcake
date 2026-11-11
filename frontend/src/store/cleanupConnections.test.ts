/**
 * Tests for cleanupConnections (networkStore)
 * Removes duplicate connection IDs and rebuilds the connection counter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupConnections } from '@/store/networkStore';
import type { NetworkConnection } from '@/types/network';

function makeConnection(
  id: string,
  overrides: Partial<NetworkConnection> = {}
): NetworkConnection {
  return {
    id,
    source: 'device-1',
    target: 'device-2',
    ...overrides,
  };
}

describe('cleanupConnections', () => {
  beforeEach(() => {
    // Silence the "[Store Cleanup] Removed duplicate connection" warning
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('duplicate removal', () => {
    it('removes duplicate connection IDs keeping the FIRST occurrence', () => {
      const first = makeConnection('conn-1', { label: 'first' });
      const duplicate = makeConnection('conn-1', { label: 'second' });
      const other = makeConnection('conn-2');

      const { cleanedConnections } = cleanupConnections([first, duplicate, other]);

      expect(cleanedConnections).toHaveLength(2);
      expect(cleanedConnections[0]).toBe(first);
      expect(cleanedConnections[0].label).toBe('first');
      expect(cleanedConnections[1]).toBe(other);
    });

    it('logs a warning for each removed duplicate', () => {
      const connections = [
        makeConnection('conn-1'),
        makeConnection('conn-1'),
        makeConnection('conn-1'),
      ];

      cleanupConnections(connections);

      expect(console.warn).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledWith(
        '[Store Cleanup] Removed duplicate connection: conn-1'
      );
    });

    it('keeps all connections when there are no duplicates', () => {
      const connections = [
        makeConnection('conn-0'),
        makeConnection('conn-1'),
        makeConnection('conn-2'),
      ];

      const { cleanedConnections } = cleanupConnections(connections);

      expect(cleanedConnections).toHaveLength(3);
      expect(cleanedConnections.map((c) => c.id)).toEqual(['conn-0', 'conn-1', 'conn-2']);
    });
  });

  describe('counter rebuilding', () => {
    it('returns maxCounter = highest conn-N number + 1', () => {
      const connections = [
        makeConnection('conn-3'),
        makeConnection('conn-34'),
        makeConnection('conn-7'),
      ];

      const { maxCounter } = cleanupConnections(connections);

      expect(maxCounter).toBe(35);
    });

    it('computes maxCounter from surviving connections after dedup', () => {
      const connections = [
        makeConnection('conn-5'),
        makeConnection('conn-5'),
        makeConnection('conn-2'),
      ];

      const { cleanedConnections, maxCounter } = cleanupConnections(connections);

      expect(cleanedConnections.map((c) => c.id)).toEqual(['conn-5', 'conn-2']);
      expect(maxCounter).toBe(6);
    });

    it('ignores IDs not matching the conn-N pattern for the counter but keeps them', () => {
      const connections = [
        makeConnection('conn-2'),
        makeConnection('edge-99'),
        makeConnection('conn-abc'),
        makeConnection('conn-10-extra'),
        makeConnection('xconn-50'),
      ];

      const { cleanedConnections, maxCounter } = cleanupConnections(connections);

      expect(cleanedConnections).toHaveLength(5);
      expect(cleanedConnections.map((c) => c.id)).toEqual([
        'conn-2',
        'edge-99',
        'conn-abc',
        'conn-10-extra',
        'xconn-50',
      ]);
      expect(maxCounter).toBe(3); // only conn-2 counts → 2 + 1
    });

    it('returns maxCounter = 1 when no ID matches the conn-N pattern', () => {
      const connections = [makeConnection('edge-1'), makeConnection('custom-id')];

      const { maxCounter } = cleanupConnections(connections);

      expect(maxCounter).toBe(1);
    });

    it('returns maxCounter = 1 when the only match is conn-0', () => {
      const { maxCounter } = cleanupConnections([makeConnection('conn-0')]);

      expect(maxCounter).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('returns { cleanedConnections: [], maxCounter: 1 } for an empty array', () => {
      const result = cleanupConnections([]);

      expect(result).toEqual({ cleanedConnections: [], maxCounter: 1 });
    });

    it('does not mutate the input array', () => {
      const connections = [
        makeConnection('conn-1'),
        makeConnection('conn-1'),
        makeConnection('conn-2'),
      ];
      const snapshot = [...connections];

      cleanupConnections(connections);

      expect(connections).toEqual(snapshot);
      expect(connections).toHaveLength(3);
    });
  });
});
