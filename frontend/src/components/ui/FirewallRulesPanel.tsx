import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ruleProblem } from '@/utils/networkConfigValidation';
import type { FirewallRule, Port } from '@/types';

interface FirewallRulesPanelProps {
  rules: FirewallRule[];
  /** The ports of the firewall as in the form, to tell which zones are in use */
  ports: Port[];
  onChange: (rules: FirewallRule[]) => void;
}

/** Lowest `rule-N` id not in use */
function nextRuleId(rules: FirewallRule[]): string {
  let n = 1;
  while (rules.some((rule) => rule.id === `rule-${n}`)) n++;
  return `rule-${n}`;
}



const ZONES = ['trust', 'untrust', 'dmz'] as const;

const cell =
  'w-full px-2 py-1 text-sm bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded ' +
  'text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]';
const iconButton =
  'p-1 rounded hover:bg-[var(--bg-canvas)] text-[var(--text-color-light)] ' +
  'disabled:opacity-30 disabled:cursor-not-allowed';

/**
 * FirewallRulesPanel
 * The ordered rules of a firewall. The order is the policy: the first rule
 * that matches decides, so each row can be moved up and down.
 */
const FirewallRulesPanel: React.FC<FirewallRulesPanelProps> = ({ rules, ports, onChange }) => {
  const update = (id: string, patch: Partial<FirewallRule>) => {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };
  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  // A rule that names a zone no port is in can never match: worth saying
  const zonesInUse = new Set(ports.map((port) => port.securityZone));
  const unusedZones = ZONES.filter(
    (zone) =>
      !zonesInUse.has(zone) &&
      rules.some(
        (rule) =>
          rule.enabled !== false &&
          (rule.source.trim().toLowerCase() === zone ||
            rule.destination.trim().toLowerCase() === zone)
      )
  );

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-[var(--text-color-light)]">
        Le regole si leggono dall&apos;alto in basso: decide la prima che corrisponde. In «Da» e «A»
        si scrive <code className="font-mono">any</code> (qualsiasi), una zona (
        <code className="font-mono">trust</code>, <code className="font-mono">untrust</code>,{' '}
        <code className="font-mono">dmz</code>), un indirizzo o una rete come{' '}
        <code className="font-mono">192.168.10.0/24</code>.
      </p>

      <section aria-label="Regole del firewall">
        {rules.length === 0 ? (
          <p className="text-[var(--text-color-light)] mb-2">
            Nessuna regola: decide soltanto la politica delle zone, qui sotto.
          </p>
        ) : (
          <table className="w-full border-collapse mb-2">
            <thead>
              <tr className="text-left text-xs text-[var(--text-color-light)]">
                <th scope="col" className="font-medium pb-1 pr-2 w-6">
                  N.
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Azione
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Servizio
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Da
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  A
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Attiva
                </th>
                <th scope="col" className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => {
                const n = index + 1;
                const problem = ruleProblem(rule);
                return (
                  <React.Fragment key={rule.id}>
                    <tr className={rule.enabled === false ? 'opacity-60' : ''}>
                      <td className="pr-2 py-1 font-mono text-xs text-[var(--text-color-light)]">
                        {n}
                      </td>
                      <td className="pr-2 py-1 w-[16%]">
                        <select
                          aria-label={`Azione della regola ${n}`}
                          className={cell}
                          value={rule.action}
                          onChange={(e) =>
                            update(rule.id, { action: e.target.value as FirewallRule['action'] })
                          }
                        >
                          <option value="allow">Permetti</option>
                          <option value="deny">Nega</option>
                        </select>
                      </td>
                      <td className="pr-2 py-1 w-[16%]">
                        <select
                          aria-label={`Servizio della regola ${n}`}
                          className={cell}
                          value={rule.service}
                          onChange={(e) =>
                            update(rule.id, { service: e.target.value as FirewallRule['service'] })
                          }
                        >
                          <option value="any">Qualsiasi</option>
                          <option value="ping">Ping</option>
                          <option value="web">Web</option>
                          <option value="email">Email</option>
                        </select>
                      </td>
                      <td className="pr-2 py-1">
                        <input
                          aria-label={`Origine della regola ${n}`}
                          className={`${cell} font-mono`}
                          list="firewall-rule-endpoints"
                          placeholder="any"
                          value={rule.source}
                          onChange={(e) => update(rule.id, { source: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1">
                        <input
                          aria-label={`Destinazione della regola ${n}`}
                          className={`${cell} font-mono`}
                          list="firewall-rule-endpoints"
                          placeholder="any"
                          value={rule.destination}
                          onChange={(e) => update(rule.id, { destination: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1 text-center w-12">
                        <input
                          type="checkbox"
                          aria-label={`Regola ${n} attiva`}
                          className="w-4 h-4 cursor-pointer"
                          checked={rule.enabled !== false}
                          onChange={(e) =>
                            update(rule.id, { enabled: e.target.checked ? undefined : false })
                          }
                        />
                      </td>
                      <td className="py-1 whitespace-nowrap text-right w-[84px]">
                        <button
                          type="button"
                          aria-label={`Sposta in su la regola ${n}`}
                          title="Sposta in su"
                          className={iconButton}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Sposta in giù la regola ${n}`}
                          title="Sposta in giù"
                          className={iconButton}
                          disabled={index === rules.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Elimina la regola ${n}`}
                          title="Elimina la regola"
                          className={`${iconButton} hover:text-red-500`}
                          onClick={() => onChange(rules.filter((entry) => entry.id !== rule.id))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    {problem && (
                      <tr>
                        <td />
                        <td colSpan={6} className="pb-1 text-xs text-red-500" role="alert">
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
        <datalist id="firewall-rule-endpoints">
          <option value="any" />
          {ZONES.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            onChange([
              ...rules,
              {
                id: nextRuleId(rules),
                action: 'allow',
                service: 'any',
                source: 'any',
                destination: 'any',
              },
            ])
          }
        >
          <Plus size={14} />
          Aggiungi regola
        </Button>
      </section>

      {unusedZones.length > 0 && (
        <div className="modal-info-box" role="note">
          {unusedZones.length === 1
            ? `Nessuna porta è nella zona ${unusedZones[0]}: le regole che la nominano non corrispondono mai.`
            : `Nessuna porta è nelle zone ${unusedZones.join(', ')}: le regole che le nominano non corrispondono mai.`}{' '}
          La zona di una porta si sceglie nella scheda «Porte».
        </div>
      )}

      <section
        aria-label="Quando nessuna regola corrisponde"
        className="text-[var(--text-color-light)]"
      >
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">
          Quando nessuna regola corrisponde
        </h4>
        <p>
          Decide la politica delle zone: il traffico verso una zona più fidata è negato (untrust →
          trust, untrust → dmz, dmz → trust), tutto il resto è permesso. La risposta a un flusso
          permesso passa sempre.
        </p>
      </section>
    </div>
  );
};

export default FirewallRulesPanel;
