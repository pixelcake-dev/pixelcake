import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { askConfirm } from '@/store/confirmStore';
import { AREA_COLOURS, type AreaColour } from '@/types/network';
import { AREA_COLOUR_NAMES } from '@/utils/canvasAreas';

/**
 * AreaContextMenu
 * The menu of an area of the canvas («riquadro»), opened with the right
 * button on its label or on its border: rename it, give it another colour
 * of the palette, delete it.
 */
const AreaContextMenu = () => {
  const areaId = useUIStore((state) => state.contextMenuArea);
  const position = useUIStore((state) => state.contextMenuPosition);
  const closeContextMenu = useUIStore((state) => state.closeContextMenu);
  const area = useNetworkStore((state) => state.areas.find((entry) => entry.id === areaId));

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    if (areaId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [areaId, closeContextMenu]);

  if (!area || !position) return null;

  const handleRename = () => {
    const network = useNetworkStore.getState();
    network.selectArea(area.id);
    network.setEditingArea(area.id);
    closeContextMenu();
  };

  const handleColour = (color: AreaColour) => {
    useNetworkStore.getState().updateArea(area.id, { color });
    closeContextMenu();
  };

  const handleDelete = async () => {
    // The menu has done its job: the question takes its place
    const { id, label } = area;
    closeContextMenu();
    const confirmed = await askConfirm({
      title: label ? `Eliminare il riquadro «${label}»?` : 'Eliminare il riquadro?',
      detail: 'I dispositivi che ha intorno restano dove sono.',
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (confirmed) useNetworkStore.getState().removeArea(id);
  };

  return (
    <div
      ref={menuRef}
      className="context-menu show"
      style={{
        position: 'fixed',
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      <ul>
        <li onClick={handleRename}>Rinomina</li>
      </ul>
      <div className="area-colour-row" role="group" aria-label="Colore del riquadro">
        <span className="area-colour-caption">Colore</span>
        {AREA_COLOURS.map((colour) => (
          <button
            key={colour}
            type="button"
            className={`area-colour-swatch area-${colour}`}
            aria-label={AREA_COLOUR_NAMES[colour]}
            aria-pressed={area.color === colour}
            title={AREA_COLOUR_NAMES[colour]}
            onClick={() => handleColour(colour)}
          />
        ))}
      </div>
      <ul>
        <hr />
        <li className="danger" onClick={handleDelete}>
          Elimina
        </li>
      </ul>
    </div>
  );
};

export default AreaContextMenu;
