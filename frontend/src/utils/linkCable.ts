/**
 * The cable of a link as the window of the link edits it: the medium, the
 * length in m or km, and a delay written by hand. Pure: the form as typed
 * in, the fields of the link and what is wrong with them out. The time the
 * cable takes is the engine's (engine/latency).
 */

import type { LinkMedium, NetworkConnection } from '@/types';
import { isLinkDelay, isLinkLength, isLinkMedium } from '@/engine';

/** The unit a length is typed in */
export type LengthUnit = 'm' | 'km';

/** The fields of the window, as typed: '' is automatic, or none */
export interface CableForm {
  medium: LinkMedium | '';
  length: string;
  unit: LengthUnit;
  delay: string;
}

export type LengthProblem = 'notLength' | 'tooLong';
export type DelayProblem = 'notDelay' | 'tooSlow';

/** The fields of a link the window writes */
export type CableFields = Pick<NetworkConnection, 'medium' | 'lengthM' | 'delayMs'>;

/** A number as a person types it: digits, with a point or a comma for the decimals. Undefined when it is not one */
export function decimalOf(text: string): number | undefined {
  const value = text.trim();
  if (!/^(\d+([.,]\d+)?|[.,]\d+)$/.test(value)) return undefined;
  return Number(value.replace(',', '.'));
}

/** A number written back in a field, with a point: up to three decimals, none at its end */
function written(value: number): string {
  return String(Number(value.toFixed(3)));
}

/**
 * The form of a link: its medium, its length in the unit it reads best in
 * (km from 1 km on, m under), its delay. With a point for the decimals: the
 * window writes them as its language does.
 */
export function cableFormOf(connection: NetworkConnection): CableForm {
  const metres = isLinkLength(connection.lengthM) ? connection.lengthM : undefined;
  const unit: LengthUnit = metres !== undefined && metres >= 1000 ? 'km' : 'm';
  return {
    medium: isLinkMedium(connection.medium) ? connection.medium : '',
    length: metres === undefined ? '' : written(unit === 'km' ? metres / 1000 : metres),
    unit,
    delay: isLinkDelay(connection.delayMs) ? written(connection.delayMs) : '',
  };
}

/**
 * What the form says: the fields of the link (each left out when it is
 * automatic, or empty, or wrong), and what is wrong with the length and the
 * delay as typed.
 */
export function readCableForm(form: CableForm): {
  fields: CableFields;
  lengthProblem?: LengthProblem;
  delayProblem?: DelayProblem;
} {
  const fields: CableFields = {
    medium: form.medium === '' ? undefined : form.medium,
    lengthM: undefined,
    delayMs: undefined,
  };
  let lengthProblem: LengthProblem | undefined;
  let delayProblem: DelayProblem | undefined;

  if (form.length.trim() !== '') {
    const value = decimalOf(form.length);
    // (kept to the millimetre: 1.1 km is 1100 m, not 1100.0000000000002)
    const metres = value === undefined ? undefined : Math.round(value * (form.unit === 'km' ? 1000 : 1) * 1000) / 1000;
    if (metres === undefined || metres <= 0) lengthProblem = 'notLength';
    else if (!isLinkLength(metres)) lengthProblem = 'tooLong';
    else fields.lengthM = metres;
  }
  if (form.delay.trim() !== '') {
    const value = decimalOf(form.delay);
    if (value === undefined) delayProblem = 'notDelay';
    else if (!isLinkDelay(value)) delayProblem = 'tooSlow';
    else fields.delayMs = value;
  }
  return {
    fields,
    ...(lengthProblem ? { lengthProblem } : {}),
    ...(delayProblem ? { delayProblem } : {}),
  };
}
