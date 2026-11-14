import React, { useState } from 'react';
import { poolOf, suggestedPool } from '@/engine';
import type { DeviceInterface, DhcpResolution } from '@/engine';
import {
  isBlankPool,
  poolProblemLabel,
  poolStatusText,
  serverLabel,
  unservedText,
} from '@/utils/dhcpLabels';
import { interfaceShortLabel } from '@/utils/interfaceLabels';
import { isValidIP } from '@/utils/ipHelpers';
import { useT, type Dictionary } from '@/i18n';
import { Rich } from '@/i18n/Rich';
import type { DhcpPool, NetworkDevice } from '@/types';

interface DhcpPanelProps {
  /** The device the window is about */
  deviceId: string;
  /** DHCP of the drawing, with the device as it is in the form */
  dhcp: DhcpResolution;
  /** Where an interface is set: the tab of the ports, or the one of the network cards on a server */
  setIn: 'ports' | 'cards';
  /** The interfaces a pool can be on, as in the form: the ports of a router or firewall, the cards of a server */
  interfaces: DeviceInterface[];
  /** A pool switched on or changed on an interface, or (undefined) switched off */
  onPoolChange: (iface: DeviceInterface, pool: DhcpPool | undefined) => void;
  /** Go to the tab where the interfaces are set, on one of them when it is given */
  onOpenInterface: (iface?: DeviceInterface) => void;
}

/** `Port 2 “Wi-Fi”` / `eth0` */
function interfaceName(t: Dictionary, iface: DeviceInterface): string {
  if (iface.kind !== 'port') return iface.label;
  const { id, name } = iface.port;
  return name ? t.common.interfaces.portNamed(id, name) : t.common.interfaces.port(id);
}

/** `port 2` / `card eth0`: what tells the fields of one interface from those of another */
function told(t: Dictionary, iface: DeviceInterface): string {
  return iface.kind === 'port'
    ? t.common.interfaces.portInSentence(iface.port.id)
    : t.common.interfaces.cardInSentence(iface.label);
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
 * interface (a tick and the range: the same setting as the tick of the DHCP
 * server on the port or on the card); switched on, an interface is given
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
  const t = useT();
  const words = t.dhcp.panel;
  // A range switched off is kept for as long as the tab is open: the tick put
  // back by mistake gives it back
  const [parked, setParked] = useState<Record<string, DhcpPool>>({});

  const pools = dhcp.pools.filter((pool) => pool.deviceId === deviceId);
  const unit = setIn === 'ports' ? 'port' : 'card';
  /** The pool of an interface: a card that takes its own address from DHCP has none */
  const poolOn = (iface: DeviceInterface): DhcpPool | undefined =>
    iface.kind === 'nic' && iface.nic.dhcp === true ? undefined : poolOf(iface);
  const devices = new Map(dhcp.topology.devices.map((device) => [device.id, device] as const));
  const leases = pools.flatMap((pool) => pool.leases.map((lease) => ({ pool, lease })));
  const waiting = dhcp.unserved.filter((entry) => entry.server?.deviceId === deviceId);
  const rivals = dhcp.rivals.filter((group) => group.some((pool) => pool.deviceId === deviceId));

  // A pool hands out the network of its interface: the ports that have an
  // address are listed (and one that has a pool without, to be put right);
  // the cards of a server are few, and all listed
  const listed = interfaces.filter(
    (iface) => iface.kind === 'nic' || isValidIP(iface.ip) || poolOn(iface) !== undefined
  );
  const serving = interfaces.filter((iface) => poolOn(iface) !== undefined);

  const toggle = (iface: DeviceInterface, on: boolean) => {
    if (on) {
      onPoolChange(iface, parked[iface.key] ?? suggestedPool(iface) ?? { start: '', end: '' });
      return;
    }
    const pool = poolOn(iface);
    if (pool) setParked({ ...parked, [iface.key]: pool });
    onPoolChange(iface, undefined);
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-[var(--text-color-light)]">{words.intro}</p>

      <section aria-label={words.ranges.title}>
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">{words.ranges.title}</h4>
        {listed.length === 0 ? (
          <p className="text-[var(--text-color-light)]">
            {words.ranges.noneAddressed(unit)}{' '}
            <button type="button" className={link} onClick={() => onOpenInterface()}>
              {words.ranges.goToTab(unit)}
            </button>
          </p>
        ) : (
          <>
            {serving.length === 0 && (
              <p className="text-[var(--text-color-light)] mb-1">{words.ranges.noneServing(unit)}</p>
            )}
            <ul className="flex flex-col gap-3">
              {listed.map((iface) => {
                const pool = poolOn(iface);
                const state = pools.find((entry) => entry.interfaceKey === iface.key);
                const of = told(t, iface);
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
                        aria-label={words.ranges.serverOn(of)}
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
                        {interfaceName(t, iface)}
                        {!isClient && iface.ip ? ` (${iface.ip})` : ''}
                      </label>
                    </div>

                    {pool && (
                      <div className="grid grid-cols-4 gap-2 pl-6">
                        <PoolField
                          label={t.dhcp.firstAddress}
                          name={words.ranges.fieldOf(t.dhcp.firstAddress, of)}
                          value={pool.start}
                          placeholder={t.dhcp.firstAddressPlaceholder}
                          onChange={(start) => change({ start })}
                        />
                        <PoolField
                          label={t.dhcp.lastAddress}
                          name={words.ranges.fieldOf(t.dhcp.lastAddress, of)}
                          value={pool.end}
                          placeholder={t.dhcp.lastAddressPlaceholder}
                          onChange={(end) => change({ end })}
                        />
                        <PoolField
                          label={words.ranges.gateway}
                          name={words.ranges.fieldOf(words.ranges.gateway, of)}
                          value={pool.gateway ?? ''}
                          placeholder={iface.kind === 'port' && addressed ? iface.ip : words.ranges.none}
                          onChange={(gateway) => change({ gateway })}
                        />
                        <PoolField
                          label={words.ranges.dns}
                          name={words.ranges.fieldOf(words.ranges.dns, of)}
                          value={pool.dns ?? ''}
                          placeholder={words.ranges.none}
                          onChange={(dns) => change({ dns })}
                        />
                      </div>
                    )}

                    {pool && isBlankPool(pool) && (
                      <span className="pl-6 text-xs text-[var(--text-color-light)]">{t.dhcp.blankRange}</span>
                    )}
                    {pool && state?.problem && (
                      <span className="pl-6 text-xs">
                        <span className="text-[var(--danger-color)]" role="alert">
                          {words.ranges.unusable(poolProblemLabel(state.problem, state.iface, state.pool))}
                        </span>
                        {state.problem.code === 'no-address' && (
                          <>
                            {' '}
                            <button type="button" className={link} onClick={() => onOpenInterface(iface)}>
                              {words.ranges.giveItOne}
                            </button>
                          </>
                        )}
                      </span>
                    )}
                    {pool && state && !state.problem && (
                      <span className="pl-6 text-xs text-[var(--text-color-light)]">
                        {poolStatusText(state)}
                      </span>
                    )}
                    {!pool && isClient && (
                      <span className="pl-6 text-xs text-[var(--text-color-light)]">{words.ranges.client}</span>
                    )}
                    {!pool && !isClient && !addressed && (
                      <span className="pl-6 text-xs text-[var(--text-color-light)]">
                        {words.ranges.noAddress}{' '}
                        <button type="button" className={link} onClick={() => onOpenInterface(iface)}>
                          {words.ranges.giveItOne}
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {listed.length < interfaces.length && (
              <p className="text-xs text-[var(--text-color-light)] mt-2">
                <Rich
                  text={words.ranges.onlyAddressed(unit)}
                  parts={{
                    link: (tab) => (
                      <button type="button" className={link} onClick={() => onOpenInterface()}>
                        {tab}
                      </button>
                    ),
                  }}
                />
              </p>
            )}
          </>
        )}
      </section>

      <section aria-label={words.leases.title}>
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">{words.leases.title}</h4>
        {leases.length === 0 ? (
          <p className="text-[var(--text-color-light)]">{words.leases.none}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-xs text-[var(--text-color-light)]">
                <th scope="col" className="font-medium pb-1 pr-2">
                  {words.leases.address}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {words.leases.device}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {words.leases.card}
                </th>
                <th scope="col" className="font-medium pb-1">
                  {words.leases.server}
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
        <section aria-label={words.warnings.title} className="flex flex-col gap-1 text-[var(--danger-color)]">
          {waiting.map((entry) => {
            const device = devices.get(entry.deviceId);
            return (
              <p key={`${entry.deviceId}|${entry.nicId}`} role="alert">
                {words.warnings.unserved(
                  device?.label ?? entry.deviceId,
                  cardName(device, entry.nicId),
                  unservedText(entry, dhcp)
                )}
              </p>
            );
          })}
          {rivals.map((group) => (
            <p key={group.map((pool) => `${pool.deviceId}|${pool.interfaceKey}`).join(' ')} role="alert">
              {words.warnings.rivals(group.map(serverLabel))}
            </p>
          ))}
        </section>
      )}

      <p className="text-[var(--text-color-light)]">{words.notSimulated}</p>
    </div>
  );
};

export default DhcpPanel;
