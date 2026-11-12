/**
 * Presentation mode — the small menu a click on a device or on a cable
 * opens: start here, arrive here, break it, repair it. It never edits the
 * drawing.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Flag, MapPin, Wrench, ZapOff } from 'lucide-react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';

/** Distance kept from the edges of the window */
const MARGIN = 8;

const PresentationMenu = () => {
  const menu = usePresentationStore((state) => state.menu);
  const sourceId = usePresentationStore((state) => state.sourceId);
  const targetId = usePresentationStore((state) => state.targetId);
  const failedDevices = usePresentationStore((state) => state.failedDevices);
  const failedConnections = usePresentationStore((state) => state.failedConnections);
  const closeMenu = usePresentationStore((state) => state.closeMenu);
  const setSource = usePresentationStore((state) => state.setSource);
  const setTarget = usePresentationStore((state) => state.setTarget);
  const toggleDeviceFailure = usePresentationStore((state) => state.toggleDeviceFailure);
  const toggleConnectionFailure = usePresentationStore((state) => state.toggleConnectionFailure);

  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);

  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  // Open where the click was, pulled back inside the window when it would
  // stick out
  useLayoutEffect(() => {
    if (!menu) {
      setPosition(null);
      return;
    }
    const box = ref.current?.getBoundingClientRect();
    const width = box?.width ?? 0;
    const height = box?.height ?? 0;
    setPosition({
      left: Math.max(MARGIN, Math.min(menu.x, window.innerWidth - width - MARGIN)),
      top: Math.max(MARGIN, Math.min(menu.y, window.innerHeight - height - MARGIN)),
    });
  }, [menu]);

  // A press anywhere else closes it
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && event.target instanceof Node && ref.current.contains(event.target)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menu, closeMenu]);

  if (!menu) return null;

  const style: React.CSSProperties = position
    ? { left: position.left, top: position.top }
    : { left: menu.x, top: menu.y, visibility: 'hidden' };

  const act = (action: () => void) => () => {
    action();
    closeMenu();
  };

  if (menu.kind === 'device') {
    const device = devices.find((entry) => entry.id === menu.id);
    if (!device) return null;
    const isFailed = failedDevices.includes(device.id);
    return (
      <div ref={ref} className="presentation-menu" role="menu" aria-label={device.label} style={style}>
        <div className="presentation-menu-title">
          <strong>{device.label}</strong>
          <span>{device.ip ? `${device.type} · ${device.ip}` : device.type}</span>
        </div>
        <button
          type="button"
          role="menuitem"
          disabled={sourceId === device.id}
          onClick={act(() => setSource(device.id))}
        >
          <MapPin size={16} aria-hidden="true" /> Parti da qui
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={targetId === device.id}
          onClick={act(() => setTarget(device.id))}
        >
          <Flag size={16} aria-hidden="true" /> Arriva qui
        </button>
        <hr />
        <button
          type="button"
          role="menuitem"
          className={isFailed ? 'repair' : 'break'}
          onClick={act(() => toggleDeviceFailure(device.id))}
        >
          {isFailed ? (
            <>
              <Wrench size={16} aria-hidden="true" /> Ripara
            </>
          ) : (
            <>
              <ZapOff size={16} aria-hidden="true" /> Simula un guasto
            </>
          )}
        </button>
      </div>
    );
  }

  const connection = connections.find((entry) => entry.id === menu.id);
  if (!connection) return null;
  const labelOf = (id: string) => devices.find((entry) => entry.id === id)?.label ?? id;
  const name = `${labelOf(connection.source)} – ${labelOf(connection.target)}`;
  const isCut = failedConnections.includes(connection.id);
  return (
    <div ref={ref} className="presentation-menu" role="menu" aria-label={`Cavo ${name}`} style={style}>
      <div className="presentation-menu-title">
        <strong>Cavo {name}</strong>
        {(connection.label || connection.bandwidth) && (
          <span>{[connection.label, connection.bandwidth].filter(Boolean).join(' · ')}</span>
        )}
      </div>
      <button
        type="button"
        role="menuitem"
        className={isCut ? 'repair' : 'break'}
        onClick={act(() => toggleConnectionFailure(connection.id))}
      >
        {isCut ? (
          <>
            <Wrench size={16} aria-hidden="true" /> Ripara il cavo
          </>
        ) : (
          <>
            <ZapOff size={16} aria-hidden="true" /> Simula un guasto
          </>
        )}
      </button>
    </div>
  );
};

export default PresentationMenu;
