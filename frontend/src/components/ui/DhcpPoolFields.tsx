import React, { useState } from 'react';
import { CheckField, FieldRow, TextField } from '@/components/ui/compact';
import { errorClass, hintClass } from '@/components/ui/compactStyles';
import { isBlankPool } from '@/utils/dhcpLabels';
import type { DhcpPool } from '@/types';

interface DhcpPoolFieldsProps {
  /** Prefix of the element ids: `port` or `nic` */
  idPrefix: string;
  /** The pool of the interface as typed; undefined when it hands out nothing */
  pool: DhcpPool | undefined;
  /** The pool as it becomes; undefined switches the server off */
  onChange: (pool: DhcpPool | undefined) => void;
  /** A range to start from when the server is switched on (see suggestedPool in the engine) */
  suggestion?: DhcpPool;
  /** What the devices get when the gateway field is left empty */
  gatewayHint: string;
  /** What is wrong with the pool as typed, when something is */
  error?: string | null;
  /** What the pool gave out, in words: said under the fields when nothing is wrong */
  status?: string;
}

/**
 * DhcpPoolFields
 * The DHCP server of one interface (a router or firewall port, a card of a
 * server), in the panel of that interface: a tick, and the range, the gateway
 * and the DNS server in a row under it. It is the same setting as the tick
 * of the «DHCP» tab of the device. What is typed goes straight to the form
 * of the window, which checks it again when the device is saved.
 */
const DhcpPoolFields: React.FC<DhcpPoolFieldsProps> = ({
  idPrefix,
  pool,
  onChange,
  suggestion,
  gatewayHint,
  error,
  status,
}) => {
  // A range switched off is kept while the panel is open: the tick put back gives it back
  const [parked, setParked] = useState<DhcpPool>();
  const toggle = (on: boolean) => {
    if (on) {
      onChange(parked ?? suggestion ?? { start: '', end: '' });
      return;
    }
    if (pool) setParked(pool);
    onChange(undefined);
  };
  const change = (patch: Partial<DhcpPool>) => {
    if (pool) onChange({ ...pool, ...patch });
  };

  return (
    <div className="flex flex-col gap-2">
      <CheckField
        id={`${idPrefix}-dhcp-server`}
        label="Server DHCP Abilitato"
        checked={pool !== undefined}
        onChange={toggle}
        hint={
          <>
            I dispositivi di questa rete con la scheda su «Automatico (DHCP)» prendono da qui
            indirizzo, subnet mask e gateway; gli indirizzi scritti a mano nel disegno vengono
            saltati. Chi ha preso quale indirizzo si vede nella scheda «DHCP».
          </>
        }
      />
      {pool && (
        <>
          <FieldRow>
            <TextField
              id={`${idPrefix}-dhcp-start`}
              label="Primo indirizzo"
              mono
              placeholder="es. 192.168.10.100"
              value={pool.start}
              onChange={(e) => change({ start: e.target.value })}
            />
            <TextField
              id={`${idPrefix}-dhcp-end`}
              label="Ultimo indirizzo"
              mono
              placeholder="es. 192.168.10.199"
              value={pool.end}
              onChange={(e) => change({ end: e.target.value })}
            />
            <TextField
              id={`${idPrefix}-dhcp-gateway`}
              label="Gateway consegnato (opzionale)"
              mono
              placeholder="es. 192.168.10.1"
              value={pool.gateway ?? ''}
              onChange={(e) => change({ gateway: e.target.value })}
              hint={gatewayHint}
            />
            <TextField
              id={`${idPrefix}-dhcp-dns`}
              label="Server DNS consegnato (opzionale)"
              mono
              placeholder="es. 192.168.30.10"
              value={pool.dns ?? ''}
              onChange={(e) => change({ dns: e.target.value })}
              hint="Vuoto: nessuno. Può stare in un'altra rete."
            />
          </FieldRow>
          {isBlankPool(pool) && (
            <span className={hintClass}>
              Scrivi il primo e l&apos;ultimo indirizzo da assegnare: un intervallo lasciato vuoto
              non viene salvato.
            </span>
          )}
          {error && (
            <span className={errorClass} role="alert">
              {error}
            </span>
          )}
          {!error && status && <span className={hintClass}>{status}</span>}
        </>
      )}
    </div>
  );
};

export default DhcpPoolFields;
