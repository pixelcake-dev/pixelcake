/**
 * The shape of a dictionary. Italian is the source: whatever it holds, every
 * other language must hold too, entry by entry and of the same kind (a text,
 * or a function of the same values). The compiler checks it.
 */

import type { it } from './it';

export type Dictionary = typeof it;
