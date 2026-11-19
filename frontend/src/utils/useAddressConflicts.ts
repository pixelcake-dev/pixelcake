/**
 * The addresses in conflict in the drawing on screen, for the components
 * that show a device: two devices with one address that can meet.
 */

import { useMemo } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import { addressConflicts } from '@/engine';
import type { AddressConflicts } from '@/engine';

export function useAddressConflicts(): AddressConflicts {
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  return useMemo(() => addressConflicts({ devices, connections }), [devices, connections]);
}
