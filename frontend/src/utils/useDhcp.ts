/**
 * DHCP in the drawing on screen, for the components that show an address:
 * which card got which one, which got none and why, what every pool gave out.
 */

import { useMemo } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import { resolveDhcp } from '@/engine';
import type { DhcpResolution } from '@/engine';

export function useDhcp(): DhcpResolution {
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  return useMemo(() => resolveDhcp({ devices, connections }), [devices, connections]);
}
