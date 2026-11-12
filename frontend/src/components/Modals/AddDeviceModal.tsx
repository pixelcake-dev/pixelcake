import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormContainer, FormFieldset } from '@/components/ui/FormContainer';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { findNextAvailableIP, generateMacAddress } from '@/utils/ipHelpers';
import type { DeviceType, Port, NetworkInterfaceCard } from '@/types/network';

const AddDeviceModal = () => {
  const isOpen = useUIStore((state) => state.modals.addDevice);
  const addDeviceType = useUIStore((state) => state.addDeviceType);
  const addDeviceTemplateId = useUIStore((state) => state.addDeviceTemplateId);
  const closeModal = useUIStore((state) => state.closeModal);
  const addDevice = useNetworkStore((state) => state.addDevice);
  const devices = useNetworkStore((state) => state.devices);
  const globalSettings = useNetworkStore((state) => state.globalNetworkSettings);
  const templates = useTemplateStore((state) => state.templates);

  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [position, setPosition] = useState('');
  const [ip, setIp] = useState('');
  const [portCount, setPortCount] = useState<number | undefined>(undefined);
  const [nics, setNics] = useState<NetworkInterfaceCard[] | undefined>(undefined);

  useEffect(() => {
    if (isOpen && addDeviceType) {
      // Find template by ID (preferred) or fallback to type
      const template = addDeviceTemplateId
        ? templates.find((t) => t.id === addDeviceTemplateId)
        : templates.find((t) => t.type === addDeviceType);

      // Auto-generate device name using template name for specificity
      const templateName = template?.name || addDeviceType;
      const typeCount = devices.filter((d) => d.type === addDeviceType).length;
      setName(`${templateName.replace(/\s+/g, '-')}-${typeCount}`);

      // Find next available IP
      const nextIp = findNextAvailableIP(devices, globalSettings);
      setIp(nextIp);

      if (template?.supportsPorts && template.defaultPortCount) {
        // Device supports ports
        setPortCount(template.defaultPortCount);
        setNics(undefined);
      } else if (template?.supportsNICs) {
        // Device supports NICs - initialize with 1 default NIC
        setNics([{
          id: 'nic-1',
          name: 'eth0',
          enabled: true,
          speed: 'auto',
          ip: nextIp,
          subnet: globalSettings.subnet,
          gateway: globalSettings.gateway,
          mac: generateMacAddress(),
        }]);
        setPortCount(undefined);
      } else {
        // Device supports neither
        setPortCount(undefined);
        setNics(undefined);
      }

      // Reset other fields
      setVendor('');
      setPosition('');
    }
  }, [isOpen, addDeviceType, addDeviceTemplateId, devices, globalSettings, templates]);

  const handleSave = () => {
    if (!addDeviceType || !name.trim() || !ip.trim()) {
      toast.error('Nome e IP sono obbligatori');
      return;
    }

    // Random position on canvas with wider distribution
    const randomX = Math.floor(Math.random() * 1800) + 100;
    const randomY = Math.floor(Math.random() * 1200) + 100;

    // Initialize ports array if device supports ports
    const template = addDeviceTemplateId
      ? templates.find((t) => t.id === addDeviceTemplateId)
      : templates.find((t) => t.type === addDeviceType);
    const ports: Port[] | undefined = template?.supportsPorts && portCount
      ? Array.from({ length: portCount }, (_, i) => ({
          id: i + 1,
          enabled: true,
          speed: 'auto',
          portType: 'access',
        }))
      : undefined;

    addDevice({
      type: addDeviceType as DeviceType,
      templateId: addDeviceTemplateId || undefined, // Store template ID for icon lookup
      label: name,
      ip,
      subnet: globalSettings.subnet,
      gateway: globalSettings.gateway,
      vendor: addDeviceType !== 'PC' ? vendor : undefined,
      location: addDeviceType !== 'PC' ? position : undefined,
      position: { x: randomX, y: randomY },
      portCount: portCount,
      ports: ports,
      // The IP typed in this form is the address of the first NIC
      nics: nics?.map((nic, index) => (index === 0 ? { ...nic, ip } : nic)),
    });

    handleClose();
  };

  const handleClose = () => {
    closeModal('addDevice');
    setName('');
    setVendor('');
    setPosition('');
    setIp('');
    setPortCount(undefined);
    setNics(undefined);
  };

  if (!isOpen || !addDeviceType) return null;

  // Get template for current device to check port support and display name
  const template = addDeviceTemplateId
    ? templates.find((t) => t.id === addDeviceTemplateId)
    : templates.find((t) => t.type === addDeviceType);

  const deviceTypeName = template?.name || addDeviceType;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Aggiungi Nuovo ${deviceTypeName}`}
      autoHeight={true}
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Aggiungi
          </Button>
        </div>
      }
    >
      <FormContainer gap="4">
        {/* Vendor field - hidden for PC */}
        {addDeviceType !== 'PC' && (
          <Input
            label="Vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="es. Cisco, HP, Ubiquiti..."
            size="md"
          />
        )}

        {/* Device Name */}
        <Input
          label="Nome Dispositivo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`es. ${addDeviceType}-Ufficio-01`}
          size="md"
          required
        />

        {/* Position field - hidden for PC */}
        {addDeviceType !== 'PC' && (
          <Input
            label="Posizione"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="es. Rack 01, Ufficio 102..."
            size="lg"
          />
        )}

        {/* Port Count Selector - only for devices with port support (Switch) */}
        {template?.supportsPorts && template.portOptions && (
          <Select
            label="Numero di Porte"
            value={portCount?.toString() || ''}
            onChange={(e) => setPortCount(Number(e.target.value))}
            size="md"
            required
          >
            {template.portOptions.map((count) => (
              <option key={count} value={count}>
                {count} porte
              </option>
            ))}
          </Select>
        )}

        {/* Network Configuration */}
        <FormFieldset legend="Configurazione Rete">
          <FormContainer gap="3">
            {nics && nics.length > 0 ? (
              <>
                <Input
                  label="Indirizzo IP (Gestito tramite NICs)"
                  value={nics[0].ip}
                  size="sm"
                  readOnly
                />

                <Input
                  label="Subnet Mask (Gestito tramite NICs)"
                  value={nics[0].subnet}
                  size="sm"
                  readOnly
                />

                <Input
                  label="Gateway (Gestito tramite NICs)"
                  value={nics[0].gateway}
                  size="sm"
                  readOnly
                />

                <p className="text-xs text-[var(--text-color-light)] mt-1">
                  Configurazione di rete gestita tramite schede di rete (NICs).
                  Modifica disponibile dopo la creazione del dispositivo.
                </p>
              </>
            ) : (
              <>
                <Input
                  label="Indirizzo IP (Auto-assegnato)"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  size="sm"
                  required
                />

                <Input
                  label="Subnet Mask"
                  value={globalSettings.subnet}
                  size="sm"
                  readOnly
                />

                <Input
                  label="Gateway"
                  value={globalSettings.gateway}
                  size="sm"
                  readOnly
                />
              </>
            )}
          </FormContainer>
        </FormFieldset>
      </FormContainer>
    </Modal>
  );
};

export default AddDeviceModal;
