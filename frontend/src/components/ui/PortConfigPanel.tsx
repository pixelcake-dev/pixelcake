import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormContainer, FormFieldset } from '@/components/ui/FormContainer';
import DhcpPoolFields from '@/components/ui/DhcpPoolFields';
import { isValidIP } from '@/utils/ipHelpers';
import { BLANK_POOL_ERROR, isBlankPool, portPoolProblemText, tidyPool } from '@/utils/dhcpLabels';
import type { DhcpPool, Port } from '@/types/network';

/** Mask given to an addressed port when the field is left empty */
const DEFAULT_PORT_SUBNET = '255.255.255.0';

/** The pool fields before anything is typed */
const EMPTY_POOL: DhcpPool = { start: '', end: '', gateway: '', dns: '' };

interface PortConfigPanelProps {
  port: Port | null;
  deviceType: string; // Device type (Switch, Router, Firewall)
  onSave: (portId: number, updates: Partial<Port>) => void;
  onCancel: () => void;
  /** What the port is linked to ("SW-Office (porta 8)"); undefined when nothing is attached */
  connectedTo?: string;
}

/**
 * PortConfigPanel Component
 * Detail panel for editing selected port configuration
 * Shows all port settings: enabled, name, type, VLAN, speed, PoE, description,
 * the L3 address of Router/Firewall ports, the DHCP server of the network of
 * such a port, and (read-only) what the port is linked to
 */
const PortConfigPanel: React.FC<PortConfigPanelProps> = ({
  port,
  deviceType,
  onSave,
  onCancel,
  connectedTo,
}) => {
  // Determine device type capabilities
  const isSwitch = deviceType === 'Switch';
  const isRouter = deviceType === 'Router';
  const isFirewall = deviceType === 'Firewall';
  // Router and Firewall ports are L3 interfaces: they can carry an address
  const supportsAddress = isRouter || isFirewall;
  const [addressError, setAddressError] = useState<string | null>(null);
  const [vlanError, setVlanError] = useState<string | null>(null);
  // DHCP server of the port (router, firewall): on or off, and what is typed
  const [serves, setServes] = useState(false);
  const [pool, setPool] = useState<DhcpPool>(EMPTY_POOL);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Port>>({
    enabled: true,
    name: '',
    portType: isSwitch ? 'access' : 'lan', // Default: access for Switch, lan for Router/Firewall
    vlan: undefined,
    speed: 'auto',
    poe: false,
    description: '',
    // Router/Firewall: L3 address
    ip: '',
    subnet: '',
    // Router-specific
    nat: false,
    // Firewall-specific: no zone until one is chosen
    securityZone: undefined,
    ips: false,
  });

  // Initialize form data when port changes
  useEffect(() => {
    if (port) {
      setFormData({
        enabled: port.enabled ?? true,
        name: port.name || '',
        portType: port.portType || (isSwitch ? 'access' : 'lan'),
        vlan: port.vlan,
        speed: port.speed || 'auto',
        poe: port.poe || false,
        description: port.description || '',
        // Router/Firewall: L3 address
        ip: port.ip || '',
        subnet: port.subnet || '',
        // Router-specific
        nat: port.nat || false,
        // Firewall-specific
        securityZone: port.securityZone,
        ips: port.ips || false,
      });
      setAddressError(null);
      setVlanError(null);
      setServes(port.dhcpServer !== undefined);
      setPool({ ...EMPTY_POOL, ...port.dhcpServer });
      setPoolError(null);
    }
  }, [port, isSwitch]);

  const handleSave = () => {
    if (!port) return;

    // Prepare updates
    const updates: Partial<Port> = {
      enabled: formData.enabled,
      name: formData.name?.trim() || undefined,
      portType: formData.portType,
      speed: formData.speed,
      description: formData.description?.trim() || undefined,
    };

    // Router/Firewall: L3 address of the port (optional, validated when given)
    if (supportsAddress) {
      const ip = formData.ip?.trim() ?? '';
      const subnet = formData.subnet?.trim() ?? '';
      if (ip && !isValidIP(ip)) {
        setAddressError(`"${ip}" non è un indirizzo IPv4 valido`);
        return;
      }
      if (subnet && !isValidIP(subnet)) {
        setAddressError(`"${subnet}" non è una subnet mask valida`);
        return;
      }
      if (!ip && subnet) {
        setAddressError('Inserisci un indirizzo IP oppure svuota la subnet mask');
        return;
      }
      setAddressError(null);
      // No address: both fields are cleared. Address without mask: /24
      updates.ip = ip || undefined;
      updates.subnet = ip ? subnet || DEFAULT_PORT_SUBNET : undefined;

      // DHCP server: the range is checked against the address just read
      if (serves) {
        const problem = isBlankPool(pool)
          ? BLANK_POOL_ERROR
          : portPoolProblemText(deviceType, { ...port, ip: updates.ip, subnet: updates.subnet }, pool);
        if (problem) {
          setPoolError(problem);
          return;
        }
      }
      setPoolError(null);
      updates.dhcpServer = serves ? tidyPool(pool) : undefined;
    }

    // Switch-specific fields
    if (isSwitch) {
      updates.poe = formData.poe;

      // Handle VLAN based on port type
      if (formData.portType === 'access') {
        // Access mode: single VLAN number
        const vlanNumber = typeof formData.vlan === 'number' ? formData.vlan : undefined;
        if (vlanNumber !== undefined && (vlanNumber < 1 || vlanNumber > 4094)) {
          setVlanError(`${vlanNumber} non è una VLAN: il numero va da 1 a 4094`);
          return;
        }
        updates.vlan = vlanNumber;
      } else if (formData.portType === 'trunk') {
        // Trunk mode: array of VLANs
        const vlanArray = Array.isArray(formData.vlan) ? formData.vlan : undefined;
        updates.vlan = vlanArray;
      }
      setVlanError(null);
    }

    // Address translation: a router or a firewall
    if (supportsAddress) {
      updates.nat = formData.nat;
    }

    // Firewall-specific fields
    if (isFirewall) {
      updates.securityZone = formData.securityZone;
      updates.ips = formData.ips;
    }

    onSave(port.id, updates);
  };

  /**
   * Switching between access and trunk keeps what was typed: the single VLAN
   * of an access port becomes the list of the trunk, and the first VLAN of a
   * trunk becomes the VLAN of the access port.
   */
  const handlePortTypeChange = (portType: NonNullable<Port['portType']>) => {
    let vlan = formData.vlan;
    if (portType === 'trunk' && typeof vlan === 'number') vlan = [vlan];
    if (portType === 'access' && Array.isArray(vlan)) vlan = vlan[0];
    setFormData({ ...formData, portType, vlan });
    setVlanError(null);
  };

  const handleVlanChange = (value: string) => {
    setVlanError(null);
    if (formData.portType === 'access') {
      // Access mode: parse single number
      const num = parseInt(value, 10);
      setFormData({ ...formData, vlan: isNaN(num) ? undefined : num });
    } else {
      // Trunk mode: parse comma-separated array
      const vlans = value
        .split(',')
        .map((v) => parseInt(v.trim(), 10))
        .filter((v) => !isNaN(v) && v >= 1 && v <= 4094);
      setFormData({ ...formData, vlan: vlans.length > 0 ? vlans : undefined });
    }
  };

  const getVlanDisplayValue = (): string => {
    if (!formData.vlan) return '';
    if (typeof formData.vlan === 'number') return formData.vlan.toString();
    if (Array.isArray(formData.vlan)) return formData.vlan.join(', ');
    return '';
  };

  if (!port) {
    return (
      <div className="port-config-empty">
        <p className="text-sm text-[var(--text-color-light)]">
          Seleziona una porta per visualizzare e modificare le sue impostazioni.
        </p>
      </div>
    );
  }

  return (
    <div className="port-config-panel">
      <div className="port-config-header">
        <h4 className="text-base font-semibold">Configurazione Porta {port.id}</h4>
      </div>

      <FormContainer gap="4">
        {/* Enabled Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="port-enabled"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--border-color)] cursor-pointer"
          />
          <label htmlFor="port-enabled" className="text-sm font-medium cursor-pointer">
            Porta Abilitata
          </label>
        </div>

        {/* Link (read-only): what is attached to this port, if anything */}
        {connectedTo && (
          <Input
            id="port-connected-to"
            label="Collegata a"
            type="text"
            value={connectedTo}
            size="full"
            readOnly
          />
        )}

        {/* Port Name */}
        <Input
          label="Nome Porta (opzionale)"
          type="text"
          placeholder={`Port ${port.id}`}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          size="full"
        />

        {/* Port Type - Different options for Switch vs Router/Firewall */}
        <Select
          label="Modalità Porta"
          value={formData.portType || (isSwitch ? 'access' : 'lan')}
          onChange={(e) =>
            handlePortTypeChange(e.target.value as 'access' | 'trunk' | 'wan' | 'lan' | 'dmz')
          }
          size="full"
        >
          {isSwitch ? (
            <>
              <option value="access">Access (dispositivo finale)</option>
              <option value="trunk">Trunk (link tra switch)</option>
            </>
          ) : (
            <>
              <option value="wan">WAN (Wide Area Network)</option>
              <option value="lan">LAN (Local Area Network)</option>
              <option value="dmz">DMZ (Demilitarized Zone)</option>
            </>
          )}
        </Select>
        {!isSwitch && (
          <span className="text-xs text-[var(--text-color-light)] -mt-2">
            Solo descrittiva: non cambia il comportamento della porta.
            {isFirewall && ' Per il firewall conta la zona di sicurezza.'}
          </span>
        )}

        {/* L3 Address - Only for Router/Firewall */}
        {supportsAddress && (
          <FormFieldset legend="Indirizzo della Porta">
            <FormContainer gap="2">
              <Input
                id="port-ip"
                label="Indirizzo IP"
                type="text"
                placeholder="es. 192.168.10.1"
                value={formData.ip}
                onChange={(e) => {
                  setFormData({ ...formData, ip: e.target.value });
                  setAddressError(null);
                }}
                size="full"
              />
              <Input
                id="port-subnet"
                label="Subnet Mask"
                type="text"
                placeholder={`es. ${DEFAULT_PORT_SUBNET}`}
                value={formData.subnet}
                onChange={(e) => {
                  setFormData({ ...formData, subnet: e.target.value });
                  setAddressError(null);
                }}
                size="full"
              />
              <span className="text-xs text-[var(--text-color-light)]">
                È il gateway dei dispositivi collegati a questa porta. Lascia vuoto se la porta non
                ha indirizzo.
              </span>
              {addressError && (
                <div className="modal-error-box" role="alert">
                  {addressError}
                </div>
              )}
            </FormContainer>
          </FormFieldset>
        )}

        {/* DHCP server - a router or a firewall, for the network of this port */}
        {supportsAddress && (
          <DhcpPoolFields
            idPrefix="port"
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
            gatewayHint="Vuoto: l'indirizzo di questa porta, che è il gateway della sua rete."
            error={poolError}
          />
        )}

        {/* VLAN - Only for Switch */}
        {isSwitch && (
          <div>
            <Input
              label={
                formData.portType === 'access'
                  ? 'VLAN (singola)'
                  : 'VLANs (separati da virgola)'
              }
              type="text"
              placeholder={formData.portType === 'access' ? 'es. 10' : 'es. 10, 20, 30'}
              value={getVlanDisplayValue()}
              onChange={(e) => handleVlanChange(e.target.value)}
              size="full"
            />
            <span className="text-xs text-[var(--text-color-light)] mt-1 block">
              {formData.portType === 'access'
                ? 'La porta appartiene a questa VLAN (numero da 1 a 4094). Vuoto: nessuna VLAN propria.'
                : 'Le VLAN che la porta trasporta con etichetta (numeri da 1 a 4094). Vuoto: tutte.'}
            </span>
            <span className="text-xs text-[var(--text-color-light)] mt-1 block">
              Appena una porta dello switch ha una VLAN, quelle senza sono nella VLAN 1.
            </span>
            {vlanError && (
              <div className="modal-error-box mt-2" role="alert">
                {vlanError}
              </div>
            )}
          </div>
        )}

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

        {/* PoE - Only for Switch */}
        {isSwitch && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="port-poe"
              checked={formData.poe}
              onChange={(e) => setFormData({ ...formData, poe: e.target.checked })}
              className="w-4 h-4 rounded border-[var(--border-color)] cursor-pointer"
            />
            <label htmlFor="port-poe" className="text-sm font-medium cursor-pointer">
              PoE Abilitato (Power over Ethernet)
            </label>
          </div>
        )}

        {/* NAT - a router or a firewall */}
        {supportsAddress && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="port-nat"
              checked={formData.nat}
              onChange={(e) => setFormData({ ...formData, nat: e.target.checked })}
              className="w-4 h-4 rounded border-[var(--border-color)] cursor-pointer"
            />
            <label htmlFor="port-nat" className="text-sm font-medium cursor-pointer">
              NAT Abilitato (Network Address Translation)
            </label>
          </div>
        )}
        {supportsAddress && (
          <span className="text-xs text-[var(--text-color-light)] -mt-2">
            Ciò che esce da questa porta prende il suo indirizzo: serve verso Internet, che non
            trasporta gli indirizzi privati. I servizi da raggiungere da fuori si pubblicano nella
            scheda «NAT».
            {formData.nat && !(formData.ip ?? '').trim() && (
              <span className="block text-red-500" role="alert">
                La porta non ha un indirizzo: finché non ne ha uno il NAT non traduce nulla.
              </span>
            )}
          </span>
        )}

        {/* Security Zone - Only for Firewall */}
        {isFirewall && (
          <Select
            label="Zona di Sicurezza"
            value={formData.securityZone ?? ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                securityZone:
                  e.target.value === ''
                    ? undefined
                    : (e.target.value as 'trust' | 'untrust' | 'dmz'),
              })
            }
            size="full"
          >
            <option value="">Nessuna</option>
            <option value="trust">Trust (Rete Fidata)</option>
            <option value="untrust">Untrust (Rete Non Fidata)</option>
            <option value="dmz">DMZ (Zona Demilitarizzata)</option>
          </Select>
        )}

        {/* IPS/IDS - Only for Firewall */}
        {isFirewall && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="port-ips"
              checked={formData.ips}
              onChange={(e) => setFormData({ ...formData, ips: e.target.checked })}
              className="w-4 h-4 rounded border-[var(--border-color)] cursor-pointer"
            />
            <label htmlFor="port-ips" className="text-sm font-medium cursor-pointer">
              IPS/IDS Abilitato (Intrusion Prevention/Detection)
            </label>
          </div>
        )}
        {isFirewall && (
          <span className="text-xs text-[var(--text-color-light)] -mt-2">
            Resta come documentazione: il motore non lo simula.
          </span>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-color-light)] mb-1.5">
            Note / Descrizione
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="es. Uplink a core switch, Server VLAN 10..."
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

export default PortConfigPanel;
