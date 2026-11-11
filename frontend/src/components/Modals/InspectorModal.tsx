import { useState, useEffect } from 'react';
import { Scrollbars } from 'react-custom-scrollbars-2';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormContainer, FormFieldset } from '@/components/ui/FormContainer';
import TabContainer, { type Tab } from '@/components/ui/TabContainer';
import { VLANInput } from '@/components/ui/VLANInput';
import { DeviceTypeDisplay } from '@/components/ui/DeviceTypeDisplay';
import PortGrid from '@/components/ui/PortGrid';
import PortConfigPanel from '@/components/ui/PortConfigPanel';
import NICList from '@/components/ui/NICList';
import NICConfigPanel from '@/components/ui/NICConfigPanel';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { generateMacAddress } from '@/utils/ipHelpers';
import { interfaceLinks, listInterfaces } from '@/engine';
import { linkPeerLabel } from '@/utils/interfaceLabels';
import { FileCode } from 'lucide-react';
import type { Port, NetworkInterfaceCard } from '@/types/network';

const InspectorModal = () => {
  const isOpen = useUIStore((state) => state.modals.inspector);
  const inspectorDevice = useUIStore((state) => state.inspectorDevice);
  const closeModal = useUIStore((state) => state.closeModal);
  const updateDevice = useNetworkStore((state) => state.updateDevice);
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const templates = useTemplateStore((state) => state.templates);

  // Device Identity
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [location, setLocation] = useState('');

  // Network Config
  const [ip, setIp] = useState('');
  const [subnet, setSubnet] = useState('');
  const [gateway, setGateway] = useState('');
  const [vlans, setVlans] = useState<number[]>([]);

  // STP Config
  const [stpEnabled, setStpEnabled] = useState(false);
  const [stpMode, setStpMode] = useState<'STP' | 'RSTP' | 'PVST+' | 'MST'>('RSTP');
  const [stpPriority, setStpPriority] = useState(32768);

  // Port Management
  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedPortId, setSelectedPortId] = useState<number | null>(null);

  // NIC Management
  const [nics, setNics] = useState<NetworkInterfaceCard[]>([]);
  const [selectedNicId, setSelectedNicId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && inspectorDevice) {
      setName(inspectorDevice.label);
      setVendor(inspectorDevice.vendor || '');
      setLocation(inspectorDevice.location || '');
      setIp(inspectorDevice.ip);
      setSubnet(inspectorDevice.subnet);
      setGateway(inspectorDevice.gateway);
      setVlans(inspectorDevice.vlan || []);
      setStpEnabled(inspectorDevice.stp?.enabled || false);
      setStpMode(inspectorDevice.stp?.mode || 'RSTP');
      setStpPriority(inspectorDevice.stp?.priority || 32768);
      setPorts(inspectorDevice.ports || []);
      setSelectedPortId(null);
      setNics(inspectorDevice.nics || []);
      setSelectedNicId(null);
    }
  }, [isOpen, inspectorDevice]);

  const handlePortSave = (portId: number, updates: Partial<Port>) => {
    setPorts((prevPorts) =>
      prevPorts.map((port) =>
        port.id === portId ? { ...port, ...updates } : port
      )
    );
    setSelectedPortId(null); // Deselect after save
  };

  const handlePortCancel = () => {
    setSelectedPortId(null);
  };

  const handleNicSave = (nicId: string, updates: Partial<NetworkInterfaceCard>) => {
    setNics((prevNics) =>
      prevNics.map((nic) =>
        nic.id === nicId ? { ...nic, ...updates } : nic
      )
    );
    setSelectedNicId(null); // Deselect after save
  };

  const handleNicCancel = () => {
    setSelectedNicId(null);
  };

  const handleAddNic = () => {
    // Lowest id and name not in use: links are bound to a NIC by id (and
    // exported by name), so neither may repeat after a NIC was removed
    let newNicNumber = 1;
    while (nics.some((nic) => nic.id === `nic-${newNicNumber}`)) newNicNumber++;
    let nameIndex = 0;
    while (nics.some((nic) => nic.name === `eth${nameIndex}`)) nameIndex++;
    const newNic: NetworkInterfaceCard = {
      id: `nic-${newNicNumber}`,
      name: `eth${nameIndex}`,
      enabled: true,
      speed: 'auto',
      ip: '',
      subnet: inspectorDevice?.subnet || '255.255.255.0',
      gateway: inspectorDevice?.gateway || '',
      mac: generateMacAddress(),
    };
    setNics([...nics, newNic]);
    setSelectedNicId(newNic.id);
  };

  const handleRemoveNic = (nicId: string) => {
    if (nics.length <= 1) {
      alert('Impossibile rimuovere l\'ultima scheda di rete');
      return;
    }
    setNics(nics.filter((nic) => nic.id !== nicId));
    if (selectedNicId === nicId) {
      setSelectedNicId(null);
    }
  };

  const handleSave = () => {
    if (!inspectorDevice || !name.trim() || !ip.trim()) {
      alert('Nome e IP sono obbligatori');
      return;
    }

    updateDevice(inspectorDevice.id, {
      label: name,
      vendor: inspectorDevice.type !== 'PC' ? vendor : undefined,
      location: inspectorDevice.type !== 'PC' ? location : undefined,
      ip,
      subnet,
      gateway,
      vlan: vlans.length > 0 ? vlans : undefined,
      stp: stpEnabled
        ? {
            enabled: stpEnabled,
            mode: stpMode,
            priority: stpPriority,
          }
        : undefined,
      ports: ports.length > 0 ? ports : undefined,
      nics: nics.length > 0 ? nics : undefined,
    });

    handleClose();
  };

  const handleClose = () => {
    closeModal('inspector');
  };

  if (!isOpen || !inspectorDevice) return null;

  // Get template capabilities (prefer templateId for specific lookup)
  const template = inspectorDevice.templateId
    ? templates.find((t) => t.id === inspectorDevice.templateId)
    : templates.find((t) => t.type === inspectorDevice.type);
  const supportsVLAN = template?.supportsVLAN || false;
  const supportsSTP = template?.supportsSTP || false;
  const supportsPorts = template?.supportsPorts || false;
  const supportsNICs = template?.supportsNICs || false;

  // What each port/NIC of this device is linked to, from the live topology
  // (the inspector holds a snapshot of the device taken when it was opened)
  const liveDevice = devices.find((d) => d.id === inspectorDevice.id) ?? inspectorDevice;
  const linkedPorts = new Map<number, string>();
  const linkedNics = new Map<string, string>();
  const links = interfaceLinks(liveDevice, devices, connections);
  for (const iface of listInterfaces(liveDevice)) {
    const link = links.get(iface.key);
    if (!link) continue;
    if (iface.kind === 'port') linkedPorts.set(iface.port.id, linkPeerLabel(link));
    else linkedNics.set(iface.nic.id, linkPeerLabel(link));
  }

  // Define tabs
  const tabs: Tab[] = [
    {
      id: 'general',
      label: 'General Configuration',
      content: (
        <FormContainer columns={2} gap="4">
          {/* Column 1: Device Identity + STP */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Device Identity */}
            <FormFieldset legend="Device Identity">
              <FormContainer gap="2">
                <DeviceTypeDisplay deviceType={inspectorDevice.type} label="Device Type" />

                <Input
                  label="Nome Dispositivo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  size="full"
                  required
                />

                {inspectorDevice.type !== 'PC' && (
                  <Input
                    label="Vendor"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    size="full"
                  />
                )}

                {inspectorDevice.type !== 'PC' && (
                  <Input
                    label="Posizione"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    size="full"
                  />
                )}
              </FormContainer>
            </FormFieldset>

            {/* STP Configuration */}
            {supportsSTP && (
              <FormFieldset legend="STP Configuration">
                <FormContainer gap="2">
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={stpEnabled}
                        onChange={(e) => setStpEnabled(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>
                        STP Enabled
                      </span>
                    </label>
                  </div>

                  <Select
                    label="STP Mode"
                    value={stpMode}
                    onChange={(e) => setStpMode(e.target.value as typeof stpMode)}
                    size="full"
                    disabled={!stpEnabled}
                  >
                    <option value="STP">STP (802.1D)</option>
                    <option value="RSTP">RSTP (802.1w)</option>
                    <option value="PVST+">PVST+ (Cisco)</option>
                    <option value="MST">MST (802.1s)</option>
                  </Select>

                  <Input
                    label="Bridge Priority"
                    type="number"
                    value={stpPriority}
                    onChange={(e) => setStpPriority(parseInt(e.target.value) || 32768)}
                    min={0}
                    max={65535}
                    step={4096}
                    size="full"
                    disabled={!stpEnabled}
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-color-light)', marginTop: '-8px' }}>
                    Range: 0-65535 (step 4096, default 32768)
                  </p>
                </FormContainer>
              </FormFieldset>
            )}
          </div>

          {/* Column 2: Network Configuration */}
          <div>
            <FormFieldset legend="Network Configuration">
              <FormContainer gap="2">
                {nics.length > 0 && supportsNICs ? (
                  <>
                    <Input
                      label="Indirizzo IP (Read-Only)"
                      value={nics[0]?.ip || ip}
                      size="full"
                      readOnly
                    />

                    <Input
                      label="Subnet Mask (Read-Only)"
                      value={nics[0]?.subnet || subnet}
                      size="full"
                      readOnly
                    />

                    <Input
                      label="Gateway (Read-Only)"
                      value={nics[0]?.gateway || gateway}
                      size="full"
                      readOnly
                    />

                    <p className="text-xs text-[var(--text-color-light)] mt-1">
                      Configurazione di rete gestita tramite schede di rete (NICs).
                      Modifica nella tab "Network Interfaces".
                    </p>
                  </>
                ) : (
                  <>
                    <Input
                      label="Indirizzo IP"
                      value={ip}
                      onChange={(e) => setIp(e.target.value)}
                      size="full"
                      required
                    />

                    <Input
                      label="Subnet Mask"
                      value={subnet}
                      onChange={(e) => setSubnet(e.target.value)}
                      size="full"
                    />

                    <Input
                      label="Gateway"
                      value={gateway}
                      onChange={(e) => setGateway(e.target.value)}
                      size="full"
                    />
                  </>
                )}

                {supportsVLAN && (
                  <VLANInput
                    label="VLAN IDs"
                    value={vlans}
                    onChange={setVlans}
                  />
                )}
              </FormContainer>
            </FormFieldset>
          </div>
        </FormContainer>
      ),
    },
    {
      id: 'terraform',
      label: 'Terraform Export',
      content: (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px',
            gap: '16px',
            color: 'var(--text-color-light)',
          }}
        >
          <FileCode size={48} />
          <p style={{ fontSize: '16px', fontWeight: 500 }}>
            Terraform export fields will be available in future updates
          </p>
          <p style={{ fontSize: '14px' }}>
            This section will contain resource naming, tags, and cloud provider settings
          </p>
        </div>
      ),
    },
  ];

  // Add Ports tab if device supports port management
  if (supportsPorts) {
    tabs.push({
      id: 'ports',
      label: `Ports${ports.length > 0 ? ` (${ports.length})` : ''}`,
      content: (
        <div style={{ display: 'flex', gap: '20px', minHeight: '400px', height: '500px' }}>
          {ports.length > 0 ? (
            <>
              {/* Left: Port Grid (flexible, takes remaining space) */}
              <div style={{ flex: '1', minWidth: '400px', display: 'flex', flexDirection: 'column' }}>
                <Scrollbars
                  autoHide
                  autoHideTimeout={1000}
                  style={{ flex: 1 }}
                  renderView={({ style, ...props }) => (
                    <div {...props} style={{
                      ...style,
                      backgroundColor: 'var(--bg-toolbar)',
                      marginRight: -20,
                      marginBottom: -20
                    }} />
                  )}
                  renderThumbVertical={({ style, ...props }) => (
                    <div
                      {...props}
                      style={{
                        ...style,
                        backgroundColor: 'var(--accent-color)',
                        borderRadius: '6px',
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
                  <PortGrid
                    ports={ports}
                    selectedPortId={selectedPortId}
                    onPortSelect={setSelectedPortId}
                    linkedPorts={linkedPorts}
                  />
                </Scrollbars>
              </div>

              {/* Right: Port Configuration Panel (fixed width with custom scrollbar) */}
              <div style={{ width: '420px', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Scrollbars
                  autoHide
                  autoHideTimeout={1000}
                  style={{ flex: 1, minHeight: 0 }}
                  renderView={({ style, ...props }) => (
                    <div {...props} style={{
                      ...style,
                      backgroundColor: 'var(--bg-toolbar)',
                      marginRight: -20,
                      marginBottom: -20
                    }} />
                  )}
                  renderThumbVertical={({ style, ...props }) => (
                    <div
                      {...props}
                      style={{
                        ...style,
                        backgroundColor: 'var(--accent-color)',
                        borderRadius: '6px',
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
                  <PortConfigPanel
                    port={ports.find((p) => p.id === selectedPortId) || null}
                    deviceType={inspectorDevice.type}
                    onSave={handlePortSave}
                    onCancel={handlePortCancel}
                    connectedTo={
                      selectedPortId !== null ? linkedPorts.get(selectedPortId) : undefined
                    }
                  />
                </Scrollbars>
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '40px',
              color: 'var(--text-color-light)',
              textAlign: 'center'
            }}>
              <p>Nessuna porta configurata per questo dispositivo.</p>
            </div>
          )}
        </div>
      ),
    });
  }

  // Add NICs tab if device supports network interface cards
  if (supportsNICs) {
    tabs.push({
      id: 'nics',
      label: `Network Interfaces${nics.length > 0 ? ` (${nics.length})` : ''}`,
      content: (
        <div style={{ display: 'flex', gap: '20px', minHeight: '400px', height: '500px' }}>
          {nics.length > 0 ? (
            <>
              {/* Left: NIC List (flexible, takes remaining space) */}
              <div style={{ flex: '1', minWidth: '400px', display: 'flex', flexDirection: 'column' }}>
                <Scrollbars
                  autoHide
                  autoHideTimeout={1000}
                  style={{ flex: 1 }}
                  renderView={({ style, ...props }) => (
                    <div {...props} style={{
                      ...style,
                      backgroundColor: 'var(--bg-toolbar)',
                      marginRight: -20,
                      marginBottom: -20
                    }} />
                  )}
                  renderThumbVertical={({ style, ...props }) => (
                    <div
                      {...props}
                      style={{
                        ...style,
                        backgroundColor: 'var(--accent-color)',
                        borderRadius: '6px',
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
                  <NICList
                    nics={nics}
                    selectedNicId={selectedNicId}
                    onNicSelect={setSelectedNicId}
                    onAddNic={handleAddNic}
                    onRemoveNic={handleRemoveNic}
                    linkedNics={linkedNics}
                  />
                </Scrollbars>
              </div>

              {/* Right: NIC Configuration Panel (fixed width with custom scrollbar) */}
              <div style={{ width: '420px', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Scrollbars
                  autoHide
                  autoHideTimeout={1000}
                  style={{ flex: 1, minHeight: 0 }}
                  renderView={({ style, ...props }) => (
                    <div {...props} style={{
                      ...style,
                      backgroundColor: 'var(--bg-toolbar)',
                      marginRight: -20,
                      marginBottom: -20
                    }} />
                  )}
                  renderThumbVertical={({ style, ...props }) => (
                    <div
                      {...props}
                      style={{
                        ...style,
                        backgroundColor: 'var(--accent-color)',
                        borderRadius: '6px',
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
                  <NICConfigPanel
                    nic={nics.find((n) => n.id === selectedNicId) || null}
                    onSave={handleNicSave}
                    onCancel={handleNicCancel}
                  />
                </Scrollbars>
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '40px',
              color: 'var(--text-color-light)',
              textAlign: 'center'
            }}>
              <p>Nessuna scheda di rete configurata per questo dispositivo.</p>
            </div>
          )}
        </div>
      ),
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Modifica: ${inspectorDevice.label}`}
      size="lg"
      autoHeight={true}
      verticalAlign="start"
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
      <div style={{ minHeight: '500px' }}>
        <TabContainer tabs={tabs} defaultTab="general" />
      </div>
    </Modal>
  );
};

export default InspectorModal;
