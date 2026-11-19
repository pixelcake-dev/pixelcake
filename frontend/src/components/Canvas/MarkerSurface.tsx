/**
 * The marker in use: a sheet over the board that takes the pointer (mouse,
 * pen or finger), so that it writes and selects, moves or joins nothing.
 * It is there only while the marker is in use; put away, the board is as it
 * always is.
 *
 * - The pen draws a line through every point the pointer goes through.
 * - An arrow goes from where the pointer goes down to where it comes up; a
 *   circle, a tick and a cross are drawn in the box the pointer drags (a
 *   tick or a cross placed with a click has the size of a stamp).
 * - Words: a click opens a field where the board was clicked; Enter writes
 *   them, Shift + Enter starts a new line, Esc gives them up.
 * - The eraser takes away, when it is let go, every whole mark it touched.
 * - The right button drags the view and the wheel zooms, as on the board.
 *
 * Each mark finished, and each sweep of the eraser, is one action of the
 * store: of the canvas (networkStore) while building, of the presenter's pen
 * (markerStore) while presenting.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow, useStore, useStoreApi, type ReactFlowState } from 'reactflow';
import type { CanvasMark } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { useMarkerStore } from '@/store/markerStore';
import { usePresentationStore } from '@/store/presentationStore';
import { HAND_FONT, MARK_COLOUR_VARS, MARK_TEXT_SIZE, newSeed, tidyMarkText } from '@/utils/canvasMarks';
import { markHit, simplifyPoints, stampBox, type HandMeasure, type HandPoint } from '@/utils/handDrawing';
import { createTextMeasure } from '@/utils/drawingMeasure';
import { useT } from '@/i18n';
import { MarkShape } from './MarksLayer';

/** On screen, in pixels: how far the pointer moves before a new point of a line is taken */
const POINT_STEP = 2;
/** How close the eraser has to come to a mark, on screen */
const ERASER_REACH = 8;
/** The size of a tick or a cross placed with a click, on screen */
const STAMP = 36;
/** Smaller than this on screen, an arrow or a circle was a click: nothing is drawn */
const LEAST_DRAG = 6;
/** The view as the board allows it */
const ZOOM = { min: 0.1, max: 4 } as const;

type Gesture =
  | { kind: 'draw'; pointerId: number; points: number[] }
  | { kind: 'erase'; pointerId: number; last: HandPoint; touched: string[] }
  | { kind: 'pan'; pointerId: number; from: { x: number; y: number }; view: { x: number; y: number; zoom: number } };

const transformOf = (state: ReactFlowState) => state.transform;

/** Words being typed: where on the canvas, and with which seed they will be drawn */
interface Typing {
  at: HandPoint;
  seed: number;
}

const MarkerSurface = () => {
  const t = useT();
  const tool = useMarkerStore((state) => state.tool);
  const color = useMarkerStore((state) => state.color);
  const width = useMarkerStore((state) => state.width);
  const presenting = usePresentationStore((state) => state.active);
  const [tx, ty, zoom] = useStore(transformOf);
  const flowStore = useStoreApi();
  const flow = useReactFlow();

  const surface = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<CanvasMark | null>(null);
  const [typing, setTyping] = useState<Typing | null>(null);
  const typingRef = useRef<Typing | null>(null);
  const words = useRef('');
  const [shownWords, setShownWords] = useState('');
  const measure = useRef<HandMeasure | null>(null);
  /** The seed of the mark being drawn: the one it keeps once finished, so that it does not change at the end */
  const draftSeed = useRef(newSeed());

  /** A point of the window, on the canvas */
  const toCanvas = useCallback(
    (clientX: number, clientY: number): HandPoint => {
      const box = surface.current?.getBoundingClientRect();
      const [x, y, scale] = flowStore.getState().transform;
      return { x: (clientX - (box?.left ?? 0) - x) / scale, y: (clientY - (box?.top ?? 0) - y) / scale };
    },
    [flowStore]
  );

  /** A mark finished goes where the marker writes now: the canvas, or the presenter's pen */
  const keep = useCallback(
    (mark: Omit<CanvasMark, 'id'>) => {
      if (usePresentationStore.getState().active) useMarkerStore.getState().addPresenterMark(mark);
      else useNetworkStore.getState().addMark(mark);
    },
    []
  );

  /** The words typed, written on the canvas (none when nothing was typed) */
  const finishTyping = useCallback(
    (write: boolean) => {
      const pending = typingRef.current;
      if (!pending) return;
      typingRef.current = null;
      setTyping(null);
      const text = tidyMarkText(words.current);
      words.current = '';
      setShownWords('');
      if (!write || text === '') return;
      const { color: colour, width: thickness } = useMarkerStore.getState();
      keep({ kind: 'text', color: colour, width: thickness, points: [pending.at.x, pending.at.y], text, seed: pending.seed });
    },
    [keep]
  );

  // Put away with words still in the field: they are written, as a click elsewhere would
  useEffect(() => () => finishTyping(true), [finishTyping]);

  /** What the eraser can take: the canvas's while building, the presenter's while presenting */
  const erasable = () =>
    usePresentationStore.getState().active ? useMarkerStore.getState().presenterMarks : useNetworkStore.getState().marks;

  /** The marks the eraser touches on its way from one point to the next */
  const touchedOn = (from: HandPoint, to: HandPoint, scale: number): string[] => {
    measure.current ??= (() => {
      const text = createTextMeasure();
      return (line: string, size: number) => text(line, { size, weight: HAND_FONT.weight, hand: true });
    })();
    const reach = ERASER_REACH / scale;
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (reach / 2)));
    const found: string[] = [];
    for (const mark of erasable()) {
      for (let step = 0; step <= steps; step++) {
        const point = { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps };
        if (markHit(mark, point, reach, measure.current)) {
          found.push(mark.id);
          break;
        }
      }
    }
    return found;
  };

  const draftOf = (points: number[]): CanvasMark | null => {
    const kind = useMarkerStore.getState().tool;
    if (kind === 'eraser' || kind === 'text') return null;
    const { color: colour, width: thickness } = useMarkerStore.getState();
    const start = points.slice(0, 2);
    const shape = kind === 'pen' ? points : [...start, ...points.slice(-2)];
    return { id: 'draft', kind, color: colour, width: thickness, points: shape, seed: draftSeed.current };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // (words being typed are written first, as a click elsewhere does)
    if (typingRef.current) {
      finishTyping(true);
      return;
    }
    if (gesture.current) return;
    const capture = () => {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // (a pointer the browser no longer knows: the window still follows it)
      }
    };

    // The right button drags the view, as on the board
    if (event.button === 2) {
      const viewport = flow.getViewport();
      gesture.current = { kind: 'pan', pointerId: event.pointerId, from: { x: event.clientX, y: event.clientY }, view: viewport };
      capture();
      event.preventDefault();
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    const point = toCanvas(event.clientX, event.clientY);
    const kind = useMarkerStore.getState().tool;

    if (kind === 'text') {
      const pending = { at: point, seed: newSeed() };
      typingRef.current = pending;
      words.current = '';
      setShownWords('');
      setTyping(pending);
      return;
    }
    if (kind === 'eraser') {
      const touched = touchedOn(point, point, flowStore.getState().transform[2]);
      gesture.current = { kind: 'erase', pointerId: event.pointerId, last: point, touched };
      useMarkerStore.getState().setErasing(touched);
      capture();
      return;
    }
    draftSeed.current = newSeed();
    const points = [point.x, point.y];
    gesture.current = { kind: 'draw', pointerId: event.pointerId, points };
    setDraft(draftOf(points));
    capture();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const now = gesture.current;
    if (!now || now.pointerId !== event.pointerId) return;
    if (now.kind === 'pan') {
      flow.setViewport({
        x: now.view.x + event.clientX - now.from.x,
        y: now.view.y + event.clientY - now.from.y,
        zoom: now.view.zoom,
      });
      return;
    }
    const point = toCanvas(event.clientX, event.clientY);
    const scale = flowStore.getState().transform[2];
    if (now.kind === 'erase') {
      const more = touchedOn(now.last, point, scale).filter((id) => !now.touched.includes(id));
      now.last = point;
      if (more.length > 0) {
        now.touched = [...now.touched, ...more];
        useMarkerStore.getState().setErasing(now.touched);
      }
      return;
    }
    const kind = useMarkerStore.getState().tool;
    if (kind === 'pen') {
      const [lastX, lastY] = now.points.slice(-2);
      if (Math.hypot(point.x - lastX, point.y - lastY) * scale < POINT_STEP) return;
      now.points = [...now.points, point.x, point.y];
    } else {
      now.points = [...now.points.slice(0, 2), point.x, point.y];
    }
    setDraft(draftOf(now.points));
  };

  const finish = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const now = gesture.current;
    if (!now || now.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDraft(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // (already let go)
    }
    if (now.kind === 'pan' || cancelled) {
      useMarkerStore.getState().setErasing([]);
      return;
    }
    if (now.kind === 'erase') {
      useMarkerStore.getState().setErasing([]);
      if (now.touched.length === 0) return;
      if (usePresentationStore.getState().active) useMarkerStore.getState().removePresenterMarks(now.touched);
      else useNetworkStore.getState().removeMarks(now.touched);
      return;
    }

    const point = toCanvas(event.clientX, event.clientY);
    const scale = flowStore.getState().transform[2];
    const { tool: kind, color: colour, width: thickness } = useMarkerStore.getState();
    if (kind === 'eraser' || kind === 'text') return;
    const seed = draftSeed.current;
    if (kind === 'pen') {
      const [lastX, lastY] = now.points.slice(-2);
      const points = lastX === point.x && lastY === point.y ? now.points : [...now.points, point.x, point.y];
      // (a line by hand keeps its turns, not every point the mouse reported)
      keep({ kind, color: colour, width: thickness, points: simplifyPoints(points, 0.6 / scale), seed });
      return;
    }
    const [x0, y0] = now.points;
    const dragged = Math.max(Math.abs(point.x - x0), Math.abs(point.y - y0)) * scale >= LEAST_DRAG;
    if (kind === 'tick' || kind === 'cross') {
      const points = dragged ? [x0, y0, point.x, point.y] : stampBox({ x: x0, y: y0 }, STAMP / scale);
      keep({ kind, color: colour, width: thickness, points, seed });
      return;
    }
    if (dragged) keep({ kind, color: colour, width: thickness, points: [x0, y0, point.x, point.y], seed });
  };

  // The wheel zooms around the pointer, as on the board. Not passive: the
  // page itself must not zoom with Ctrl and the wheel
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const view = flow.getViewport();
      const step = event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002;
      const next = Math.min(
        ZOOM.max,
        Math.max(ZOOM.min, view.zoom * Math.pow(2, -event.deltaY * step * (event.ctrlKey ? 10 : 1)))
      );
      const box = element.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      flow.setViewport({
        x: px - ((px - view.x) * next) / view.zoom,
        y: py - ((py - view.y) * next) / view.zoom,
        zoom: next,
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [flow]);

  const textSize = MARK_TEXT_SIZE[width] * zoom;

  return (
    <div
      ref={surface}
      className="marker-surface nopan nodrag nowheel"
      data-tool={tool}
      data-presenting={presenting || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finish(event, false)}
      onPointerCancel={(event) => finish(event, true)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {draft && (
        <svg className="marker-draft" aria-hidden="true">
          <g transform={`translate(${tx} ${ty}) scale(${zoom})`}>
            <MarkShape mark={draft} />
          </g>
        </svg>
      )}
      {typing && (
        <textarea
          className="marker-text-field"
          aria-label={t.marker.text.label}
          placeholder={t.marker.text.placeholder}
          autoFocus
          rows={Math.max(1, shownWords.split('\n').length)}
          value={shownWords}
          spellCheck={false}
          style={{
            left: typing.at.x * zoom + tx,
            top: typing.at.y * zoom + ty,
            fontSize: textSize,
            lineHeight: 1.15,
            color: MARK_COLOUR_VARS[color],
            fontFamily: HAND_FONT.family,
            fontWeight: HAND_FONT.weight,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            words.current = event.target.value;
            setShownWords(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              finishTyping(true);
            } else if (event.key === 'Escape') {
              // (the words are given up; the marker stays in use)
              event.preventDefault();
              event.stopPropagation();
              finishTyping(false);
            }
          }}
          onBlur={() => finishTyping(true)}
        />
      )}
    </div>
  );
};

export default MarkerSurface;
