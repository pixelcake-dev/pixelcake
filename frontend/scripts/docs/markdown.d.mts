/** Types of markdown.mjs, for the tests that read the documentation (src/docs) */

export interface FenceInfo {
  /** The first word of the info string: `ncl`, `text`, `json`… */
  lang: string;
  /** `sample=company` → { sample: 'company' } */
  attrs: Record<string, string>;
  /** Words without `=`: `continue` */
  flags: string[];
}

export interface Fence extends FenceInfo {
  info: string;
  content: string;
  /** The line the fence opens on, 1-based */
  line: number;
}

export interface SessionStep {
  /** `pixelcake`, or the device of a context (`PC-1`) */
  prompt: string;
  command: string;
  /** The lines printed under the command, as the page shows them */
  output: string[];
  /** Index of the command among the lines of the block, from 0 */
  line: number;
}

export const CALLOUTS: string[];
export const PROMPT_LINE: RegExp;
export function escapeHtml(text: string): string;
export function parseInfo(info: string): FenceInfo;
export function parseSession(content: string): { steps: SessionStep[]; before: string[] };
export function fencesOf(text: string): Fence[];
export function slugify(text: string): string;
export function imageSize(file: string): { width: number; height: number } | null;
export function mediaKind(file: string): 'image' | 'gif' | 'video' | 'other';
export function variant(file: string, suffix: string, extension?: string): string;
