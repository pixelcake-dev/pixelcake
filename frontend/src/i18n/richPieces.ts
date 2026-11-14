/**
 * The marks a text of the dictionary can carry (see Rich.tsx, which draws
 * them): words between backticks, a named piece with or without words.
 */

export type RichPiece =
  | { kind: 'text'; words: string }
  | { kind: 'code'; words: string }
  | { kind: 'part'; name: string; words: string };

const MARK = /`([^`]+)`|<(\w+)>([^<]*)<\/\2>|<(\w+)\/>/g;

/** The pieces of a text, in order */
export function richPieces(text: string): RichPiece[] {
  const pieces: RichPiece[] = [];
  let from = 0;
  for (const match of text.matchAll(MARK)) {
    const at = match.index ?? 0;
    if (at > from) pieces.push({ kind: 'text', words: text.slice(from, at) });
    if (match[1] !== undefined) pieces.push({ kind: 'code', words: match[1] });
    else if (match[2] !== undefined) pieces.push({ kind: 'part', name: match[2], words: match[3] });
    else pieces.push({ kind: 'part', name: match[4], words: '' });
    from = at + match[0].length;
  }
  if (from < text.length) pieces.push({ kind: 'text', words: text.slice(from) });
  return pieces;
}
