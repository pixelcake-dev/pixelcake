import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { askConfirm } from '@/store/confirmStore';
import { AREA_COLOURS, type AreaColour } from '@/types/network';
import { areaColourNames } from '@/utils/canvasAreas';
import { useT } from '@/i18n';

/**
 * AreaContextMenu
 * The menu of an area of the canvas («riquadro»), opened with the right
 * button on its label or on its border: rename it, give it another colour
 * of the palette, delete it.
 */
const AreaContextMenu = () => {
  const t = useT();
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
      title: t.contextMenu.area.deleteQuestion.title(label),
      detail: t.contextMenu.area.deleteQuestion.detail,
      confirmLabel: t.common.actions.delete,
      danger: true,
    });
    if (confirmed) useNetworkStore.getState().removeArea(id);
  };

  // (read at each drawing of the menu, so in the language of the moment)
  const colourNames = areaColourNames();

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
        <li onClick={handleRename}>{t.contextMenu.area.rename}</li>
      </ul>
      <div className="area-colour-row" role="group" aria-label={t.contextMenu.area.colourGroup}>
        <span className="area-colour-caption">{t.contextMenu.area.colour}</span>
        {AREA_COLOURS.map((colour) => (
          <button
            key={colour}
            type="button"
            className={`area-colour-swatch area-${colour}`}
            aria-label={colourNames[colour]}
            aria-pressed={area.color === colour}
            title={colourNames[colour]}
            onClick={() => handleColour(colour)}
          />
        ))}
      </div>
      <ul>
        <hr />
        <li className="danger" onClick={handleDelete}>
          {t.common.actions.delete}
        </li>
      </ul>
    </div>
  );
};

export default AreaContextMenu;
