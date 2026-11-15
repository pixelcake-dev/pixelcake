import { memo, useCallback, useEffect, useRef } from 'react';
import { NodeResizeControl, useStoreApi } from 'reactflow';
import type { NodeProps, ResizeParams } from 'reactflow';
import type { CanvasArea } from '@/types/network';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { AREA_LABEL_MAX_LENGTH, AREA_MIN_SIZE } from '@/utils/canvasAreas';
import { useT } from '@/i18n';

/** A press that moved less than this far is a click, not a move */
const MOVE_THRESHOLD = 3;

/** Where a selected area can be pulled to resize it: its corners and the middle of its sides */
const RESIZE_HANDLES = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
] as const;

/**
 * AreaNode
 * An area of the canvas («riquadro»): a light tint of its colour with a thin
 * border of the same colour and a label in small capitals in a corner, drawn
 * behind the devices and the cables.
 *
 * It must not be in the way of the drawing. Its inside lets the pointer
 * through: a press there starts a selection box, or reaches the device or
 * the cable that is there. It is taken by its label or by its border: a
 * press selects it, a drag moves it, a double click on the label renames it,
 * the right button opens its menu. Selected, it shows eight handles that
 * resize it (React Flow's own, which know the zoom and the smallest size).
 *
 * It is not part of React Flow's selection, which is the selection of the
 * devices (copy, paste, Delete): which area is selected is kept in the
 * store, and it is moved here, not by React Flow, so that the devices that
 * are selected are never dragged along with it.
 */
const AreaNode = memo(({ id, data }: NodeProps<CanvasArea>) => {
  const t = useT();
  const selected = useNetworkStore((state) => state.selectedAreaId === id);
  const editing = useNetworkStore((state) => state.editingAreaId === id);
  // While presenting an area is shown and nothing else
  const presenting = usePresentationStore((state) => state.active);
  const flow = useStoreApi();

  // The move in progress: what puts an end to it (see handlePointerDown)
  const endMove = useRef<(() => void) | null>(null);
  useEffect(() => () => endMove.current?.(), []);

  // (selecting an area lets go of the devices and of the cables that were
  // selected: the store empties its own list, the canvas tells React Flow)
  const select = useCallback(() => {
    const network = useNetworkStore.getState();
    if (network.selectedAreaId !== id) network.selectArea(id);
    useUIStore.getState().closeContextMenu();
  }, [id]);

  /**
   * A press on the label or on the border: the area is selected, and
   * follows the pointer until the button is let go. The pointer is followed
   * on the window, as React Flow follows the drag of a device: inside the
   * canvas an element cannot keep the pointer to itself.
   */
  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    select();
    const area = useNetworkStore.getState().areas.find((entry) => entry.id === id);
    if (!area) return;
    endMove.current?.();

    const pointerId = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    const from = area.position;
    const zoom = flow.getState().transform[2] || 1;
    let moved = false;

    const follow = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
      moved = true;
      useNetworkStore.getState().updateArea(id, {
        position: { x: Math.round(from.x + dx / zoom), y: Math.round(from.y + dy / zoom) },
      });
    };
    const stop = (endEvent?: PointerEvent) => {
      if (endEvent && endEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', follow);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      endMove.current = null;
    };
    window.addEventListener('pointermove', follow);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    endMove.current = () => stop();
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    select();
    useUIStore.getState().setContextMenuArea(id, event.clientX, event.clientY);
  };

  const handleResize = useCallback(
    (_event: unknown, params: ResizeParams) => {
      useNetworkStore.getState().updateArea(id, {
        position: { x: Math.round(params.x), y: Math.round(params.y) },
        size: { width: Math.round(params.width), height: Math.round(params.height) },
      });
    },
    [id]
  );

  /** What takes the area: its label and the four sides of its border */
  const grip = {
    onPointerDown: handlePointerDown,
    onContextMenu: handleContextMenu,
  };

  const classes = [
    'area-node',
    `area-${data.color}`,
    selected && !presenting ? 'selected' : '',
    presenting ? 'readonly' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} data-testid={`area-${id}`}>
      {!presenting &&
        (['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <div key={side} className={`area-edge area-edge-${side} nopan`} aria-hidden="true" {...grip} />
        ))}

      {/* (after the sides of the border, so that a handle is over them) */}
      {selected &&
        !presenting &&
        RESIZE_HANDLES.map((position) => (
          <NodeResizeControl
            key={position}
            position={position}
            className="area-resize-handle nopan"
            minWidth={AREA_MIN_SIZE.width}
            minHeight={AREA_MIN_SIZE.height}
            onResize={handleResize}
          />
        ))}

      {editing && !presenting ? (
        <InlineEdit
          value={data.label}
          label={t.canvas.area.name}
          placeholder={t.canvas.area.namePlaceholder}
          className="area-label-input nodrag nopan"
          maxLength={AREA_LABEL_MAX_LENGTH}
          onCommit={(label) => {
            const network = useNetworkStore.getState();
            network.updateArea(id, { label });
            network.setEditingArea(null);
          }}
          onCancel={() => useNetworkStore.getState().setEditingArea(null)}
        />
      ) : presenting ? (
        data.label && <span className="area-label">{data.label}</span>
      ) : (
        <button
          type="button"
          className={`area-label nopan ${data.label ? '' : 'area-label-empty'}`}
          aria-pressed={selected}
          title={t.canvas.area.labelHint}
          onDoubleClick={(event) => {
            event.stopPropagation();
            useNetworkStore.getState().setEditingArea(id);
          }}
          // (from the keyboard: Enter on the name selects the area and renames it)
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            select();
            useNetworkStore.getState().setEditingArea(id);
          }}
          {...grip}
        >
          {data.label || t.canvas.area.unnamed}
        </button>
      )}
    </div>
  );
});

AreaNode.displayName = 'AreaNode';

export default AreaNode;
