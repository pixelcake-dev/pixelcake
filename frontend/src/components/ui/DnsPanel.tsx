import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { recordProblem } from '@/utils/networkConfigValidation';
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
  'p-1 rounded hover:bg-[var(--bg-canvas)] text-[var(--text-color-light)] hover:text-red-500';

/**
 * DnsPanel
 * What a server answers as a DNS server: the names it knows, each with the
 * address it stands for. A row is checked as it is typed; which devices ask
 * this server is written on their own cards, not here.
 */
const DnsPanel: React.FC<DnsPanelProps> = ({ records, onChange, addresses }) => {
  const update = (id: string, patch: Partial<DnsRecord>) => {
    onChange(records.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-[var(--text-color-light)]">
        Un server DNS dice a quale indirizzo corrisponde un nome. Risponde soltanto per i nomi
        scritti qui sotto. Un nome si usa nel terminale al posto di un indirizzo, per esempio{' '}
        <code className="font-mono">ping www.azienda.example from PC-1</code>: prima parte la
        domanda al server DNS, che attraversa la rete come ogni altro scambio e può fermarsi
        allo stesso modo, poi il ping va all&apos;indirizzo ricevuto.
      </p>

      <section aria-label="Record DNS">
        <h4 className="text-sm font-semibold text-[var(--text-color)] mb-1">Nomi conosciuti</h4>
        {records.length === 0 ? (
          <p className="text-[var(--text-color-light)] mb-2">
            Nessun nome: finché non ne ha almeno uno, questo dispositivo non risponde come server
            DNS.
          </p>
        ) : (
          <table className="w-full border-collapse mb-2">
            <thead>
              <tr className="text-left text-xs text-[var(--text-color-light)]">
                <th scope="col" className="font-medium pb-1 pr-2 w-6">
                  N.
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Nome
                </th>
                <th scope="col" className="font-medium pb-1 pr-2">
                  Indirizzo
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
                          aria-label={`Nome del record ${n}`}
                          className={`${cell} font-mono`}
                          placeholder="www.azienda.example"
                          value={record.name}
                          onChange={(e) => update(record.id, { name: e.target.value })}
                        />
                      </td>
                      <td className="pr-2 py-1 w-[32%]">
                        <input
                          aria-label={`Indirizzo del record ${n}`}
                          className={`${cell} font-mono`}
                          placeholder="192.168.30.30"
                          value={record.address}
                          onChange={(e) => update(record.id, { address: e.target.value })}
                        />
                      </td>
                      <td className="py-1 whitespace-nowrap text-right w-[32px]">
                        <button
                          type="button"
                          aria-label={`Elimina il record ${n}`}
                          title="Elimina il record"
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
                        <td colSpan={3} className="pb-1 text-xs text-red-500" role="alert">
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
          Aggiungi record
        </Button>
      </section>

      <section aria-label="Chi chiede a questo server" className="text-[var(--text-color-light)]">
        <p>
          A chi chiedere lo decide ogni dispositivo, sulla propria scheda di rete: il campo «Server
          DNS» con l&apos;indirizzo scritto a mano, oppure «Server DNS consegnato» nel server DHCP
          che gli dà l&apos;indirizzo.{' '}
          {addresses.length > 0 ? (
            <>
              L&apos;indirizzo di questo server è{' '}
              <code className="font-mono">{addresses.join(', ')}</code>.
            </>
          ) : (
            <span className="text-red-500" role="alert">
              Questo server non ha un indirizzo: nessuno può chiedergli nulla.
            </span>
          )}
        </p>
        <p className="mt-2">
          Maiuscole e minuscole nei nomi non contano, e un nome ha un solo indirizzo. Non sono
          simulati: un secondo server DNS di riserva, l&apos;inoltro della domanda ad altri server
          (il server risponde solo per i propri nomi), la memoria delle risposte e le scadenze, la
          ricerca inversa, gli alias e i nomi jolly. La simulazione e la presentazione scelgono i
          dispositivi dai menu e non usano i nomi.
        </p>
      </section>
    </div>
  );
};

export default DnsPanel;
