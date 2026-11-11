import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormContainer, FormFieldset } from '@/components/ui/FormContainer';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { runFlowSimulation } from '@/utils/runSimulation';
import type { FlowModelType } from '@/types/network';

const SimulationModal = () => {
  const isOpen = useUIStore((state) => state.modals.simulation);
  const closeModal = useUIStore((state) => state.closeModal);
  const devices = useNetworkStore((state) => state.devices);

  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [flowModel, setFlowModel] = useState<FlowModelType>('ping');

  useEffect(() => {
    if (isOpen && devices.length > 0) {
      // Set default source and target
      if (!sourceId && devices.length > 0) {
        setSourceId(devices[0].id);
      }
      if (!targetId && devices.length > 1) {
        setTargetId(devices[1].id);
      }
    }
  }, [isOpen, devices, sourceId, targetId]);

  const handleStart = () => {
    // Plan the flow (email via mail server, web/download round trip,
    // ping echo), evaluate every leg with the engine and animate
    const started = runFlowSimulation(sourceId, targetId, flowModel);
    if (started) {
      handleClose();
    }
  };

  const handleClose = () => {
    closeModal('simulation');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Impostazioni Simulazione"
      autoHeight={true}
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={handleStart}>
            ► Avvia Simulazione
          </Button>
        </div>
      }
    >
      <FormContainer gap="4">
        <Select
          label="Partenza"
          value={sourceId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSourceId(e.target.value)}
        >
          <option value="">Seleziona dispositivo...</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label} ({device.ip})
            </option>
          ))}
        </Select>

        <Select
          label="Destinazione"
          value={targetId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTargetId(e.target.value)}
        >
          <option value="">Seleziona dispositivo...</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label} ({device.ip})
            </option>
          ))}
        </Select>

        {/* Flow Model */}
        <FormFieldset legend="Modello di Flusso">
          <Select
            value={flowModel}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFlowModel(e.target.value as FlowModelType)}
          >
            <option value="ping">Ping (ICMP)</option>
            <option value="email">Messaggio Email (SMTP)</option>
            <option value="web">Pagina Web (HTTP)</option>
            <option value="download">Download File (FTP)</option>
          </Select>
        </FormFieldset>
      </FormContainer>
    </Modal>
  );
};

export default SimulationModal;
