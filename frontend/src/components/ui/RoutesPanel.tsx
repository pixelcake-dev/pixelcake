import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatNetwork, hasInterfaceAddresses, isBackupRoute, routingTable } from '@/engine';
import type { RouteEntry } from '@/engine';
import { routeProblem } from '@/utils/networkConfigValidation';
import type { NetworkDevice, StaticRoute } from '@/types';

interface RoutesPanelProps {
  /** The device as it would be saved now: ports, gateway and routes from the form */
  device: NetworkDevice;
  routes: StaticRoute[];
  onChange: (routes: StaticRoute[]) => void;
}

/** Lowest `route-N` id not in use */
function nextRouteId(routes: StaticRoute[]): string {
  let n = 1;
  while (routes.some((route) => route.id === `route-${n}`)) n++;
  return `route-${n}`;
}



/** `porta 2` / `eth0`: the interface a route leaves from, as the rest of the interface names it */
function interfaceName(entry: RouteEntry): string {
  const iface = entry.out?.iface;
  if (!iface) return '—';
  return iface.kind === 'port' ? `porta ${iface.port.id}` : iface.label;
}

const KIND_LABELS: Record<RouteEntry['kind'], string> = {
  connected: 'collegata',
  static: 'statica',
  default: 'predefinita',
};

const cellInput =
  'w-full px-2 py-1 text-sm font-mono bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded ' +
  'text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]';

/**
 * RoutesPanel
 * The static routes of a router or firewall, with the routing table the
 * engine derives from the whole form (addressed ports, routes, gateway), so
 * the user sees at once which entry a destination would take and whether a
 * next hop can be reached.
 */
const RoutesPanel: React.FC<RoutesPanelProps> = ({ device, routes, onChange }) => {
  const table = routingTable(device);
  const addressed = hasInterfaceAddresses(device);

  const update = (id: string, patch: Partial<StaticRoute>) => {
    onChange(routes.map((route) => (route.id === id ? { ...route, ...patch } : route)));
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      <p className="text-[var(--text-color-light)]">
        Le reti a cui il dispositivo è collegato con una porta si raggiungono da sole. Qui si
        scrivono le reti che stanno dietro un altro router: il traffico per quella rete viene
        consegnato al prossimo salto. Il gateway della scheda «Generale» è la rotta predefinita, usata
        quando nessun&apos;altra corrisponde.
      </p>
      <p className="text-[var(--text-color-light)] -mt-3">
        Due rotte per la stessa rete: vale la prima. La seconda è di riserva e subentra quando la
        porta da cui esce la prima è spenta, o quando la sua linea è guasta (lo puoi simulare in
        modalità presentazione).
      </p>

      {!addressed && (
        <div className="modal-info-box" role="note">
          Nessuna porta di questo dispositivo ha un indirizzo: lascia passare il traffico senza
          instradarlo, e le rotte non vengono usate. Assegna un indirizzo alle porte nella scheda
          «Porte».
        </div>
      )}

      {/* Static routes */}
      <section aria-label="Rotte statiche">
        <h4 className="text-sm font-semibold mb-2">Rotte statiche</h4>
        {routes.length === 0 ? (
          <p className="text-[var(--text-color-light)] mb-2">Nessuna rotta statica.</p>
        ) : (
          <table className="w-full border-collapse mb-2">
            <thead>
              <tr className="text-left text-xs text-[var(--text-color-light)]">
                <th scope="col" className="font-medium pb-1 pr-2">
                  Rete di destinazione
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Prossimo salto
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Nota
                </th>
                <th scope="col" className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {routes.map((route, index) => {
                const problem = routeProblem(route);
                return (
                  <React.Fragment key={route.id}>
                    <tr>
                      <td className="pr-2 py-1 w-[34%]">
                        <input
                          aria-label={`Rete di destinazione della rotta ${index + 1}`}
                          className={cellInput}
                          placeholder="192.168.30.0/24"
                          value={route.destination}
                          onChange={(e) => update(route.id, { destination: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1 w-[26%]">
                        <input
                          aria-label={`Prossimo salto della rotta ${index + 1}`}
                          className={cellInput}
                          placeholder="10.0.0.2"
                          value={route.nextHop}
                          onChange={(e) => update(route.id, { nextHop: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1">
                        <input
                          aria-label={`Nota della rotta ${index + 1}`}
                          className={cellInput.replace('font-mono ', '')}
                          placeholder="es. sede di Milano"
                          value={route.description ?? ''}
                          onChange={(e) =>
                            update(route.id, { description: e.target.value || undefined })
                          }
                        />
                      </td>
                      <td className="py-1 w-8 text-right">
                        <button
                          type="button"
                          aria-label={`Elimina la rotta ${index + 1}`}
                          title="Elimina la rotta"
                          className="p-1 rounded hover:bg-[var(--bg-canvas)] text-[var(--text-color-light)] hover:text-red-500"
                          onClick={() => onChange(routes.filter((entry) => entry.id !== route.id))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    {problem && (
                      <tr>
                        <td colSpan={4} className="pb-1 text-xs text-red-500" role="alert">
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
          onClick={() =>
            onChange([...routes, { id: nextRouteId(routes), destination: '', nextHop: '' }])
          }
        >
          <Plus size={14} />
          Aggiungi rotta
        </Button>
      </section>

      {/* The table the engine reads */}
      <section aria-label="Tabella di instradamento">
        <h4 className="text-sm font-semibold mb-1">Tabella di instradamento</h4>
        <p className="text-xs text-[var(--text-color-light)] mb-2">
          È quella che il motore usa, con le modifiche di questa finestra non ancora salvate. Vince
          la riga più specifica.
        </p>
        {table.length === 0 ? (
          <p className="text-[var(--text-color-light)]">
            Nessuna riga: il dispositivo non ha indirizzi.
          </p>
        ) : (
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="text-left border-b border-[var(--border-color)] font-sans text-[var(--text-color-light)]">
                <th scope="col" className="font-medium py-1 pr-3">
                  Destinazione
                </th>
                <th scope="col" className="font-medium py-1 pr-3">
                  Prossimo salto
                </th>
                <th scope="col" className="font-medium py-1 pr-3">
                  Esce da
                </th>
                <th scope="col" className="font-medium py-1">
                  Tipo
                </th>
              </tr>
            </thead>
            <tbody>
              {table.map((entry, index) => {
                const unreachable = entry.out === undefined;
                const down = entry.out !== undefined && !entry.out.enabled;
                return (
                  <tr
                    key={`${formatNetwork(entry.network)}-${entry.kind}-${index}`}
                    className={`border-b border-[var(--border-color)] ${
                      unreachable ? 'text-red-500' : down ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="py-1 pr-3">{formatNetwork(entry.network)}</td>
                    <td className="py-1 pr-3">{entry.nextHop ?? '—'}</td>
                    <td className="py-1 pr-3">{unreachable ? '?' : interfaceName(entry)}</td>
                    <td className="py-1 font-sans">
                      {KIND_LABELS[entry.kind]}
                      {entry.kind === 'default' && !entry.route ? ' (gateway)' : ''}
                      {isBackupRoute(table, index) && ', di riserva'}
                      {unreachable && ': il prossimo salto non è su nessuna rete del dispositivo'}
                      {down && ' (interfaccia spenta)'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default RoutesPanel;
