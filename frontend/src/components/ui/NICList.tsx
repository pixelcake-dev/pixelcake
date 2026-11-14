import React from 'react';
import { Icon } from '@iconify/react';
import { Scrollbars } from 'react-custom-scrollbars-2';
import type { NetworkInterfaceCard } from '@/types/network';

interface NICListProps {
  nics: NetworkInterfaceCard[];
  selectedNicId: string | null;
  onNicSelect: (nicId: string) => void;
  onAddNic: () => void;
  onRemoveNic: (nicId: string) => void;
  /** NIC id → what it is linked to ("SW-Office (porta 1)"); only linked NICs are present */
  linkedNics?: ReadonlyMap<string, string>;
  /**
   * NIC id → what to show as the address of a card that takes it from DHCP
   * ("192.168.20.100 · DHCP", "DHCP: nessun indirizzo"); the other cards show
   * the address written on them
   */
  leasedAddresses?: ReadonlyMap<string, string>;
}

/**
 * NICList Component
 * Displays network interface cards as a vertical list with status indicators
 * Shows interface name, IP (the leased one for a card on DHCP), MAC, and
 * status for each NIC, and marks the NICs that have a connection attached
 */
const NICList: React.FC<NICListProps> = ({
  nics,
  selectedNicId,
  onNicSelect,
  onAddNic,
  onRemoveNic,
  linkedNics,
  leasedAddresses,
}) => {
  const getNicStatusColor = (nic: NetworkInterfaceCard): string => {
    if (!nic.enabled) return 'var(--text-color-light)';
    return 'var(--ok-color)';
  };

  const getNicStatusClass = (nic: NetworkInterfaceCard): string => {
    if (!nic.enabled) return 'nic-card-disabled';
    return 'nic-card-enabled';
  };

  return (
    <div className="nic-list-container">
      {/* Header with Add Button */}
      <div className="nic-list-header">
        <h4 className="text-sm font-semibold text-[var(--text-color)]">
          Schede di Rete ({nics.length})
        </h4>
        <button
          onClick={onAddNic}
          className="nic-add-button"
          title="Aggiungi nuova NIC"
        >
          <Icon icon="mdi:plus" width={16} height={16} />
          <span>Aggiungi NIC</span>
        </button>
      </div>

      {/* NIC Cards List */}
      <Scrollbars
        autoHeight
        autoHeightMax={400}
        style={{ width: '100%' }}
        renderView={({ style, ...props }) => (
          <div {...props} style={{
            ...style,
            marginRight: -20,
            marginBottom: -20
          }} />
        )}
        renderThumbVertical={({ style, ...props }) => (
          <div
            {...props}
            style={{
              ...style,
              backgroundColor: 'var(--scroll-thumb)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
            }}
          />
        )}
        renderTrackVertical={({ style, ...props }) => (
          <div
            {...props}
            style={{
              ...style,
              width: '10px',
              right: '-2px',
              bottom: '-2px',
              top: '-2px',
              background: 'linear-gradient(to right, transparent calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% + 1px), transparent calc(50% + 1px))',
            }}
          />
        )}
      >
        <div className="nic-list">
          {nics.map((nic) => (
            <div
              key={nic.id}
              className={`nic-card ${getNicStatusClass(nic)} ${selectedNicId === nic.id ? 'nic-card-selected' : ''}`}
              onClick={() => onNicSelect(nic.id)}
            >
              {/* NIC Header */}
              <div className="nic-card-header">
                <div className="nic-card-title">
                  <Icon
                    icon="mdi:ethernet"
                    width={20}
                    height={20}
                    style={{ color: getNicStatusColor(nic) }}
                  />
                  <span className="nic-name">{nic.name}</span>
                  <span className={`nic-status-badge ${nic.enabled ? 'enabled' : 'disabled'}`}>
                    {nic.enabled ? 'Abilitata' : 'Disabilitata'}
                  </span>
                  {/* Link Marker: a connection is attached to this NIC */}
                  {linkedNics?.has(nic.id) && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-[var(--bg-hover)] text-[var(--text-color-light)]"
                      title={`Collegata a ${linkedNics.get(nic.id)}`}
                      data-testid={`nic-link-marker-${nic.id}`}
                    >
                      <Icon icon="mdi:link-variant" width={12} height={12} />
                      Collegata
                    </span>
                  )}
                </div>

                {/* Remove Button */}
                {nics.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveNic(nic.id);
                    }}
                    className="nic-remove-button"
                    title="Rimuovi NIC"
                  >
                    <Icon icon="mdi:close" width={16} height={16} />
                  </button>
                )}
              </div>

              {/* NIC Details */}
              <div className="nic-card-details">
                <div className="nic-detail-row">
                  <span className="nic-detail-label">IP:</span>
                  <span className="nic-detail-value">{leasedAddresses?.get(nic.id) ?? nic.ip}</span>
                </div>

                <div className="nic-detail-row">
                  <span className="nic-detail-label">MAC:</span>
                  <span className="nic-detail-value">{nic.mac || 'Auto'}</span>
                </div>

                <div className="nic-detail-row">
                  <span className="nic-detail-label">Velocità:</span>
                  <span className="nic-detail-value">
                    {nic.speed === 'auto' ? 'Auto' : nic.speed.replace('M', ' Mbps').replace('G', ' Gbps')}
                  </span>
                </div>

                {linkedNics?.has(nic.id) && (
                  <div className="nic-detail-row">
                    <span className="nic-detail-label">Collegata a:</span>
                    <span className="nic-detail-value">{linkedNics.get(nic.id)}</span>
                  </div>
                )}

                {nic.description && (
                  <div className="nic-detail-row">
                    <span className="nic-detail-label">Note:</span>
                    <span className="nic-detail-value nic-description">{nic.description}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Scrollbars>

      {/* Empty State */}
      {nics.length === 0 && (
        <div className="nic-list-empty">
          <Icon icon="mdi:ethernet-off" width={48} height={48} />
          <p className="text-sm text-[var(--text-color-light)] mt-2">
            Nessuna scheda di rete configurata
          </p>
          <button onClick={onAddNic} className="nic-add-button mt-3">
            <Icon icon="mdi:plus" width={16} height={16} />
            <span>Aggiungi Prima NIC</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default NICList;
