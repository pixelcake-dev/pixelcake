/**
 * Open Project Modal
 * Browse and select existing projects
 */

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Scrollbars } from 'react-custom-scrollbars-2';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import { useNetworkStore } from '@/store/networkStore';
import { friendlyApiError, type ProjectList } from '@/api';

const OpenProjectModal = () => {
  const isOpen = useUIStore((state) => state.modals.openProject);
  const closeModal = useUIStore((state) => state.closeModal);

  const projects = useProjectStore((state) => state.projects);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const loadProject = useProjectStore((state) => state.loadProject);
  const isLoading = useProjectStore((state) => state.isLoading);

  const loadFromBackend = useNetworkStore((state) => state.loadFromBackend);
  const saveBeforeSwitch = useNetworkStore((state) => state.saveBeforeSwitch);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectList | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load projects when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedProject(null);
      setError(null);
      loadProjects().catch((err) => {
        setError(friendlyApiError(err, 'Errore durante il caricamento'));
      });
    }
  }, [isOpen, loadProjects]);

  // Filter projects by search query
  const filteredProjects = projects.filter((project) => {
    const query = searchQuery.toLowerCase();
    return (
      project.name.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query)
    );
  });

  const handleOpenProject = async () => {
    if (!selectedProject) {
      setError('Seleziona un progetto da aprire');
      return;
    }

    setError(null);

    // Save the currently open canvas before overwriting it
    const saved = await saveBeforeSwitch();
    if (
      !saved &&
      !confirm(
        'Salvataggio del canvas corrente fallito. Aprire comunque il progetto? Le modifiche non salvate andranno perse.'
      )
    ) {
      return;
    }

    try {
      // Load full project details
      const fullProject = await loadProject(selectedProject.id);

      // Load first canvas into networkStore
      if (fullProject.canvases.length > 0) {
        const firstCanvas = fullProject.canvases[0];
        await loadFromBackend(fullProject.id, firstCanvas.id);
      }

      // Close modal
      closeModal('openProject');
      toast.success(`Progetto "${fullProject.name}" aperto con successo`);
    } catch (err) {
      const errorMessage = friendlyApiError(err, "Errore durante l'apertura");
      setError(errorMessage);
      console.error('[OpenProject] Failed to open:', err);
    }
  };

  const handleCancel = () => {
    closeModal('openProject');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Apri Progetto"
      size="md"
      minHeight="80vh"
      maxHeight="calc(98vh - 40px)"
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleCancel}>
            Annulla
          </Button>
          <Button
            variant="primary"
            onClick={handleOpenProject}
            disabled={!selectedProject || isLoading}
          >
            Apri Progetto
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Search Bar */}
        <Input
          label="Cerca Progetto"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cerca per nome o descrizione..."
          fullWidth
        />

        {/* Projects List */}
        <div style={{
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          background: 'var(--bg-component)',
          overflow: 'hidden',
        }}>
          <Scrollbars
            autoHide
            autoHideTimeout={1000}
            autoHeightMax={1200}
            autoHeight
            renderView={({ style, ...props }) => (
              <div {...props} style={{
                ...style,
                marginRight: -20,
                marginBottom: -20,
              }} />
            )}
            renderThumbVertical={({ style, ...props }) => (
              <div
                {...props}
                style={{
                  ...style,
                  backgroundColor: 'var(--accent-color)',
                  borderRadius: '6px',
                  border: '2px solid transparent',
                  backgroundClip: 'padding-box',
                  cursor: 'pointer',
                }}
              />
            )}
            renderTrackVertical={({ style, ...props }) => (
              <div
                {...props}
                style={{
                  ...style,
                  width: '10px',
                  right: '2px',
                  bottom: '2px',
                  top: '2px',
                  background: 'linear-gradient(to right, transparent calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% + 1px), transparent calc(50% + 1px))',
                }}
              />
            )}
          >
          {isLoading ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: 'var(--text-color-light)',
            }}>
              <Icon icon="eos-icons:loading" width={32} />
              <div style={{ marginTop: '12px' }}>Caricamento progetti...</div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: 'var(--text-color-light)',
            }}>
              {searchQuery ? (
                <>
                  <Icon icon="lucide:search-x" width={32} />
                  <div style={{ marginTop: '12px' }}>Nessun progetto trovato</div>
                </>
              ) : (
                <>
                  <Icon icon="lucide:folder-x" width={32} />
                  <div style={{ marginTop: '12px' }}>Nessun progetto disponibile</div>
                  <div style={{ marginTop: '8px', fontSize: '0.85em' }}>
                    Crea un nuovo progetto per iniziare
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ padding: '8px' }}>
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className={`project-card ${selectedProject?.id === project.id ? 'selected' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <Icon icon="lucide:folder" width={20} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                        {project.name}
                      </div>
                      {project.description && (
                        <div style={{
                          fontSize: '0.85em',
                          opacity: selectedProject?.id === project.id ? 0.9 : 0.7,
                          marginBottom: '8px',
                        }}>
                          {project.description}
                        </div>
                      )}
                      <div style={{
                        display: 'flex',
                        gap: '16px',
                        fontSize: '0.8em',
                        opacity: selectedProject?.id === project.id ? 0.9 : 0.6,
                      }}>
                        <span>
                          <Icon icon="lucide:layers" width={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                          {project.canvases_count} {project.canvases_count === 1 ? 'canvas' : 'canvases'}
                        </span>
                        <span>
                          <Icon icon="lucide:clock" width={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                          {formatDate(project.last_accessed)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </Scrollbars>
        </div>

        {/* Error Message */}
        {error && (
          <div className="modal-error-box">
            ⚠️ {error}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default OpenProjectModal;
