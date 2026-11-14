/**
 * Network Settings Tab
 * The network of the project: what a new device starts from (the network its
 * addresses are proposed in, the mask, the gateway, the DNS server its card
 * asks), the names of its VLANs, and how emails travel in a simulation. One
 * button saves it all.
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { FormFieldset } from '@/components/ui/FormContainer';
import { FieldRow, SelectField, TextField } from '@/components/ui/compact';
import { hintClass } from '@/components/ui/compactStyles';
import VlanNamesTable from '@/components/ui/VlanNamesTable';
import { useNetworkStore } from '@/store/networkStore';
import { askConfirm } from '@/store/confirmStore';
import { isValidIP } from '@/utils/ipHelpers';
import { devicesWithoutDns, withDnsServer } from '@/utils/defaultDns';
import { namedVlans, vlanRowProblem, vlanRows, vlansInUse, type VlanRow } from '@/utils/vlanNames';
import { getT, useT, type Dictionary } from '@/i18n';
import { type EmailMode } from '@/types';

/** What is wrong with an address field of the project; undefined when it is fine */
function addressProblem(t: Dictionary, value: string): string | undefined {
  const text = value.trim();
  if (!text) return t.networkSettings.required;
  return isValidIP(text) ? undefined : t.common.validation.notIPv4(text);
}

/** The same for a field that may be left empty */
function optionalAddressProblem(t: Dictionary, value: string): string | undefined {
  return value.trim() ? addressProblem(t, value) : undefined;
}

const NetworkSettingsTab = () => {
  const t = useT();
  const words = t.networkSettings;
  const globalSettings = useNetworkStore((state) => state.globalNetworkSettings);
  const setGlobalSettings = useNetworkStore((state) => state.setGlobalNetworkSettings);
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const updateDevice = useNetworkStore((state) => state.updateDevice);

  const [ipClass, setIpClass] = useState('');
  const [subnet, setSubnet] = useState('');
  const [gateway, setGateway] = useState('');
  const [dns, setDns] = useState('');
  const [emailMode, setEmailMode] = useState<EmailMode>('auto');
  const [vlans, setVlans] = useState<VlanRow[]>([]);
  // What is wrong is said once the user has tried to save, then as it is typed
  const [checked, setChecked] = useState(false);

  // Load current settings when component mounts or settings change
  useEffect(() => {
    setIpClass(globalSettings.ipClass);
    setSubnet(globalSettings.subnet);
    setGateway(globalSettings.gateway);
    setDns(globalSettings.dns ?? '');
    setEmailMode(globalSettings.emailMode ?? 'auto');
    // The VLANs that have a name, and those the drawing on screen uses
    // without one (read once: the drawing does not change under this window)
    const drawing = useNetworkStore.getState();
    setVlans(vlanRows(globalSettings.vlans, vlansInUse(drawing.devices, drawing.connections)));
  }, [globalSettings]);

  const problems = {
    ipClass: addressProblem(t, ipClass),
    subnet: addressProblem(t, subnet),
    gateway: addressProblem(t, gateway),
    dns: optionalAddressProblem(t, dns),
  };

  // The devices that are already there and ask nobody: the server that was
  // saved (not the one being typed) can be given to them
  const savedDns = globalSettings.dns;
  const askingNobody = savedDns ? devicesWithoutDns(devices, connections) : [];
  const askingNobodyNames = askingNobody.map((device) => device.label);

  const handleAssignDns = async () => {
    if (!savedDns || askingNobody.length === 0) return;
    const yes = await askConfirm({
      title: words.assignDns.question.title(savedDns, askingNobodyNames),
      detail: words.assignDns.question.detail(askingNobodyNames),
      confirmLabel: words.assignDns.question.confirm,
    });
    if (!yes) return;
    // (read again: the answer may have come after the drawing changed)
    const now = useNetworkStore.getState();
    const targets = devicesWithoutDns(now.devices, now.connections);
    for (const device of targets) {
      updateDevice(device.id, { nics: withDnsServer(device, savedDns).nics });
    }
    toast.success(getT().networkSettings.assignDns.done(targets.map((device) => device.label)));
  };

  const handleSave = () => {
    if (!ipClass.trim() || !subnet.trim() || !gateway.trim()) {
      setChecked(true);
      toast.error(words.allRequired);
      return;
    }
    const wrong =
      problems.ipClass ??
      problems.subnet ??
      problems.gateway ??
      problems.dns ??
      vlans.map((row) => vlanRowProblem(row, vlans)).find((problem) => problem !== undefined);
    if (wrong) {
      setChecked(true);
      toast.error(wrong);
      return;
    }

    setGlobalSettings({
      ipClass: ipClass.trim(),
      subnet: subnet.trim(),
      gateway: gateway.trim(),
      dns: dns.trim() || undefined,
      emailMode,
      // (rows left without a name are not kept; none named, no list)
      vlans: namedVlans(vlans).length > 0 ? namedVlans(vlans) : undefined,
    });
    setChecked(false);

    toast.success(words.saved);
  };

  return (
    <div className="settings-panel">
      <h3>{words.title}</h3>
      <p className="text-sm text-[var(--text-color-light)]">{words.intro}</p>

      <FormFieldset legend={words.newDevices.legend}>
        <FieldRow>
          <TextField
            label={words.newDevices.network}
            mono
            value={ipClass}
            onChange={(e) => setIpClass(e.target.value)}
            placeholder={words.newDevices.networkPlaceholder}
            error={checked ? problems.ipClass : undefined}
            required
          />
          <TextField
            label={words.newDevices.mask}
            mono
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            placeholder={words.newDevices.maskPlaceholder}
            error={checked ? problems.subnet : undefined}
            required
          />
          <TextField
            label={words.newDevices.gateway}
            mono
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
            placeholder={words.newDevices.gatewayPlaceholder}
            error={checked ? problems.gateway : undefined}
            required
          />
          <TextField
            label={words.newDevices.dns}
            mono
            value={dns}
            onChange={(e) => setDns(e.target.value)}
            placeholder={words.newDevices.dnsPlaceholder}
            error={checked ? problems.dns : undefined}
          />
          <span className={`col-span-4 ${hintClass}`}>{words.newDevices.hint}</span>
          {savedDns && askingNobody.length > 0 && (
            <div className="col-span-4 flex items-center gap-3" data-testid="assign-dns">
              <span className="text-sm">{words.assignDns.missing(askingNobodyNames)}</span>
              <Button variant="secondary" size="sm" onClick={handleAssignDns}>
                {words.assignDns.button(savedDns)}
              </Button>
            </div>
          )}
        </FieldRow>
      </FormFieldset>

      <FormFieldset legend={t.vlan.names.title}>
        <p className={`${hintClass} mb-2`}>{words.vlansHint}</p>
        <VlanNamesTable rows={vlans} onChange={setVlans} showProblems={checked} />
      </FormFieldset>

      <FormFieldset legend={words.simulation.legend}>
        <FieldRow>
          <SelectField
            label={words.simulation.emailMode}
            span={2}
            value={emailMode}
            onChange={(e) => setEmailMode(e.target.value as EmailMode)}
          >
            <option value="auto">{words.simulation.auto}</option>
            <option value="internal">{words.simulation.internal}</option>
            <option value="cloud">{words.simulation.cloud}</option>
          </SelectField>
          <span className={`col-span-2 pt-[18px] ${hintClass}`}>{words.simulation.hint}</span>
        </FieldRow>
      </FormFieldset>

      <div className="mt-5">
        <Button variant="primary" onClick={handleSave}>
          {words.save}
        </Button>
      </div>
    </div>
  );
};

export default NetworkSettingsTab;
