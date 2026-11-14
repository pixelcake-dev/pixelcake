import { useState, useEffect, useMemo } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import { useSimulationStore } from '@/store/simulationStore';
import { runFlowSimulation } from '@/utils/runSimulation';
import { useDhcp } from '@/utils/useDhcp';
import { shownAddress } from '@/utils/dhcpLabels';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';
import { Play, Square } from 'lucide-react';
import { useLanguage, useT } from '@/i18n';
import type { FlowModelType, NetworkDevice } from '@/types/network';

/** A PC is where a question starts; a server is what it is asked of */
const startsQuestions = (device: NetworkDevice) => device.type === 'PC';
const answersQuestions = (device: NetworkDevice) =>
  device.type === 'Server' || device.type === 'Database';

const SimulationPanel = () => {
  const t = useT();
  const language = useLanguage();
  const devices = useNetworkStore((state) => state.devices);
  const stopSimulation = useSimulationStore((state) => state.stopSimulation);
  const isRunning = useSimulationStore((state) => state.isRunning);

  // Sort devices alphabetically by label
  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => a.label.localeCompare(b.label));
  }, [devices]);

  // Convert devices to options format for SearchableSelect
  const dhcp = useDhcp();
  const deviceOptions = useMemo(() => {
    // A device on DHCP that was given no address says so in words: the list
    // is made again when the language changes
    void language;
    return sortedDevices.map((device) => {
      // (the Internet symbol, for one, has no address to show; a device on
      // DHCP shows the one it is leased)
      const address = shownAddress(device, dhcp);
      return { value: device.id, label: address ? `${device.label} (${address})` : device.label };
    });
  }, [sortedDevices, dhcp, language]);

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
          label={t.simulation.source}
          value={sourceId}
          onChange={(value) => setSourceId(value)}
          options={deviceOptions}
          placeholder={t.simulation.sourcePlaceholder}
        />

        <SearchableSelect
          label={t.simulation.destination}
          value={targetId}
          onChange={(value) => setTargetId(value)}
          options={deviceOptions}
          placeholder={t.simulation.destinationPlaceholder}
        />

        <Select
          label={t.simulation.flowModel}
          value={flowModel}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setFlowModel(e.target.value as FlowModelType)
          }
        >
          <option value="ping">{t.simulation.flowModels.ping}</option>
          <option value="email">{t.simulation.flowModels.email}</option>
          <option value="web">{t.simulation.flowModels.web}</option>
          <option value="download">{t.simulation.flowModels.download}</option>
        </Select>

        {/* What the panel is for: one button, and it looks like one */}
        <Button
          variant={isRunning ? 'danger' : 'primary'}
          className="w-full"
          onClick={handleSimulationToggle}
          disabled={!isRunning && !ready}
        >
          {isRunning ? <Square size={16} /> : <Play size={16} />}
          {isRunning ? t.simulation.stop : t.simulation.start}
        </Button>
        {!ready && !isRunning && (
          <p className="text-xs text-[var(--text-color-light)]">
            {t.simulation.needsTwoDevices}
          </p>
        )}
      </div>
    </div>
  );
};

export default SimulationPanel;
