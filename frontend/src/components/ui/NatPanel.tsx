import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { forwardProblemText } from '@/utils/networkConfigValidation';
import { isValidIP } from '@/utils/ipHelpers';
import { useT, type Dictionary } from '@/i18n';
import { Rich } from '@/i18n/Rich';
import type { Port, PortForward } from '@/types';

interface NatPanelProps {
  /** The ports of the device as in the form: which do NAT, which have an address */
  ports: Port[];
  forwards: PortForward[];
  /** A firewall also needs a rule for what a forward lets in */
  isFirewall: boolean;
  onChange: (forwards: PortForward[]) => void;
  /** NAT is switched on and off here, port by port: the ports as they become */
  onPortsChange: (ports: Port[]) => void;
  /** Go to the “Ports” tab, on a port when one is given: an address is typed there */
  onOpenPort: (portId?: number) => void;
}

/** Lowest `forward-N` id not in use */
function nextForwardId(forwards: PortForward[]): string {
  let n = 1;
  while (forwards.some((forward) => forward.id === `forward-${n}`)) n++;
  return `forward-${n}`;
}

/** `Port 3 “Internet”` */
function portName(port: Port, t: Dictionary): string {
  const { interfaces } = t.common;
  return port.name ? interfaces.portNamed(port.id, port.name) : interfaces.port(port.id);
}

const hasAddress = (port: Port): boolean => Boolean(port.ip && isValidIP(port.ip));

const cell =
  'w-full px-2 py-1 text-sm bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded ' +
  'text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]';
const iconButton =
  'p-1 rounded hover:bg-[var(--bg-canvas)] text-[var(--text-color-light)] ' +
  'disabled:opacity-30 disabled:cursor-not-allowed';
const link = 'text-[var(--accent-text)] underline cursor-pointer';

/**
 * NatPanel
 * Address translation of a router or a firewall: which ports give their
 * address to what leaves by them (a tick for each port that has an address:
 * the same setting as the NAT tick of the port in the “Ports” tab), and what
 * is published from a port to an address inside. The forwards are ordered:
 * the first that matches is taken, so each row can be moved up and down.
 */
const NatPanel: React.FC<NatPanelProps> = ({
  ports,
  forwards,
  isFirewall,
  onChange,
  onPortsChange,
  onOpenPort,
}) => {
  const t = useT();
  const update = (id: string, patch: Partial<PortForward>) => {
    onChange(forwards.map((forward) => (forward.id === id ? { ...forward, ...patch } : forward)));
  };
  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= forwards.length) return;
    const next = [...forwards];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const setNat = (id: number, nat: boolean) => {
    onPortsChange(ports.map((port) => (port.id === id ? { ...port, nat } : port)));
  };

  const natPorts = ports.filter((port) => port.nat);
  // A forward publishes the address of a port: only a port that has one can
  const publishing = ports.filter(hasAddress);
  const firstPort = (natPorts.find(hasAddress) ?? publishing[0])?.id;
  // NAT gives the address of the port: the ports that have one are listed,
  // and one that has NAT on without an address, so that it can be put right
  const listed = ports.filter((port) => hasAddress(port) || port.nat);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-[var(--text-color-light)]">{t.nat.intro}</p>

      <section aria-label={t.nat.ports.title}>
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">{t.nat.ports.title}</h4>
        {listed.length === 0 ? (
          <p className="text-[var(--text-color-light)]">
            {t.nat.ports.noAddressedPort}{' '}
            <button type="button" className={link} onClick={() => onOpenPort()}>
              {t.nat.ports.goToPorts}
            </button>
          </p>
        ) : (
          <>
            {natPorts.length === 0 && (
              <p className="text-[var(--text-color-light)] mb-1">{t.nat.ports.noneDoesNat}</p>
            )}
            <ul className="flex flex-col gap-1">
              {listed.map((port) => {
                // The name of the port is the label of its tick, wherever the sentence puts it
                const name = () => (
                  <label htmlFor={`nat-port-${port.id}`} className="cursor-pointer">
                    {portName(port, t)}
                  </label>
                );
                const address = () => <code className="font-mono">{port.ip}</code>;
                return (
                  <li key={port.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`nat-port-${port.id}`}
                      aria-label={t.nat.ports.natOn(port.id)}
                      className="w-4 h-4 shrink-0 cursor-pointer"
                      checked={Boolean(port.nat)}
                      onChange={(e) => setNat(port.id, e.target.checked)}
                    />
                    <span className={port.nat ? '' : 'text-[var(--text-color-light)]'}>
                      {!port.nat && (
                        <>
                          {name()} ({address()})
                        </>
                      )}
                      {port.nat && hasAddress(port) && (
                        <Rich text={t.nat.ports.translates} parts={{ port: name, address }} />
                      )}
                      {port.nat && !hasAddress(port) && (
                        <>
                          <Rich
                            text={t.nat.ports.withoutAddress}
                            parts={{
                              port: name,
                              problem: (words) => (
                                <span className="text-[var(--danger-color)]" role="alert">
                                  {words}
                                </span>
                              ),
                            }}
                          />{' '}
                          <button type="button" className={link} onClick={() => onOpenPort(port.id)}>
                            {t.nat.ports.giveAddress}
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {listed.length < ports.length && (
              <p className="text-xs text-[var(--text-color-light)] mt-2">
                <Rich
                  text={t.nat.ports.onlyAddressed}
                  parts={{
                    link: (words) => (
                      <button type="button" className={link} onClick={() => onOpenPort()}>
                        {words}
                      </button>
                    ),
                  }}
                />
              </p>
            )}
          </>
        )}
      </section>

      <section aria-label={t.nat.forwards.label}>
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">
          {t.nat.forwards.title}
        </h4>
        {forwards.length === 0 ? (
          <p className="text-[var(--text-color-light)] mb-2">{t.nat.forwards.none}</p>
        ) : (
          <table className="w-full border-collapse mb-2">
            <thead>
              <tr className="text-left text-xs text-[var(--text-color-light)]">
                <th scope="col" className="font-medium pb-1 pr-2 w-6">
                  {t.nat.forwards.columns.number}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.nat.forwards.columns.service}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.nat.forwards.columns.arrivesOn}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.nat.forwards.columns.goesTo}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.nat.forwards.columns.enabled}
                </th>
                <th scope="col" className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {forwards.map((forward, index) => {
                const n = index + 1;
                const problem = forwardProblemText(forward, ports);
                const known = publishing.some((port) => port.id === forward.port);
                return (
                  <React.Fragment key={forward.id}>
                    <tr className={forward.enabled === false ? 'opacity-60' : ''}>
                      <td className="pr-2 py-1 font-mono text-xs text-[var(--text-color-light)]">
                        {n}
                      </td>
                      <td className="pr-2 py-1 w-[18%]">
                        <select
                          aria-label={t.nat.forwards.serviceOf(n)}
                          className={cell}
                          value={forward.service}
                          onChange={(e) =>
                            update(forward.id, { service: e.target.value as PortForward['service'] })
                          }
                        >
                          <option value="web">{t.common.services.web}</option>
                          <option value="email">{t.common.services.email}</option>
                          <option value="dns">{t.common.services.dns}</option>
                          <option value="ping">{t.common.services.ping}</option>
                          <option value="any">{t.common.services.any}</option>
                        </select>
                      </td>
                      <td className="pr-2 py-1">
                        <select
                          aria-label={t.nat.forwards.portOf(n)}
                          className={cell}
                          value={forward.port}
                          onChange={(e) => update(forward.id, { port: Number(e.target.value) })}
                        >
                          {!known && (
                            <option value={forward.port}>
                              {t.nat.forwards.portWithoutAddress(forward.port)}
                            </option>
                          )}
                          {publishing.map((port) => (
                            <option key={port.id} value={port.id}>
                              {portName(port, t)} ({port.ip})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="pr-2 py-1 w-[24%]">
                        <input
                          aria-label={t.nat.forwards.insideAddressOf(n)}
                          className={`${cell} font-mono`}
                          placeholder="172.16.0.10"
                          value={forward.to}
                          onChange={(e) => update(forward.id, { to: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1 text-center w-12">
                        <input
                          type="checkbox"
                          aria-label={t.nat.forwards.enabledOf(n)}
                          className="w-4 h-4 cursor-pointer"
                          checked={forward.enabled !== false}
                          onChange={(e) =>
                            update(forward.id, { enabled: e.target.checked ? undefined : false })
                          }
                        />
                      </td>
                      <td className="py-1 whitespace-nowrap text-right w-[84px]">
                        <button
                          type="button"
                          aria-label={t.nat.forwards.moveUpNumbered(n)}
                          title={t.nat.forwards.moveUp}
                          className={iconButton}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={t.nat.forwards.moveDownNumbered(n)}
                          title={t.nat.forwards.moveDown}
                          className={iconButton}
                          disabled={index === forwards.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={t.nat.forwards.deleteNumbered(n)}
                          title={t.nat.forwards.delete}
                          className={`${iconButton} hover:text-[var(--danger-color)]`}
                          onClick={() => onChange(forwards.filter((entry) => entry.id !== forward.id))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    {problem && (
                      <tr>
                        <td />
                        <td colSpan={5} className="pb-1 text-xs text-[var(--danger-color)]" role="alert">
                          {problem}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={firstPort === undefined}
          onClick={() =>
            firstPort !== undefined &&
            onChange([
              ...forwards,
              { id: nextForwardId(forwards), service: 'web', port: firstPort, to: '' },
            ])
          }
        >
          <Plus size={14} />
          {t.nat.forwards.add}
        </Button>
        {firstPort === undefined && (
          <p className="text-xs text-[var(--text-color-light)] mt-1">
            {t.nat.forwards.nothingToPublish}
          </p>
        )}
      </section>

      <section aria-label={t.nat.reading.title} className="text-[var(--text-color-light)]">
        <p>{t.nat.reading.text}</p>
        {isFirewall && <p className="mt-2">{t.nat.reading.onFirewall}</p>}
      </section>
    </div>
  );
};

export default NatPanel;
