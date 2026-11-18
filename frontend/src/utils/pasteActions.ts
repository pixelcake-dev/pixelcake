/**
 * Edit → Paste and Ctrl+V: what was copied comes on the board
 * (utils/pasteDevices), and the board says which pasted end device asked a
 * DHCP server for its address and got none, as a real PC plugged into a
 * network with no server would show.
 */

import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { resolveDhcp } from '@/engine';
import { getT } from '@/i18n';

/** Paste, and say which pasted devices were left without an address */
export function pasteAndTell(): void {
  const { onDhcp } = useNetworkStore.getState().paste();
  if (onDhcp.length === 0) return;
  const { devices, connections } = useNetworkStore.getState();
  const unserved = new Set(resolveDhcp({ devices, connections }).unserved.map((entry) => entry.deviceId));
  const without = devices.filter((device) => onDhcp.includes(device.id) && unserved.has(device.id));
  if (without.length > 0) toast.warning(getT().canvas.paste.noAddress(without.map((device) => device.label)));
}
