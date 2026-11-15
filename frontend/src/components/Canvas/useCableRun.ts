import { useCallback } from 'react';
import { useStore } from 'reactflow';
import type { Position, ReactFlowState } from 'reactflow';
import { cableRun, type Side } from '@/utils/deviceGeometry';

/**
 * The middle run of a cable between two devices, as `cableRun` places it,
 * from the frames React Flow has measured: `centerX` and `centerY` for
 * getSmoothStepPath, undefined where React Flow's own run is kept (sides
 * that do not face each other, a device not measured yet). Read as text, so
 * that a cable is drawn again only when its run moves.
 */
export function useCableRun(
  source: string,
  target: string,
  sourcePosition: Position,
  targetPosition: Position
): { centerX?: number; centerY?: number } {
  const seen = useStore(
    useCallback(
      (state: ReactFlowState) => {
        const from = state.nodeInternals.get(source);
        const to = state.nodeInternals.get(target);
        if (!from?.width || !from.height || !to?.width || !to.height) return '';
        const a = from.positionAbsolute ?? from.position;
        const b = to.positionAbsolute ?? to.position;
        const run = cableRun(
          { x: a.x, y: a.y, width: from.width, height: from.height },
          sourcePosition as Side,
          { x: b.x, y: b.y, width: to.width, height: to.height },
          targetPosition as Side
        );
        return `${run.centerX ?? ''} ${run.centerY ?? ''}`;
      },
      [source, target, sourcePosition, targetPosition]
    )
  );
  const [x, y] = seen.split(' ');
  return {
    centerX: x ? Number(x) : undefined,
    centerY: y ? Number(y) : undefined,
  };
}
