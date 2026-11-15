import React from 'react';
import { ChevronDown, ChevronRight, Link2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import NicEditor, { type CardLease } from '@/components/ui/NicEditor';
import { useT } from '@/i18n';
import type { NetworkInterfaceCard } from '@/types/network';

interface NicRowsProps {
  /** The cards as they are in the form of the window */
  nics: NetworkInterfaceCard[];
  /** The card whose settings are open; null when none is */
  openNicId: string | null;
  onOpen: (nicId: string | null) => void;
  onChange: (nicId: string, patch: Partial<NetworkInterfaceCard>) => void;
  onAdd: () => void;
  onRemove: (nicId: string) => void;
  /** NIC id → what it is linked to ("SW-Office (porta 1)"); only linked NICs are present */
  linkedNics?: ReadonlyMap<string, string>;
  /**
   * NIC id → what to show as the address of a card that takes it from DHCP
   * ("192.168.20.100 · DHCP", "DHCP: nessun indirizzo"); the other cards show
   * the address written on them
   */
  leasedAddresses?: ReadonlyMap<string, string>;
  /** What a card gets from DHCP, whether it is on DHCP yet or not */
  leaseOf?: (nicId: string) => CardLease | undefined;
  /** The cards belong to a server: each can hand out addresses to its network */
  canServe?: boolean;
  /** NIC id → what its DHCP server gave out, in words */
  poolStatus?: ReadonlyMap<string, string>;
}

const speedText = (speed: NetworkInterfaceCard['speed']): string =>
  !speed || speed === 'auto' ? 'Auto' : speed.replace('M', ' Mbps').replace('G', ' Gbps');

/**
 * NicRows
 * The network cards of a device, a row each: name, address (the leased one
 * for a card on DHCP), MAC, speed and what it is linked to. The row of the
 * card being set is open, with its settings under it (NicEditor); a device
 * with one card shows it open. Cards are added and removed here.
 */
const NicRows: React.FC<NicRowsProps> = ({
  nics,
  openNicId,
  onOpen,
  onChange,
  onAdd,
  onRemove,
  linkedNics,
  leasedAddresses,
  leaseOf,
  canServe = false,
  poolStatus,
}) => {
  const t = useT();
  // One card: there is nothing to choose, its settings are simply there
  const openId = nics.length === 1 ? nics[0].id : openNicId;

  return (
    <div className="nic-rows flex flex-col gap-2">
      {nics.length === 0 ? (
        <p className="text-sm text-[var(--text-color-light)]">{t.interfaces.cards.none}</p>
      ) : (
        <ul className="flex flex-col">
          {nics.map((nic) => {
            const open = nic.id === openId;
            const linkedTo = linkedNics?.get(nic.id);
            const address = leasedAddresses?.get(nic.id) ?? (nic.ip || t.interfaces.cards.noAddress);
            return (
              <li
                key={nic.id}
                className={`nic-card ${nic.enabled === false ? 'nic-card-disabled' : 'nic-card-enabled'} ${
                  open ? 'nic-card-selected' : ''
                }`}
              >
                <div className="nic-card-header">
                  <button
                    type="button"
                    className="nic-card-title"
                    aria-expanded={open}
                    onClick={() => onOpen(open && nics.length > 1 ? null : nic.id)}
                  >
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className="nic-name">{nic.name}</span>
                    <span className="nic-address">{address}</span>
                    <span className="nic-meta">{nic.mac ? `MAC ${nic.mac}` : t.interfaces.cards.noMac}</span>
                    <span className="nic-meta">{speedText(nic.speed)}</span>
                    {linkedTo && (
                      <span
                        className="nic-link"
                        title={t.interfaces.link.linkedToPeer(linkedTo)}
                        data-testid={`nic-link-marker-${nic.id}`}
                      >
                        <Link2 size={12} />
                        {linkedTo}
                      </span>
                    )}
                    {nic.enabled === false && (
                      <span className="nic-status-badge disabled">{t.interfaces.cards.disabled}</span>
                    )}
                  </button>
                  {nics.length > 1 && (
                    <button
                      type="button"
                      className="nic-remove-button"
                      title={t.interfaces.cards.remove}
                      aria-label={t.interfaces.cards.removeNamed(nic.name)}
                      onClick={() => onRemove(nic.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {open && (
                  <div className="nic-card-body">
                    <NicEditor
                      nic={nic}
                      onChange={(patch) => onChange(nic.id, patch)}
                      lease={leaseOf?.(nic.id)}
                      canServe={canServe}
                      poolStatus={poolStatus?.get(nic.id)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div>
        <Button variant="secondary" size="sm" onClick={onAdd}>
          <Plus size={14} />
          {t.interfaces.cards.add}
        </Button>
      </div>
    </div>
  );
};

export default NicRows;
