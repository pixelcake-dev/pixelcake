import { memo } from 'react';
import {
  DEVICE_DRAWINGS,
  DEVICE_DRAWING_CUT,
  DEVICE_DRAWING_SIZE,
  type DeviceDrawingId,
} from '@/data/deviceDrawings';
import type { DeviceState } from '@/utils/deviceDrawing';

interface DeviceDrawingProps {
  drawing: DeviceDrawingId;
  /** The side of the square it is drawn in, in pixels */
  size?: number;
  /** What its upper layer says */
  state?: DeviceState;
  className?: string;
}

/**
 * DeviceDrawing
 * A device as it is drawn everywhere in the app: a silhouette in two layers
 * with a cut between them. The lower layer and the upper one take their
 * colours from the theme, and the upper one is the lamp of the device: its
 * colour is the state. The symbol on the layers and the cut take the colour
 * of what is behind the drawing (`--device-ground`), so they read as holes.
 *
 * The shapes are drawn three times, as in the files they come from: whole,
 * in the colour of the lower layer; again in the colour of the state, in a
 * window as high as the upper layer; and once more, in the colour of the
 * ground, in a window as high as the cut. The windows are nested `<svg>`,
 * which show nothing outside themselves: no clip and no mask to refer to by
 * an id, so any number of the same drawing can be on a page, shown or not.
 *
 * It is a picture of what is named next to it, and says nothing by itself.
 */
const DeviceDrawing = memo(({ drawing, size = 48, state = 'rest', className }: DeviceDrawingProps) => {
  const { layer, shapes } = DEVICE_DRAWINGS[drawing];
  // (the shapes are the app's own data, written by scripts/build-device-drawings.mjs)
  const markup = { __html: shapes };
  const cutTop = layer - DEVICE_DRAWING_CUT / 2;
  return (
    <svg
      className={['device-drawing', `is-${state}`, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${DEVICE_DRAWING_SIZE} ${DEVICE_DRAWING_SIZE}`}
      width={size}
      height={size}
      data-drawing={drawing}
      aria-hidden="true"
      focusable="false"
    >
      <g className="device-drawing-lower" dangerouslySetInnerHTML={markup} />
      <svg
        className="device-drawing-upper"
        width={DEVICE_DRAWING_SIZE}
        height={layer}
        viewBox={`0 0 ${DEVICE_DRAWING_SIZE} ${layer}`}
        dangerouslySetInnerHTML={markup}
      />
      <svg
        className="device-drawing-cut"
        y={cutTop}
        width={DEVICE_DRAWING_SIZE}
        height={DEVICE_DRAWING_CUT}
        viewBox={`0 ${cutTop} ${DEVICE_DRAWING_SIZE} ${DEVICE_DRAWING_CUT}`}
        dangerouslySetInnerHTML={markup}
      />
    </svg>
  );
});

DeviceDrawing.displayName = 'DeviceDrawing';

export default DeviceDrawing;
