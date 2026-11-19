/**
 * What is written with the marker («Pennarello»), drawn over the devices and
 * the cables: one SVG over the board, in the coordinates of the canvas, that
 * follows the view as React Flow moves and zooms it. It never takes the
 * pointer: while the marker is put away the board is as if nothing were
 * written on it (MarkerSurface takes the pointer while it is in use).
 *
 * While presenting, what the presenter writes is drawn over what the canvas
 * has.
 */

import { memo, useMemo } from 'react';
import { useStore, type ReactFlowState } from 'reactflow';
import type { CanvasMark } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { useMarkerStore } from '@/store/markerStore';
import { usePresentationStore } from '@/store/presentationStore';
import { HAND_FONT, MARK_COLOUR_VARS } from '@/utils/canvasMarks';
import { drawMark, textBaseline } from '@/utils/handDrawing';

const transformOf = (state: ReactFlowState) => state.transform;

/** One mark, as utils/handDrawing draws it */
export const MarkShape = memo(({ mark, fading = false }: { mark: CanvasMark; fading?: boolean }) => {
  const drawing = useMemo(() => drawMark(mark), [mark]);
  const colour = MARK_COLOUR_VARS[mark.color] ?? MARK_COLOUR_VARS.ink;
  const opacity = fading ? 0.25 : undefined;

  if (drawing.text) {
    const { text } = drawing;
    return (
      <text
        className="mark-text"
        fontFamily={HAND_FONT.family}
        fontSize={text.size}
        fontWeight={HAND_FONT.weight}
        transform={`rotate(${text.rotate} ${text.x} ${text.y})`}
        // (a halo of the canvas around the letters, so that they read over a cable)
        style={{ fill: colour, stroke: 'var(--bg-canvas)', strokeWidth: Math.max(4, text.size / 5), opacity }}
      >
        {text.lines.map((line, index) => (
          <tspan key={index} x={text.x} y={textBaseline(text, index)}>
            {line}
          </tspan>
        ))}
      </text>
    );
  }
  return (
    <g style={{ stroke: colour, strokeWidth: drawing.stroke, opacity }}>
      {drawing.paths.map((path, index) => (
        <path key={index} d={path} />
      ))}
    </g>
  );
});
MarkShape.displayName = 'MarkShape';

const MarksLayer = () => {
  const marks = useNetworkStore((state) => state.marks);
  const presenterMarks = useMarkerStore((state) => state.presenterMarks);
  const erasing = useMarkerStore((state) => state.erasing);
  const presenting = usePresentationStore((state) => state.active);
  const [x, y, zoom] = useStore(transformOf);

  const shownPresenter = presenting ? presenterMarks : [];
  if (marks.length === 0 && shownPresenter.length === 0) return null;
  return (
    <svg className="marks-layer" aria-hidden="true">
      <g transform={`translate(${x} ${y}) scale(${zoom})`}>
        <g className="marks-canvas">
          {marks.map((mark) => (
            // (the eraser shows what it is about to take; while presenting it takes the presenter's alone)
            <MarkShape key={mark.id} mark={mark} fading={!presenting && erasing.includes(mark.id)} />
          ))}
        </g>
        {shownPresenter.length > 0 && (
          <g className="marks-presenter">
            {shownPresenter.map((mark) => (
              <MarkShape key={mark.id} mark={mark} fading={erasing.includes(mark.id)} />
            ))}
          </g>
        )}
      </g>
    </svg>
  );
};

export default MarksLayer;
