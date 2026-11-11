import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';

const ConnectionContextMenu = () => {
  const contextMenuConnection = useUIStore((state) => state.contextMenuConnection);
  const contextMenuPosition = useUIStore((state) => state.contextMenuPosition);
  const closeContextMenu = useUIStore((state) => state.closeContextMenu);
  const setInspectorConnection = useUIStore((state) => state.setInspectorConnection);
  const openModal = useUIStore((state) => state.openModal);
  const removeConnection = useNetworkStore((state) => state.removeConnection);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    if (contextMenuConnection) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenuConnection, closeContextMenu]);

  const handleEdit = () => {
    if (contextMenuConnection) {
      setInspectorConnection(contextMenuConnection);
      openModal('connectionInspector');
      closeContextMenu();
    }
  };

  const handleDelete = () => {
    if (contextMenuConnection) {
      if (
        confirm(
          `Sei sicuro di voler eliminare questa connessione?`
        )
      ) {
        removeConnection(contextMenuConnection.id);
        closeContextMenu();
      }
    }
  };

  if (!contextMenuConnection || !contextMenuPosition) return null;

  return (
    <div
      ref={menuRef}
      className="context-menu show"
      style={{
        position: 'fixed',
        top: `${contextMenuPosition.y}px`,
        left: `${contextMenuPosition.x}px`,
      }}
    >
      <ul>
        <li onClick={handleEdit}>Modifica Connessione</li>
        <li className="disabled">Evidenzia Percorso</li>
        <hr />
        <li className="danger" onClick={handleDelete}>
          Elimina Connessione
        </li>
      </ul>
    </div>
  );
};

export default ConnectionContextMenu;
