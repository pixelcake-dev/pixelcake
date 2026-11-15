/**
 * A number of things, written as the language writes it: «14.891» in
 * Italian, "14,891" in English. One helper for every count the app writes
 * (Intl.NumberFormat). Italian groups the digits from five on, as its rules
 * say («4422», «14.891»); English from four ("4,422").
 *
 * A number that names one thing (rule 3, port 24, VLAN 10) is not a count,
 * and is written as it is.
 */

import type { Language } from './language';

const formats = new Map<Language, Intl.NumberFormat>();

/** `value` as `language` writes a number of things */
export function formatCount(language: Language, value: number): string {
  let format = formats.get(language);
  if (!format) {
    format = new Intl.NumberFormat(language, { maximumFractionDigits: 0 });
    formats.set(language, format);
  }
  return format.format(value);
}
