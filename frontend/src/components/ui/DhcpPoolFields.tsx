import React from 'react';
import { Input } from '@/components/ui/Input';
import type { DhcpPool } from '@/types';

interface DhcpPoolFieldsProps {
  /** Prefix of the element ids: `port` or `nic` */
  idPrefix: string;
  /** The interface hands out addresses */
  enabled: boolean;
  /** The range and the gateway as typed */
  pool: DhcpPool;
  onToggle: (enabled: boolean) => void;
  onChange: (pool: DhcpPool) => void;
  /** What the devices get when the gateway field is left empty */
  gatewayHint: string;
  /** What is wrong with the pool as typed, when something is */
  error?: string | null;
}

/**
 * DhcpPoolFields
 * The DHCP server of one interface (a router or firewall port, a card of a
 * server): whether it hands out addresses, and which. Shared by the port and
 * the network card panels; each validates and saves on its own.
 */
const DhcpPoolFields: React.FC<DhcpPoolFieldsProps> = ({
  idPrefix,
  enabled,
  pool,
  onToggle,
  onChange,
  gatewayHint,
  error,
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={`${idPrefix}-dhcp-server`}
        checked={enabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--border-color)] cursor-pointer"
      />
      <label htmlFor={`${idPrefix}-dhcp-server`} className="text-sm font-medium cursor-pointer">
        Server DHCP Abilitato (assegna gli indirizzi)
      </label>
    </div>
    <span className="text-xs text-[var(--text-color-light)]">
      I dispositivi di questa rete con la scheda su «Automatico (DHCP)» prendono da qui indirizzo,
      subnet mask e gateway. Gli indirizzi già scritti a mano nel disegno vengono saltati. Chi ha
      preso quale indirizzo si vede nella scheda «DHCP».
    </span>

    {enabled && (
      <>
        <Input
          id={`${idPrefix}-dhcp-start`}
          label="Primo indirizzo"
          type="text"
          placeholder="es. 192.168.10.100"
          value={pool.start}
          onChange={(e) => onChange({ ...pool, start: e.target.value })}
          size="full"
        />
        <Input
          id={`${idPrefix}-dhcp-end`}
          label="Ultimo indirizzo"
          type="text"
          placeholder="es. 192.168.10.199"
          value={pool.end}
          onChange={(e) => onChange({ ...pool, end: e.target.value })}
          size="full"
        />
        <Input
          id={`${idPrefix}-dhcp-gateway`}
          label="Gateway consegnato (opzionale)"
          type="text"
          placeholder="es. 192.168.10.1"
          value={pool.gateway ?? ''}
          onChange={(e) => onChange({ ...pool, gateway: e.target.value })}
          size="full"
        />
        <span className="text-xs text-[var(--text-color-light)]">{gatewayHint}</span>
      </>
    )}
    {error && (
      <div className="modal-error-box" role="alert">
        {error}
      </div>
    )}
  </div>
);

export default DhcpPoolFields;
