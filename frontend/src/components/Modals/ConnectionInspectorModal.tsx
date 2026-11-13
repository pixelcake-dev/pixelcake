import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormContainer, FormFieldset } from '@/components/ui/FormContainer';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { bindingFor, boundInterface, listInterfaces, usedInterfaceKeys, withLeases } from '@/engine';
import type { DeviceInterface } from '@/engine';
import { interfaceOptionLabel } from '@/utils/interfaceLabels';
import type { ConnectionType, NetworkDevice } from '@/types/network';

/** Value shown for an end that has no interface */
const UNASSIGNED = '';

interface InterfaceSelectProps {
  id: string;
  device: NetworkDevice | undefined;
  /** Selected interface key, or UNASSIGNED */
  value: string;
  onChange: (key: string) => void;
  /** Interfaces of the device that another link (or the other end) already uses */
  takenKeys: ReadonlySet<string>;
}

/**
 * Picker for the interface (port or NIC) one end of the link is attached to.
 * Interfaces used by another link are listed but cannot be chosen.
 */
const InterfaceSelect = ({ id, device, value, onChange, takenKeys }: InterfaceSelectProps) => {
  const interfaces: DeviceInterface[] = device ? listInterfaces(device) : [];

  return (
    <Select
      id={id}
      label={`Interfaccia su ${device?.label ?? 'dispositivo sconosciuto'}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={interfaces.length === 0}
    >
      {/* A cable is always plugged into something, and an unbound end is
          bound again at the next load: "Non assegnata" is only shown while
          the end really has no interface (none free, or a device without
          any), never offered as a choice for a bound end. */}
      {value === UNASSIGNED && <option value={UNASSIGNED}>Non assegnata</option>}
      {interfaces.map((iface) => {
        const inUse = takenKeys.has(iface.key);
        return (
          <option key={iface.key} value={iface.key} disabled={inUse}>
            {interfaceOptionLabel(iface)}
            {!iface.enabled && ' — disabilitata'}
            {inUse && ' (in uso)'}
          </option>
        );
      })}
    </Select>
  );
};

const ConnectionInspectorModal = () => {
  const isOpen = useUIStore((state) => state.modals.connectionInspector);
  const inspectorConnection = useUIStore((state) => state.inspectorConnection);
  const closeModal = useUIStore((state) => state.closeModal);
  const updateConnection = useNetworkStore((state) => state.updateConnection);
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const connectionTemplates = useTemplateStore((state) => state.connectionTemplates);
  const getConnectionTemplateByType = useTemplateStore(
    (state) => state.getConnectionTemplateByType
  );

  const [connectionType, setConnectionType] = useState<string>('');
  const [bandwidth, setBandwidth] = useState('');
  const [label, setLabel] = useState('');
  const [customColor, setCustomColor] = useState('');
  // Interface (key) each end is attached to; UNASSIGNED when not bound
  const [sourceInterface, setSourceInterface] = useState(UNASSIGNED);
  const [targetInterface, setTargetInterface] = useState(UNASSIGNED);

  useEffect(() => {
    if (isOpen && inspectorConnection) {
      setConnectionType(inspectorConnection.type || '');
      setBandwidth(inspectorConnection.bandwidth || '');
      setLabel(inspectorConnection.label || '');
      setCustomColor(inspectorConnection.color || '');

      // Bindings come from the live topology: the inspector only holds a
      // snapshot of the connection taken when the modal was opened
      const live = useNetworkStore.getState();
      const connection =
        live.connections.find((c) => c.id === inspectorConnection.id) ?? inspectorConnection;
      const source = live.devices.find((d) => d.id === connection.source);
      const target = live.devices.find((d) => d.id === connection.target);
      setSourceInterface(
        (source && boundInterface(connection, source, 'source')?.key) || UNASSIGNED
      );
      setTargetInterface(
        (target && boundInterface(connection, target, 'target')?.key) || UNASSIGNED
      );
    }
  }, [isOpen, inspectorConnection]);

  if (!isOpen || !inspectorConnection) return null;

  // The two devices, as they are named in the lists below: an interface is
  // listed with its address, the leased one for a card on DHCP. (Only the
  // key of the interface chosen is saved.)
  const shown = withLeases({ devices, connections }).devices;
  const sourceDevice = shown.find((d) => d.id === inspectorConnection.source);
  const targetDevice = shown.find((d) => d.id === inspectorConnection.target);
  const connectionLabel = `${sourceDevice?.label || 'Unknown'} → ${targetDevice?.label || 'Unknown'}`;

  // Interfaces that cannot be chosen for an end: used by another link, or
  // (when both ends sit on the same device) chosen for the other end
  const takenOn = (device: NetworkDevice | undefined, otherEndKey: string): Set<string> => {
    if (!device) return new Set();
    const taken = usedInterfaceKeys(device, connections, inspectorConnection.id);
    const sameDevice = inspectorConnection.source === inspectorConnection.target;
    if (sameDevice && otherEndKey !== UNASSIGNED) taken.add(otherEndKey);
    return taken;
  };

  const interfaceByKey = (device: NetworkDevice | undefined, key: string) =>
    device && key !== UNASSIGNED
      ? listInterfaces(device).find((iface) => iface.key === key)
      : undefined;

  const handleSave = () => {
    updateConnection(inspectorConnection.id, {
      type: (connectionType as ConnectionType) || undefined,
      bandwidth: bandwidth.trim() || undefined,
      label: label.trim() || undefined,
      color: customColor.trim() || undefined,
      // The four binding fields: one of port/NIC per end, the other cleared
      ...bindingFor('source', interfaceByKey(sourceDevice, sourceInterface)),
      ...bindingFor('target', interfaceByKey(targetDevice, targetInterface)),
    });

    handleClose();
  };

  const handleClose = () => {
    closeModal('connectionInspector');
  };

  // Get the color to display (custom color > template color > default gray)
  const template = connectionType ? getConnectionTemplateByType(connectionType) : undefined;
  const displayColor = customColor || template?.color || '#999';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Modifica Connessione: ${connectionLabel}`}
      size="sm"
      autoHeight={true}
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Salva
          </Button>
        </div>
      }
    >
      <div>
        {/* Interfaces: which port/NIC each end of the link is attached to */}
        <FormFieldset legend="Interfacce" className="mb-4">
          <FormContainer gap="0">
            <InterfaceSelect
              id="connection-source-interface"
              device={sourceDevice}
              value={sourceInterface}
              onChange={setSourceInterface}
              takenKeys={takenOn(sourceDevice, targetInterface)}
            />
            <InterfaceSelect
              id="connection-target-interface"
              device={targetDevice}
              value={targetInterface}
              onChange={setTargetInterface}
              takenKeys={takenOn(targetDevice, sourceInterface)}
            />
            <p className="text-xs text-[var(--text-color-light)]">
              Stato della porta, zona di sicurezza e gateway vengono verificati solo sulle
              estremità assegnate a un&apos;interfaccia.
            </p>
          </FormContainer>
        </FormFieldset>

        {/* Connection Type */}
        <Select
        label="Tipo Connessione"
        value={connectionType}
        onChange={(e) => setConnectionType(e.target.value)}
      >
        <option value="">Nessuno (Default)</option>
        {connectionTemplates.map((template) => (
          <option key={template.id} value={template.type}>
            {template.name}
            {template.description && ` - ${template.description}`}
          </option>
        ))}
      </Select>

      {/* Preview della connessione con colore */}
      {connectionType && (
        <div className="form-group">
          <label className="block text-sm font-medium mb-1 text-[var(--text-color-light)]">
            Anteprima Colore
          </label>
          <div
            className="w-full h-4 rounded-md border border-[var(--border-color)]"
            style={{ backgroundColor: displayColor }}
          />
        </div>
      )}

      {/* Bandwidth and label. An Input has no space of its own around it
          (the select and the groups around these two have): the gap between
          them and under them comes from this container */}
      <FormContainer gap="4" className="mb-4">
        <Input
          label="Bandwidth (es: 1Gbps, 100Mbps)"
          value={bandwidth}
          onChange={(e) => setBandwidth(e.target.value)}
          placeholder="1Gbps"
          size="sm"
        />

        <Input
          label="Etichetta Custom"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Etichetta opzionale"
          size="md"
        />
      </FormContainer>

      {/* Custom Color */}
      <div className="form-group">
        <label className="block text-sm font-medium mb-1 text-[var(--text-color-light)]">
          Colore Personalizzato (opzionale)
        </label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={customColor || '#999999'}
            onChange={(e) => setCustomColor(e.target.value)}
            className="w-20 h-10 cursor-pointer"
            size="xs"
          />
          <Input
            type="text"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            placeholder="#999999"
            size="xs"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-[var(--text-color-light)] mt-1">
          Il colore personalizzato sovrascrive il colore del tipo
        </p>
      </div>
      </div>
    </Modal>
  );
};

export default ConnectionInspectorModal;
