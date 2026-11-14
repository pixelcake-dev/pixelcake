/**
 * A text of the dictionary that has something inside it: words to show as
 * code, or a piece the screen draws itself (a button, a link, a number in
 * bold). The text stays one sentence in the dictionary, so each language
 * puts those pieces where its own word order wants them.
 *
 *   `ping PC-1`            between backticks: drawn by `code`
 *   <tab>Ports</tab>       a named piece with words: drawn by `parts.tab(words)`
 *   <count/>               a named piece without words: drawn by `parts.count('')`
 *
 * Only texts of the dictionary go through here. What a person typed (a
 * device name) is handed over as a piece, never pasted into the text: a
 * name with a backtick in it must stay a name.
 */

import { Fragment, type ReactNode } from 'react';
import { richPieces } from './richPieces';

interface RichProps {
  text: string;
  /** How the words between backticks are drawn (a plain <code> when not given) */
  code?: (words: string) => ReactNode;
  /** How each named piece is drawn */
  parts?: Record<string, (words: string) => ReactNode>;
}

export function Rich({ text, code, parts }: RichProps) {
  return (
    <>
      {richPieces(text).map((piece, index) => {
        if (piece.kind === 'text') return <Fragment key={index}>{piece.words}</Fragment>;
        if (piece.kind === 'code') {
          return <Fragment key={index}>{code ? code(piece.words) : <code>{piece.words}</code>}</Fragment>;
        }
        const draw = parts?.[piece.name];
        // A piece nobody draws shows its words: a text is never lost
        return <Fragment key={index}>{draw ? draw(piece.words) : piece.words}</Fragment>;
      })}
    </>
  );
}
