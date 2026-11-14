import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatNetwork, hasInterfaceAddresses, isBackupRoute, routingTable } from '@/engine';
import type { RouteEntry } from '@/engine';
import { routeProblem } from '@/utils/networkConfigValidation';
import { useT, type Dictionary } from '@/i18n';
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



/** `port 2` / `eth0`: the interface a route leaves from, as the rest of the interface names it */
function interfaceName(entry: RouteEntry, t: Dictionary): string {
  const iface = entry.out?.iface;
  if (!iface) return '—';
  return iface.kind === 'port' ? t.common.interfaces.portInSentence(iface.port.id) : iface.label;
}

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
  const t = useT();
  const table = routingTable(device);
  const addressed = hasInterfaceAddresses(device);

  const update = (id: string, patch: Partial<StaticRoute>) => {
    onChange(routes.map((route) => (route.id === id ? { ...route, ...patch } : route)));
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      <p className="text-[var(--text-color-light)]">{t.routes.intro}</p>
      <p className="text-[var(--text-color-light)] -mt-3">{t.routes.backup}</p>

      {!addressed && (
        <div className="modal-info-box" role="note">
          {t.routes.noAddresses}
        </div>
      )}

      {/* Static routes */}
      <section aria-label={t.routes.staticRoutes.title}>
        <h4 className="text-sm font-semibold mb-2">{t.routes.staticRoutes.title}</h4>
        {routes.length === 0 ? (
          <p className="text-[var(--text-color-light)] mb-2">{t.routes.staticRoutes.none}</p>
        ) : (
          <table className="w-full border-collapse mb-2">
            <thead>
              <tr className="text-left text-xs text-[var(--text-color-light)]">
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.routes.staticRoutes.columns.destination}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.routes.staticRoutes.columns.nextHop}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.routes.staticRoutes.columns.note}
                </th>
                <th scope="col" className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {routes.map((route, index) => {
                const n = index + 1;
                const problem = routeProblem(route);
                return (
                  <React.Fragment key={route.id}>
                    <tr>
                      <td className="pr-2 py-1 w-[34%]">
                        <input
                          aria-label={t.routes.staticRoutes.destinationOf(n)}
                          className={cellInput}
                          placeholder="192.168.30.0/24"
                          value={route.destination}
                          onChange={(e) => update(route.id, { destination: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1 w-[26%]">
                        <input
                          aria-label={t.routes.staticRoutes.nextHopOf(n)}
                          className={cellInput}
                          placeholder="10.0.0.2"
                          value={route.nextHop}
                          onChange={(e) => update(route.id, { nextHop: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1">
                        <input
                          aria-label={t.routes.staticRoutes.noteOf(n)}
                          className={cellInput.replace('font-mono ', '')}
                          placeholder={t.routes.staticRoutes.notePlaceholder}
                          value={route.description ?? ''}
                          onChange={(e) =>
                            update(route.id, { description: e.target.value || undefined })
                          }
                        />
                      </td>
                      <td className="py-1 w-8 text-right">
                        <button
                          type="button"
                          aria-label={t.routes.staticRoutes.deleteNumbered(n)}
                          title={t.routes.staticRoutes.delete}
                          className="p-1 rounded hover:bg-[var(--bg-canvas)] text-[var(--text-color-light)] hover:text-[var(--danger-color)]"
                          onClick={() => onChange(routes.filter((entry) => entry.id !== route.id))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    {problem && (
                      <tr>
                        <td colSpan={4} className="pb-1 text-xs text-[var(--danger-color)]" role="alert">
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
          {t.routes.staticRoutes.add}
        </Button>
      </section>

      {/* The table the engine reads */}
      <section aria-label={t.routes.table.title}>
        <h4 className="text-sm font-semibold mb-1">{t.routes.table.title}</h4>
        <p className="text-xs text-[var(--text-color-light)] mb-2">{t.routes.table.explanation}</p>
        {table.length === 0 ? (
          <p className="text-[var(--text-color-light)]">{t.routes.table.empty}</p>
        ) : (
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="text-left border-b border-[var(--border-color)] font-sans text-[var(--text-color-light)]">
                <th scope="col" className="font-medium py-1 pr-3">
                  {t.routes.table.columns.destination}
                </th>
                <th scope="col" className="font-medium py-1 pr-3">
                  {t.routes.table.columns.nextHop}
                </th>
                <th scope="col" className="font-medium py-1 pr-3">
                  {t.routes.table.columns.leavesBy}
                </th>
                <th scope="col" className="font-medium py-1">
                  {t.routes.table.columns.kind}
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
                      unreachable ? 'text-[var(--danger-color)]' : down ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="py-1 pr-3">{formatNetwork(entry.network)}</td>
                    <td className="py-1 pr-3">{entry.nextHop ?? '—'}</td>
                    <td className="py-1 pr-3">{unreachable ? '?' : interfaceName(entry, t)}</td>
                    <td className="py-1 font-sans">
                      {t.routes.table.kind({
                        kind: entry.kind,
                        fromGateway: entry.kind === 'default' && !entry.route,
                        backup: isBackupRoute(table, index),
                        state: unreachable ? 'unreachable' : down ? 'down' : 'usable',
                      })}
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
