/**
 * The names the project gave its VLANs, for the components that show a VLAN
 * number (see utils/vlanNames for how a VLAN is written with its name).
 */

import { useNetworkStore } from '@/store/networkStore';
import type { ProjectVlan } from '@/types';

export function useVlanNames(): readonly ProjectVlan[] | undefined {
  return useNetworkStore((state) => state.globalNetworkSettings.vlans);
}
