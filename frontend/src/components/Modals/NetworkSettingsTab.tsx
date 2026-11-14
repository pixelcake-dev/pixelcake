/**
 * Network Settings Tab
 * The network of the project: what a new device starts from (the network its
 * addresses are proposed in, the mask, the gateway, the DNS server its card
 * asks), and how emails travel in a simulation.
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { FormFieldset } from '@/components/ui/FormContainer';
import { FieldRow, SelectField, TextField } from '@/components/ui/compact';
import { hintClass } from '@/components/ui/compactStyles';
import { useNetworkStore } from '@/store/networkStore';
import { askConfirm } from '@/store/confirmStore';
import { isValidIP } from '@/utils/ipHelpers';
import { devicesWithoutDns, withDnsServer } from '@/utils/defaultDns';
import { type EmailMode } from '@/types';

/** What is wrong with an address field of the project; undefined when it is fine */
function addressProblem(value: string): string | undefined {
  const text = value.trim();
  if (!text) return 'Obbligatorio';
  return isValidIP(text) ? undefined : `"${text}" non è un indirizzo IPv4 valido`;
}

/** The same for a field that may be left empty */
function optionalAddressProblem(value: string): string | undefined {
  return value.trim() ? addressProblem(value) : undefined;
}

/** `PC-1, PC-2 e Srv-1`; after the first four, how many more */
function namesOf(labels: string[]): string {
  const shown = labels.slice(0, 4);
  const more = labels.length - shown.length;
  if (more > 0) return `${shown.join(', ')} e ${more === 1 ? 'un altro' : `altri ${more}`}`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}`;
}

const NetworkSettingsTab = () => {
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
  // What is wrong is said once the user has tried to save, then as it is typed
  const [checked, setChecked] = useState(false);

  // Load current settings when component mounts or settings change
  useEffect(() => {
    setIpClass(globalSettings.ipClass);
    setSubnet(globalSettings.subnet);
    setGateway(globalSettings.gateway);
    setDns(globalSettings.dns ?? '');
    setEmailMode(globalSettings.emailMode ?? 'auto');
  }, [globalSettings]);

  const problems = {
    ipClass: addressProblem(ipClass),
    subnet: addressProblem(subnet),
    gateway: addressProblem(gateway),
    dns: optionalAddressProblem(dns),
  };

  // The devices that are already there and ask nobody: the server that was
  // saved (not the one being typed) can be given to them
  const savedDns = globalSettings.dns;
  const askingNobody = savedDns ? devicesWithoutDns(devices, connections) : [];

  const handleAssignDns = async () => {
    if (!savedDns || askingNobody.length === 0) return;
    const count = askingNobody.length;
    const yes = await askConfirm({
      title:
        count === 1
          ? `Assegnare il server DNS ${savedDns} a ${askingNobody[0].label}?`
          : `Assegnare il server DNS ${savedDns} a ${count} dispositivi?`,
      detail:
        (count === 1
          ? 'Viene scritto sulla sua scheda di rete.'
          : `Viene scritto sulla scheda di rete di ${namesOf(askingNobody.map((device) => device.label))}.`) +
        ' Chi ha già un server DNS lo tiene, e le schede in DHCP non vengono toccate: il loro arriva con l\'indirizzo.',
      confirmLabel: 'Assegna',
    });
    if (!yes) return;
    // (read again: the answer may have come after the drawing changed)
    const now = useNetworkStore.getState();
    const targets = devicesWithoutDns(now.devices, now.connections);
    for (const device of targets) {
      updateDevice(device.id, { nics: withDnsServer(device, savedDns).nics });
    }
    toast.success(
      targets.length === 1
        ? `Server DNS assegnato a ${targets[0].label}`
        : `Server DNS assegnato a ${targets.length} dispositivi`
    );
  };

  const handleSave = () => {
    if (!ipClass.trim() || !subnet.trim() || !gateway.trim()) {
      setChecked(true);
      toast.error('Tutti i campi sono obbligatori');
      return;
    }
    const wrong = problems.ipClass ?? problems.subnet ?? problems.gateway ?? problems.dns;
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
    });
    setChecked(false);

    toast.success('Impostazioni di rete salvate');
  };

  return (
    <div className="settings-panel">
      <h3>Impostazioni Rete Globale</h3>
      <p className="text-sm text-[var(--text-color-light)]">
        Valgono per tutto il progetto. Cambiarle non tocca i dispositivi che ci sono già.
      </p>

      <FormFieldset legend="Nuovi dispositivi">
        <FieldRow>
          <TextField
            label="Classe IP di Partenza"
            mono
            value={ipClass}
            onChange={(e) => setIpClass(e.target.value)}
            placeholder="es. 192.168.1.0"
            error={checked ? problems.ipClass : undefined}
            required
          />
          <TextField
            label="Subnet Mask di Default"
            mono
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            placeholder="es. 255.255.255.0"
            error={checked ? problems.subnet : undefined}
            required
          />
          <TextField
            label="Gateway di Default"
            mono
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
            placeholder="es. 192.168.1.1"
            error={checked ? problems.gateway : undefined}
            required
          />
          <TextField
            label="Server DNS di Default"
            mono
            value={dns}
            onChange={(e) => setDns(e.target.value)}
            placeholder="facoltativo"
            error={checked ? problems.dns : undefined}
          />
          <span className={`col-span-4 ${hintClass}`}>
            A un dispositivo nuovo viene proposto il primo indirizzo libero di questa rete, con
            questa subnet mask e questo gateway. Un router o un firewall nasce senza gateway: la
            sua rotta predefinita si sceglie nella sua scheda. Il server DNS, se c&apos;è, viene
            scritto sulla scheda di rete dei nuovi PC, server e degli altri dispositivi finali.
          </span>
          {savedDns && askingNobody.length > 0 && (
            <div className="col-span-4 flex items-center gap-3" data-testid="assign-dns">
              <span className="text-sm">
                {askingNobody.length === 1
                  ? `Su questo canvas ${askingNobody[0].label} non ha un server DNS.`
                  : `Su questo canvas ${askingNobody.length} dispositivi non hanno un server DNS.`}
              </span>
              <Button variant="secondary" size="sm" onClick={handleAssignDns}>
                Assegna {savedDns}
              </Button>
            </div>
          )}
        </FieldRow>
      </FormFieldset>

      <FormFieldset legend="Simulazione">
        <FieldRow>
          <SelectField
            label="Modalità Email (SMTP)"
            span={2}
            value={emailMode}
            onChange={(e) => setEmailMode(e.target.value as EmailMode)}
          >
            <option value="auto">Auto (rileva automaticamente)</option>
            <option value="internal">Mail server interno</option>
            <option value="cloud">Cloud (M365, Gmail...)</option>
          </SelectField>
          <span className={`col-span-2 pt-[18px] ${hintClass}`}>
            Determina come viaggiano le email in simulazione: tramite un Mail Server interno o
            attraverso l&apos;uscita internet.
          </span>
        </FieldRow>
      </FormFieldset>

      <div className="mt-5">
        <Button variant="primary" onClick={handleSave}>
          Salva Impostazioni Rete
        </Button>
      </div>
    </div>
  );
};

export default NetworkSettingsTab;
