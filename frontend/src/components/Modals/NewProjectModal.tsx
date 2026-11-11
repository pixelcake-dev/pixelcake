/**
 * New Project Modal
 * Form to create a new project with default settings
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormContainer, FormFieldset } from '@/components/ui/FormContainer';
import { useUIStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import { useNetworkStore } from '@/store/networkStore';
import { friendlyApiError } from '@/api';

const NewProjectModal = () => {
  const isOpen = useUIStore((state) => state.modals.newProject);
  const closeModal = useUIStore((state) => state.closeModal);
  const createNewProject = useProjectStore((state) => state.createNewProject);
  const loadFromBackend = useNetworkStore((state) => state.loadFromBackend);
  const saveBeforeSwitch = useNetworkStore((state) => state.saveBeforeSwitch);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ipClass, setIpClass] = useState('192.168.1.0');
  const [subnet, setSubnet] = useState('255.255.255.0');
  const [gateway, setGateway] = useState('192.168.1.1');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setIpClass('192.168.1.0');
      setSubnet('255.255.255.0');
      setGateway('192.168.1.1');
      setError(null);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Il nome del progetto è obbligatorio');
      return;
    }

    setIsCreating(true);
    setError(null);

    // Save the currently open canvas before replacing it with the new project
    const saved = await saveBeforeSwitch();
    if (
      !saved &&
      !confirm(
        'Salvataggio del canvas corrente fallito. Creare comunque il nuovo progetto? Le modifiche non salvate andranno perse.'
      )
    ) {
      setIsCreating(false);
      return;
    }

    try {
      // Create project (backend auto-creates default "Main Canvas")
      const project = await createNewProject({
        name: name.trim(),
        description: description.trim() || undefined,
        global_settings: {
          ipClass,
          subnet,
          gateway,
        },
      });

      // Load the default canvas into networkStore
      const defaultCanvas = project.canvases[0];
      if (defaultCanvas) {
        await loadFromBackend(project.id, defaultCanvas.id);
      }

      // Close modal and show success
      closeModal('newProject');
      toast.success(`Progetto "${project.name}" creato con successo`);
    } catch (err) {
      const errorMessage = friendlyApiError(err, 'Errore durante la creazione');
      setError(errorMessage);
      console.error('[NewProject] Failed to create:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    closeModal('newProject');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Nuovo Progetto"
      size="sm"
      minHeight="550px"
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleCancel} disabled={isCreating}>
            Annulla
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creazione...' : 'Crea Progetto'}
          </Button>
        </div>
      }
    >
      <FormContainer>
        {/* Project Info */}
        <FormFieldset legend="Informazioni Progetto">
          <Input
            label="Nome Progetto *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Infrastructure HQ"
            fullWidth
            required
          />
          <Input
            label="Descrizione"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Breve descrizione del progetto..."
            fullWidth
          />
        </FormFieldset>

        {/* Global Network Settings */}
        <FormFieldset legend="Impostazioni di Rete Globali">
          <Input
            label="Classe IP"
            value={ipClass}
            onChange={(e) => setIpClass(e.target.value)}
            placeholder="192.168.1.0"
            fullWidth
          />
          <Input
            label="Subnet Mask"
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            placeholder="255.255.255.0"
            fullWidth
          />
          <Input
            label="Gateway"
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
            placeholder="192.168.1.1"
            fullWidth
          />
        </FormFieldset>

        {/* Error Message */}
        {error && (
          <div className="modal-error-box">
            ⚠️ {error}
          </div>
        )}
      </FormContainer>
    </Modal>
  );
};

export default NewProjectModal;
