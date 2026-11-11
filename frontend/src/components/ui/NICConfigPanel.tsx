import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormContainer } from '@/components/ui/FormContainer';
import { generateMacAddress } from '@/utils/ipHelpers';
import type { NetworkInterfaceCard } from '@/types/network';

interface NICConfigPanelProps {
  nic: NetworkInterfaceCard | null;
  onSave: (nicId: string, updates: Partial<NetworkInterfaceCard>) => void;
  onCancel: () => void;
}

/**
 * NICConfigPanel Component
 * Detail panel for editing selected NIC configuration
 * Shows all NIC settings: enabled, name, speed, IP/Subnet/Gateway, MAC, description
 */
const NICConfigPanel: React.FC<NICConfigPanelProps> = ({ nic, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<NetworkInterfaceCard>>({
    enabled: true,
    name: '',
    speed: 'auto',
    ip: '',
    subnet: '',
    gateway: '',
    mac: '',
    description: '',
  });

  // Initialize form data when NIC changes
  useEffect(() => {
    if (nic) {
      setFormData({
        enabled: nic.enabled ?? true,
        name: nic.name || '',
        speed: nic.speed || 'auto',
        ip: nic.ip || '',
        subnet: nic.subnet || '',
        gateway: nic.gateway || '',
        mac: nic.mac || '',
        description: nic.description || '',
      });
    }
  }, [nic]);

  const handleSave = () => {
    if (!nic) return;

    // Prepare updates
    const updates: Partial<NetworkInterfaceCard> = {
      enabled: formData.enabled,
      name: formData.name?.trim() || 'eth0',
      speed: formData.speed,
      ip: formData.ip?.trim() || '',
      subnet: formData.subnet?.trim() || '',
      gateway: formData.gateway?.trim() || '',
      mac: formData.mac?.trim() || undefined,
      description: formData.description?.trim() || undefined,
    };

    onSave(nic.id, updates);
  };

  const handleGenerateMac = () => {
    const newMac = generateMacAddress();
    setFormData({ ...formData, mac: newMac });
  };

  if (!nic) {
    return (
      <div className="nic-config-empty">
        <p className="text-sm text-[var(--text-color-light)]">
          Seleziona una scheda di rete per visualizzare e modificare le sue impostazioni.
        </p>
      </div>
    );
  }

  return (
    <div className="nic-config-panel">
      <div className="nic-config-header">
        <h4 className="text-base font-semibold">Configurazione {nic.name}</h4>
      </div>

      <FormContainer gap="4">
        {/* Enabled Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="nic-enabled"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--border-color)] cursor-pointer"
          />
          <label htmlFor="nic-enabled" className="text-sm font-medium cursor-pointer">
            Scheda Abilitata
          </label>
        </div>

        {/* Interface Name */}
        <Input
          label="Nome Interfaccia"
          type="text"
          placeholder="es. eth0, eth1, ens192..."
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          size="full"
          required
        />

        {/* Speed */}
        <Select
          label="Velocità Link"
          value={formData.speed || 'auto'}
          onChange={(e) =>
            setFormData({
              ...formData,
              speed: e.target.value as '10M' | '100M' | '1G' | '2.5G' | '10G' | 'auto',
            })
          }
          size="full"
        >
          <option value="auto">Auto</option>
          <option value="10M">10 Mbps</option>
          <option value="100M">100 Mbps</option>
          <option value="1G">1 Gbps</option>
          <option value="2.5G">2.5 Gbps</option>
          <option value="10G">10 Gbps</option>
        </Select>

        {/* IP Address */}
        <Input
          label="Indirizzo IP"
          type="text"
          placeholder="es. 192.168.1.10"
          value={formData.ip}
          onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
          size="full"
          required
        />

        {/* Subnet Mask */}
        <Input
          label="Subnet Mask"
          type="text"
          placeholder="es. 255.255.255.0"
          value={formData.subnet}
          onChange={(e) => setFormData({ ...formData, subnet: e.target.value })}
          size="full"
          required
        />

        {/* Gateway */}
        <Input
          label="Gateway"
          type="text"
          placeholder="es. 192.168.1.1"
          value={formData.gateway}
          onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
          size="full"
        />

        {/* MAC Address */}
        <div>
          <Input
            label="Indirizzo MAC"
            type="text"
            placeholder="es. 02:A1:B2:C3:D4:E5"
            value={formData.mac}
            onChange={(e) => setFormData({ ...formData, mac: e.target.value })}
            size="full"
          />
          <button
            onClick={handleGenerateMac}
            className="mt-2 text-xs text-[var(--accent-color)] hover:underline cursor-pointer"
            type="button"
          >
            Genera MAC Random
          </button>
          <span className="block text-xs text-[var(--text-color-light)] mt-1">
            Formato: XX:XX:XX:XX:XX:XX (lascia vuoto per auto-generazione)
          </span>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-color-light)] mb-1.5">
            Note / Descrizione
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="es. Connessione primaria, Backup link..."
            className="w-full px-3 py-1.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 pb-6">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Annulla
          </Button>
          <Button variant="primary" onClick={handleSave} className="flex-1">
            Salva
          </Button>
        </div>
      </FormContainer>
    </div>
  );
};

export default NICConfigPanel;
