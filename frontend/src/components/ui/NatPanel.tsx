import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { forwardProblemText } from '@/utils/networkConfigValidation';
import { isValidIP } from '@/utils/ipHelpers';
import type { Port, PortForward } from '@/types';

interface NatPanelProps {
  /** The ports of the device as in the form: which do NAT, which have an address */
  ports: Port[];
  forwards: PortForward[];
  /** A firewall also needs a rule for what a forward lets in */
  isFirewall: boolean;
  onChange: (forwards: PortForward[]) => void;
}

/** Lowest `forward-N` id not in use */
function nextForwardId(forwards: PortForward[]): string {
  let n = 1;
  while (forwards.some((forward) => forward.id === `forward-${n}`)) n++;
  return `forward-${n}`;
}

/** `Porta 3 «Internet»` */
function portName(port: Port): string {
  return port.name ? `Porta ${port.id} «${port.name}»` : `Porta ${port.id}`;
}

const hasAddress = (port: Port): boolean => Boolean(port.ip && isValidIP(port.ip));

const cell =
  'w-full px-2 py-1 text-sm bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded ' +
  'text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]';
const iconButton =
  'p-1 rounded hover:bg-[var(--bg-canvas)] text-[var(--text-color-light)] ' +
  'disabled:opacity-30 disabled:cursor-not-allowed';

/**
 * NatPanel
 * Address translation of a router or a firewall: which ports give their
 * address to what leaves by them (set port by port, shown here), and what is
 * published from a port to an address inside. The forwards are ordered: the
 * first that matches is taken, so each row can be moved up and down.
 */
const NatPanel: React.FC<NatPanelProps> = ({ ports, forwards, isFirewall, onChange }) => {
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

  const natPorts = ports.filter((port) => port.nat);
  // A forward publishes the address of a port: only a port that has one can
  const publishing = ports.filter(hasAddress);
  const firstPort = (natPorts.find(hasAddress) ?? publishing[0])?.id;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-[var(--text-color-light)]">
        Internet non trasporta gli indirizzi privati. Una porta con il NAT attivo dà il proprio
        indirizzo a ciò che esce da lì, e il dispositivo riporta la risposta a chi aveva chiesto.
        Un inoltro fa il contrario: pubblica sull&apos;indirizzo di una porta un servizio che sta
        dentro, perché sia raggiungibile da fuori.
      </p>

      <section aria-label="Porte con NAT">
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">Porte con NAT</h4>
        {natPorts.length === 0 ? (
          <p className="text-[var(--text-color-light)]">
            Nessuna porta fa NAT. Si attiva porta per porta, nella scheda «Porte».
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {natPorts.map((port) => (
              <li key={port.id}>
                {portName(port)}:{' '}
                {hasAddress(port) ? (
                  <>
                    ciò che esce prende l&apos;indirizzo <code className="font-mono">{port.ip}</code>
                  </>
                ) : (
                  <span className="text-[var(--danger-color)]" role="alert">
                    non ha un indirizzo, quindi non traduce nulla. Dagliene uno nella scheda
                    «Porte».
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Servizi pubblicati">
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">
          Servizi pubblicati (port forward)
        </h4>
        {forwards.length === 0 ? (
          <p className="text-[var(--text-color-light)] mb-2">
            Nessun inoltro: da fuori si raggiunge soltanto il dispositivo stesso.
          </p>
        ) : (
          <table className="w-full border-collapse mb-2">
            <thead>
              <tr className="text-left text-xs text-[var(--text-color-light)]">
                <th scope="col" className="font-medium pb-1 pr-2 w-6">
                  N.
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Servizio
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Arriva sulla porta
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Va all&apos;indirizzo
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Attivo
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
                          aria-label={`Servizio dell'inoltro ${n}`}
                          className={cell}
                          value={forward.service}
                          onChange={(e) =>
                            update(forward.id, { service: e.target.value as PortForward['service'] })
                          }
                        >
                          <option value="web">Web</option>
                          <option value="email">Email</option>
                          <option value="dns">DNS</option>
                          <option value="ping">Ping</option>
                          <option value="any">Qualsiasi</option>
                        </select>
                      </td>
                      <td className="pr-2 py-1">
                        <select
                          aria-label={`Porta dell'inoltro ${n}`}
                          className={cell}
                          value={forward.port}
                          onChange={(e) => update(forward.id, { port: Number(e.target.value) })}
                        >
                          {!known && (
                            <option value={forward.port}>
                              Porta {forward.port} (senza indirizzo)
                            </option>
                          )}
                          {publishing.map((port) => (
                            <option key={port.id} value={port.id}>
                              {portName(port)} ({port.ip})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="pr-2 py-1 w-[24%]">
                        <input
                          aria-label={`Indirizzo interno dell'inoltro ${n}`}
                          className={`${cell} font-mono`}
                          placeholder="172.16.0.10"
                          value={forward.to}
                          onChange={(e) => update(forward.id, { to: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1 text-center w-12">
                        <input
                          type="checkbox"
                          aria-label={`Inoltro ${n} attivo`}
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
                          aria-label={`Sposta in su l'inoltro ${n}`}
                          title="Sposta in su"
                          className={iconButton}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Sposta in giù l'inoltro ${n}`}
                          title="Sposta in giù"
                          className={iconButton}
                          disabled={index === forwards.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Elimina l'inoltro ${n}`}
                          title="Elimina l'inoltro"
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
          Aggiungi inoltro
        </Button>
        {firstPort === undefined && (
          <p className="text-xs text-[var(--text-color-light)] mt-1">
            Nessuna porta ha un indirizzo da pubblicare: dagliene uno nella scheda «Porte».
          </p>
        )}
      </section>

      <section aria-label="Come si leggono gli inoltri" className="text-[var(--text-color-light)]">
        <p>
          Gli inoltri si leggono dall&apos;alto in basso: vale il primo che corrisponde per
          servizio e porta. Chi è fuori chiede all&apos;indirizzo della porta, e la risposta gli
          torna da quell&apos;indirizzo: quello interno non lo vede mai.
        </p>
        {isFirewall && (
          <p className="mt-2">
            Su un firewall l&apos;inoltro dice dove va il traffico, non che può passare: serve
            anche una regola che lo permetta, scritta per l&apos;indirizzo interno (scheda
            «Regole»).
          </p>
        )}
      </section>
    </div>
  );
};

export default NatPanel;
