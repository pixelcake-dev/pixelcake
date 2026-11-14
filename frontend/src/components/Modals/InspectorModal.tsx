import { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
import RoutesPanel from '@/components/ui/RoutesPanel';
import FirewallRulesPanel from '@/components/ui/FirewallRulesPanel';
import NatPanel from '@/components/ui/NatPanel';
import DhcpPanel from '@/components/ui/DhcpPanel';
import DnsPanel from '@/components/ui/DnsPanel';
import type { CardLease } from '@/components/ui/NICConfigPanel';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { generateMacAddress } from '@/utils/ipHelpers';
import {
  interfaceLinks,
  isL3Capable,
  leaseOf,
  listInterfaces,
  normalizeAddressing,
  resolveDhcp,
  servesDhcp,
  servesDns,
} from '@/engine';
import type { DhcpResolution } from '@/engine';
import { linkPeerLabel } from '@/utils/interfaceLabels';
import { NO_LEASE_LABEL, cardLeaseText, firstPoolProblem } from '@/utils/dhcpLabels';
import {
  forwardProblemText,
  isBlankForward,
  isBlankRecord,
  isBlankRoute,
  recordProblem,
  routeProblem,
  ruleProblem,
  tidyRecord,
} from '@/utils/networkConfigValidation';
import type {
  DeviceTemplate,
  DnsRecord,
  FirewallRule,
  NetworkDevice,
  NetworkInterfaceCard,
  Port,
  PortForward,
  StaticRoute,
} from '@/types/network';

/** The template of a device: the one it was made from, else the one of its type */
function templateOf(
  device: Pick<NetworkDevice, 'templateId' | 'type'>,
  templates: DeviceTemplate[]
): DeviceTemplate | undefined {
  return device.templateId
    ? templates.find((t) => t.id === device.templateId)
    : templates.find((t) => t.type === device.type);
}

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

  // Routing and filtering (router, firewall)
  const [routes, setRoutes] = useState<StaticRoute[]>([]);
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [portForwards, setPortForwards] = useState<PortForward[]>([]);

  // Name resolution (server): the names it answers for
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);

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
      setRoutes(inspectorDevice.routes || []);
      setFirewallRules(inspectorDevice.firewallRules || []);
      setPortForwards(inspectorDevice.portForwards || []);
      setDnsRecords(inspectorDevice.dnsRecords || []);
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
      toast.error('Impossibile rimuovere l\'ultima scheda di rete');
      return;
    }
    setNics(nics.filter((nic) => nic.id !== nicId));
    if (selectedNicId === nicId) {
      setSelectedNicId(null);
    }
  };

  const handleSave = () => {
    if (!inspectorDevice) return;
    // A device with network cards is addressed through them (and a card may
    // take its address from DHCP, or have none): the address is asked for
    // here only where it is typed here
    const viaCards = nics.length > 0 && (templateOf(inspectorDevice, templates)?.supportsNICs ?? false);
    if (!name.trim() || (!viaCards && !ip.trim())) {
      toast.error(viaCards ? 'Il nome è obbligatorio' : 'Nome e IP sono obbligatori');
      return;
    }

    // Routes and rules are saved only when the engine can read every one of
    // them; a route row left empty is simply not kept
    const keptRoutes = routes
      .filter((route) => !isBlankRoute(route))
      .map((route) => ({
        ...route,
        destination: route.destination.trim(),
        nextHop: route.nextHop.trim(),
      }));
    const routeIndex = keptRoutes.findIndex((route) => routeProblem(route) !== undefined);
    if (routeIndex >= 0) {
      toast.error(`Rotta ${routeIndex + 1}: ${routeProblem(keptRoutes[routeIndex])}`);
      return;
    }
    const keptRules = firewallRules.map((rule) => ({
      ...rule,
      source: rule.source.trim().toLowerCase(),
      destination: rule.destination.trim().toLowerCase(),
    }));
    const ruleIndex = keptRules.findIndex((rule) => ruleProblem(rule) !== undefined);
    if (ruleIndex >= 0) {
      toast.error(`Regola ${ruleIndex + 1}: ${ruleProblem(keptRules[ruleIndex])}`);
      return;
    }
    // Port forwards, like routes: a row whose address was never typed is not kept
    const keptForwards = portForwards
      .filter((forward) => !isBlankForward(forward))
      .map((forward) => ({ ...forward, to: forward.to.trim() }));
    const forwardIndex = keptForwards.findIndex(
      (forward) => forwardProblemText(forward, ports) !== undefined
    );
    if (forwardIndex >= 0) {
      toast.error(
        `Inoltro ${forwardIndex + 1}: ${forwardProblemText(keptForwards[forwardIndex], ports)}`
      );
      return;
    }

    // DNS records, like routes: a row left empty is not kept, and a name is
    // kept the way names are compared
    const keptRecords = dnsRecords.filter((record) => !isBlankRecord(record)).map(tidyRecord);
    const recordIndex = keptRecords.findIndex(
      (record) => recordProblem(record, keptRecords) !== undefined
    );
    if (recordIndex >= 0) {
      toast.error(
        `Record DNS ${recordIndex + 1}: ${recordProblem(keptRecords[recordIndex], keptRecords)}`
      );
      return;
    }

    // A DHCP server is saved only if it can work with the addresses as they
    // are now (the address of its port may have changed after it was typed)
    const poolIssue = firstPoolProblem({ ...inspectorDevice, ports, nics });
    if (poolIssue) {
      toast.error(poolIssue);
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
      routes: keptRoutes.length > 0 ? keptRoutes : undefined,
      firewallRules: keptRules.length > 0 ? keptRules : undefined,
      portForwards: keptForwards.length > 0 ? keptForwards : undefined,
      dnsRecords: keptRecords.length > 0 ? keptRecords : undefined,
    });

    handleClose();
  };

  const handleClose = () => {
    closeModal('inspector');
  };

  if (!isOpen || !inspectorDevice) return null;

  // Get template capabilities (prefer templateId for specific lookup)
  const template = templateOf(inspectorDevice, templates);
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

  // Routers and firewalls route; firewalls also filter
  const routesTraffic = isL3Capable(inspectorDevice);
  const isFirewall = inspectorDevice.type.toLowerCase().includes('firewall');
  const isSwitch = inspectorDevice.type.toLowerCase().includes('switch');

  // DHCP in the drawing with this device as it is in the form, unsaved edits
  // included: what its cards are leased, what its pools give out
  const withForm = (formNics: NetworkInterfaceCard[]) =>
    devices.map((d) =>
      d.id === liveDevice.id
        ? normalizeAddressing({
            ...liveDevice,
            ports: ports.length > 0 ? ports : undefined,
            nics: formNics.length > 0 ? formNics : undefined,
          })
        : d
    );
  const dhcp: DhcpResolution = resolveDhcp({ devices: withForm(nics), connections });
  /** What a card of the form gets with its address on DHCP, whether it is on DHCP yet or not */
  const cardLease = (nicId: string): CardLease => {
    const asClient = nics.map((nic) =>
      nic.id === nicId ? { ...nic, dhcp: true, dhcpServer: undefined } : nic
    );
    const preview = resolveDhcp({ devices: withForm(asClient), connections });
    const lease = leaseOf(preview, liveDevice.id, nicId);
    return {
      text: cardLeaseText(preview, liveDevice.id, nicId).text,
      given: lease
        ? { ip: lease.ip, subnet: lease.mask, gateway: lease.gateway, dns: lease.dns }
        : undefined,
    };
  };
  // What the list of the cards shows for those on DHCP
  const leasedAddresses = new Map<string, string>();
  for (const nic of nics) {
    if (!nic.dhcp) continue;
    const lease = leaseOf(dhcp, liveDevice.id, nic.id);
    leasedAddresses.set(nic.id, lease ? `${lease.ip} · DHCP` : NO_LEASE_LABEL);
  }
  // The addressing of the device is the one of its first card: leased, when
  // the card is on DHCP
  const primaryNic = nics[0];
  const primaryLease = primaryNic?.dhcp ? leaseOf(dhcp, liveDevice.id, primaryNic.id) : undefined;
  const primaryAddressing = primaryNic?.dhcp
    ? { ip: primaryLease?.ip ?? '', subnet: primaryLease?.mask ?? '', gateway: primaryLease?.gateway ?? '' }
    : { ip: primaryNic?.ip || ip, subnet: primaryNic?.subnet || subnet, gateway: primaryNic?.gateway || gateway };

  // Define tabs
  const tabs: Tab[] = [
    {
      id: 'general',
      label: 'Generale',
      content: (
        <FormContainer columns={2} gap="4">
          {/* Column 1: Device Identity + STP */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Device Identity */}
            <FormFieldset legend="Identità">
              <FormContainer gap="2">
                <DeviceTypeDisplay deviceType={inspectorDevice.type} label="Tipo" />

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
              <FormFieldset legend="Spanning Tree (STP)">
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
                        STP attivo
                      </span>
                    </label>
                  </div>

                  <Select
                    label="Modalità STP"
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
                    label="Priorità del bridge"
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
                    Da 0 a 65535 a passi di 4096 (predefinita 32768)
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-color-light)' }}>
                    Lo spanning tree resta come documentazione: il motore non lo simula.
                  </p>
                </FormContainer>
              </FormFieldset>
            )}
          </div>

          {/* Column 2: Network Configuration */}
          <div>
            <FormFieldset legend="Rete">
              <FormContainer gap="2">
                {nics.length > 0 && supportsNICs ? (
                  <>
                    <Input
                      label="Indirizzo IP (sola lettura)"
                      value={primaryAddressing.ip}
                      size="full"
                      readOnly
                    />

                    <Input
                      label="Subnet Mask (sola lettura)"
                      value={primaryAddressing.subnet}
                      size="full"
                      readOnly
                    />

                    <Input
                      label="Gateway (sola lettura)"
                      value={primaryAddressing.gateway}
                      size="full"
                      readOnly
                    />

                    <p className="text-xs text-[var(--text-color-light)] mt-1">
                      {primaryNic?.dhcp ? (
                        <>
                          La prima scheda di rete prende l&apos;indirizzo dal DHCP
                          {primaryLease ? ': ' : '. '}
                          {cardLeaseText(dhcp, liveDevice.id, primaryNic.id).text}. Si cambia nella
                          scheda «Schede di rete».
                        </>
                      ) : (
                        <>
                          L&apos;indirizzo è quello della prima scheda di rete: si modifica nella
                          scheda «Schede di rete».
                        </>
                      )}
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
                      label={routesTraffic ? 'Gateway (rotta predefinita)' : 'Gateway'}
                      value={gateway}
                      onChange={(e) => setGateway(e.target.value)}
                      size="full"
                    />
                    {routesTraffic && (
                      <p className="text-xs text-[var(--text-color-light)] mt-1">
                        L&apos;indirizzo qui sopra è quello con cui il dispositivo viene nominato; le
                        reti a cui è collegato sono gli indirizzi delle sue porte.
                      </p>
                    )}
                  </>
                )}

                {supportsVLAN && (
                  <>
                    <VLANInput label="VLAN" value={vlans} onChange={setVlans} />
                    <p className="text-xs text-[var(--text-color-light)] mt-1">
                      {isSwitch
                        ? 'Le VLAN che lo switch conosce: le altre vengono scartate. Vuoto: tutte. La VLAN di ogni porta si sceglie nella scheda «Porte».'
                        : 'Le VLAN che il dispositivo accetta con etichetta su una porta trunk. Vuoto: solo traffico senza etichetta.'}
                    </p>
                  </>
                )}
              </FormContainer>
            </FormFieldset>
          </div>
        </FormContainer>
      ),
    },
  ];

  // Add Ports tab if device supports port management
  if (supportsPorts) {
    tabs.push({
      id: 'ports',
      label: `Porte${ports.length > 0 ? ` (${ports.length})` : ''}`,
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
      label: `Schede di rete${nics.length > 0 ? ` (${nics.length})` : ''}`,
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
                    leasedAddresses={leasedAddresses}
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
                    lease={selectedNicId !== null ? cardLease(selectedNicId) : undefined}
                    canServe={servesDhcp(inspectorDevice) && !routesTraffic}
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

  // Routes: routers and firewalls. The panel shows the table the engine would
  // read from the form as it is now, unsaved edits included
  if (routesTraffic) {
    const keptRoutes = routes.filter((route) => !isBlankRoute(route));
    tabs.push({
      id: 'routes',
      label: `Rotte${keptRoutes.length > 0 ? ` (${keptRoutes.length})` : ''}`,
      content: (
        <div style={{ minHeight: '400px' }}>
          <RoutesPanel
            device={{ ...liveDevice, ip, subnet, gateway, ports, nics, routes: keptRoutes }}
            routes={routes}
            onChange={setRoutes}
          />
        </div>
      ),
    });
  }

  // Rules: firewalls
  if (isFirewall) {
    tabs.push({
      id: 'rules',
      label: `Regole${firewallRules.length > 0 ? ` (${firewallRules.length})` : ''}`,
      content: (
        <div style={{ minHeight: '400px' }}>
          <FirewallRulesPanel rules={firewallRules} ports={ports} onChange={setFirewallRules} />
        </div>
      ),
    });
  }

  // Address translation: routers and firewalls that have ports. The panel
  // reads the ports of the form as they are now, unsaved edits included
  if (routesTraffic && supportsPorts) {
    const keptForwards = portForwards.filter((forward) => !isBlankForward(forward));
    tabs.push({
      id: 'nat',
      label: `NAT${keptForwards.length > 0 ? ` (${keptForwards.length})` : ''}`,
      content: (
        <div style={{ minHeight: '400px' }}>
          <NatPanel
            ports={ports}
            forwards={portForwards}
            isFirewall={isFirewall}
            onChange={setPortForwards}
          />
        </div>
      ),
    });
  }

  // DHCP server: routers and firewalls on their ports, servers on their
  // cards. The panel shows what the engine makes of the form as it is now
  if (servesDhcp(inspectorDevice) && (supportsPorts || supportsNICs)) {
    const poolCount = dhcp.pools.filter((pool) => pool.deviceId === liveDevice.id).length;
    tabs.push({
      id: 'dhcp',
      label: `DHCP${poolCount > 0 ? ` (${poolCount})` : ''}`,
      content: (
        <div style={{ minHeight: '400px' }}>
          <DhcpPanel
            deviceId={liveDevice.id}
            dhcp={dhcp}
            setIn={supportsPorts ? 'Porte' : 'Schede di rete'}
          />
        </div>
      ),
    });
  }

  // DNS server: a server. The panel checks the rows of the form as they are
  // typed, and says at which address the server is asked
  if (servesDns(inspectorDevice)) {
    const recordCount = dnsRecords.filter((record) => !isBlankRecord(record)).length;
    tabs.push({
      id: 'dns',
      label: `DNS${recordCount > 0 ? ` (${recordCount})` : ''}`,
      content: (
        <div style={{ minHeight: '400px' }}>
          <DnsPanel
            records={dnsRecords}
            onChange={setDnsRecords}
            addresses={nics.filter((nic) => nic.ip).map((nic) => nic.ip)}
          />
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
