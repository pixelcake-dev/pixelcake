/**
 * Network Settings Tab
 * The network of the project: what a new device starts from (the network its
 * addresses are proposed in, the mask, the gateway), and how emails travel in
 * a simulation.
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { FormFieldset } from '@/components/ui/FormContainer';
import { FieldRow, SelectField, TextField } from '@/components/ui/compact';
import { hintClass } from '@/components/ui/compactStyles';
import { useNetworkStore } from '@/store/networkStore';
import { isValidIP } from '@/utils/ipHelpers';
import { type EmailMode } from '@/types';

/** What is wrong with an address field of the project; undefined when it is fine */
function addressProblem(value: string): string | undefined {
  const text = value.trim();
  if (!text) return 'Obbligatorio';
  return isValidIP(text) ? undefined : `"${text}" non è un indirizzo IPv4 valido`;
}

const NetworkSettingsTab = () => {
  const globalSettings = useNetworkStore((state) => state.globalNetworkSettings);
  const setGlobalSettings = useNetworkStore((state) => state.setGlobalNetworkSettings);

  const [ipClass, setIpClass] = useState('');
  const [subnet, setSubnet] = useState('');
  const [gateway, setGateway] = useState('');
  const [emailMode, setEmailMode] = useState<EmailMode>('auto');
  // What is wrong is said once the user has tried to save, then as it is typed
  const [checked, setChecked] = useState(false);

  // Load current settings when component mounts or settings change
  useEffect(() => {
    setIpClass(globalSettings.ipClass);
    setSubnet(globalSettings.subnet);
    setGateway(globalSettings.gateway);
    setEmailMode(globalSettings.emailMode ?? 'auto');
  }, [globalSettings]);

  const problems = {
    ipClass: addressProblem(ipClass),
    subnet: addressProblem(subnet),
    gateway: addressProblem(gateway),
  };

  const handleSave = () => {
    if (!ipClass.trim() || !subnet.trim() || !gateway.trim()) {
      setChecked(true);
      toast.error('Tutti i campi sono obbligatori');
      return;
    }
    const wrong = problems.ipClass ?? problems.subnet ?? problems.gateway;
    if (wrong) {
      setChecked(true);
      toast.error(wrong);
      return;
    }

    setGlobalSettings({
      ipClass: ipClass.trim(),
      subnet: subnet.trim(),
      gateway: gateway.trim(),
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
          <span className={`col-span-4 ${hintClass}`}>
            A un dispositivo nuovo viene proposto il primo indirizzo libero di questa rete, con
            questa subnet mask e questo gateway. Un router o un firewall nasce senza gateway: la
            sua rotta predefinita si sceglie nella sua scheda.
          </span>
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
