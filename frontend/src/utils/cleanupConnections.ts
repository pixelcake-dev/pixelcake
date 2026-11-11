import type { NetworkConnection } from '@/types';

/**
 * Remove duplicate connections and rebuild connection counter
 * Fixes corrupted data from previous sessions or hand-edited files
 */
export function cleanupConnections(connections: NetworkConnection[]): {
  cleanedConnections: NetworkConnection[];
  maxCounter: number;
} {
  // Remove duplicates by ID (keep first occurrence)
  const seenIds = new Set<string>();
  const cleanedConnections = connections.filter((conn) => {
    if (seenIds.has(conn.id)) {
      console.warn(`[Store Cleanup] Removed duplicate connection: ${conn.id}`);
      return false;
    }
    seenIds.add(conn.id);
    return true;
  });

  // Extract max counter from connection IDs (conn-0, conn-1, conn-34, etc.)
  let maxCounter = 0;
  cleanedConnections.forEach((conn) => {
    const match = conn.id.match(/^conn-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxCounter) {
        maxCounter = num;
      }
    }
  });

  return {
    cleanedConnections,
    maxCounter: maxCounter + 1, // Next available ID
  };
}
