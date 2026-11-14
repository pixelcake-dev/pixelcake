import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { SearchInput } from '@/components/ui/SearchInput';
import { useUIStore } from '@/store/uiStore';
import { useTemplateStore } from '@/store/templateStore';
import { useNetworkStore } from '@/store/networkStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import { createCompanySample } from '@/utils/sampleCompany';
import { createPerimeterSample } from '@/utils/samplePerimeter';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import { Plug, Package } from 'lucide-react';
import type { DeviceType } from '@/types/network';
import { askConfirm } from '@/store/confirmStore';

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

const DevicePanel = () => {
  const openModal = useUIStore((state) => state.openModal);
  const setAddDeviceType = useUIStore((state) => state.setAddDeviceType);

  // Every template can be placed: the built-in ones and the custom ones
  // created in Impostazioni → Template
  const templates = useTemplateStore((state) => state.templates);

  const devices = useNetworkStore((state) => state.devices);
  const loadTopology = useNetworkStore((state) => state.loadTopology);
  const clearAllDevices = useNetworkStore((state) => state.clearAllDevices);
  const triggerFitView = useNetworkStore((state) => state.triggerFitView);

  const [activeTab, setActiveTab] = useState<'devices' | 'templates'>('devices');
  const [searchQuery, setSearchQuery] = useState('');

  // Convert templates to device options
  const availableDevices = useMemo(
    () =>
      templates.map((template) => ({
        id: template.id, // Template ID for specific lookup
        type: template.type,
        name: template.name,
        description: template.isCustom
          ? `Template personalizzato (${template.type})`
          : getDeviceDescription(template.type),
        icon: template.icon,
        color: template.color,
      })),
    [templates]
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

  const handleDeviceSelect = (deviceType: DeviceType, templateId: string) => {
    setAddDeviceType(deviceType, templateId);
    openModal('addDevice'); // Open device modal
    setSearchQuery(''); // Reset search for next time
  };

  // A sample network takes the place of what is on the canvas: ask first
  const handleLoadSample = async (create: typeof createSampleTopology) => {
    const shouldLoad =
      devices.length === 0 ||
      (await askConfirm({
        title: 'Caricare la rete di esempio?',
        detail: 'Prende il posto di quello che c\'è sul canvas.',
        confirmLabel: 'Carica',
      }));

    if (shouldLoad) {
      clearAllDevices();
      const topology = create();
      loadTopology(topology.devices, topology.connections);
      // Whole in the window, whatever part of the board was on screen
      triggerFitView();
    }
  };

  return (
    <div className="sidebar-panel-section">
      {/* Tab Header */}
      <div className="segmented mb-3">
        <button
          className={activeTab === 'devices' ? 'active' : ''}
          onClick={() => setActiveTab('devices')}
        >
          Dispositivi
        </button>
        <button
          className={activeTab === 'templates' ? 'active' : ''}
          onClick={() => setActiveTab('templates')}
        >
          Topologie
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'devices' ? (
        <>
          {/* Search Bar */}
          <div className="mb-3">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cerca dispositivo..."
              autoFocus={true}
              inputWidth="100%"
              size="md"
            />
          </div>

          {/* Bulk Add Button */}
          <div className="mb-3">
            <button
              className="sidebar-panel-item w-full"
              onClick={() => openModal('bulkAddDevice')}
            >
              <Package size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>Aggiungi in Blocco</span>
            </button>
          </div>

          {/* Device List */}
          <div className="device-list">
            {filteredDevices.length > 0 ? (
              filteredDevices.map((device) => (
                <button
                  key={device.id}
                  className="device-list-item"
                  onClick={() => handleDeviceSelect(device.type, device.id)}
                >
                  <div className="device-list-icon">
                    <Icon
                      icon={device.icon}
                      width={28}
                      height={28}
                      style={{ color: device.color }}
                    />
                  </div>
                  <div className="device-list-info">
                    <div className="device-list-name">{device.name}</div>
                    <div className="device-list-description">{device.description}</div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center text-[var(--text-color-light)] py-4">
                Nessun dispositivo trovato per "{searchQuery}"
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Templates Tab */}
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-color-light)] mb-1">
              Reti di esempio già configurate. Caricarne una sostituisce il canvas aperto.
            </p>
            <button
              className="sidebar-panel-item"
              onClick={() => handleLoadSample(createCompanySample)}
            >
              <Plug size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>
                Azienda: uffici, Wi-Fi, server e DMZ
                <span className="block text-xs text-[var(--text-color-light)]">
                  La rete di esempio: VLAN su un trunk, access point, firewall con tre regole
                </span>
              </span>
            </button>
            <button
              className="sidebar-panel-item"
              onClick={() => handleLoadSample(createSampleTopology)}
            >
              <Plug size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>
                Ufficio: due reti e un router
                <span className="block text-xs text-[var(--text-color-light)]">
                  Per cominciare: ping, web, email
                </span>
              </span>
            </button>
            <button
              className="sidebar-panel-item"
              onClick={() => handleLoadSample(createPerimeterSample)}
            >
              <Plug size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>
                Sede: VLAN, DMZ e firewall
                <span className="block text-xs text-[var(--text-color-light)]">
                  Due VLAN, rotte, zone e una regola che pubblica un sito
                </span>
              </span>
            </button>
            <button
              className="sidebar-panel-item"
              onClick={() => handleLoadSample(createRedundancySample)}
            >
              <Plug size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>
                Due sedi: linea principale e di riserva
                <span className="block text-xs text-[var(--text-color-light)]">
                  Per provare i guasti: quasi ogni cavo ha un&apos;altra strada
                </span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DevicePanel;
