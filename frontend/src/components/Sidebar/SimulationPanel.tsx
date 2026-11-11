import { useState, useEffect, useMemo } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import { useSimulationStore } from '@/store/simulationStore';
import { runFlowSimulation } from '@/utils/runSimulation';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Play, Square } from 'lucide-react';
import type { FlowModelType } from '@/types/network';

const SimulationPanel = () => {
  const devices = useNetworkStore((state) => state.devices);
  const stopSimulation = useSimulationStore((state) => state.stopSimulation);
  const isRunning = useSimulationStore((state) => state.isRunning);

  // Sort devices alphabetically by label
  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => a.label.localeCompare(b.label));
  }, [devices]);

  // Convert devices to options format for SearchableSelect
  const deviceOptions = useMemo(() => {
    return sortedDevices.map((device) => ({
      value: device.id,
      label: `${device.label} (${device.ip})`,
    }));
  }, [sortedDevices]);

  // Simulation settings state
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [flowModel, setFlowModel] = useState<FlowModelType>('ping');

  // Set default source and target when devices change
  useEffect(() => {
    if (devices.length > 0) {
      if (!sourceId && devices.length > 0) {
        setSourceId(devices[0].id);
      }
      if (!targetId && devices.length > 1) {
        setTargetId(devices[1].id);
      }
    }
  }, [devices, sourceId, targetId]);

  const handleSimulationToggle = () => {
    // If simulation is running, stop it
    if (isRunning) {
      stopSimulation();
      return;
    }

    // Plan the flow (email via mail server, web/download round trip,
    // ping echo), evaluate every leg with the engine and animate
    runFlowSimulation(sourceId, targetId, flowModel);
  };

  return (
    <div className="sidebar-panel-section">
      <h4 className="sidebar-section-title">SIMULAZIONE</h4>

      {/* Primary Simulation Button - Top */}
      <button className="sidebar-panel-item" onClick={handleSimulationToggle}>
        {isRunning ? (
          <Square size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
        ) : (
          <Play size={20} style={{ color: '#10b981', flexShrink: 0 }} />
        )}
        <span>{isRunning ? 'Ferma Simulazione' : 'Avvia Simulazione'}</span>
      </button>

      {/* Always Visible Settings */}
      <div className="px-2 py-3 space-y-3">
        <SearchableSelect
          label="Partenza"
          value={sourceId}
          onChange={(value) => setSourceId(value)}
          options={deviceOptions}
          placeholder="Cerca dispositivo di partenza..."
        />

        <SearchableSelect
          label="Destinazione"
          value={targetId}
          onChange={(value) => setTargetId(value)}
          options={deviceOptions}
          placeholder="Cerca dispositivo di destinazione..."
        />

        <Select
          label="Modello di Flusso"
          value={flowModel}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setFlowModel(e.target.value as FlowModelType)
          }
        >
          <option value="ping">Ping (ICMP)</option>
          <option value="email">Messaggio Email (SMTP)</option>
          <option value="web">Pagina Web (HTTP)</option>
          <option value="download">Download File (FTP)</option>
        </Select>
      </div>
    </div>
  );
};

export default SimulationPanel;
