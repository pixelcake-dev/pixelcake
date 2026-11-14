import React, { useState } from 'react';
import { CheckField, FieldRow, SelectField, TextField } from '@/components/ui/compact';
import { cellClass, hintClass, labelClass } from '@/components/ui/compactStyles';
import DhcpPoolFields from '@/components/ui/DhcpPoolFields';
import { portSuggestedPool } from '@/utils/dhcpLabels';
import {
  DEFAULT_PORT_SUBNET,
  portProblems,
  portsCarryAddress,
  readVlanText,
  vlanText,
} from '@/utils/interfaceProblems';
import { vlanLabel, vlanName, vlanShort } from '@/utils/vlanNames';
import { useVlanNames } from '@/utils/useVlanNames';
import type { Port } from '@/types/network';

interface PortEditorProps {
  /** The port as it is in the form of the window */
  port: Port;
  deviceType: string; // Switch, Router, Firewall
  /** What changes on the port: it goes straight to the form, which the window saves */
  onChange: (patch: Partial<Port>) => void;
  /** What the port is linked to ("SW-Office (porta 8)"); undefined when nothing is attached */
  connectedTo?: string;
  /** What the DHCP server of the port gave out, in words, as the engine reads the form */
  poolStatus?: string;
}

type PortType = NonNullable<Port['portType']>;
type Speed = NonNullable<Port['speed']>;

/**
 * The VLAN of a switch port. What is typed is kept as typed (a list is
 * written a comma at a time); the port takes it each time it reads as a
 * VLAN, or as a list of them. The field holds numbers: the names the
 * project gave them are said under it.
 */
const VlanField: React.FC<{
  mode: 'access' | 'trunk';
  vlan: Port['vlan'];
  onChange: (vlan: Port['vlan']) => void;
}> = ({ mode, vlan, onChange }) => {
  const [text, setText] = useState(() => vlanText(vlan));
  const [error, setError] = useState<string>();
  const names = useVlanNames();
  // What is typed, as far as it reads: the VLANs whose names are said
  const read = readVlanText(mode, text).vlan;
  const typed = read === undefined ? [] : Array.isArray(read) ? read : [read];
  const named = typed.some((vlan) => vlanName(vlan, names) !== undefined);
  return (
    <TextField
      label={mode === 'access' ? 'VLAN (singola)' : 'VLANs (separati da virgola)'}
      span={2}
      placeholder={mode === 'access' ? 'es. 10' : 'es. 10, 20, 30'}
      value={text}
      error={error}
      onChange={(e) => {
        const typed = e.target.value;
        setText(typed);
        const read = readVlanText(mode, typed);
        setError(read.error);
        if (!read.error) onChange(read.vlan);
      }}
      hint={
        <>
          {mode === 'access'
            ? 'La porta appartiene a questa VLAN (numero da 1 a 4094). Vuoto: nessuna VLAN propria.'
            : 'Le VLAN che la porta trasporta con etichetta (numeri da 1 a 4094). Vuoto: tutte.'}{' '}
          Appena una porta dello switch ha una VLAN, quelle senza sono nella VLAN 1.
          {named && (
            <span className="block text-[var(--text-color)]" data-testid="vlan-names">
              {typed.length === 1
                ? vlanLabel(typed[0], names)
                : `VLAN ${typed.map((vlan) => vlanShort(vlan, names)).join(', ')}`}
            </span>
          )}
        </>
      }
    />
  );
};

/**
 * PortEditor
 * The settings of one port, laid out in rows of four: what every port has
 * (on or off, name, mode, speed), then what its device gives it: a VLAN and
 * PoE on a switch; an address, NAT and a DHCP server on a router or a
 * firewall, and there also the security zone. Nothing here is saved by
 * itself: each change goes to the form of the window, and what is wrong is
 * said under the field as it is typed.
 */
const PortEditor: React.FC<PortEditorProps> = ({ port, deviceType, onChange, connectedTo, poolStatus }) => {
  const isSwitch = deviceType === 'Switch';
  const isFirewall = deviceType === 'Firewall';
  const addressed = portsCarryAddress(deviceType);
  const mode: PortType = port.portType ?? (isSwitch ? 'access' : 'lan');
  const problems = portProblems(deviceType, port);

  /**
   * Switching between access and trunk keeps what was typed: the single VLAN
   * of an access port becomes the list of the trunk, and the first VLAN of a
   * trunk becomes the VLAN of the access port.
   */
  const changeMode = (portType: PortType) => {
    let vlan = port.vlan;
    if (portType === 'trunk' && typeof vlan === 'number') vlan = [vlan];
    if (portType === 'access' && Array.isArray(vlan)) vlan = vlan[0];
    onChange({ portType, vlan });
  };

  return (
    <div className="port-editor flex flex-col gap-3" data-testid={`port-editor-${port.id}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="text-sm font-semibold text-[var(--text-color)]">
          Porta {port.id}
          {port.name?.trim() ? ` «${port.name.trim()}»` : ''}
        </h4>
        <span className="text-xs text-[var(--text-color-light)]">
          {connectedTo ? (
            <>
              <span id={`port-${port.id}-link`} className={labelClass}>
                Collegata a
              </span>{' '}
              <output aria-labelledby={`port-${port.id}-link`} className="text-[var(--text-color)]">
                {connectedTo}
              </output>
            </>
          ) : (
            'Nessun cavo collegato'
          )}
        </span>
      </div>

      <FieldRow>
        <CheckField
          id="port-enabled"
          label="Porta Abilitata"
          inRow
          checked={port.enabled !== false}
          onChange={(enabled) => onChange({ enabled })}
        />
        <TextField
          label="Nome Porta (opzionale)"
          placeholder={`Port ${port.id}`}
          value={port.name ?? ''}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <SelectField
          label="Modalità Porta"
          value={mode}
          onChange={(e) => changeMode(e.target.value as PortType)}
          hint={
            isSwitch
              ? undefined
              : `Solo descrittiva: non cambia il comportamento della porta.${
                  isFirewall ? ' Per il firewall conta la zona di sicurezza.' : ''
                }`
          }
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
        </SelectField>
        <SelectField
          label="Velocità Link"
          value={port.speed ?? 'auto'}
          onChange={(e) => onChange({ speed: e.target.value as Speed })}
        >
          <option value="auto">Auto</option>
          <option value="10M">10 Mbps</option>
          <option value="100M">100 Mbps</option>
          <option value="1G">1 Gbps</option>
          <option value="2.5G">2.5 Gbps</option>
          <option value="10G">10 Gbps</option>
        </SelectField>
      </FieldRow>

      {/* A switch: the VLAN of the port, and power over the cable */}
      {isSwitch && (
        <FieldRow>
          <VlanField
            key={`${port.id}-${mode}`}
            mode={mode === 'trunk' ? 'trunk' : 'access'}
            vlan={port.vlan}
            onChange={(vlan) => onChange({ vlan })}
          />
          <CheckField
            id="port-poe"
            label="PoE Abilitato (Power over Ethernet)"
            inRow
            span={2}
            checked={port.poe === true}
            onChange={(poe) => onChange({ poe })}
          />
          {problems.vlan && (
            <span className="col-span-4 text-xs text-[var(--danger-color)]" role="alert">
              {problems.vlan}
            </span>
          )}
        </FieldRow>
      )}

      {/* A router or a firewall: the address of the port, what leaves by it, who it lets in */}
      {addressed && (
        <FieldRow>
          <TextField
            id="port-ip"
            label="Indirizzo IP"
            mono
            placeholder="es. 192.168.10.1"
            value={port.ip ?? ''}
            error={problems.address}
            onChange={(e) => onChange({ ip: e.target.value })}
          />
          <TextField
            id="port-subnet"
            label="Subnet Mask"
            mono
            placeholder={`es. ${DEFAULT_PORT_SUBNET}`}
            value={port.subnet ?? ''}
            onChange={(e) => onChange({ subnet: e.target.value })}
          />
          {isFirewall && (
            <SelectField
              label="Zona di Sicurezza"
              value={port.securityZone ?? ''}
              onChange={(e) =>
                onChange({
                  securityZone:
                    e.target.value === '' ? undefined : (e.target.value as 'trust' | 'untrust' | 'dmz'),
                })
              }
            >
              <option value="">Nessuna</option>
              <option value="trust">Trust (Rete Fidata)</option>
              <option value="untrust">Untrust (Rete Non Fidata)</option>
              <option value="dmz">DMZ (Zona Demilitarizzata)</option>
            </SelectField>
          )}
          <CheckField
            id="port-nat"
            label="NAT Abilitato"
            inRow
            span={isFirewall ? 1 : 2}
            checked={port.nat === true}
            onChange={(nat) => onChange({ nat })}
          />
          <span className={`col-span-2 ${hintClass}`}>
            È il gateway dei dispositivi collegati a questa porta. Lascia vuoto se la porta non ha
            indirizzo; senza subnet mask vale {DEFAULT_PORT_SUBNET}.
          </span>
          <span className={`col-span-2 ${hintClass}`}>
            Con il NAT ciò che esce da questa porta prende il suo indirizzo: serve verso Internet,
            che non trasporta gli indirizzi privati. I servizi da raggiungere da fuori si
            pubblicano nella scheda «NAT».
            {port.nat && !(port.ip ?? '').trim() && (
              <span className="block text-[var(--danger-color)]" role="alert">
                La porta non ha un indirizzo: finché non ne ha uno il NAT non traduce nulla.
              </span>
            )}
          </span>
        </FieldRow>
      )}

      {addressed && (
        <DhcpPoolFields
          idPrefix="port"
          pool={port.dhcpServer}
          onChange={(dhcpServer) => onChange({ dhcpServer })}
          suggestion={portSuggestedPool(deviceType, port)}
          gatewayHint="Vuoto: l'indirizzo di questa porta."
          error={problems.pool}
          status={poolStatus}
        />
      )}

      {isFirewall && (
        <CheckField
          id="port-ips"
          label="IPS/IDS Abilitato (Intrusion Prevention/Detection)"
          checked={port.ips === true}
          onChange={(ips) => onChange({ ips })}
          hint="Resta come documentazione: il motore non lo simula."
        />
      )}

      <div className="flex flex-col gap-0.5">
        <label htmlFor="port-description" className={labelClass}>
          Note / Descrizione
        </label>
        <textarea
          id="port-description"
          className={cellClass}
          rows={2}
          placeholder="es. Uplink a core switch, Server VLAN 10..."
          value={port.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  );
};

export default PortEditor;
