/**
 * For tests: tell whether a text has Italian in it.
 *
 * Two lists of words. The first is written here: the little words nearly
 * every Italian sentence needs, and the nouns and verbs this interface is
 * made of; none of them is an English word. The second is worked out from
 * the two dictionaries: every word the Italian one uses and the English one
 * does not, so the test follows the vocabulary as it grows.
 *
 * A letter with an Italian accent, or a quotation in «…», is Italian too.
 */

import { dictionaryOf } from '@/i18n';

const LITTLE_WORDS = `
  il lo la gli le un una uno del dello della dei degli delle
  al allo alla ai agli alle dal dallo dalla dai dagli dalle dall
  nel nello nella nei negli nelle nell sul sullo sulla sui sugli sulle sull
  di da su con tra fra che chi cui non anche ancora oppure quando poi mentre
  senza sopra sotto dentro fuori dopo prima qui ecco ed ma se si ci ne
  sono ha hanno viene vengono deve devono sta stanno servono resta restano manca mancano
  questo questa questi queste quello quella stesso stessa ogni tutto tutti tutte
  altro altra altri altre nessun nessuno nessuna nuovo nuova nuovi nuove
  primo ultimo ultima vuoto vuota libero libera liberi libere
`;

const INTERFACE_WORDS = `
  dispositivo dispositivi rete reti porta porte scheda schede indirizzo indirizzi
  progetto progetti cavo cavi collegamento collegamenti connessione connessioni
  rotta rotte regola regole inoltro inoltri guasto guasti nome nomi tipo tipi
  impostazioni modifica modifiche salva salvato salvata annulla elimina eliminare
  chiudi apri aggiungi aggiunto aggiunti rimuovi togli rinomina
  attivo attiva abilitato abilitata disabilitata collegata collegato
  assegnato assegnati consegnato intervallo intervalli domanda risposta partenza
  destinazione arrivo percorso disegno immagine pulsante finestra schermata elenco
  riga righe campo valore valido valida obbligatorio errore avviso avvisi esempio
  descrizione colore spessore anteprima cerca seleziona selezione copia incolla
  scarica carica importa esporta formato dimensione tema chiaro scuro lingua guida
  aiuto benvenuto simulazione presentazione pacchetto zona sicurezza servizio servizi
  origine azione permetti nega sposta opzionale facoltativo predefinito predefinita
  riquadro riquadri
`;

/**
 * Words the Italian dictionary uses and the English one happens not to,
 * that are English all the same: English words the Italian interface
 * borrowed (`canvas`, which the English interface calls a board), or Italian
 * words spelled like English ones (`state`, as in «sono state»). They are
 * left out of the list that is worked out, or the English of the engine and
 * of the terminal would be taken for Italian.
 */
const ALSO_ENGLISH = `
  canvas canvases vlan state
`;

const words = (list: string) => list.split(/\s+/).filter(Boolean);

/** Italian words that are not English words: written by hand, always looked for */
export const ITALIAN_BASE_WORDS: ReadonlySet<string> = new Set([
  ...words(LITTLE_WORDS),
  ...words(INTERFACE_WORDS),
]);

const ACCENTED = /[àèéìòù]/i;
const LETTERS = /[A-Za-zÀ-ÖØ-öø-ÿ]+/g;
/** What makes a word part of an identifier or of a number: `bg-canvas`, `eth0`, `--radius` */
const GLUE = /[-_0-9@#$=\\]/;
/** What does the same only between two words, where a sentence would have a space: `it.port`, `a/b`, `x:y` */
const JOINT = /[./:]/;
const WORD_CHARACTER = /[A-Za-zÀ-ÖØ-öø-ÿ0-9_]/;

/**
 * The words of a text, in lower case. A word glued to a dash or a digit, or
 * joined to another by a dot, is part of a name (`PC-Vendite`,
 * `explorer-canvas-card`, `eth0`, `state.name`): it is left out, because a
 * name is not a sentence.
 */
export function proseWords(text: string): string[] {
  const found: string[] = [];
  const glued = (character: string | undefined, beyond: string | undefined) =>
    character !== undefined &&
    (GLUE.test(character) || (JOINT.test(character) && beyond !== undefined && WORD_CHARACTER.test(beyond)));
  for (const match of text.matchAll(LETTERS)) {
    const at = match.index ?? 0;
    const end = at + match[0].length;
    if (match[0].length < 2) continue;
    if (glued(text[at - 1], text[at - 2]) || glued(text[end], text[end + 1])) continue;
    found.push(match[0].toLowerCase());
  }
  return found;
}

/** Every text of a dictionary: the plain ones, and the source of the ones that take values */
export function leavesOf(node: unknown, path = ''): Array<{ path: string; text: string; isFunction: boolean }> {
  if (typeof node === 'string') return [{ path, text: node, isFunction: false }];
  if (typeof node === 'function') return [{ path, text: String(node), isFunction: true }];
  if (Array.isArray(node)) return node.flatMap((item, index) => leavesOf(item, `${path}[${index}]`));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => leavesOf(value, path ? `${path}.${key}` : key));
  }
  return [];
}

/**
 * The words inside the quotes of a piece of source (a function of the
 * dictionary): its parameter names and its code are not text.
 */
export function quotedText(source: string): string {
  const pieces = source.match(/`(?:[^`\\]|\\.)*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g) ?? [];
  return pieces.map((piece) => piece.slice(1, -1).replace(/\$\{[^}]*\}/g, ' ')).join(' ');
}

const leafText = (leaf: { text: string; isFunction: boolean }) =>
  leaf.isFunction ? quotedText(leaf.text) : leaf.text;

let derived: ReadonlySet<string> | null = null;

/** The words the Italian dictionary uses and the English one does not */
export function italianOnlyWords(): ReadonlySet<string> {
  if (derived) return derived;
  const english = new Set(leavesOf(dictionaryOf('en')).flatMap((leaf) => proseWords(leafText(leaf))));
  const italian = leavesOf(dictionaryOf('it')).flatMap((leaf) => proseWords(leafText(leaf)));
  // (a word of three letters or fewer says too little to be trusted here: the
  // list written by hand has the short ones that matter)
  const alsoEnglish = new Set(words(ALSO_ENGLISH));
  derived = new Set(
    italian.filter((word) => word.length >= 4 && !english.has(word) && !alsoEnglish.has(word))
  );
  return derived;
}

/**
 * What is Italian in a text: its Italian words, and `accent` / `«»` when it
 * has an accented letter or an Italian quotation. Empty when nothing is.
 *
 * `strict` looks only for the words written by hand: for checking the
 * English dictionary itself, whose words the worked-out list is made from.
 */
export function italianIn(text: string, { strict = false } = {}): string[] {
  const derivedWords = strict ? null : italianOnlyWords();
  const found = new Set<string>();
  for (const word of proseWords(text)) {
    if (ITALIAN_BASE_WORDS.has(word) || derivedWords?.has(word)) found.add(word);
  }
  if (ACCENTED.test(text)) found.add('accent');
  if (/[«»]/.test(text)) found.add('«»');
  return [...found];
}
