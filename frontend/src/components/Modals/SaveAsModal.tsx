/**
 * Save As Modal
 * Save current project with a new name (creates a duplicate)
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormContainer } from '@/components/ui/FormContainer';
import { useUIStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import { useNetworkStore } from '@/store/networkStore';
import { friendlyApiError } from '@/api';

const SaveAsModal = () => {
  const isOpen = useUIStore((state) => state.modals.saveAsProject);
  const closeModal = useUIStore((state) => state.closeModal);

  const currentProject = useProjectStore((state) => state.currentProject);
  const createNewProject = useProjectStore((state) => state.createNewProject);
  const loadFromBackend = useNetworkStore((state) => state.loadFromBackend);
  const cancelPendingSave = useNetworkStore((state) => state.cancelPendingSave);

  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const viewport = useNetworkStore((state) => state.viewport);
  const deviceCounter = useNetworkStore((state) => state.deviceCounter);
  const connectionCounter = useNetworkStore((state) => state.connectionCounter);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with current project name
  useEffect(() => {
    if (isOpen && currentProject) {
      setName(`${currentProject.name} (Copia)`);
      setDescription(currentProject.description || '');
      setError(null);
    }
  }, [isOpen, currentProject]);

  const handleSaveAs = async () => {
    if (!name.trim()) {
      setError('Il nome del progetto è obbligatorio');
      return;
    }

    if (!currentProject) {
      setError('Nessun progetto corrente da duplicare');
      return;
    }

    setIsSaving(true);
    setError(null);

    // Disarm the pending autosave: this flow snapshots the live topology and
    // writes it to the NEW project's canvas; a stale timer firing mid-flow
    // would write against the old (or half-switched) canvas
    cancelPendingSave();

    try {
      // Create new project with current project settings
      const newProject = await createNewProject({
        name: name.trim(),
        description: description.trim() || undefined,
        global_settings: currentProject.global_settings,
      });

      // Get the default canvas created by backend
      const defaultCanvas = newProject.canvases[0];
      if (!defaultCanvas) {
        throw new Error('Canvas di default non creato');
      }

      // Update the default canvas with current topology data
      const { updateCanvas } = await import('@/api');
      await updateCanvas(newProject.id, defaultCanvas.id, {
        name: 'Main Canvas',
        devices,
        connections,
        settings: {
          viewport,
          deviceCounter,
          connectionCounter,
        },
      });

      // Load the new project into networkStore
      await loadFromBackend(newProject.id, defaultCanvas.id);

      // Close modal
      closeModal('saveAsProject');
      toast.success(`Progetto "${newProject.name}" duplicato con successo`);
    } catch (err) {
      const errorMessage = friendlyApiError(err, 'Errore durante il salvataggio');
      setError(errorMessage);
      console.error('[SaveAs] Failed to save as:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    closeModal('saveAsProject');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Salva con nome"
      size="md"
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>
            Annulla
          </Button>
          <Button variant="primary" onClick={handleSaveAs} disabled={isSaving}>
            {isSaving ? 'Salvataggio...' : 'Salva come'}
          </Button>
        </div>
      }
    >
      <FormContainer>
        <Input
          label="Nome Progetto *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome per il nuovo progetto..."
          required
        />
        <Input
          label="Descrizione"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrizione opzionale..."
        />

        {/* Info Message */}
        <div className="modal-info-box">
          ℹ️ Verrà creato un nuovo progetto con tutti i dispositivi e connessioni correnti
        </div>

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

export default SaveAsModal;
