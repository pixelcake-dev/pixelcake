import React from 'react';
import { linkClass } from '@/components/ui/compactStyles';
import { isPortInUse, portAddressText, portRanges, summariseSwitch } from '@/utils/portSummary';
import type { Port } from '@/types';

const ZONE_NAMES: Record<NonNullable<Port['securityZone']>, string> = {
  trust: 'Trust',
  untrust: 'Untrust',
  dmz: 'DMZ',
};

/** `Porta 3 «Internet»` */
function portName(port: Port): string {
  return port.name?.trim() ? `Porta ${port.id} «${port.name.trim()}»` : `Porta ${port.id}`;
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
  const used = ports.filter((port) => isPortInUse(port, linkedPorts));
  const spare = ports.length - used.length;

  if (used.length === 0) {
    return (
      <p className="text-sm text-[var(--text-color-light)]">
        Nessuna delle {ports.length} porte ha un indirizzo o un cavo: il dispositivo non è ancora
        collegato a nessuna rete.{' '}
        <button type="button" className={linkClass} onClick={() => onOpenPort()}>
          Apri la scheda «Porte»
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
              Porta
            </th>
            <th scope="col" className="font-medium pb-1 pr-3">
              Indirizzo
            </th>
            {showZone && (
              <th scope="col" className="font-medium pb-1 pr-3">
                Zona
              </th>
            )}
            <th scope="col" className="font-medium pb-1 pr-3">
              Collegata a
            </th>
            <th scope="col" className="font-medium pb-1">
              Fa
            </th>
          </tr>
        </thead>
        <tbody>
          {used.map((port) => {
            const does = [
              ...(port.nat ? ['NAT'] : []),
              ...(port.dhcpServer ? ['server DHCP'] : []),
              ...(port.enabled === false ? ['disabilitata'] : []),
            ];
            return (
              <tr key={port.id} className={port.enabled === false ? 'opacity-60' : ''}>
                <td className="pr-3 py-0.5">
                  <button type="button" className={linkClass} onClick={() => onOpenPort(port.id)}>
                    {portName(port)}
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
        <p className="text-xs text-[var(--text-color-light)] mt-2">
          {spare === 1 ? 'Un\'altra porta è libera' : `Altre ${spare} porte sono libere`}: senza
          indirizzo e senza cavo.
        </p>
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
 * ports as they are in the form.
 */
export const SwitchPortsOverview: React.FC<SwitchPortsOverviewProps> = ({ ports, linkedPorts, onOpenPort }) => {
  const summary = summariseSwitch(ports, linkedPorts);
  const counts = [
    `${summary.total} porte`,
    `${summary.linked} ${summary.linked === 1 ? 'collegata' : 'collegate'}`,
    ...(summary.disabled > 0
      ? [`${summary.disabled} ${summary.disabled === 1 ? 'disabilitata' : 'disabilitate'}`]
      : []),
  ];

  return (
    <div className="text-sm flex flex-col gap-1">
      <p>
        {counts.join(' · ')}.{' '}
        <button type="button" className={linkClass} onClick={() => onOpenPort()}>
          Apri la scheda «Porte»
        </button>
      </p>
      {summary.vlanAware ? (
        <ul className="flex flex-col gap-0.5">
          {summary.vlans.map(({ vlan, ports: ids }) => (
            <li key={vlan}>
              <span className="font-medium">VLAN {vlan}</span>: {ids.length === 1 ? 'porta' : 'porte'}{' '}
              <span className="font-mono">{portRanges(ids)}</span>
            </li>
          ))}
          {summary.trunks.map(({ port, vlans }) => (
            <li key={`trunk-${port}`}>
              <span className="font-medium">Trunk</span>: porta <span className="font-mono">{port}</span>
              {vlans.length > 0 ? `, porta le VLAN ${vlans.join(', ')}` : ', porta tutte le VLAN'}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--text-color-light)]">
          Nessuna porta ha una VLAN: tutte le porte sono nella stessa rete.
        </p>
      )}
    </div>
  );
};
