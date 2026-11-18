import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ruleProblem } from '@/utils/networkConfigValidation';
import { useT } from '@/i18n';
import { Rich } from '@/i18n/Rich';
import type { FirewallRule, Port } from '@/types';

interface FirewallRulesPanelProps {
  rules: FirewallRule[];
  /** The ports of the firewall as in the form, to tell which zones are in use */
  ports: Port[];
  onChange: (rules: FirewallRule[]) => void;
  /**
   * The rules of a router: its access list. A router has no zones, so they
   * are not offered, and what no rule matches passes
   */
  router?: boolean;
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
 * The ordered rules of a firewall, or of a router. The order is the policy:
 * the first rule that matches decides, so each row can be moved up and down.
 */
const FirewallRulesPanel: React.FC<FirewallRulesPanelProps> = ({
  rules,
  ports,
  onChange,
  router = false,
}) => {
  const t = useT();
  // (a router reads its rules the same way, without zones: some words change)
  const texts = router ? t.firewall.router : t.firewall;
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
        <Rich
          text={texts.intro}
          code={(words) => <code className="font-mono">{words}</code>}
        />
      </p>

      <section aria-label={texts.title}>
        {rules.length === 0 ? (
          <p className="text-[var(--text-color-light)] mb-2">{texts.none}</p>
        ) : (
          <table className="w-full border-collapse mb-2">
            <thead>
              <tr className="text-left text-xs text-[var(--text-color-light)]">
                <th scope="col" className="font-medium pb-1 pr-2 w-6">
                  {t.firewall.columns.number}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.firewall.columns.action}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.firewall.columns.service}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.firewall.columns.from}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.firewall.columns.to}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {t.firewall.columns.enabled}
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
                          aria-label={t.firewall.actionOf(n)}
                          className={cell}
                          value={rule.action}
                          onChange={(e) =>
                            update(rule.id, { action: e.target.value as FirewallRule['action'] })
                          }
                        >
                          <option value="allow">{t.firewall.actions.allow}</option>
                          <option value="deny">{t.firewall.actions.deny}</option>
                        </select>
                      </td>
                      <td className="pr-2 py-1 w-[16%]">
                        <select
                          aria-label={t.firewall.serviceOf(n)}
                          className={cell}
                          value={rule.service}
                          onChange={(e) =>
                            update(rule.id, { service: e.target.value as FirewallRule['service'] })
                          }
                        >
                          <option value="any">{t.common.services.any}</option>
                          <option value="ping">{t.common.services.ping}</option>
                          <option value="web">{t.common.services.web}</option>
                          <option value="email">{t.common.services.email}</option>
                          <option value="dns">{t.common.services.dns}</option>
                        </select>
                      </td>
                      <td className="pr-2 py-1">
                        <input
                          aria-label={t.firewall.sourceOf(n)}
                          className={`${cell} font-mono`}
                          list="firewall-rule-endpoints"
                          placeholder="any"
                          value={rule.source}
                          onChange={(e) => update(rule.id, { source: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1">
                        <input
                          aria-label={t.firewall.destinationOf(n)}
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
                          aria-label={t.firewall.enabledOf(n)}
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
                          aria-label={t.firewall.moveUpNumbered(n)}
                          title={t.firewall.moveUp}
                          className={iconButton}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={t.firewall.moveDownNumbered(n)}
                          title={t.firewall.moveDown}
                          className={iconButton}
                          disabled={index === rules.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={t.firewall.deleteNumbered(n)}
                          title={t.firewall.delete}
                          className={`${iconButton} hover:text-[var(--danger-color)]`}
                          onClick={() => onChange(rules.filter((entry) => entry.id !== rule.id))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    {problem && (
                      <tr>
                        <td />
                        <td colSpan={6} className="pb-1 text-xs text-[var(--danger-color)]" role="alert">
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
          {!router && ZONES.map((zone) => <option key={zone} value={zone} />)}
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
          {t.firewall.add}
        </Button>
      </section>

      {unusedZones.length > 0 && (
        <div className="modal-info-box" role="note">
          {router ? t.firewall.router.zonesNeverMatch(unusedZones) : t.firewall.unusedZones(unusedZones)}
        </div>
      )}

      <section aria-label={t.firewall.noMatch.title} className="text-[var(--text-color-light)]">
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">
          {t.firewall.noMatch.title}
        </h4>
        <p>{router ? t.firewall.router.noMatch : t.firewall.noMatch.text}</p>
      </section>
    </div>
  );
};

export default FirewallRulesPanel;
