/**
 * The tools of annotation mode («Modalità appunti»), over the top of the
 * board while it is on: what to draw (pen, words, arrow, circle, tick, cross)
 * or the eraser, the colour, the thickness, «Cancella tutto», and the way to
 * leave the mode. The same while building and while presenting.
 */

import type { ReactNode } from 'react';
import { Check, Circle, Eraser, MoveUpRight, Pencil, Trash2, Type, X } from 'lucide-react';
import { MARK_COLOURS, MARK_WIDTHS } from '@/types';
import { MARKER_TOOLS, useMarkerStore, type MarkerTool } from '@/store/markerStore';
import { useNetworkStore } from '@/store/networkStore';
import { useT } from '@/i18n';
import { MARK_COLOUR_VARS } from '@/utils/canvasMarks';
import { clearWithQuestion } from '@/utils/markerActions';

/** A cross drawn by hand, told apart from the X that closes */
const HandCross = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
    <path d="M5.5 5Q12 11.5 18.5 19M18 5.5Q11.5 12.5 5 18.5" />
  </svg>
);

const TOOL_ICONS: Record<MarkerTool, ReactNode> = {
  pen: <Pencil size={16} aria-hidden="true" />,
  text: <Type size={16} aria-hidden="true" />,
  arrow: <MoveUpRight size={16} aria-hidden="true" />,
  ellipse: <Circle size={16} aria-hidden="true" />,
  tick: <Check size={16} strokeWidth={2.4} aria-hidden="true" />,
  cross: <HandCross />,
  eraser: <Eraser size={16} aria-hidden="true" />,
};

const MarkerToolbar = () => {
  const t = useT();
  const tool = useMarkerStore((state) => state.tool);
  const color = useMarkerStore((state) => state.color);
  const width = useMarkerStore((state) => state.width);
  const nothingWritten = useNetworkStore((state) => state.marks.length === 0);
  const marker = useMarkerStore.getState();

  return (
    <div className="marker-toolbar" role="toolbar" aria-label={t.marker.name}>
      <div className="marker-group" role="group" aria-label={t.marker.groups.tool}>
        {MARKER_TOOLS.map((entry) => (
          <button
            key={entry}
            type="button"
            className={entry === tool ? 'marker-button active' : 'marker-button'}
            aria-pressed={entry === tool}
            aria-label={t.marker.tools[entry]}
            title={t.marker.tools[entry]}
            onClick={() => marker.setTool(entry)}
          >
            {TOOL_ICONS[entry]}
          </button>
        ))}
      </div>

      <div className="marker-group" role="group" aria-label={t.marker.groups.colour}>
        {MARK_COLOURS.map((entry) => (
          <button
            key={entry}
            type="button"
            className={entry === color ? 'marker-button marker-swatch active' : 'marker-button marker-swatch'}
            aria-pressed={entry === color}
            aria-label={t.marker.colours[entry]}
            title={t.marker.colours[entry]}
            onClick={() => marker.setColor(entry)}
          >
            <span style={{ background: MARK_COLOUR_VARS[entry] }} />
          </button>
        ))}
      </div>

      <div className="marker-group" role="group" aria-label={t.marker.groups.width}>
        {MARK_WIDTHS.map((entry) => (
          <button
            key={entry}
            type="button"
            className={entry === width ? 'marker-button active' : 'marker-button'}
            aria-pressed={entry === width}
            aria-label={t.marker.widths[entry]}
            title={t.marker.widths[entry]}
            onClick={() => marker.setWidth(entry)}
          >
            <span className={`marker-width marker-width-${entry}`} />
          </button>
        ))}
      </div>

      <div className="marker-group">
        <button
          type="button"
          className="marker-button"
          aria-label={t.marker.clear}
          title={t.marker.clearHint}
          disabled={nothingWritten}
          onClick={() => void clearWithQuestion()}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="marker-button"
          aria-label={t.marker.close}
          title={`${t.marker.close} (Esc)`}
          onClick={() => marker.setActive(false)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default MarkerToolbar;
