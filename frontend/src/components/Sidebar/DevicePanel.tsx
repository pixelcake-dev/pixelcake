import { useState, useMemo } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import DeviceDrawing from '@/components/ui/DeviceDrawing';
import { drawingOf } from '@/utils/deviceDrawing';
import { useUIStore } from '@/store/uiStore';
import { useTemplateStore } from '@/store/templateStore';
import { useNetworkStore } from '@/store/networkStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import { createCompanySample } from '@/utils/sampleCompany';
import { createPerimeterSample } from '@/utils/samplePerimeter';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import { createMultinationalSample } from '@/utils/sampleMultinational';
import { Plug, Package, SquareDashed } from 'lucide-react';
import { addAreaInView } from '@/utils/areaActions';
import { loadSampleNetwork } from '@/utils/sampleActions';
import type { DeviceType } from '@/types/network';
import { askConfirm } from '@/store/confirmStore';
import { useT } from '@/i18n';
import { deviceTemplateDescription } from '@/utils/templateText';

const DevicePanel = () => {
  const t = useT();
  const openModal = useUIStore((state) => state.openModal);
  const setAddDeviceType = useUIStore((state) => state.setAddDeviceType);

  // Every template can be placed: the built-in ones and the custom ones
  // created in Impostazioni → Template
  const templates = useTemplateStore((state) => state.templates);

  const devices = useNetworkStore((state) => state.devices);
  const areaCount = useNetworkStore((state) => state.areas.length);
  // (the size of the largest sample is said with its entry, counted on the sample itself)
  const multinationalDevices = useMemo(() => createMultinationalSample().devices.length, []);

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
          ? t.devicePanel.customTemplate(template.type)
          : deviceTemplateDescription(template, t),
        drawing: drawingOf(template, template.type),
      })),
    [templates, t]
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

  // A sample network takes the place of what is on the canvas, and of the
  // network settings of the project: ask first
  const handleLoadSample = async (create: typeof createSampleTopology) => {
    // (an area drawn on a canvas without devices is something to lose, too)
    const shouldLoad =
      (devices.length === 0 && areaCount === 0) ||
      (await askConfirm({
        title: t.devicePanel.samples.replaceQuestion.title,
        detail: t.devicePanel.samples.replaceQuestion.detail,
        confirmLabel: t.devicePanel.samples.replaceQuestion.confirm,
      }));

    if (shouldLoad) {
      // (whole in the window; the steps of the drawing it replaces cannot be undone over it)
      loadSampleNetwork(create());
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
          {t.devicePanel.tabs.devices}
        </button>
        <button
          className={activeTab === 'templates' ? 'active' : ''}
          onClick={() => setActiveTab('templates')}
        >
          {t.devicePanel.tabs.samples}
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
              placeholder={t.devicePanel.searchPlaceholder}
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
              <span>{t.devicePanel.bulkAdd}</span>
            </button>
          </div>

          {/* An area: a labelled rectangle behind a group of devices. It is
              added where the user is looking, ready to be named */}
          <div className="mb-3">
            <button className="sidebar-panel-item w-full" onClick={() => addAreaInView()}>
              <SquareDashed size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>
                {t.devicePanel.area.name}
                <span className="block text-xs text-[var(--text-color-light)]">
                  {t.devicePanel.area.description}
                </span>
              </span>
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
                    <DeviceDrawing drawing={device.drawing} size={32} />
                  </div>
                  <div className="device-list-info">
                    <div className="device-list-name">{device.name}</div>
                    <div className="device-list-description">{device.description}</div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center text-[var(--text-color-light)] py-4">
                {t.devicePanel.noDevicesFor(searchQuery)}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Templates Tab */}
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-color-light)] mb-1">
              {t.devicePanel.samples.intro}
            </p>
            <button
              className="sidebar-panel-item"
              onClick={() => handleLoadSample(createCompanySample)}
            >
              <Plug size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>
                {t.devicePanel.samples.company.title}
                <span className="block text-xs text-[var(--text-color-light)]">
                  {t.devicePanel.samples.company.description}
                </span>
              </span>
            </button>
            <button
              className="sidebar-panel-item"
              onClick={() => handleLoadSample(createSampleTopology)}
            >
              <Plug size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>
                {t.devicePanel.samples.office.title}
                <span className="block text-xs text-[var(--text-color-light)]">
                  {t.devicePanel.samples.office.description}
                </span>
              </span>
            </button>
            <button
              className="sidebar-panel-item"
              onClick={() => handleLoadSample(createPerimeterSample)}
            >
              <Plug size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>
                {t.devicePanel.samples.site.title}
                <span className="block text-xs text-[var(--text-color-light)]">
                  {t.devicePanel.samples.site.description}
                </span>
              </span>
            </button>
            <button
              className="sidebar-panel-item"
              onClick={() => handleLoadSample(createRedundancySample)}
            >
              <Plug size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>
                {t.devicePanel.samples.twoSites.title}
                <span className="block text-xs text-[var(--text-color-light)]">
                  {t.devicePanel.samples.twoSites.description}
                </span>
              </span>
            </button>
            <button
              className="sidebar-panel-item"
              onClick={() => handleLoadSample(createMultinationalSample)}
            >
              <Plug size={18} strokeWidth={1.75} style={{ color: 'var(--text-color-light)', flexShrink: 0 }} />
              <span>
                {t.devicePanel.samples.multinational.title}
                <span className="block text-xs text-[var(--text-color-light)]">
                  {t.devicePanel.samples.multinational.description(multinationalDevices)}
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
