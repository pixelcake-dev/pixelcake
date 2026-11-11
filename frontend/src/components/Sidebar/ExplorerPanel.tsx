/**
 * Explorer Panel
 * VS Code-style explorer of the open project: its name and description, its
 * canvases (switch, add, rename, delete) and the file actions. Everything is
 * local and immediate; the project reaches the disk only through "Salva su file".
 */

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { useProjectStore } from '@/store/projectStore';
import { useNetworkStore } from '@/store/networkStore';
import { openProject, saveProject } from '@/utils/projectFileAccess';

/** What is being edited in place, if anything */
type Editing =
  | { kind: 'projectName' }
  | { kind: 'projectDescription' }
  | { kind: 'canvas'; canvasId: string }
  | null;

function deviceCountLabel(count: number): string {
  return count === 1 ? '1 dispositivo' : `${count} dispositivi`;
}

const ExplorerPanel = () => {
  const projectName = useProjectStore(state => state.name);
  const projectDescription = useProjectStore(state => state.description);
  const canvases = useProjectStore(state => state.canvases);
  const activeCanvasId = useProjectStore(state => state.activeCanvasId);
  const renameProject = useProjectStore(state => state.renameProject);
  const setDescription = useProjectStore(state => state.setDescription);
  const addCanvas = useProjectStore(state => state.addCanvas);
  const renameCanvas = useProjectStore(state => state.renameCanvas);
  const deleteCanvas = useProjectStore(state => state.deleteCanvas);
  const switchCanvas = useProjectStore(state => state.switchCanvas);

  // The entry of the active canvas in `canvases` is only refreshed when it is
  // committed: its live content is in the network store
  const liveDeviceCount = useNetworkStore(state => state.devices.length);
  const hasUnsavedChanges = useNetworkStore(state => state.hasUnsavedChanges);

  const [editing, setEditing] = useState<Editing>(null);
  const [newCanvasName, setNewCanvasName] = useState('');
  const [showNewCanvasInput, setShowNewCanvasInput] = useState(false);

  const stopEditing = () => setEditing(null);

  const handleCreateCanvas = () => {
    if (!newCanvasName.trim()) return;
    addCanvas(newCanvasName);
    setNewCanvasName('');
    setShowNewCanvasInput(false);
  };

  const handleDeleteCanvas = (canvasId: string, canvasName: string, deviceCount: number) => {
    const question =
      `Eliminare il canvas "${canvasName}"?` +
      (deviceCount > 0
        ? `\nContiene ${deviceCountLabel(deviceCount)}: il suo contenuto andrà perso.`
        : '');
    if (!confirm(question)) return;
    deleteCanvas(canvasId);
  };

  return (
    <div className="sidebar-panel-section" style={{ padding: '0' }}>
      {/* Project Info */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Icon
            icon="lucide:folder"
            width={18}
            style={{ color: 'var(--accent-color)', flexShrink: 0 }}
          />
          {editing?.kind === 'projectName' ? (
            <InlineEdit
              className="explorer-inline-input"
              value={projectName}
              label="Nome del progetto"
              onCommit={value => {
                renameProject(value);
                stopEditing();
              }}
              onCancel={stopEditing}
            />
          ) : (
            <>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: 600,
                  fontSize: '0.95em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={projectName}
                onDoubleClick={() => setEditing({ kind: 'projectName' })}
              >
                {projectName}
              </div>
              <button
                className="explorer-icon-button"
                title="Rinomina progetto"
                aria-label="Rinomina progetto"
                onClick={() => setEditing({ kind: 'projectName' })}
              >
                <Icon icon="lucide:pencil" width={14} />
              </button>
            </>
          )}
        </div>

        <div style={{ marginLeft: '26px', fontSize: '0.8em', color: 'var(--text-color-light)' }}>
          {editing?.kind === 'projectDescription' ? (
            <InlineEdit
              className="explorer-inline-input"
              value={projectDescription}
              label="Descrizione del progetto"
              placeholder="Descrizione..."
              onCommit={value => {
                setDescription(value);
                stopEditing();
              }}
              onCancel={stopEditing}
            />
          ) : (
            <button
              className="explorer-description"
              title="Modifica descrizione"
              onClick={() => setEditing({ kind: 'projectDescription' })}
            >
              {projectDescription || 'Aggiungi una descrizione…'}
            </button>
          )}
        </div>

        {hasUnsavedChanges && (
          <div className="explorer-unsaved-hint" style={{ marginLeft: '26px', marginTop: '8px' }}>
            <span className="explorer-unsaved-dot" aria-hidden="true" />
            Modifiche non salvate su file
          </div>
        )}
      </div>

      {/* Canvases List */}
      <div style={{ padding: '12px' }}>
        <div
          style={{
            fontSize: '0.75em',
            fontWeight: 600,
            color: 'var(--text-color-light)',
            letterSpacing: '0.5px',
            marginBottom: '8px',
            paddingLeft: '4px',
          }}
        >
          CANVASES
        </div>

        {/* Canvas Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {canvases.map(canvas => {
            const isActive = canvas.id === activeCanvasId;
            const deviceCount = isActive ? liveDeviceCount : canvas.devices.length;
            const isRenaming = editing?.kind === 'canvas' && editing.canvasId === canvas.id;

            return (
              <div
                key={canvas.id}
                onClick={() => switchCanvas(canvas.id)}
                className={`explorer-canvas-card ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'true' : undefined}
              >
                <Icon icon="lucide:file" width={16} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: '0.9em' }}>
                  {isRenaming ? (
                    <InlineEdit
                      className="explorer-inline-input"
                      value={canvas.name}
                      label={`Nome del canvas ${canvas.name}`}
                      onCommit={value => {
                        renameCanvas(canvas.id, value);
                        stopEditing();
                      }}
                      onCancel={stopEditing}
                    />
                  ) : (
                    <div
                      style={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={canvas.name}
                      onDoubleClick={() => setEditing({ kind: 'canvas', canvasId: canvas.id })}
                    >
                      {canvas.name}
                    </div>
                  )}
                  <div
                    style={{ fontSize: '0.8em', opacity: isActive ? 0.9 : 0.6, marginTop: '2px' }}
                  >
                    {deviceCountLabel(deviceCount)}
                  </div>
                </div>
                {!isRenaming && (
                  <button
                    className="explorer-icon-button"
                    title="Rinomina canvas"
                    aria-label={`Rinomina canvas ${canvas.name}`}
                    onClick={e => {
                      e.stopPropagation();
                      setEditing({ kind: 'canvas', canvasId: canvas.id });
                    }}
                  >
                    <Icon icon="lucide:pencil" width={14} />
                  </button>
                )}
                {canvases.length > 1 && !isRenaming && (
                  <button
                    className="explorer-icon-button"
                    title="Elimina canvas"
                    aria-label={`Elimina canvas ${canvas.name}`}
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteCanvas(canvas.id, canvas.name, deviceCount);
                    }}
                  >
                    <Icon icon="lucide:trash-2" width={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Canvas Button / Input */}
        {showNewCanvasInput ? (
          <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
            <input
              type="text"
              value={newCanvasName}
              onChange={e => setNewCanvasName(e.target.value)}
              placeholder="Nome canvas..."
              aria-label="Nome del nuovo canvas"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateCanvas();
                if (e.key === 'Escape') {
                  setShowNewCanvasInput(false);
                  setNewCanvasName('');
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
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
              disabled={!newCanvasName.trim()}
              title="Crea canvas"
              aria-label="Crea canvas"
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
              title="Annulla"
              aria-label="Annulla nuovo canvas"
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

      {/* File Actions */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={() => void saveProject()}
          className="explorer-button"
          style={{ marginBottom: '8px' }}
        >
          <Icon icon="lucide:save" width={14} />
          Salva su file
        </button>
        <button onClick={() => void openProject()} className="explorer-button">
          <Icon icon="lucide:folder-open" width={14} />
          Apri file…
        </button>
      </div>
    </div>
  );
};

export default ExplorerPanel;
