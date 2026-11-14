import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Icon } from '@iconify/react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormFieldset } from '@/components/ui/FormContainer';
import TabContainer, { type Tab } from '@/components/ui/TabContainer';
import { VLANInput } from '@/components/ui/VLANInput';
import {
  CheckField,
  FieldRow,
  ReadOnlyField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui/compact';
import { hintClass, linkClass } from '@/components/ui/compactStyles';
import PortGrid from '@/components/ui/PortGrid';
import PortEditor from '@/components/ui/PortEditor';
import NicRows from '@/components/ui/NicRows';
import { NicAddressFields, type CardLease } from '@/components/ui/NicEditor';
import { RoutedPortsOverview, SwitchPortsOverview } from '@/components/ui/PortsOverview';
import RoutesPanel from '@/components/ui/RoutesPanel';
import FirewallRulesPanel from '@/components/ui/FirewallRulesPanel';
import NatPanel from '@/components/ui/NatPanel';
import DhcpPanel from '@/components/ui/DhcpPanel';
import DnsPanel from '@/components/ui/DnsPanel';
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
import type { DeviceInterface, DhcpResolution } from '@/engine';
import { linkPeerLabel } from '@/utils/interfaceLabels';
import { cardLeaseText, firstPoolProblem, noLeaseLabel, poolStatusText } from '@/utils/dhcpLabels';
import { firstInterfaceProblem, tidyNic, tidyPort } from '@/utils/interfaceProblems';
import { NOTES_MAX_LENGTH, noteRows, tidyNotes } from '@/utils/deviceNotes';
import {
  BRIDGE_PRIORITY_DEFAULT,
  BRIDGE_PRIORITY_MAX,
  BRIDGE_PRIORITY_STEP,
  nearestBridgePriority,
} from '@/utils/bridgePriority';
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
import { useT } from '@/i18n';
import { Rich } from '@/i18n/Rich';
import type {
  DeviceTemplate,
  DhcpPool,
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

type StpMode = 'STP' | 'RSTP' | 'PVST+' | 'MST';

/**
 * InspectorModal
 * The window of a device. Its first screen is made for the device it is
 * about: what it is, how it is addressed (an end device: the address of its
 * first card, typed there; a switch: its VLANs and how its ports are split
 * among them; a router or a firewall: its ports in use, with what each
 * does), and each further tab sets one thing (ports or cards, routes, rules,
 * NAT, DHCP, DNS). Every field goes to one form, which «Salva» checks and
 * saves all together; a tab can send to another one.
 */
const InspectorModal = () => {
  const t = useT();
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
  const [notes, setNotes] = useState('');

  // Network Config
  const [ip, setIp] = useState('');
  const [subnet, setSubnet] = useState('');
  const [gateway, setGateway] = useState('');
  const [vlans, setVlans] = useState<number[]>([]);

  // STP Config
  const [stpEnabled, setStpEnabled] = useState(false);
  const [stpMode, setStpMode] = useState<StpMode>('RSTP');
  const [stpPriority, setStpPriority] = useState(BRIDGE_PRIORITY_DEFAULT);

  // Ports, and the one whose settings are open in «Porte»
  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedPortId, setSelectedPortId] = useState<number | null>(null);

  // Network cards, and the one whose settings are open in «Schede di rete»
  const [nics, setNics] = useState<NetworkInterfaceCard[]>([]);
  const [selectedNicId, setSelectedNicId] = useState<string | null>(null);

  // Routing and filtering (router, firewall)
  const [routes, setRoutes] = useState<StaticRoute[]>([]);
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [portForwards, setPortForwards] = useState<PortForward[]>([]);

  // Name resolution (server): the names it answers for
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);

  // The open tab is kept here, so that a tab can send to another one: from
  // «NAT» and «DHCP» to the port that needs an address, in «Porte»
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (isOpen && inspectorDevice) {
      setName(inspectorDevice.label);
      setVendor(inspectorDevice.vendor || '');
      setLocation(inspectorDevice.location || '');
      setNotes(inspectorDevice.notes || '');
      setIp(inspectorDevice.ip);
      setSubnet(inspectorDevice.subnet);
      setGateway(inspectorDevice.gateway);
      setVlans(inspectorDevice.vlan || []);
      setStpEnabled(inspectorDevice.stp?.enabled || false);
      setStpMode(inspectorDevice.stp?.mode || 'RSTP');
      setStpPriority(nearestBridgePriority(inspectorDevice.stp?.priority));
      setPorts(inspectorDevice.ports || []);
      setSelectedPortId(null);
      setNics(inspectorDevice.nics || []);
      setSelectedNicId(null);
      setRoutes(inspectorDevice.routes || []);
      setFirewallRules(inspectorDevice.firewallRules || []);
      setPortForwards(inspectorDevice.portForwards || []);
      setDnsRecords(inspectorDevice.dnsRecords || []);
      setActiveTab('general');
    }
  }, [isOpen, inspectorDevice]);

  /** A setting of a port, typed in «Porte» */
  const changePort = (portId: number, patch: Partial<Port>) => {
    setPorts((prev) => prev.map((port) => (port.id === portId ? { ...port, ...patch } : port)));
  };

  /** A setting of a card, typed in «Schede di rete» or on the first screen */
  const changeNic = (nicId: string, patch: Partial<NetworkInterfaceCard>) => {
    setNics((prev) => prev.map((nic) => (nic.id === nicId ? { ...nic, ...patch } : nic)));
  };

  /** From another tab: the «Porte» tab, on a port when one is given */
  const openPort = (portId?: number) => {
    if (portId !== undefined) setSelectedPortId(portId);
    setActiveTab('ports');
  };

  /** From another tab: the «Schede di rete» tab, on a card when one is given */
  const openNic = (nicId?: string) => {
    if (nicId !== undefined) setSelectedNicId(nicId);
    setActiveTab('nics');
  };

  /** The DHCP pool of an interface, set from the «DHCP» tab (undefined: none) */
  const handlePoolChange = (iface: DeviceInterface, pool: DhcpPool | undefined) => {
    if (iface.kind === 'port') changePort(iface.port.id, { dhcpServer: pool });
    else changeNic(iface.nic.id, { dhcpServer: pool });
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
      toast.error(t.inspector.toasts.lastCard);
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
      toast.error(viaCards ? t.inspector.toasts.nameRequired : t.inspector.toasts.nameAndIpRequired);
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
      toast.error(
        t.inspector.toasts.routeProblem(routeIndex + 1, routeProblem(keptRoutes[routeIndex]) ?? '')
      );
      return;
    }
    const keptRules = firewallRules.map((rule) => ({
      ...rule,
      source: rule.source.trim().toLowerCase(),
      destination: rule.destination.trim().toLowerCase(),
    }));
    const ruleIndex = keptRules.findIndex((rule) => ruleProblem(rule) !== undefined);
    if (ruleIndex >= 0) {
      toast.error(t.inspector.toasts.ruleProblem(ruleIndex + 1, ruleProblem(keptRules[ruleIndex]) ?? ''));
      return;
    }

    // Ports and cards: what is wrong with one was said under its field while
    // it was typed; here it stops the save, with the name of the port or card
    const interfaceIssue = firstInterfaceProblem(inspectorDevice.type, ports, nics);
    if (interfaceIssue) {
      toast.error(interfaceIssue);
      return;
    }
    // They are kept tidy: trimmed, a DHCP range left empty not kept at all
    const keptPorts = ports.map((port) => tidyPort(inspectorDevice.type, port));
    // (a range left on a card that cannot hand out addresses is not kept either)
    const cardsServe = servesDhcp(inspectorDevice) && !isL3Capable(inspectorDevice);
    const keptNics = nics
      .map(tidyNic)
      .map((nic) => (cardsServe || !nic.dhcpServer ? nic : { ...nic, dhcpServer: undefined }));

    // Port forwards, like routes: a row whose address was never typed is not kept
    const keptForwards = portForwards
      .filter((forward) => !isBlankForward(forward))
      .map((forward) => ({ ...forward, to: forward.to.trim() }));
    const forwardIndex = keptForwards.findIndex(
      (forward) => forwardProblemText(forward, keptPorts) !== undefined
    );
    if (forwardIndex >= 0) {
      toast.error(
        t.inspector.toasts.forwardProblem(
          forwardIndex + 1,
          forwardProblemText(keptForwards[forwardIndex], keptPorts) ?? ''
        )
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
        t.inspector.toasts.recordProblem(
          recordIndex + 1,
          recordProblem(keptRecords[recordIndex], keptRecords) ?? ''
        )
      );
      return;
    }

    // A DHCP server is saved only if it can work with the addresses as they
    // are now (the address of its port may have changed after it was typed)
    const poolIssue = firstPoolProblem({ ...inspectorDevice, ports: keptPorts, nics: keptNics });
    if (poolIssue) {
      toast.error(poolIssue);
      return;
    }

    updateDevice(inspectorDevice.id, {
      label: name,
      vendor: inspectorDevice.type !== 'PC' ? vendor : undefined,
      location: inspectorDevice.type !== 'PC' ? location : undefined,
      // (trimmed; a note emptied is no note)
      notes: tidyNotes(notes),
      ip,
      subnet,
      gateway,
      vlan: vlans.length > 0 ? vlans : undefined,
      stp: stpEnabled
        ? {
            enabled: stpEnabled,
            mode: stpMode,
            // (a number typed between two steps, or past the last one, is kept as the nearest)
            priority: nearestBridgePriority(stpPriority),
          }
        : undefined,
      ports: keptPorts.length > 0 ? keptPorts : undefined,
      // The number of ports is written again only when it was changed here
      ...(keptPorts.length !== (inspectorDevice.ports?.length ?? 0) ? { portCount: keptPorts.length } : {}),
      nics: keptNics.length > 0 ? keptNics : undefined,
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
  const isPC = inspectorDevice.type === 'PC';
  // The device is addressed through its cards: its own three fields follow the first one
  const viaCards = nics.length > 0 && supportsNICs;
  // Spanning tree is a matter of switches: a router or a firewall is not asked about it
  const showStp = supportsSTP && isSwitch;

  // DHCP in the drawing with this device as it is in the form, unsaved edits
  // included: what its cards are leased, what its pools give out. Ports and
  // cards are read as they would be kept (what is being typed is not tidy yet)
  const withForm = (formNics: NetworkInterfaceCard[]) =>
    devices.map((d) =>
      d.id === liveDevice.id
        ? normalizeAddressing({
            ...liveDevice,
            ports: ports.length > 0 ? ports.map((port) => tidyPort(liveDevice.type, port)) : undefined,
            nics: formNics.length > 0 ? formNics.map(tidyNic) : undefined,
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
    leasedAddresses.set(nic.id, lease ? `${lease.ip} · DHCP` : noLeaseLabel());
  }
  /** What the DHCP server of an interface gave out, in words; undefined when it has none that works */
  const poolStatus = (interfaceKey: string): string | undefined => {
    const state = dhcp.pools.find(
      (pool) => pool.deviceId === liveDevice.id && pool.interfaceKey === interfaceKey
    );
    return state && !state.problem ? poolStatusText(state) : undefined;
  };
  const nicPoolStatus = new Map<string, string>();
  for (const nic of nics) {
    const status = poolStatus(`nic:${nic.id}`);
    if (status) nicPoolStatus.set(nic.id, status);
  }

  const primaryNic = nics[0];
  const selectedPort = ports.find((port) => port.id === selectedPortId);

  /**
   * More or fewer ports. New ones are added at the end, as the device was
   * made with; the last ones are taken away, unless a cable is on one of them
   */
  const resizePorts = (count: number) => {
    if (count > ports.length) {
      const added: Port[] = Array.from({ length: count - ports.length }, (_, i) => ({
        id: ports.length + i + 1,
        enabled: true,
        speed: 'auto',
        portType: routesTraffic ? 'lan' : 'access',
      }));
      setPorts([...ports, ...added]);
      return;
    }
    const going = ports.slice(count);
    const linked = going.filter((port) => linkedPorts.has(port.id));
    if (linked.length > 0) {
      toast.error(t.inspector.toasts.portsWithCable(linked.map((port) => port.id)));
      return;
    }
    setPorts(ports.slice(0, count));
    if (selectedPortId !== null && selectedPortId > count) setSelectedPortId(null);
  };
  // The sizes the device can be made with, and the one it has
  const portCounts = [...new Set([...(template?.portOptions ?? []), ports.length])].sort((a, b) => a - b);

  // The words of the first tab, of the fields it shares with ports and cards, of the tab of the ports
  const general = t.inspector.general;
  const fields = t.interfaces.fields;
  const portsTab = t.interfaces.portsTab;
  const tabNames = t.common.deviceTabs;
  /** The name of a tab, with how many things it holds when it holds any */
  const tabLabel = (name: string, count: number) => (count > 0 ? `${name} (${count})` : name);

  // Define tabs
  const tabs: Tab[] = [
    {
      id: 'general',
      label: tabNames.general,
      content: (
        <div className="flex flex-col">
          <FormFieldset legend={general.identity.legend} className="first:mt-0">
            <FieldRow>
              <ReadOnlyField label={general.identity.type}>
                <Icon
                  icon={template?.icon || 'mdi:help-circle'}
                  width={18}
                  height={18}
                  className="text-[var(--accent-text)] shrink-0"
                />
                <span className="font-medium truncate">{template?.name || inspectorDevice.type}</span>
              </ReadOnlyField>
              <TextField
                label={general.identity.name}
                span={isPC ? 2 : 1}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              {!isPC && (
                <TextField
                  label={general.identity.vendor}
                  placeholder={general.identity.vendorPlaceholder}
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                />
              )}
              {!isPC && (
                <TextField
                  label={general.identity.location}
                  placeholder={general.identity.locationPlaceholder}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              )}
              {/* What does not fit a field: every kind of device has it. One
                  row until it is written, then as many as its lines (the
                  first screen of a device is for what the device is) */}
              <TextAreaField
                label={general.identity.notes}
                placeholder={general.identity.notesPlaceholder}
                rows={noteRows(notes)}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={NOTES_MAX_LENGTH}
              />
            </FieldRow>
          </FormFieldset>

          {viaCards ? (
            /* An end device or a server: the address is the one of its first card, typed here */
            <FormFieldset legend={general.network.legendOfCard(primaryNic.name)}>
              <NicAddressFields
                nic={primaryNic}
                onChange={(patch) => changeNic(primaryNic.id, patch)}
                lease={cardLease(primaryNic.id)}
              />
              <p className={`${hintClass} mt-2`}>
                <Rich
                  text={
                    linkedNics.has(primaryNic.id)
                      ? general.network.firstCard.linkedTo
                      : general.network.firstCard.noCable
                  }
                  parts={{ peer: () => linkedNics.get(primaryNic.id) }}
                />{' '}
                <Rich
                  text={
                    nics.length > 1
                      ? general.network.firstCard.firstOfSeveral(nics.length)
                      : general.network.firstCard.onlyCard
                  }
                  parts={{
                    tab: (words) => (
                      <button type="button" className={linkClass} onClick={() => openNic()}>
                        {words}
                      </button>
                    ),
                  }}
                />
              </p>
            </FormFieldset>
          ) : (
            <FormFieldset legend={general.network.legend}>
              <FieldRow>
                <TextField
                  label={fields.ipAddress}
                  mono
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  required
                />
                <TextField
                  label={fields.subnetMask}
                  mono
                  value={subnet}
                  onChange={(e) => setSubnet(e.target.value)}
                />
                <TextField
                  label={routesTraffic ? general.network.gatewayDefaultRoute : fields.gateway}
                  mono
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                />
                {routesTraffic && (
                  <span className={`col-span-4 ${hintClass}`}>{general.network.namedByAddress}</span>
                )}
              </FieldRow>
            </FormFieldset>
          )}

          {supportsVLAN && (
            <FormFieldset legend="VLAN">
              <FieldRow>
                <div className="col-span-2">
                  <VLANInput value={vlans} onChange={setVlans} />
                </div>
                <span className={`col-span-2 ${hintClass}`}>
                  {isSwitch ? general.vlans.hintSwitch : general.vlans.hintOther}
                </span>
              </FieldRow>
            </FormFieldset>
          )}

          {supportsPorts && ports.length > 0 && routesTraffic && (
            <FormFieldset legend={general.portsInUse}>
              <RoutedPortsOverview
                ports={ports}
                showZone={isFirewall}
                linkedPorts={linkedPorts}
                onOpenPort={openPort}
              />
            </FormFieldset>
          )}
          {supportsPorts && ports.length > 0 && isSwitch && (
            <FormFieldset legend={general.ports}>
              <SwitchPortsOverview ports={ports} linkedPorts={linkedPorts} onOpenPort={openPort} />
            </FormFieldset>
          )}
          {showStp && (
            <FormFieldset legend="Spanning tree">
              <FieldRow>
                <CheckField label={general.stp.enabled} inRow checked={stpEnabled} onChange={setStpEnabled} />
                <SelectField
                  label={general.stp.mode}
                  value={stpMode}
                  onChange={(e) => setStpMode(e.target.value as StpMode)}
                  disabled={!stpEnabled}
                >
                  <option value="STP">STP (802.1D)</option>
                  <option value="RSTP">RSTP (802.1w)</option>
                  <option value="PVST+">PVST+ (Cisco)</option>
                  <option value="MST">MST (802.1s)</option>
                </SelectField>
                <TextField
                  label={general.stp.bridgePriority}
                  type="number"
                  value={stpPriority}
                  onChange={(e) => {
                    // (0 is a priority, the lowest: only an empty field is the default)
                    const typed = parseInt(e.target.value, 10);
                    setStpPriority(Number.isNaN(typed) ? BRIDGE_PRIORITY_DEFAULT : typed);
                  }}
                  onBlur={() => setStpPriority(nearestBridgePriority(stpPriority))}
                  min={0}
                  max={BRIDGE_PRIORITY_MAX}
                  step={BRIDGE_PRIORITY_STEP}
                  disabled={!stpEnabled}
                  hint={general.stp.bridgePriorityHint}
                />
                <span className={`pt-[18px] ${hintClass}`}>{general.stp.notSimulated}</span>
              </FieldRow>
            </FormFieldset>
          )}

        </div>
      ),
    },
  ];

  // Ports: the grid of the device, and under it the settings of the port picked
  if (supportsPorts) {
    tabs.push({
      id: 'ports',
      label: tabLabel(tabNames.ports, ports.length),
      content:
        ports.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <p className="text-sm text-[var(--text-color-light)]">
                {portsTab.summary(linkedPorts.size, ports.length)}
              </p>
              <div className="w-[150px] shrink-0">
                <SelectField
                  label={portsTab.count}
                  value={ports.length}
                  onChange={(e) => resizePorts(Number(e.target.value))}
                >
                  {portCounts.map((count) => (
                    <option key={count} value={count}>
                      {portsTab.countOption(count)}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
            <PortGrid
              ports={ports}
              selectedPortId={selectedPortId}
              onPortSelect={setSelectedPortId}
              linkedPorts={linkedPorts}
            />
            {selectedPort ? (
              <div className="border-t border-[var(--border-color)] pt-4">
                <PortEditor
                  key={selectedPort.id}
                  port={selectedPort}
                  deviceType={inspectorDevice.type}
                  onChange={(patch) => changePort(selectedPort.id, patch)}
                  connectedTo={linkedPorts.get(selectedPort.id)}
                  poolStatus={poolStatus(`port:${selectedPort.id}`)}
                />
              </div>
            ) : (
              <p className="port-config-empty">{portsTab.nonePicked}</p>
            )}
          </div>
        ) : (
          <p className="port-config-empty">{portsTab.none}</p>
        ),
    });
  }

  // Network cards: a row each, the one being set open under its row
  if (supportsNICs) {
    tabs.push({
      id: 'nics',
      label: tabLabel(tabNames.cards, nics.length),
      content: (
        <NicRows
          nics={nics}
          openNicId={selectedNicId}
          onOpen={setSelectedNicId}
          onChange={changeNic}
          onAdd={handleAddNic}
          onRemove={handleRemoveNic}
          linkedNics={linkedNics}
          leasedAddresses={leasedAddresses}
          leaseOf={cardLease}
          canServe={servesDhcp(inspectorDevice) && !routesTraffic}
          poolStatus={nicPoolStatus}
        />
      ),
    });
  }

  // Routes: routers and firewalls. The panel shows the table the engine would
  // read from the form as it is now, unsaved edits included
  if (routesTraffic) {
    const keptRoutes = routes.filter((route) => !isBlankRoute(route));
    tabs.push({
      id: 'routes',
      label: tabLabel(tabNames.routes, keptRoutes.length),
      content: (
        <RoutesPanel
          device={{ ...liveDevice, ip, subnet, gateway, ports, nics, routes: keptRoutes }}
          routes={routes}
          onChange={setRoutes}
        />
      ),
    });
  }

  // Rules: firewalls
  if (isFirewall) {
    tabs.push({
      id: 'rules',
      label: tabLabel(tabNames.rules, firewallRules.length),
      content: <FirewallRulesPanel rules={firewallRules} ports={ports} onChange={setFirewallRules} />,
    });
  }

  // Address translation: routers and firewalls that have ports. The panel
  // reads the ports of the form as they are now, unsaved edits included, and
  // switches NAT on and off on them
  if (routesTraffic && supportsPorts) {
    const keptForwards = portForwards.filter((forward) => !isBlankForward(forward));
    tabs.push({
      id: 'nat',
      label: tabLabel(tabNames.nat, keptForwards.length),
      content: (
        <NatPanel
          ports={ports}
          forwards={portForwards}
          isFirewall={isFirewall}
          onChange={setPortForwards}
          onPortsChange={setPorts}
          onOpenPort={openPort}
        />
      ),
    });
  }

  // DHCP server: routers and firewalls on their ports, servers on their
  // cards. The panel sets the pools and shows what the engine makes of the
  // form as it is now
  if (servesDhcp(inspectorDevice) && (supportsPorts || supportsNICs)) {
    const poolCount = dhcp.pools.filter((pool) => pool.deviceId === liveDevice.id).length;
    tabs.push({
      id: 'dhcp',
      label: tabLabel(tabNames.dhcp, poolCount),
      content: (
        <DhcpPanel
          deviceId={liveDevice.id}
          dhcp={dhcp}
          setIn={supportsPorts ? 'ports' : 'cards'}
          interfaces={listInterfaces({ ...liveDevice, ports, nics }).filter(
            (iface) => iface.kind === (supportsPorts ? 'port' : 'nic')
          )}
          onPoolChange={handlePoolChange}
          onOpenInterface={(iface) =>
            supportsPorts
              ? openPort(iface?.kind === 'port' ? iface.port.id : undefined)
              : openNic(iface?.kind === 'nic' ? iface.nic.id : undefined)
          }
        />
      ),
    });
  }

  // DNS server: a server. The panel checks the rows of the form as they are
  // typed, and says at which address the server is asked
  if (servesDns(inspectorDevice)) {
    const recordCount = dnsRecords.filter((record) => !isBlankRecord(record)).length;
    tabs.push({
      id: 'dns',
      label: tabLabel(tabNames.dns, recordCount),
      content: (
        <DnsPanel
          records={dnsRecords}
          onChange={setDnsRecords}
          addresses={nics.filter((nic) => nic.ip && !nic.dhcp).map((nic) => nic.ip)}
        />
      ),
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t.inspector.title(inspectorDevice.label)}
      size="lg"
      autoHeight={true}
      verticalAlign="start"
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleClose}>
            {t.common.actions.cancel}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {t.common.actions.save}
          </Button>
        </div>
      }
    >
      {/* A window with several tabs keeps one height, so that it does not
          jump from a tab to the next; a device with little to set (a PC) is
          as tall as what it shows */}
      <div style={{ minHeight: tabs.length > 2 ? '420px' : undefined }}>
        <TabContainer tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </Modal>
  );
};

export default InspectorModal;
