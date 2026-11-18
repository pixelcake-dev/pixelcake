/**
 * Explorer Panel
 * VS Code-style explorer of the open project: its name and description, its
 * canvases (switch, add, rename, duplicate, delete) and the file actions. Everything is
 * local and immediate; the project reaches the disk only through "Salva su file".
 */

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Copy } from 'lucide-react';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { useProjectStore } from '@/store/projectStore';
import { useNetworkStore } from '@/store/networkStore';
import { openProject, saveProject } from '@/utils/projectFileAccess';
import { askConfirm } from '@/store/confirmStore';
import { useT } from '@/i18n';

/** What is being edited in place, if anything */
type Editing =
  | { kind: 'projectName' }
  | { kind: 'projectDescription' }
  | { kind: 'canvas'; canvasId: string }
  | null;

const ExplorerPanel = () => {
  const t = useT();
  const projectName = useProjectStore(state => state.name);
  const projectDescription = useProjectStore(state => state.description);
  const canvases = useProjectStore(state => state.canvases);
  const activeCanvasId = useProjectStore(state => state.activeCanvasId);
  const renameProject = useProjectStore(state => state.renameProject);
  const setDescription = useProjectStore(state => state.setDescription);
  const addCanvas = useProjectStore(state => state.addCanvas);
  const renameCanvas = useProjectStore(state => state.renameCanvas);
  const deleteCanvas = useProjectStore(state => state.deleteCanvas);
  const duplicateCanvas = useProjectStore(state => state.duplicateCanvas);
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

  const handleDeleteCanvas = async (canvasId: string, canvasName: string, deviceCount: number) => {
    const confirmed = await askConfirm({
      title: t.explorer.deleteCanvasQuestion.title(canvasName),
      detail: deviceCount > 0 ? t.explorer.deleteCanvasQuestion.detail(deviceCount) : undefined,
      confirmLabel: t.common.actions.delete,
      danger: true,
    });
    if (!confirmed) return;
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
            style={{ color: 'var(--accent-text)', flexShrink: 0 }}
          />
          {editing?.kind === 'projectName' ? (
            <InlineEdit
              className="explorer-inline-input"
              value={projectName}
              label={t.explorer.projectName}
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
                title={t.explorer.renameProject}
                aria-label={t.explorer.renameProject}
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
              label={t.explorer.projectDescription}
              placeholder={t.explorer.descriptionPlaceholder}
              onCommit={value => {
                setDescription(value);
                stopEditing();
              }}
              onCancel={stopEditing}
            />
          ) : (
            <button
              className="explorer-description"
              title={t.explorer.editDescription}
              onClick={() => setEditing({ kind: 'projectDescription' })}
            >
              {projectDescription || t.explorer.addDescription}
            </button>
          )}
        </div>

        {hasUnsavedChanges && (
          <div className="explorer-unsaved-hint" style={{ marginLeft: '26px', marginTop: '8px' }}>
            <span className="explorer-unsaved-dot" aria-hidden="true" />
            {t.explorer.unsavedChanges}
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
            textTransform: 'uppercase',
            marginBottom: '8px',
            paddingLeft: '4px',
          }}
        >
          {t.explorer.heading}
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
                      label={t.explorer.canvasName(canvas.name)}
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
                    {t.explorer.devices(deviceCount)}
                  </div>
                </div>
                {!isRenaming && (
                  <button
                    className="explorer-icon-button"
                    title={t.explorer.renameCanvas}
                    aria-label={t.explorer.renameCanvasNamed(canvas.name)}
                    onClick={e => {
                      e.stopPropagation();
                      setEditing({ kind: 'canvas', canvasId: canvas.id });
                    }}
                  >
                    <Icon icon="lucide:pencil" width={14} />
                  </button>
                )}
                {/* A copy of the canvas, right after it: «<name> (copia)» */}
                {!isRenaming && (
                  <button
                    className="explorer-icon-button"
                    title={t.explorer.duplicateCanvas}
                    aria-label={t.explorer.duplicateCanvasNamed(canvas.name)}
                    onClick={e => {
                      e.stopPropagation();
                      duplicateCanvas(canvas.id);
                    }}
                  >
                    <Copy size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
                {canvases.length > 1 && !isRenaming && (
                  <button
                    className="explorer-icon-button"
                    title={t.explorer.deleteCanvas}
                    aria-label={t.explorer.deleteCanvasNamed(canvas.name)}
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
              placeholder={t.explorer.newCanvasPlaceholder}
              aria-label={t.explorer.newCanvasName}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateCanvas();
                if (e.key === 'Escape') {
                  // The press is used up here, as in an edit in place
                  e.preventDefault();
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
                borderRadius: 'var(--radius-small)',
                color: 'var(--text-color)',
                fontSize: '0.85em',
                outline: 'none',
              }}
            />
            <button
              onClick={handleCreateCanvas}
              disabled={!newCanvasName.trim()}
              title={t.explorer.createCanvas}
              aria-label={t.explorer.createCanvas}
              style={{
                padding: '6px 10px',
                background: 'var(--text-color)',
                color: 'var(--bg-canvas)',
                border: 'none',
                borderRadius: 'var(--radius-small)',
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
              title={t.common.actions.cancel}
              aria-label={t.explorer.cancelNewCanvas}
              style={{
                padding: '6px 10px',
                background: 'var(--bg-component)',
                color: 'var(--text-color)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-small)',
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
            {t.explorer.newCanvas}
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
          {t.explorer.saveToFile}
        </button>
        <button onClick={() => void openProject()} className="explorer-button">
          <Icon icon="lucide:folder-open" width={14} />
          {t.explorer.openFile}
        </button>
      </div>
    </div>
  );
};

export default ExplorerPanel;
