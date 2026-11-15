/**
 * DeviceNote
 * The note of a device, shown by the app when the pointer rests on the
 * device, or the keyboard brings its focus there: a small panel of the look
 * of the menus, under the device (above it when there is no room below),
 * with the line breaks of the note, and a long note cut after a few lines.
 *
 * One panel for the whole canvas, placed on the page. It never takes the
 * pointer, and it is outside the frame of the device: it is never in the
 * way of the device, of the bands that start a cable, or of what is next to
 * it. It shows after a short rest, and not while something is going on (a
 * device dragged, a cable pulled, a menu open); it goes at once when the
 * pointer leaves, a button is pressed, the wheel turns, a menu is asked for
 * or Esc is pressed. It is there while presenting too: a note is something
 * to read aloud.
 *
 * A screen reader has the note from the device itself (NetworkDevice): this
 * panel is for the eye, and is hidden from it.
 */

import { useEffect, useRef, useState } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useUIStore } from '@/store/uiStore';

/** How long the pointer rests on a device before its note shows (ms) */
export const NOTE_REST_MS = 450;
/** The room between the device and its note */
const GAP = 6;
/** The room the panel needs under a device to be shown there */
const ROOM_BELOW = 140;

interface ShownNote {
  deviceId: string;
  /** The middle of the device, across the page */
  x: number;
  /** Where the panel starts (under the device) or ends (above it) */
  y: number;
  above: boolean;
}

/** The frame of a device on the page, when it is on the canvas */
function frameOf(deviceId: string): DOMRect | null {
  const node = document.querySelector(`.react-flow__node[data-id="${CSS.escape(deviceId)}"] .network-device`);
  return node ? node.getBoundingClientRect() : null;
}

/** True while something is going on that a note would be in the way of */
function busy(): boolean {
  return (
    document.body.classList.contains('react-flow-connecting') ||
    document.querySelector('.react-flow__node.dragging') !== null ||
    useUIStore.getState().contextMenuDevice !== null ||
    usePresentationStore.getState().menu !== null
  );
}

const DeviceNote = () => {
  const hovered = useNetworkStore((state) => state.hoveredDeviceId);
  const devices = useNetworkStore((state) => state.devices);
  // The device the keyboard brought its focus to (a device clicked has the
  // focus too, but its note is the pointer's business)
  const [focused, setFocused] = useState<string | null>(null);
  const [shown, setShown] = useState<ShownNote | null>(null);
  /** The device whose note was sent away: it stays away until the pointer or the focus comes to it again */
  const dismissed = useRef<string | null>(null);

  useEffect(() => {
    let byKeyboard = false;
    const onKeyDown = () => {
      byKeyboard = true;
    };
    const onMouseDown = () => {
      byKeyboard = false;
    };
    const onFocusIn = (event: FocusEvent) => {
      const node = event.target instanceof Element ? event.target.closest('.react-flow__node') : null;
      setFocused(byKeyboard && node?.querySelector('.network-device') ? node.getAttribute('data-id') : null);
    };
    const onFocusOut = () => setFocused(null);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const deviceId = hovered ?? focused;

  // After a short rest on a device that has a note, the note shows
  useEffect(() => {
    if (dismissed.current !== deviceId) dismissed.current = null;
    setShown(null);
    if (deviceId === null) return;
    const timer = setTimeout(() => {
      if (dismissed.current === deviceId || busy()) return;
      const device = useNetworkStore.getState().devices.find((entry) => entry.id === deviceId);
      const frame = frameOf(deviceId);
      if (!device?.notes?.trim() || !frame) return;
      const above = window.innerHeight - frame.bottom < ROOM_BELOW && frame.top > ROOM_BELOW;
      setShown({
        deviceId,
        x: Math.round(frame.left + frame.width / 2),
        y: Math.round(above ? frame.top - GAP : frame.bottom + GAP),
        above,
      });
    }, NOTE_REST_MS);
    return () => clearTimeout(timer);
  }, [deviceId]);

  // It goes when a button is pressed, the wheel turns, a menu is asked for, or Esc is pressed
  useEffect(() => {
    if (!shown) return;
    const dismiss = () => {
      dismissed.current = shown.deviceId;
      setShown(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('mousedown', dismiss, true);
    window.addEventListener('wheel', dismiss, true);
    window.addEventListener('contextmenu', dismiss, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', dismiss, true);
      window.removeEventListener('wheel', dismiss, true);
      window.removeEventListener('contextmenu', dismiss, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [shown]);

  // (the note as it is now: a device removed, or its note emptied, shows nothing)
  const text = shown ? devices.find((device) => device.id === shown.deviceId)?.notes?.trim() : undefined;
  if (!shown || !text) return null;
  return (
    <div
      className={shown.above ? 'device-note device-note-above' : 'device-note'}
      style={{ left: shown.x, top: shown.y }}
      aria-hidden="true"
      data-testid="device-note"
    >
      <span className="device-note-text">{text}</span>
    </div>
  );
};

export default DeviceNote;
