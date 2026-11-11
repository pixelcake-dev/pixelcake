/**
 * Explorer Panel
 * VS Code-style project and canvas explorer
 */

import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import { useUIStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import { useNetworkStore } from '@/store/networkStore';

const ExplorerPanel = () => {
  const openModal = useUIStore((state) => state.openModal);

  const currentProject = useProjectStore((state) => state.currentProject);
  const loadProject = useProjectStore((state) => state.loadProject);
  const createNewCanvas = useProjectStore((state) => state.createNewCanvas);
  const deleteCanvasById = useProjectStore((state) => state.deleteCanvasById);

  const currentCanvasId = useNetworkStore((state) => state.currentCanvasId);
  const loadFromBackend = useNetworkStore((state) => state.loadFromBackend);
  const saveToBackend = useNetworkStore((state) => state.saveToBackend);
  const saveBeforeSwitch = useNetworkStore((state) => state.saveBeforeSwitch);
  const cancelPendingSave = useNetworkStore((state) => state.cancelPendingSave);
  const clearCurrentCanvas = useNetworkStore((state) => state.clearCurrentCanvas);
  const setCurrentCanvas = useNetworkStore((state) => state.setCurrentCanvas);
  const isSyncing = useNetworkStore((state) => state.isSyncing);

  const [isCreatingCanvas, setIsCreatingCanvas] = useState(false);
  const [newCanvasName, setNewCanvasName] = useState('');
  const [showNewCanvasInput, setShowNewCanvasInput] = useState(false);

  // Load project on mount if we have a current canvas
  useEffect(() => {
    if (currentProject) {
      loadProject(currentProject.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, loadProject]);

  const handleSwitchCanvas = async (canvasId: string) => {
    if (!currentProject || canvasId === currentCanvasId) return;

    try {
      // Save current canvas first (also disarms the pending autosave timer)
      const saved = await saveBeforeSwitch();
      if (
        !saved &&
        !confirm(
          'Salvataggio del canvas corrente fallito. Cambiare canvas comunque? Le modifiche non salvate andranno perse.'
        )
      ) {
        return;
      }

      // Load new canvas
      await loadFromBackend(currentProject.id, canvasId);
    } catch (error) {
      console.error('[Explorer] Failed to switch canvas:', error);
      toast.error('Errore durante il cambio canvas');
    }
  };

  const handleCreateCanvas = async () => {
    if (!currentProject || !newCanvasName.trim()) return;

    setIsCreatingCanvas(true);
    try {
      await createNewCanvas(currentProject.id, {
        name: newCanvasName.trim(),
        order: currentProject.canvases.length,
      });

      setNewCanvasName('');
      setShowNewCanvasInput(false);
    } catch (error) {
      console.error('[Explorer] Failed to create canvas:', error);
      toast.error('Errore durante la creazione del canvas');
    } finally {
      setIsCreatingCanvas(false);
    }
  };

  const handleDeleteCanvas = async (canvasId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentProject) return;

    // Prevent deleting the last canvas
    if (currentProject.canvases.length <= 1) {
      toast.warning('Impossibile eliminare l\'ultimo canvas del progetto');
      return;
    }

    if (!confirm('Sei sicuro di voler eliminare questo canvas?')) return;

    const deletingActive = canvasId === currentCanvasId;
    const projectId = currentProject.id;

    // Disarm the pending autosave; if the active canvas is going away,
    // unbind it so nothing can save to a deleted canvas mid-flow
    if (deletingActive) {
      clearCurrentCanvas();
    } else {
      cancelPendingSave();
    }

    try {
      await deleteCanvasById(projectId, canvasId);

      // If we deleted the active canvas, switch to first available
      // (read the refreshed project — the captured one is stale after delete)
      if (deletingActive) {
        const freshProject = useProjectStore.getState().currentProject;
        const nextCanvas = freshProject?.canvases.find((c) => c.id !== canvasId);
        if (nextCanvas) {
          await loadFromBackend(projectId, nextCanvas.id);
        }
      }
    } catch (error) {
      if (deletingActive) {
        // Delete failed: the canvas still exists, restore the binding
        setCurrentCanvas(projectId, canvasId);
      }
      console.error('[Explorer] Failed to delete canvas:', error);
      toast.error('Errore durante l\'eliminazione del canvas');
    }
  };

  // No project loaded
  if (!currentProject) {
    return (
      <div className="sidebar-panel-section explorer-empty-state">
        <Icon icon="lucide:folder-x" width={48} className="explorer-empty-state-icon" />
        <div className="explorer-empty-state-text">
          Nessun progetto aperto
        </div>
        <button
          onClick={() => openModal('newProject')}
          className="explorer-button explorer-button-accent"
          style={{ marginBottom: '8px' }}
        >
          <Icon icon="lucide:plus" width={16} />
          Nuovo Progetto
        </button>
        <button
          onClick={() => openModal('openProject')}
          className="explorer-button"
        >
          <Icon icon="lucide:folder-open" width={16} />
          Apri Progetto
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar-panel-section" style={{ padding: '0' }}>
      {/* Project Info */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Icon icon="lucide:folder" width={18} style={{ color: 'var(--accent-color)' }} />
          <div style={{ fontWeight: 600, fontSize: '0.95em' }}>
            {currentProject.name}
          </div>
        </div>
        {currentProject.description && (
          <div style={{ fontSize: '0.8em', color: 'var(--text-color-light)', marginLeft: '26px' }}>
            {currentProject.description}
          </div>
        )}
      </div>

      {/* Canvases List */}
      <div style={{ padding: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          paddingLeft: '4px',
        }}>
          <div style={{ fontSize: '0.75em', fontWeight: 600, color: 'var(--text-color-light)', letterSpacing: '0.5px' }}>
            CANVASES
          </div>
          {isSyncing && (
            <Icon icon="eos-icons:loading" width={14} style={{ color: 'var(--accent-color)' }} />
          )}
        </div>

        {/* Canvas Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {currentProject.canvases.map((canvas) => (
            <div
              key={canvas.id}
              onClick={() => handleSwitchCanvas(canvas.id)}
              className={`explorer-canvas-card ${canvas.id === currentCanvasId ? 'active' : ''}`}
            >
              <Icon icon="fluent:document-24-regular" width={16} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: '0.9em' }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {canvas.name}
                </div>
                <div style={{
                  fontSize: '0.8em',
                  opacity: canvas.id === currentCanvasId ? 0.9 : 0.6,
                  marginTop: '2px',
                }}>
                  {canvas.devices_count} devices
                </div>
              </div>
              {currentProject.canvases.length > 1 && (
                <button
                  onClick={(e) => handleDeleteCanvas(canvas.id, e)}
                  style={{
                    padding: '4px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0.6,
                    color: canvas.id === currentCanvasId ? 'white' : 'var(--text-color)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.6';
                  }}
                >
                  <Icon icon="lucide:trash-2" width={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Canvas Button / Input */}
        {showNewCanvasInput ? (
          <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
            <input
              type="text"
              value={newCanvasName}
              onChange={(e) => setNewCanvasName(e.target.value)}
              placeholder="Nome canvas..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCanvas();
                if (e.key === 'Escape') {
                  setShowNewCanvasInput(false);
                  setNewCanvasName('');
                }
              }}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: 'var(--bg-component)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-color)',
                fontSize: '0.85em',
                outline: 'none',
              }}
            />
            <button
              onClick={handleCreateCanvas}
              disabled={!newCanvasName.trim() || isCreatingCanvas}
              style={{
                padding: '6px 10px',
                background: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85em',
              }}
            >
              <Icon icon="lucide:check" width={14} />
            </button>
            <button
              onClick={() => {
                setShowNewCanvasInput(false);
                setNewCanvasName('');
              }}
              style={{
                padding: '6px 10px',
                background: 'var(--bg-component)',
                color: 'var(--text-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85em',
              }}
            >
              <Icon icon="lucide:x" width={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewCanvasInput(true)}
            className="explorer-button explorer-button-dashed"
            style={{ marginTop: '8px' }}
          >
            <Icon icon="lucide:plus" width={14} />
            Nuovo Canvas
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={() => saveToBackend()}
          disabled={isSyncing}
          className="explorer-button"
          style={{ marginBottom: '8px' }}
        >
          <Icon icon="lucide:save" width={14} />
          {isSyncing ? 'Salvataggio...' : 'Salva Progetto'}
        </button>
        <button
          onClick={() => openModal('openProject')}
          className="explorer-button"
        >
          <Icon icon="lucide:folder-open" width={14} />
          Cambia Progetto
        </button>
      </div>
    </div>
  );
};

export default ExplorerPanel;
