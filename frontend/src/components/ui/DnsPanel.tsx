import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { recordProblem } from '@/utils/networkConfigValidation';
import { useT } from '@/i18n';
import { Rich } from '@/i18n/Rich';
import type { DnsRecord } from '@/types';

interface DnsPanelProps {
  records: DnsRecord[];
  onChange: (records: DnsRecord[]) => void;
  /** The addresses of the server as in the form: what the other devices write to ask it */
  addresses: string[];
}

/** Lowest `record-N` id not in use */
function nextRecordId(records: DnsRecord[]): string {
  let n = 1;
  while (records.some((record) => record.id === `record-${n}`)) n++;
  return `record-${n}`;
}

const cell =
  'w-full px-2 py-1 text-sm bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded ' +
  'text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]';
const iconButton =
  'p-1 rounded hover:bg-[var(--bg-canvas)] text-[var(--text-color-light)] hover:text-[var(--danger-color)]';

/**
 * DnsPanel
 * What a server answers as a DNS server: the names it knows, each with the
 * address it stands for. A row is checked as it is typed; which devices ask
 * this server is written on their own cards, not here.
 */
const DnsPanel: React.FC<DnsPanelProps> = ({ records, onChange, addresses }) => {
  const t = useT();
  const words = t.dns;
  const update = (id: string, patch: Partial<DnsRecord>) => {
    onChange(records.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  };
  const code = (text: string) => <code className="font-mono">{text}</code>;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-[var(--text-color-light)]">
        <Rich text={words.intro} code={code} />
      </p>

      <section aria-label={words.records.label}>
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">{words.records.title}</h4>
        {records.length === 0 ? (
          <p className="text-[var(--text-color-light)] mb-2">{words.records.none}</p>
        ) : (
          <table className="w-full border-collapse mb-2">
            <thead>
              <tr className="text-left text-xs text-[var(--text-color-light)]">
                <th scope="col" className="font-medium pb-1 pr-2 w-6">
                  {words.records.number}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {words.records.name}
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  {words.records.address}
                </th>
                <th scope="col" className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => {
                const n = index + 1;
                const problem = recordProblem(record, records);
                return (
                  <React.Fragment key={record.id}>
                    <tr>
                      <td className="pr-2 py-1 font-mono text-xs text-[var(--text-color-light)]">
                        {n}
                      </td>
                      <td className="pr-2 py-1">
                        <input
                          aria-label={words.records.nameOf(n)}
                          className={`${cell} font-mono`}
                          placeholder="www.azienda.example"
                          value={record.name}
                          onChange={(e) => update(record.id, { name: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1 w-[32%]">
                        <input
                          aria-label={words.records.addressOf(n)}
                          className={`${cell} font-mono`}
                          placeholder="192.168.30.30"
                          value={record.address}
                          onChange={(e) => update(record.id, { address: e.target.value })}
                        />
                      </td>
                      <td className="py-1 whitespace-nowrap text-right w-[32px]">
                        <button
                          type="button"
                          aria-label={words.records.deleteRow(n)}
                          title={words.records.delete}
                          className={iconButton}
                          onClick={() => onChange(records.filter((entry) => entry.id !== record.id))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    {problem && (
                      <tr>
                        <td />
                        <td colSpan={3} className="pb-1 text-xs text-[var(--danger-color)]" role="alert">
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
          onClick={() => onChange([...records, { id: nextRecordId(records), name: '', address: '' }])}
        >
          <Plus size={14} />
          {words.records.add}
        </Button>
      </section>

      <section aria-label={words.asking.label} className="text-[var(--text-color-light)]">
        <p>
          {words.asking.how}{' '}
          {addresses.length > 0 ? (
            <Rich text={words.asking.address} parts={{ address: () => code(addresses.join(', ')) }} />
          ) : (
            <span className="text-[var(--danger-color)]" role="alert">
              {words.asking.noAddress}
            </span>
          )}
        </p>
        <p className="mt-2">{words.asking.limits}</p>
      </section>
    </div>
  );
};

export default DnsPanel;
