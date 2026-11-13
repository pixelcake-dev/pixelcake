import { useState, useEffect, useMemo } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import { useSimulationStore } from '@/store/simulationStore';
import { runFlowSimulation } from '@/utils/runSimulation';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';
import { Play, Square } from 'lucide-react';
import type { FlowModelType, NetworkDevice } from '@/types/network';

/** A PC is where a question starts; a server is what it is asked of */
const startsQuestions = (device: NetworkDevice) => device.type === 'PC';
const answersQuestions = (device: NetworkDevice) =>
  device.type === 'Server' || device.type === 'Database';

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
      // (the Internet symbol, for one, has no address to show)
      label: device.ip ? `${device.label} (${device.ip})` : device.label,
    }));
  }, [sortedDevices]);

  // Simulation settings state
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [flowModel, setFlowModel] = useState<FlowModelType>('ping');

  // Propose an exchange while none is chosen, and again when what was chosen
  // is no longer in the drawing (a device removed, another drawing loaded):
  // from the first PC to the first server, which is what a person asks first.
  // A drawing without them gets its first two devices.
  useEffect(() => {
    const has = (id: string) => devices.some((device) => device.id === id);
    const source = has(sourceId)
      ? sourceId
      : ((devices.find(startsQuestions) ?? devices[0])?.id ?? '');
    const target = has(targetId)
      ? targetId
      : ((
          devices.find((device) => answersQuestions(device) && device.id !== source) ??
          devices.find((device) => device.id !== source)
        )?.id ?? '');
    if (source !== sourceId) setSourceId(source);
    if (target !== targetId) setTargetId(target);
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

  // There is something to send only between two devices
  const ready = Boolean(sourceId && targetId);

  return (
    <div className="sidebar-panel-section">
      {/* What to send, from where to where: then the button that sends it */}
      <div className="px-2 pb-3 space-y-3">
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

        {/* What the panel is for: one button, and it looks like one */}
        <Button
          variant={isRunning ? 'danger' : 'primary'}
          className="w-full"
          onClick={handleSimulationToggle}
          disabled={!isRunning && !ready}
        >
          {isRunning ? <Square size={16} /> : <Play size={16} />}
          {isRunning ? 'Ferma Simulazione' : 'Avvia Simulazione'}
        </Button>
        {!ready && !isRunning && (
          <p className="text-xs text-[var(--text-color-light)]">
            Servono almeno due dispositivi sul canvas.
          </p>
        )}
      </div>
    </div>
  );
};

export default SimulationPanel;
