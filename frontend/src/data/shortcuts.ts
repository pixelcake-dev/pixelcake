/**
 * The shortcuts of the app, in the groups and the order Settings → Advanced
 * lists them. What each says (its action and its keys, in both languages) is
 * in the dictionary (`advanced.shortcuts`); the groups are the sections of
 * the page of the documentation (documentation/{en,it}/reference/shortcuts.md),
 * and a test holds the two to each other: the same groups, as many lines in
 * each, the same keys.
 *
 * Every line here is something the app really does; keep it that way when
 * adding one.
 */

import type { Dictionary } from '@/i18n';

type Shortcuts = Dictionary['advanced']['shortcuts'];

export type ShortcutRow = keyof Shortcuts['rows'];
/** The anchor of the section of the documentation the group is */
export type ShortcutGroup = keyof Shortcuts['groups'];

export const SHORTCUT_GROUPS: ReadonlyArray<{ id: ShortcutGroup; rows: readonly ShortcutRow[] }> = [
  {
    // NetworkCanvas (copy, paste, delete), registerSaveShortcut (save) and
    // registerUndoShortcuts (undo, redo); the rest is React Flow: multi-selection key, selection on drag, pan on the
    // right button, the wheel, the double click, the arrow keys, Tab, Enter and
    // Esc on a device that has the focus
    id: 'board',
    rows: [
      'save',
      'undo',
      'redo',
      'copy',
      'paste',
      'delete',
      'toggleSelection',
      'selectionBox',
      'pan',
      'zoom',
      'zoomPoint',
      'moveDevice',
      'nudge',
      'nudgeFar',
      'release',
      'focusNext',
      'focusSelect',
    ],
  },
  {
    id: 'pointer',
    rows: [
      'openDevice',
      'deviceMenu',
      'cableMenu',
      'drawCable',
      'readNote',
      'selectArea',
      'moveArea',
      'renameArea',
      'areaMenu',
      'renameProject',
    ],
  },
  // useEscapeToClose, ConfirmDialog, InlineEdit, VLANInput
  { id: 'windows', rows: ['closeWindow', 'confirm', 'nextField', 'vlans'] },
  // TerminalModal
  { id: 'terminal', rows: ['run', 'history', 'interrupt', 'closeTerminal'] },
  // PresentationBar
  { id: 'presenting', rows: ['leavePresentation', 'askOrBreak', 'presentationView'] },
  // useMarkerKeys, MarkerSurface
  { id: 'marker', rows: ['markerToggle', 'markerOff', 'markerText', 'markerNewLine', 'markerView'] },
  // components/Guide/GuidedTour
  { id: 'tour', rows: ['tourNext', 'tourBack', 'tourClose', 'tourButtons'] },
];

/**
 * The keys the code listens to (what `event.key` is compared with, or a key
 * a React Flow prop is given), each with the lines of the list that say what
 * it does. A test finds the keys in the source: one that is not here is a
 * shortcut nobody wrote down.
 */
export const KEYS_HEARD: Record<string, readonly ShortcutRow[]> = {
  Enter: ['confirm', 'vlans', 'run', 'renameArea', 'renameProject', 'markerText', 'markerNewLine', 'tourNext'],
  Escape: [
    'closeWindow',
    'closeTerminal',
    'leavePresentation',
    'readNote',
    'release',
    'markerOff',
    'markerText',
    'tourClose',
  ],
  Delete: ['delete'],
  Control: ['toggleSelection'],
  c: ['copy', 'interrupt'],
  v: ['paste'],
  s: ['save'],
  z: ['undo', 'redo'],
  y: ['redo'],
  ArrowUp: ['history'],
  ArrowDown: ['history'],
  ArrowRight: ['tourNext'],
  ArrowLeft: ['tourBack'],
  Tab: ['tourButtons'],
  ',': ['vlans'],
  Backspace: ['vlans'],
  a: ['markerToggle'],
};
