/**
 * Network Settings Tab
 * Manages global network configuration (IP range, subnet, gateway)
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormContainer } from '@/components/ui/FormContainer';
import { useNetworkStore } from '@/store/networkStore';
import { type EmailMode } from '@/types';

const NetworkSettingsTab = () => {
  const globalSettings = useNetworkStore((state) => state.globalNetworkSettings);
  const setGlobalSettings = useNetworkStore((state) => state.setGlobalNetworkSettings);

  const [ipClass, setIpClass] = useState('');
  const [subnet, setSubnet] = useState('');
  const [gateway, setGateway] = useState('');
  const [emailMode, setEmailMode] = useState<EmailMode>('auto');

  // Load current settings when component mounts or settings change
  useEffect(() => {
    setIpClass(globalSettings.ipClass);
    setSubnet(globalSettings.subnet);
    setGateway(globalSettings.gateway);
    setEmailMode(globalSettings.emailMode ?? 'auto');
  }, [globalSettings]);

  const handleSave = () => {
    if (!ipClass.trim() || !subnet.trim() || !gateway.trim()) {
      toast.error('Tutti i campi sono obbligatori');
      return;
    }

    setGlobalSettings({
      ipClass,
      subnet,
      gateway,
      emailMode,
    });

    toast.success('Impostazioni di rete salvate');
  };

  return (
    <div className="settings-panel">
      <h3>Impostazioni Rete Globale</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-4">
        Questi valori verranno usati come default per i nuovi dispositivi.
      </p>

      {/* A field has no space of its own around it: the gap between one field
          and the label of the next comes from the container, as in the other
          windows */}
      <FormContainer gap="4">
        <Input
          label="Classe IP di Partenza"
          value={ipClass}
          onChange={(e) => setIpClass(e.target.value)}
          placeholder="es. 192.168.1.0"
          size="sm"
          required
        />

        <Input
          label="Subnet Mask di Default"
          value={subnet}
          onChange={(e) => setSubnet(e.target.value)}
          placeholder="es. 255.255.255.0"
          size="sm"
          required
        />

        <Input
          label="Gateway di Default"
          value={gateway}
          onChange={(e) => setGateway(e.target.value)}
          placeholder="es. 192.168.1.1"
          size="sm"
          required
        />

        {/* The select and the line that explains it are one field */}
        <div>
          <Select
            label="Modalità Email (SMTP)"
            value={emailMode}
            onChange={(e) => setEmailMode(e.target.value as EmailMode)}
            size="md"
          >
            <option value="auto">Auto (rileva automaticamente)</option>
            <option value="internal">Mail server interno</option>
            <option value="cloud">Cloud (M365, Gmail...)</option>
          </Select>
          <p className="text-xs text-[var(--text-color-light)] -mt-2 mb-4">
            Determina come viaggiano le email in simulazione: tramite un Mail Server interno o
            attraverso l&apos;uscita internet.
          </p>
        </div>
      </FormContainer>

      <div className="mt-4">
        <Button variant="primary" onClick={handleSave}>
          Salva Impostazioni Rete
        </Button>
      </div>
    </div>
  );
};

export default NetworkSettingsTab;
