import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import DeviceDrawing from '@/components/ui/DeviceDrawing';
import { drawingOf } from '@/utils/deviceDrawing';
import { Button } from '@/components/ui/Button';
import { FormFieldset } from '@/components/ui/FormContainer';
import { FieldRow, ReadOnlyField, SelectField, TextField } from '@/components/ui/compact';
import { hintClass } from '@/components/ui/compactStyles';
import { NicAddressFields } from '@/components/ui/NicEditor';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { findNextAvailableIP, generateMacAddress } from '@/utils/ipHelpers';
import { firstFreePlace } from '@/utils/placeDevice';
import { newDevicePlace } from '@/utils/viewPlace';
import { isNameTaken, newDeviceName, newDevicePorts } from '@/utils/newDevice';
import { nicProblems, tidyNic } from '@/utils/interfaceProblems';
import { isEndDeviceKind } from '@/utils/defaultDns';
import { isL3Type, withLeases } from '@/engine';
import { useT } from '@/i18n';
import type { DeviceType, Port, NetworkInterfaceCard } from '@/types/network';

/**
 * AddDeviceModal
 * A new device, of the type picked in the panel: its name, and how it is
 * addressed. An end device is addressed through its card, and the address is
 * typed (or left to DHCP) here, with the same fields its window has; the
 * rest of a device is set in its window once it is on the canvas.
 */
const AddDeviceModal = () => {
  const t = useT();
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
        ? templates.find((tpl) => tpl.id === addDeviceTemplateId)
        : templates.find((tpl) => tpl.type === addDeviceType);

      // The name is proposed: the name of the template and the lowest number
      // that leaves it free on the canvas (the same name bulk add gives)
      setName(newDeviceName(template?.name || addDeviceType, devices));

      // Find next available IP: not one a device has, written by hand or
      // leased by DHCP
      const { connections } = useNetworkStore.getState();
      const nextIp = findNextAvailableIP(withLeases({ devices, connections }).devices, globalSettings);
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
          // The DNS server of the project, when it has one: for an end
          // device, not for what only carries the traffic of others
          ...(globalSettings.dns && isEndDeviceKind(addDeviceType, template.id)
            ? { dns: globalSettings.dns }
            : {}),
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

  // An end device is addressed through its card: what is typed here is the card
  const card = nics?.[0];

  // A name another device has is refused: the terminal finds a device by its
  // name, and could not tell the two apart (utils/newDevice)
  const nameTaken = isNameTaken(name, devices);

  const handleSave = () => {
    if (!addDeviceType) return;
    // A card on DHCP needs no address; any other device is asked for one
    const address = card ? (card.dhcp ? 'dhcp' : (card.ip ?? '').trim()) : ip.trim();
    if (!name.trim() || !address) {
      toast.error(t.addDevice.nameAndAddressRequired);
      return;
    }
    // (said under the field: the window stays open until the name is changed)
    if (isNameTaken(name, useNetworkStore.getState().devices)) return;
    const cardProblem = card ? nicProblems(card).dns : undefined;
    if (cardProblem) {
      toast.error(cardProblem);
      return;
    }

    // The new device appears where the user is looking: at the centre of the
    // visible part of the canvas, or in the nearest free place when another
    // device is already there. Never at random: it is where one expects it
    // (a batch added in bulk starts there too)
    const { devices: placed } = useNetworkStore.getState();
    const place = firstFreePlace(
      newDevicePlace(),
      placed.map((device) => device.position)
    );

    // A router or firewall does not take the gateway of the end devices: its
    // gateway is its default route, set later by whoever configures it
    const routesTraffic = isL3Type(addDeviceType);

    // Initialize ports array if device supports ports (the ports bulk add gives too)
    const template = addDeviceTemplateId
      ? templates.find((tpl) => tpl.id === addDeviceTemplateId)
      : templates.find((tpl) => tpl.type === addDeviceType);
    const ports: Port[] | undefined = template?.supportsPorts && portCount
      ? newDevicePorts(portCount, addDeviceType)
      : undefined;

    // The device is named by its first card: its own three fields follow it
    const keptCard = card ? tidyNic(card) : undefined;
    const newId = addDevice({
      type: addDeviceType as DeviceType,
      templateId: addDeviceTemplateId || undefined, // Store template ID for icon lookup
      label: name,
      ip: keptCard ? keptCard.ip : ip,
      subnet: keptCard ? keptCard.subnet : globalSettings.subnet,
      gateway: keptCard ? keptCard.gateway : routesTraffic ? '' : globalSettings.gateway,
      vendor: addDeviceType !== 'PC' ? vendor : undefined,
      location: addDeviceType !== 'PC' ? position : undefined,
      position: place,
      portCount: portCount,
      ports: ports,
      nics: keptCard ? [keptCard] : undefined,
    });
    // The new device is the selected one: it stands out, and is found at once
    useNetworkStore.getState().selectMultipleDevices([newId]);

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
    ? templates.find((tpl) => tpl.id === addDeviceTemplateId)
    : templates.find((tpl) => tpl.type === addDeviceType);

  const deviceTypeName = template?.name || addDeviceType;
  const isPC = addDeviceType === 'PC';
  const routesTraffic = isL3Type(addDeviceType);
  // The card started with the DNS server of the project (see above)
  const takesDns = Boolean(globalSettings.dns) && isEndDeviceKind(addDeviceType, template?.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t.addDevice.title(deviceTypeName)}
      size="md"
      // (four fields to a row: at the 42rem of "md" each is too narrow for the
      // longest choice of a select and for the example of an address)
      className="!max-w-[46rem]"
      autoHeight={true}
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleClose}>
            {t.common.actions.cancel}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {t.common.actions.add}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col">
        <FormFieldset legend={t.addDevice.identity.legend} className="first:mt-0">
          <FieldRow>
            <ReadOnlyField label={t.addDevice.type}>
              <DeviceDrawing drawing={drawingOf(template, addDeviceType)} size={24} />
              <span className="font-medium truncate">{deviceTypeName}</span>
            </ReadOnlyField>
            <TextField
              label={t.addDevice.identity.name}
              span={isPC ? 3 : 1}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.addDevice.identity.namePlaceholder(addDeviceType)}
              required
              error={nameTaken ? t.addDevice.identity.nameTaken : undefined}
            />
            {/* Who made it and where it is: not asked of a PC */}
            {!isPC && (
              <TextField
                label={t.addDevice.identity.vendor}
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder={t.addDevice.identity.vendorPlaceholder}
              />
            )}
            {!isPC && (
              <TextField
                label={t.addDevice.identity.location}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder={t.addDevice.identity.locationPlaceholder}
              />
            )}
            {/* How many ports: only for the devices that are made with ports */}
            {template?.supportsPorts && template.portOptions && (
              <SelectField
                label={t.addDevice.identity.portCount}
                value={portCount?.toString() || ''}
                onChange={(e) => setPortCount(Number(e.target.value))}
                required
                hint={t.addDevice.identity.portCountHint}
              >
                {template.portOptions.map((count) => (
                  <option key={count} value={count}>
                    {t.addDevice.ports(count)}
                  </option>
                ))}
              </SelectField>
            )}
          </FieldRow>
        </FormFieldset>

        {card ? (
          /* An end device: the address of its card, typed here or left to DHCP */
          <FormFieldset legend={t.addDevice.network.legendOfCard(card.name)}>
            <NicAddressFields
              nic={card}
              onChange={(patch) => setNics([{ ...card, ...patch }])}
            />
            <p className={`${hintClass} mt-2`}>{t.addDevice.network.cardHint(takesDns)}</p>
          </FormFieldset>
        ) : (
          <FormFieldset legend={t.addDevice.network.legend}>
            <FieldRow>
              <TextField
                label={t.addDevice.network.ipAddress}
                mono
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                required
                hint={t.addDevice.network.ipAddressHint}
              />
              <TextField
                label={t.addDevice.network.subnetMask}
                mono
                value={globalSettings.subnet}
                readOnly
              />
              {!routesTraffic && (
                <TextField
                  label={t.addDevice.network.gateway}
                  mono
                  value={globalSettings.gateway}
                  readOnly
                />
              )}
              {routesTraffic && (
                <span className={`col-span-2 pt-[18px] ${hintClass}`}>
                  {t.addDevice.network.setLater}
                </span>
              )}
            </FieldRow>
          </FormFieldset>
        )}
      </div>
    </Modal>
  );
};

export default AddDeviceModal;
