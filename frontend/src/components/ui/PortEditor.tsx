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
import { useT } from '@/i18n';
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
  const t = useT();
  const say = t.interfaces.port.vlan;
  const [text, setText] = useState(() => vlanText(vlan));
  // What is wrong is said once something was typed: the VLAN the port came
  // with is not judged here. (Whether, not what: the words are read again at
  // each drawing, so they follow the language of the interface)
  const [edited, setEdited] = useState(false);
  const names = useVlanNames();
  // What is typed, as far as it reads: the VLANs whose names are said
  const reading = readVlanText(mode, text);
  const read = reading.vlan;
  const typed = read === undefined ? [] : Array.isArray(read) ? read : [read];
  const named = typed.some((vlan) => vlanName(vlan, names) !== undefined);
  return (
    <TextField
      label={mode === 'access' ? say.labelAccess : say.labelTrunk}
      span={2}
      placeholder={t.interfaces.example(mode === 'access' ? '10' : '10, 20, 30')}
      value={text}
      error={edited ? reading.error : undefined}
      onChange={(e) => {
        const typed = e.target.value;
        setText(typed);
        setEdited(true);
        const read = readVlanText(mode, typed);
        if (!read.error) onChange(read.vlan);
      }}
      hint={
        <>
          {mode === 'access' ? say.hintAccess : say.hintTrunk}
          {named && (
            <span className="block text-[var(--text-color)]" data-testid="vlan-names">
              {typed.length === 1
                ? vlanLabel(typed[0], names)
                : say.typedList(typed.map((vlan) => vlanShort(vlan, names)))}
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
  const t = useT();
  const say = t.interfaces.port;
  const fields = t.interfaces.fields;
  const isSwitch = deviceType === 'Switch';
  const isFirewall = deviceType === 'Firewall';
  const addressed = portsCarryAddress(deviceType);
  const mode: PortType = port.portType ?? (isSwitch ? 'access' : 'lan');
  const problems = portProblems(deviceType, port);
  const name = port.name?.trim();

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
          {name ? t.common.interfaces.portNamed(port.id, name) : t.common.interfaces.port(port.id)}
        </h4>
        <span className="text-xs text-[var(--text-color-light)]">
          {connectedTo ? (
            <>
              <span id={`port-${port.id}-link`} className={labelClass}>
                {t.interfaces.link.linkedTo}
              </span>{' '}
              <output aria-labelledby={`port-${port.id}-link`} className="text-[var(--text-color)]">
                {connectedTo}
              </output>
            </>
          ) : (
            t.interfaces.link.noCable
          )}
        </span>
      </div>

      <FieldRow>
        <CheckField
          id="port-enabled"
          label={say.enabled}
          inRow
          checked={port.enabled !== false}
          onChange={(enabled) => onChange({ enabled })}
        />
        <TextField
          label={say.name}
          placeholder={say.defaultName(port.id)}
          value={port.name ?? ''}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <SelectField
          label={say.mode}
          value={mode}
          onChange={(e) => changeMode(e.target.value as PortType)}
          hint={isSwitch ? undefined : isFirewall ? say.modeHintFirewall : say.modeHint}
        >
          {isSwitch ? (
            <>
              <option value="access">{say.modes.access}</option>
              <option value="trunk">{say.modes.trunk}</option>
            </>
          ) : (
            <>
              <option value="wan">{say.modes.wan}</option>
              <option value="lan">{say.modes.lan}</option>
              <option value="dmz">{say.modes.dmz}</option>
            </>
          )}
        </SelectField>
        <SelectField
          label={fields.linkSpeed}
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
            label={say.poe}
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
            label={fields.ipAddress}
            mono
            placeholder={t.interfaces.example('192.168.10.1')}
            value={port.ip ?? ''}
            error={problems.address}
            onChange={(e) => onChange({ ip: e.target.value })}
          />
          <TextField
            id="port-subnet"
            label={fields.subnetMask}
            mono
            placeholder={t.interfaces.example(DEFAULT_PORT_SUBNET)}
            value={port.subnet ?? ''}
            onChange={(e) => onChange({ subnet: e.target.value })}
          />
          {isFirewall && (
            <SelectField
              label={say.zone}
              value={port.securityZone ?? ''}
              onChange={(e) =>
                onChange({
                  securityZone:
                    e.target.value === '' ? undefined : (e.target.value as 'trust' | 'untrust' | 'dmz'),
                })
              }
            >
              <option value="">{say.zones.none}</option>
              <option value="trust">{say.zones.trust}</option>
              <option value="untrust">{say.zones.untrust}</option>
              <option value="dmz">{say.zones.dmz}</option>
            </SelectField>
          )}
          <CheckField
            id="port-nat"
            label={say.nat}
            inRow
            span={isFirewall ? 1 : 2}
            checked={port.nat === true}
            onChange={(nat) => onChange({ nat })}
          />
          <span className={`col-span-2 ${hintClass}`}>{say.addressHint(DEFAULT_PORT_SUBNET)}</span>
          <span className={`col-span-2 ${hintClass}`}>
            {say.natHint}
            {port.nat && !(port.ip ?? '').trim() && (
              <span className="block text-[var(--danger-color)]" role="alert">
                {say.natWithoutAddress}
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
          gatewayHint={say.dhcpGatewayHint}
          error={problems.pool}
          status={poolStatus}
        />
      )}

      {isFirewall && (
        <CheckField
          id="port-ips"
          label={say.ips}
          checked={port.ips === true}
          onChange={(ips) => onChange({ ips })}
          hint={say.ipsHint}
        />
      )}

      <div className="flex flex-col gap-0.5">
        <label htmlFor="port-description" className={labelClass}>
          {fields.notes}
        </label>
        <textarea
          id="port-description"
          className={cellClass}
          rows={2}
          placeholder={say.notesPlaceholder}
          value={port.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  );
};

export default PortEditor;
