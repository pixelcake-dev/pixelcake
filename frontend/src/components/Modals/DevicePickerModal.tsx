import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { useUIStore } from '@/store/uiStore';
import { useTemplateStore } from '@/store/templateStore';
import type { DeviceType } from '@/types/network';

// Helper function for device descriptions
const getDeviceDescription = (type: DeviceType): string => {
  const descriptions: Record<DeviceType, string> = {
    PC: 'Dispositivo endpoint per utenti',
    Switch: 'Aggregatore di rete locale',
    Router: 'Gateway e routing tra reti',
    Server: 'Server applicativo o dati',
    Firewall: 'Protezione e sicurezza di rete',
    AccessPoint: 'Punto di accesso WiFi',
    LoadBalancer: 'Bilanciatore di carico',
    Database: 'Database server',
    Cloud: 'Servizio cloud o virtuale',
  };
  return descriptions[type] || 'Dispositivo di rete';
};

const DevicePickerModal = () => {
  const isOpen = useUIStore((state) => state.modals.devicePicker);
  const closeModal = useUIStore((state) => state.closeModal);
  const openModal = useUIStore((state) => state.openModal);
  const setAddDeviceType = useUIStore((state) => state.setAddDeviceType);

  const templates = useTemplateStore((state) => state.templates);
  const genericTemplates = templates.filter((t) => !t.isCustom);

  const [searchQuery, setSearchQuery] = useState('');

  // Convert templates to device options
  const availableDevices = useMemo(
    () =>
      genericTemplates.map((template) => ({
        type: template.type,
        name: template.name,
        description: getDeviceDescription(template.type),
        icon: template.icon,
        color: template.color,
      })),
    [genericTemplates]
  );

  // Filter devices based on search query
  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return availableDevices;

    const query = searchQuery.toLowerCase();
    return availableDevices.filter(
      (device) =>
        device.name.toLowerCase().includes(query) ||
        device.description.toLowerCase().includes(query) ||
        device.type.toLowerCase().includes(query)
    );
  }, [searchQuery, availableDevices]);

  const handleDeviceSelect = (deviceType: DeviceType) => {
    setAddDeviceType(deviceType);
    closeModal('devicePicker');
    openModal('addDevice');
    setSearchQuery(''); // Reset search for next time
  };

  const handleClose = () => {
    closeModal('devicePicker');
    setSearchQuery('');
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Seleziona Tipo Dispositivo" size="md" autoHeight={true}>
      <div>
        {/* Search Bar */}
        <div className="mb-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cerca dispositivo..."
          autoFocus={true}
          inputWidth="100%"
          size="md"
        />
      </div>

      {/* Device Grid */}
      <div className="device-picker-grid">
        {filteredDevices.length > 0 ? (
          filteredDevices.map((device) => (
            <div
              key={device.type}
              className="device-card"
              onClick={() => handleDeviceSelect(device.type)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleDeviceSelect(device.type);
                }
              }}
            >
              <div className="device-card-icon">
                <Icon
                  icon={device.icon}
                  width={32}
                  height={32}
                  style={{ color: device.color }}
                />
              </div>
              <div className="device-card-name">{device.name}</div>
              <div className="device-card-description">{device.description}</div>
            </div>
          ))
        ) : (
          <div className="text-center text-[var(--text-color-light)] py-8 col-span-full">
            Nessun dispositivo trovato per "{searchQuery}"
          </div>
        )}
      </div>
      </div>
    </Modal>
  );
};

export default DevicePickerModal;
