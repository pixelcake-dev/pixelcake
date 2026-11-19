/**
 * Edit → Paste and Ctrl+V: what was copied comes on the board
 * (utils/pasteDevices), and the board says what the copies did with their
 * addresses:
 *
 *  - a pasted end device asked a DHCP server for its address: the notice
 *    names those that got none, as a real PC plugged into a network with no
 *    server would show;
 *  - a pasted server, router, firewall or switch keeps the addresses of the
 *    original, as a real machine that is cloned: the notice says so, and
 *    which of them are now in conflict (engine/conflicts) until they change.
 */

import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { addressConflicts, heldAddresses, resolveDhcp } from '@/engine';
import { getT } from '@/i18n';

/** Paste, and say which pasted devices were left without an address, and which kept theirs */
export function pasteAndTell(): void {
  const { pasted, onDhcp } = useNetworkStore.getState().paste();
  if (pasted.length === 0) return;
  const { devices, connections } = useNetworkStore.getState();
  const say = getT().canvas.paste;

  if (onDhcp.length > 0) {
    const unserved = new Set(resolveDhcp({ devices, connections }).unserved.map((entry) => entry.deviceId));
    const without = devices.filter((device) => onDhcp.includes(device.id) && unserved.has(device.id));
    if (without.length > 0) toast.warning(say.noAddress(without.map((device) => device.label)));
  }

  // (a switch with no address of its own keeps nothing)
  const kept = devices.filter(
    (device) => pasted.includes(device.id) && !onDhcp.includes(device.id) && heldAddresses(device).length > 0
  );
  if (kept.length === 0) return;
  const conflicts = addressConflicts({ devices, connections });
  const inConflict = [
    ...new Set(kept.flatMap((device) => [...(conflicts.byDevice.get(device.id)?.keys() ?? [])])),
  ];
  const notice = say.keptAddresses(
    kept.map((device) => device.label),
    inConflict
  );
  if (inConflict.length > 0) toast.warning(notice);
  else toast.info(notice);
}
