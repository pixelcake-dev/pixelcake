/**
 * The classes of the low fields of a settings screen (see ./compact.tsx for
 * the fields themselves): kept apart so that a table can give them to a
 * field of its own.
 */

/** A low field: the same in a table of forwards, of pools, of ports, of cards */
export const cellClass =
  'w-full px-2 py-1 text-sm bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded ' +
  'text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed read-only:bg-[var(--bg-toolbar)]';

export const labelClass = 'text-xs text-[var(--text-color-light)]';
export const hintClass = 'text-xs text-[var(--text-color-light)]';
export const errorClass = 'text-xs text-[var(--danger-color)]';
/** A link inside a sentence: «Dagliene uno», «scheda Porte» */
export const linkClass = 'text-[var(--accent-text)] underline cursor-pointer';
