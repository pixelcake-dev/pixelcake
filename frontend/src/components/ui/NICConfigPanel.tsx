import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormContainer } from '@/components/ui/FormContainer';
import DhcpPoolFields from '@/components/ui/DhcpPoolFields';
import { generateMacAddress } from '@/utils/ipHelpers';
import { BLANK_POOL_ERROR, isBlankPool, nicPoolProblemText, tidyPool } from '@/utils/dhcpLabels';
import { dnsServerProblem } from '@/utils/networkConfigValidation';
import type { DhcpPool, NetworkInterfaceCard } from '@/types/network';

/**
 * What the card would have with its address on «Automatico (DHCP)», worked
 * out from the drawing: the lease, or the reason there is none
 */
export interface CardLease {
  /** `192.168.20.100 da Router-Core, porta 2`, or `Nessun indirizzo: …` */
  text: string;
  /**
   * The address, mask and gateway given, and the DNS server when the pool
   * hands one out; absent when the card gets no lease
   */
  given?: { ip: string; subnet: string; gateway: string; dns?: string };
}

interface NICConfigPanelProps {
  nic: NetworkInterfaceCard | null;
  onSave: (nicId: string, updates: Partial<NetworkInterfaceCard>) => void;
  onCancel: () => void;
  /** What the card gets from DHCP (see CardLease); left out, DHCP is offered without a preview */
  lease?: CardLease;
  /** The card belongs to a server: it can hand out addresses to its network */
  canServe?: boolean;
}

/** The pool fields before anything is typed */
const EMPTY_POOL: DhcpPool = { start: '', end: '', gateway: '' };

/**
 * NICConfigPanel Component
 * Detail panel for editing selected NIC configuration
 * Shows all NIC settings: enabled, name, speed, the address (written by hand,
 * or taken from a DHCP server), the DNS server the card asks, MAC, description
 * and, on a server, the DHCP server of the network of the card
 */
const NICConfigPanel: React.FC<NICConfigPanelProps> = ({ nic, onSave, onCancel, lease, canServe = false }) => {
  const [formData, setFormData] = useState<Partial<NetworkInterfaceCard>>({
    enabled: true,
    name: '',
    speed: 'auto',
    ip: '',
    subnet: '',
    gateway: '',
    dns: '',
    mac: '',
    description: '',
    dhcp: false,
  });
  const [dnsError, setDnsError] = useState<string | null>(null);
  // DHCP server of the card (a server): on or off, and what is typed
  const [serves, setServes] = useState(false);
  const [pool, setPool] = useState<DhcpPool>(EMPTY_POOL);
  const [poolError, setPoolError] = useState<string | null>(null);

  // Initialize form data when NIC changes
  useEffect(() => {
    if (nic) {
      setFormData({
        enabled: nic.enabled ?? true,
        name: nic.name || '',
        speed: nic.speed || 'auto',
        ip: nic.ip || '',
        subnet: nic.subnet || '',
        gateway: nic.gateway || '',
        dns: nic.dns || '',
        mac: nic.mac || '',
        description: nic.description || '',
        dhcp: nic.dhcp === true,
      });
      setServes(nic.dhcpServer !== undefined);
      setPool({ ...EMPTY_POOL, ...nic.dhcpServer });
      setPoolError(null);
      setDnsError(null);
    }
  }, [nic]);

  const automatic = formData.dhcp === true;

  /**
   * From DHCP to an address written by hand: the fields start from the
   * address the card had, and from the DNS server that came with it (it
   * keeps them, now as its own). From an address to DHCP nothing is thrown
   * away until the card is saved.
   */
  const handleModeChange = (dhcp: boolean) => {
    if (dhcp || !automatic || formData.ip?.trim() || !lease?.given) {
      setFormData({ ...formData, dhcp });
      return;
    }
    setFormData({ ...formData, dhcp, ...lease.given });
  };

  const handleSave = () => {
    if (!nic) return;

    // The DNS server of a card whose address is written by hand: an address, or nothing
    const dnsProblem = automatic ? undefined : dnsServerProblem(formData.dns ?? '');
    if (dnsProblem) {
      setDnsError(dnsProblem);
      return;
    }

    // Prepare updates. A card on DHCP keeps no address of its own, and no
    // DNS server of its own: both come with the lease
    const updates: Partial<NetworkInterfaceCard> = {
      enabled: formData.enabled,
      name: formData.name?.trim() || 'eth0',
      speed: formData.speed,
      ip: automatic ? '' : formData.ip?.trim() || '',
      subnet: automatic ? '' : formData.subnet?.trim() || '',
      gateway: automatic ? '' : formData.gateway?.trim() || '',
      dns: automatic ? undefined : formData.dns?.trim() || undefined,
      mac: formData.mac?.trim() || undefined,
      description: formData.description?.trim() || undefined,
      dhcp: automatic ? true : undefined,
    };

    // DHCP server (a server's card that has its own address): the range is
    // checked against the address just read
    const serving = canServe && !automatic && serves;
    if (serving) {
      const problem = isBlankPool(pool)
        ? BLANK_POOL_ERROR
        : nicPoolProblemText({ ...nic, ...updates } as NetworkInterfaceCard, pool);
      if (problem) {
        setPoolError(problem);
        return;
      }
    }
    setPoolError(null);
    updates.dhcpServer = serving ? tidyPool(pool) : undefined;

    onSave(nic.id, updates);
  };

  const handleGenerateMac = () => {
    const newMac = generateMacAddress();
    setFormData({ ...formData, mac: newMac });
  };

  if (!nic) {
    return (
      <div className="nic-config-empty">
        <p className="text-sm text-[var(--text-color-light)]">
          Seleziona una scheda di rete per visualizzare e modificare le sue impostazioni.
        </p>
      </div>
    );
  }

  return (
    <div className="nic-config-panel">
      <div className="nic-config-header">
        <h4 className="text-base font-semibold">Configurazione {nic.name}</h4>
      </div>

      <FormContainer gap="4">
        {/* Enabled Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="nic-enabled"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--border-color)] cursor-pointer"
          />
          <label htmlFor="nic-enabled" className="text-sm font-medium cursor-pointer">
            Scheda Abilitata
          </label>
        </div>

        {/* Interface Name */}
        <Input
          label="Nome Interfaccia"
          type="text"
          placeholder="es. eth0, eth1, ens192..."
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          size="full"
          required
        />

        {/* Speed */}
        <Select
          label="Velocità Link"
          value={formData.speed || 'auto'}
          onChange={(e) =>
            setFormData({
              ...formData,
              speed: e.target.value as '10M' | '100M' | '1G' | '2.5G' | '10G' | 'auto',
            })
          }
          size="full"
        >
          <option value="auto">Auto</option>
          <option value="10M">10 Mbps</option>
          <option value="100M">100 Mbps</option>
          <option value="1G">1 Gbps</option>
          <option value="2.5G">2.5 Gbps</option>
          <option value="10G">10 Gbps</option>
        </Select>

        {/* Where the address comes from */}
        <Select
          id="nic-address-mode"
          label="Indirizzo"
          value={automatic ? 'dhcp' : 'manual'}
          onChange={(e) => handleModeChange(e.target.value === 'dhcp')}
          size="full"
        >
          <option value="manual">Manuale</option>
          <option value="dhcp">Automatico (DHCP)</option>
        </Select>

        {automatic ? (
          /* The lease, worked out from the drawing: nothing to type */
          <div>
            <div
              className={lease && !lease.given ? 'modal-error-box' : 'modal-info-box'}
              role="status"
              data-testid="nic-lease"
            >
              {lease ? (
                <>
                  {lease.given && <strong>Indirizzo assegnato: </strong>}
                  {lease.text}
                  {lease.given && (
                    <span className="block mt-1">
                      Subnet mask {lease.given.subnet} · gateway {lease.given.gateway || 'nessuno'}
                      {' · '}server DNS {lease.given.dns || 'nessuno'}
                    </span>
                  )}
                </>
              ) : (
                'L\'indirizzo arriva dal server DHCP della rete a cui la scheda è collegata.'
              )}
            </div>
            <span className="block text-xs text-[var(--text-color-light)] mt-1">
              Indirizzo, subnet mask e gateway li assegna un server DHCP della stessa rete: una
              porta di router o firewall, o un server, con «Server DHCP Abilitato». Si calcolano dal
              disegno, sempre allo stesso modo. Il server DNS arriva con l&apos;indirizzo, se
              quel server ne consegna uno.
            </span>
          </div>
        ) : (
          <>
            {/* IP Address */}
            <Input
              label="Indirizzo IP"
              type="text"
              placeholder="es. 192.168.1.10"
              value={formData.ip}
              onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
              size="full"
              required
            />

            {/* Subnet Mask */}
            <Input
              label="Subnet Mask"
              type="text"
              placeholder="es. 255.255.255.0"
              value={formData.subnet}
              onChange={(e) => setFormData({ ...formData, subnet: e.target.value })}
              size="full"
              required
            />

            {/* Gateway */}
            <Input
              label="Gateway"
              type="text"
              placeholder="es. 192.168.1.1"
              value={formData.gateway}
              onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
              size="full"
            />

            {/* DNS server: whom the card asks for names */}
            <div>
              <Input
                id="nic-dns"
                label="Server DNS"
                type="text"
                placeholder="es. 192.168.1.53"
                value={formData.dns ?? ''}
                onChange={(e) => {
                  setFormData({ ...formData, dns: e.target.value });
                  setDnsError(null);
                }}
                size="full"
              />
              <span className="block text-xs text-[var(--text-color-light)] mt-1">
                L&apos;indirizzo del server a cui la scheda chiede a quale indirizzo corrisponde un
                nome. Vuoto: nessuno, e un nome usato al posto di un indirizzo non trova risposta.
              </span>
              {dnsError && (
                <div className="modal-error-box mt-2" role="alert">
                  {dnsError}
                </div>
              )}
            </div>
          </>
        )}

        {/* DHCP server - a server, for the network of this card */}
        {canServe && !automatic && (
          <DhcpPoolFields
            idPrefix="nic"
            enabled={serves}
            pool={pool}
            onToggle={(enabled) => {
              setServes(enabled);
              setPoolError(null);
            }}
            onChange={(next) => {
              setPool(next);
              setPoolError(null);
            }}
            gatewayHint="Vuoto: nessun gateway, i dispositivi parlano solo dentro la loro rete. Di solito è l'indirizzo del router."
            error={poolError}
          />
        )}

        {/* MAC Address */}
        <div>
          <Input
            label="Indirizzo MAC"
            type="text"
            placeholder="es. 02:A1:B2:C3:D4:E5"
            value={formData.mac}
            onChange={(e) => setFormData({ ...formData, mac: e.target.value })}
            size="full"
          />
          <button
            onClick={handleGenerateMac}
            className="mt-2 text-xs text-[var(--accent-text)] underline cursor-pointer"
            type="button"
          >
            Genera MAC Random
          </button>
          <span className="block text-xs text-[var(--text-color-light)] mt-1">
            Formato: XX:XX:XX:XX:XX:XX (lascia vuoto per auto-generazione)
          </span>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-color-light)] mb-1.5">
            Note / Descrizione
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="es. Connessione primaria, Backup link..."
            className="w-full px-3 py-1.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 pb-6">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Annulla
          </Button>
          <Button variant="primary" onClick={handleSave} className="flex-1">
            Salva
          </Button>
        </div>
      </FormContainer>
    </div>
  );
};

export default NICConfigPanel;
