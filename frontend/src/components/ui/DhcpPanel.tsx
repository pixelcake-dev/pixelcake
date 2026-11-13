import React from 'react';
import type { DhcpPoolState, DhcpResolution } from '@/engine';
import { poolProblemLabel, serverLabel, unservedText } from '@/utils/dhcpLabels';
import { interfaceShortLabel } from '@/utils/interfaceLabels';
import type { NetworkDevice } from '@/types';

interface DhcpPanelProps {
  /** The device the window is about */
  deviceId: string;
  /** DHCP of the drawing, with the device as it is in the form */
  dhcp: DhcpResolution;
  /** Where a pool is switched on: the tab «Porte», or «Schede di rete» on a server */
  setIn: 'Porte' | 'Schede di rete';
}

/** `Porta 2 «Wi-Fi»` / `eth0` */
function interfaceName(pool: DhcpPoolState): string {
  if (pool.iface.kind !== 'port') return pool.iface.label;
  const { id, name } = pool.iface.port;
  return name ? `Porta ${id} «${name}»` : `Porta ${id}`;
}

/** Name of a card of a device, for the table of the leases */
function cardName(device: NetworkDevice | undefined, nicId: string): string {
  return device?.nics?.find((nic) => nic.id === nicId)?.name ?? nicId;
}

/**
 * DhcpPanel
 * What a device does as a DHCP server: the pools of its interfaces (each set
 * on its own interface, shown here), the addresses they gave out and to
 * whom, and what does not add up — a pool that cannot work, a card left
 * without an address, a second server on the same network. Nothing is typed
 * here: it is the answer of the engine to the drawing as it is.
 */
const DhcpPanel: React.FC<DhcpPanelProps> = ({ deviceId, dhcp, setIn }) => {
  const pools = dhcp.pools.filter((pool) => pool.deviceId === deviceId);
  const unit = setIn === 'Porte' ? 'porta' : 'scheda';
  const devices = new Map(dhcp.topology.devices.map((device) => [device.id, device] as const));
  const leases = pools.flatMap((pool) => pool.leases.map((lease) => ({ pool, lease })));
  const waiting = dhcp.unserved.filter((entry) => entry.server?.deviceId === deviceId);
  const rivals = dhcp.rivals.filter((group) => group.some((pool) => pool.deviceId === deviceId));

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-[var(--text-color-light)]">
        Un server DHCP dà indirizzo, subnet mask e gateway ai dispositivi della sua rete che hanno
        la scheda su «Automatico (DHCP)», e il server DNS a cui chiedere i nomi quando
        l&apos;intervallo ne indica uno. Gli indirizzi si calcolano dal disegno, sempre allo
        stesso modo: i dispositivi vengono serviti nell&apos;ordine in cui compaiono, e ciascuno
        prende il primo indirizzo libero.
      </p>

      <section aria-label="Intervalli di indirizzi">
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">Intervalli di indirizzi</h4>
        {pools.length === 0 ? (
          <p className="text-[var(--text-color-light)]">
            Nessuna {unit} assegna indirizzi. Si attiva {unit} per {unit}, nella scheda «{setIn}»,
            con «Server DHCP Abilitato».
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pools.map((pool) => (
              <li key={pool.interfaceKey}>
                {interfaceName(pool)}
                {pool.iface.ip ? ` (${pool.iface.ip})` : ''}: da{' '}
                <code className="font-mono">{pool.pool.start}</code> a{' '}
                <code className="font-mono">{pool.pool.end}</code>
                {pool.problem ? (
                  <span className="block text-red-500" role="alert">
                    Non utilizzabile: {poolProblemLabel(pool.problem, pool.iface, pool.pool)}.
                  </span>
                ) : (
                  <span className="block text-[var(--text-color-light)]">
                    {pool.gateway ? `Gateway consegnato ${pool.gateway}` : 'Nessun gateway consegnato'}
                    {pool.pool.dns ? ` · server DNS consegnato ${pool.pool.dns}` : ''}
                    {' · '}
                    {pool.leases.length} {pool.leases.length === 1 ? 'assegnato' : 'assegnati'},{' '}
                    {pool.free} {pool.free === 1 ? 'libero' : 'liberi'} su {pool.size}
                    {!pool.iface.enabled && ` · ${unit} disabilitata: non risponde`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Indirizzi assegnati">
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">Indirizzi assegnati</h4>
        {leases.length === 0 ? (
          <p className="text-[var(--text-color-light)]">
            Nessun indirizzo assegnato: nessun dispositivo di queste reti ha la scheda su
            «Automatico (DHCP)».
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-xs text-[var(--text-color-light)]">
                <th scope="col" className="font-medium pb-1 pr-2">
                  Indirizzo
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Dispositivo
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Scheda
                </th>
                <th scope="col" className="font-medium pb-1">
                  Assegnato da
                </th>
              </tr>
            </thead>
            <tbody>
              {leases.map(({ pool, lease }) => (
                <tr key={`${lease.deviceId}|${lease.nicId}`}>
                  <td className="pr-2 py-0.5 font-mono">{lease.ip}</td>
                  <td className="pr-2 py-0.5">{devices.get(lease.deviceId)?.label ?? lease.deviceId}</td>
                  <td className="pr-2 py-0.5">{cardName(devices.get(lease.deviceId), lease.nicId)}</td>
                  <td className="py-0.5">{interfaceShortLabel(pool.iface)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(waiting.length > 0 || rivals.length > 0) && (
        <section aria-label="Avvisi" className="flex flex-col gap-1 text-red-500">
          {waiting.map((entry) => {
            const device = devices.get(entry.deviceId);
            return (
              <p key={`${entry.deviceId}|${entry.nicId}`} role="alert">
                {device?.label ?? entry.deviceId} ({cardName(device, entry.nicId)}) resta senza
                indirizzo: {unservedText(entry, dhcp)}.
              </p>
            );
          })}
          {rivals.map((group) => (
            <p key={group.map((pool) => `${pool.deviceId}|${pool.interfaceKey}`).join(' ')} role="alert">
              {group.length === 2 ? 'Due' : group.length} server DHCP sulla stessa rete:{' '}
              {group.map(serverLabel).join('; ')}. Risponde il primo che ha un indirizzo libero.
            </p>
          ))}
        </section>
      )}

      <p className="text-[var(--text-color-light)]">
        Un guasto simulato in presentazione non toglie l&apos;indirizzo a chi lo aveva. Non sono
        simulati il relay verso altre reti, le prenotazioni e le scadenze.
      </p>
    </div>
  );
};

export default DhcpPanel;
