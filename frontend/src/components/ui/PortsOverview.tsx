import React from 'react';
import { linkClass } from '@/components/ui/compactStyles';
import { isPortInUse, portAddressText, portRanges, summariseSwitch } from '@/utils/portSummary';
import { vlanLabel, vlanShort } from '@/utils/vlanNames';
import { useVlanNames } from '@/utils/useVlanNames';
import { useT, type Dictionary } from '@/i18n';
import { Rich } from '@/i18n/Rich';
import type { Port } from '@/types';

const ZONE_NAMES: Record<NonNullable<Port['securityZone']>, string> = {
  trust: 'Trust',
  untrust: 'Untrust',
  dmz: 'DMZ',
};

/** `Porta 3 «Internet»` */
function portName(port: Port, t: Dictionary): string {
  const name = port.name?.trim();
  return name ? t.common.interfaces.portNamed(port.id, name) : t.common.interfaces.port(port.id);
}

interface RoutedPortsOverviewProps {
  /** The ports of the router or firewall as in the form */
  ports: Port[];
  /** A firewall: the zone of each port is shown too */
  showZone: boolean;
  /** Port id → what it is linked to */
  linkedPorts: ReadonlyMap<number, string>;
  /** Go to the «Porte» tab, on a port when one is given */
  onOpenPort: (portId?: number) => void;
}

/**
 * RoutedPortsOverview
 * The ports of a router or of a firewall that are in use, on the first
 * screen of its window: address, zone, what each is linked to and what it
 * does (NAT, DHCP). A glance at the device; the name of a port opens it in
 * «Porte», where it is set.
 */
export const RoutedPortsOverview: React.FC<RoutedPortsOverviewProps> = ({
  ports,
  showZone,
  linkedPorts,
  onOpenPort,
}) => {
  const t = useT();
  const say = t.interfaces.overview;
  const used = ports.filter((port) => isPortInUse(port, linkedPorts));
  const spare = ports.length - used.length;

  if (used.length === 0) {
    return (
      <p className="text-sm text-[var(--text-color-light)]">
        {say.noneInUse(ports.length)}{' '}
        <button type="button" className={linkClass} onClick={() => onOpenPort()}>
          {say.openPortsTab}
        </button>
      </p>
    );
  }

  return (
    <div className="text-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-xs text-[var(--text-color-light)]">
            <th scope="col" className="font-medium pb-1 pr-3">
              {say.columns.port}
            </th>
            <th scope="col" className="font-medium pb-1 pr-3">
              {say.columns.address}
            </th>
            {showZone && (
              <th scope="col" className="font-medium pb-1 pr-3">
                {say.columns.zone}
              </th>
            )}
            <th scope="col" className="font-medium pb-1 pr-3">
              {say.columns.linkedTo}
            </th>
            <th scope="col" className="font-medium pb-1">
              {say.columns.does}
            </th>
          </tr>
        </thead>
        <tbody>
          {used.map((port) => {
            const does = [
              ...(port.nat ? ['NAT'] : []),
              ...(port.dhcpServer ? [say.does.dhcpServer] : []),
              ...(port.enabled === false ? [say.does.disabled] : []),
            ];
            return (
              <tr key={port.id} className={port.enabled === false ? 'opacity-60' : ''}>
                <td className="pr-3 py-0.5">
                  <button type="button" className={linkClass} onClick={() => onOpenPort(port.id)}>
                    {portName(port, t)}
                  </button>
                </td>
                <td className="pr-3 py-0.5 font-mono">{portAddressText(port) || '—'}</td>
                {showZone && (
                  <td className="pr-3 py-0.5">{port.securityZone ? ZONE_NAMES[port.securityZone] : '—'}</td>
                )}
                <td className="pr-3 py-0.5">{linkedPorts.get(port.id) ?? '—'}</td>
                <td className="py-0.5">{does.join(' · ') || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {spare > 0 && (
        <p className="text-xs text-[var(--text-color-light)] mt-2">{say.spare(spare)}</p>
      )}
    </div>
  );
};

interface SwitchPortsOverviewProps {
  /** The ports of the switch as in the form */
  ports: Port[];
  linkedPorts: ReadonlyMap<number, string>;
  onOpenPort: (portId?: number) => void;
}

/**
 * SwitchPortsOverview
 * How a switch splits its ports, on the first screen of its window: how
 * many are linked, which VLAN each group of access ports is in, which ports
 * are trunks and what they carry. It is what the engine reads from the
 * ports as they are in the form. A VLAN the project gave a name to is
 * written with it.
 */
export const SwitchPortsOverview: React.FC<SwitchPortsOverviewProps> = ({ ports, linkedPorts, onOpenPort }) => {
  const t = useT();
  const say = t.interfaces.overview;
  const summary = summariseSwitch(ports, linkedPorts);
  const names = useVlanNames();

  return (
    <div className="text-sm flex flex-col gap-1">
      <p>
        {say.switchCounts(summary.total, summary.linked, summary.disabled)}{' '}
        <button type="button" className={linkClass} onClick={() => onOpenPort()}>
          {say.openPortsTab}
        </button>
      </p>
      {summary.vlanAware ? (
        <ul className="flex flex-col gap-0.5">
          {summary.vlans.map(({ vlan, ports: ids }) => (
            <li key={vlan}>
              <Rich
                text={say.vlanPorts(ids.length)}
                parts={{
                  vlan: () => <span className="font-medium">{vlanLabel(vlan, names)}</span>,
                  ports: () => <span className="font-mono">{portRanges(ids)}</span>,
                }}
              />
            </li>
          ))}
          {summary.trunks.map(({ port, vlans }) => (
            <li key={`trunk-${port}`}>
              <Rich
                text={say.trunk(vlans.length)}
                parts={{
                  trunk: (words) => <span className="font-medium">{words}</span>,
                  port: () => <span className="font-mono">{port}</span>,
                  vlans: () => vlans.map((vlan) => vlanShort(vlan, names)).join(', '),
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--text-color-light)]">{say.noVlans}</p>
      )}
    </div>
  );
};
