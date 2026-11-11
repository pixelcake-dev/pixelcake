import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';

const ContextMenu = () => {
  const contextMenuDevice = useUIStore((state) => state.contextMenuDevice);
  const contextMenuPosition = useUIStore((state) => state.contextMenuPosition);
  const closeContextMenu = useUIStore((state) => state.closeContextMenu);
  const setInspectorDevice = useUIStore((state) => state.setInspectorDevice);
  const openModal = useUIStore((state) => state.openModal);
  const removeDevice = useNetworkStore((state) => state.removeDevice);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    if (contextMenuDevice) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenuDevice, closeContextMenu]);

  const handleDetails = () => {
    if (contextMenuDevice) {
      setInspectorDevice(contextMenuDevice);
      openModal('inspector');
      closeContextMenu();
    }
  };

  const handleConsole = () => {
    // Open the terminal already inside this device's context
    if (contextMenuDevice) {
      useUIStore.getState().setTerminalContextDevice(contextMenuDevice.label);
    }
    openModal('codeTerminal');
    closeContextMenu();
  };

  const handleDelete = () => {
    if (contextMenuDevice) {
      if (
        confirm(
          `Sei sicuro di voler eliminare "${contextMenuDevice.label}"?`
        )
      ) {
        removeDevice(contextMenuDevice.id);
        closeContextMenu();
      }
    }
  };

  if (!contextMenuDevice || !contextMenuPosition) return null;

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
        <li onClick={handleDetails}>Dettagli (Modifica)</li>
        <li className="disabled">Configurazione...</li>
        <li onClick={handleConsole}>Console</li>
        <hr />
        <li className="danger" onClick={handleDelete}>
          Elimina
        </li>
      </ul>
    </div>
  );
};

export default ContextMenu;
