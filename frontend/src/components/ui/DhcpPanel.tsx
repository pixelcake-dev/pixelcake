import React, { useState } from 'react';
import { poolOf, suggestedPool } from '@/engine';
import type { DeviceInterface, DhcpResolution } from '@/engine';
import { isBlankPool, poolProblemLabel, serverLabel, unservedText } from '@/utils/dhcpLabels';
import { interfaceShortLabel } from '@/utils/interfaceLabels';
import { isValidIP } from '@/utils/ipHelpers';
import type { DhcpPool, NetworkDevice } from '@/types';

interface DhcpPanelProps {
  /** The device the window is about */
  deviceId: string;
  /** DHCP of the drawing, with the device as it is in the form */
  dhcp: DhcpResolution;
  /** Where an interface is set: the tab «Porte», or «Schede di rete» on a server */
  setIn: 'Porte' | 'Schede di rete';
  /** The interfaces a pool can be on, as in the form: the ports of a router or firewall, the cards of a server */
  interfaces: DeviceInterface[];
  /** A pool switched on or changed on an interface, or (undefined) switched off */
  onPoolChange: (iface: DeviceInterface, pool: DhcpPool | undefined) => void;
  /** Go to the tab where the interfaces are set, on one of them when it is given */
  onOpenInterface: (iface?: DeviceInterface) => void;
}

/** `Porta 2 «Wi-Fi»` / `eth0` */
function interfaceName(iface: DeviceInterface): string {
  if (iface.kind !== 'port') return iface.label;
  const { id, name } = iface.port;
  return name ? `Porta ${id} «${name}»` : `Porta ${id}`;
}

/** `porta 2` / `scheda eth0`: what tells the fields of one interface from those of another */
function told(iface: DeviceInterface): string {
  return iface.kind === 'port' ? `porta ${iface.port.id}` : `scheda ${iface.label}`;
}

/** Name of a card of a device, for the table of the leases */
function cardName(device: NetworkDevice | undefined, nicId: string): string {
  return device?.nics?.find((nic) => nic.id === nicId)?.name ?? nicId;
}

const cell =
  'w-full px-2 py-1 text-sm font-mono bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded ' +
  'text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]';
const link = 'text-[var(--accent-text)] underline cursor-pointer';

interface PoolFieldProps {
  label: string;
  /** The label with the interface it is of: two interfaces have the same four fields */
  name: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

const PoolField: React.FC<PoolFieldProps> = ({ label, name, value, placeholder, onChange }) => (
  <label className="flex flex-col gap-0.5 min-w-0">
    <span className="text-xs text-[var(--text-color-light)]">{label}</span>
    <input
      type="text"
      aria-label={name}
      className={cell}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);

/**
 * DhcpPanel
 * What a device does as a DHCP server. The pools are set here, interface by
 * interface (a tick and the range: the same setting as «Server DHCP
 * Abilitato» on the port or on the card); switched on, an interface is given
 * a range to start from. Below, the answer of the engine to the drawing as
 * it is: the addresses the pools gave out and to whom, and what does not add
 * up — a pool that cannot work, a card left without an address, a second
 * server on the same network.
 */
const DhcpPanel: React.FC<DhcpPanelProps> = ({
  deviceId,
  dhcp,
  setIn,
  interfaces,
  onPoolChange,
  onOpenInterface,
}) => {
  // A range switched off is kept for as long as the tab is open: the tick put
  // back by mistake gives it back
  const [parked, setParked] = useState<Record<string, DhcpPool>>({});

  const pools = dhcp.pools.filter((pool) => pool.deviceId === deviceId);
  const unit = setIn === 'Porte' ? 'porta' : 'scheda';
  const devices = new Map(dhcp.topology.devices.map((device) => [device.id, device] as const));
  const leases = pools.flatMap((pool) => pool.leases.map((lease) => ({ pool, lease })));
  const waiting = dhcp.unserved.filter((entry) => entry.server?.deviceId === deviceId);
  const rivals = dhcp.rivals.filter((group) => group.some((pool) => pool.deviceId === deviceId));

  // A pool hands out the network of its interface: the ports that have an
  // address are listed (and one that has a pool without, to be put right);
  // the cards of a server are few, and all listed
  const listed = interfaces.filter(
    (iface) => iface.kind === 'nic' || isValidIP(iface.ip) || poolOf(iface) !== undefined
  );
  const serving = interfaces.filter((iface) => poolOf(iface) !== undefined);

  const toggle = (iface: DeviceInterface, on: boolean) => {
    if (on) {
      onPoolChange(iface, parked[iface.key] ?? suggestedPool(iface) ?? { start: '', end: '' });
      return;
    }
    const pool = poolOf(iface);
    if (pool) setParked({ ...parked, [iface.key]: pool });
    onPoolChange(iface, undefined);
  };

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
        {listed.length === 0 ? (
          <p className="text-[var(--text-color-light)]">
            Nessuna {unit} ha un indirizzo: un intervallo distribuisce gli indirizzi della rete
            della sua {unit}, quindi si attiva su una {unit} che ne ha uno.{' '}
            <button type="button" className={link} onClick={() => onOpenInterface()}>
              Vai alla scheda «{setIn}»
            </button>
          </p>
        ) : (
          <>
            {serving.length === 0 && (
              <p className="text-[var(--text-color-light)] mb-1">
                Nessuna {unit} assegna indirizzi. Spunta la {unit} della rete a cui darli:
                l&apos;intervallo viene proposto, e si può cambiare.
              </p>
            )}
            <ul className="flex flex-col gap-3">
              {listed.map((iface) => {
                const pool = poolOf(iface);
                const state = pools.find((entry) => entry.interfaceKey === iface.key);
                const of = told(iface);
                const isClient = iface.kind === 'nic' && iface.nic.dhcp === true;
                const addressed = isValidIP(iface.ip);
                const change = (patch: Partial<DhcpPool>) => {
                  if (pool) onPoolChange(iface, { ...pool, ...patch });
                };
                return (
                  <li key={iface.key} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`dhcp-${iface.key}`}
                        aria-label={`Server DHCP sulla ${of}`}
                        className="w-4 h-4 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                        checked={pool !== undefined}
                        disabled={!pool && (isClient || !addressed)}
                        onChange={(e) => toggle(iface, e.target.checked)}
                      />
                      <label
                        htmlFor={`dhcp-${iface.key}`}
                        className={
                          pool ? 'cursor-pointer font-medium' : 'cursor-pointer text-[var(--text-color-light)]'
                        }
                      >
                        {interfaceName(iface)}
                        {!isClient && iface.ip ? ` (${iface.ip})` : ''}
                      </label>
                    </div>

                    {pool && (
                      <div className="grid grid-cols-4 gap-2 pl-6">
                        <PoolField
                          label="Primo indirizzo"
                          name={`Primo indirizzo, ${of}`}
                          value={pool.start}
                          placeholder="es. 192.168.10.100"
                          onChange={(start) => change({ start })}
                        />
                        <PoolField
                          label="Ultimo indirizzo"
                          name={`Ultimo indirizzo, ${of}`}
                          value={pool.end}
                          placeholder="es. 192.168.10.199"
                          onChange={(end) => change({ end })}
                        />
                        <PoolField
                          label="Gateway consegnato"
                          name={`Gateway consegnato, ${of}`}
                          value={pool.gateway ?? ''}
                          placeholder={iface.kind === 'port' && addressed ? iface.ip : 'nessuno'}
                          onChange={(gateway) => change({ gateway })}
                        />
                        <PoolField
                          label="Server DNS consegnato"
                          name={`Server DNS consegnato, ${of}`}
                          value={pool.dns ?? ''}
                          placeholder="nessuno"
                          onChange={(dns) => change({ dns })}
                        />
                      </div>
                    )}

                    {pool && isBlankPool(pool) && (
                      <span className="pl-6 text-xs text-[var(--text-color-light)]">
                        Scrivi il primo e l&apos;ultimo indirizzo da assegnare: un intervallo
                        lasciato vuoto non viene salvato.
                      </span>
                    )}
                    {pool && state?.problem && (
                      <span className="pl-6 text-xs">
                        <span className="text-[var(--danger-color)]" role="alert">
                          Non utilizzabile: {poolProblemLabel(state.problem, state.iface, state.pool)}.
                        </span>
                        {state.problem.code === 'no-address' && (
                          <>
                            {' '}
                            <button type="button" className={link} onClick={() => onOpenInterface(iface)}>
                              Dagliene uno
                            </button>
                          </>
                        )}
                      </span>
                    )}
                    {pool && state && !state.problem && (
                      <span className="pl-6 text-xs text-[var(--text-color-light)]">
                        {state.gateway ? `Gateway consegnato ${state.gateway}` : 'Nessun gateway consegnato'}
                        {state.pool.dns ? ` · server DNS consegnato ${state.pool.dns}` : ''}
                        {' · '}
                        {state.leases.length} {state.leases.length === 1 ? 'assegnato' : 'assegnati'},{' '}
                        {state.free} {state.free === 1 ? 'libero' : 'liberi'} su {state.size}
                        {!state.iface.enabled && ` · ${unit} disabilitata: non risponde`}
                      </span>
                    )}
                    {!pool && isClient && (
                      <span className="pl-6 text-xs text-[var(--text-color-light)]">
                        Prende il proprio indirizzo dal DHCP: non può anche assegnarne.
                      </span>
                    )}
                    {!pool && !isClient && !addressed && (
                      <span className="pl-6 text-xs text-[var(--text-color-light)]">
                        Non ha un indirizzo: gli indirizzi da assegnare sono quelli della sua rete.{' '}
                        <button type="button" className={link} onClick={() => onOpenInterface(iface)}>
                          Dagliene uno
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {listed.length < interfaces.length && (
              <p className="text-xs text-[var(--text-color-light)] mt-2">
                Sono elencate le porte che hanno un indirizzo. Per darne uno a un&apos;altra:{' '}
                <button type="button" className={link} onClick={() => onOpenInterface()}>
                  scheda «{setIn}»
                </button>
                .
              </p>
            )}
          </>
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
        <section aria-label="Avvisi" className="flex flex-col gap-1 text-[var(--danger-color)]">
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
