/**
 * Every command the terminal knows is in the terminal reference of the
 * documentation, in both languages.
 *
 * What the terminal knows is read from the parser itself (terminal/parser.ts,
 * through the TypeScript compiler), not from a list written here: the verbs
 * of `parse` and their aliases, what `show` shows, what `set` sets, what
 * `interface <id> …` changes, what `add` and `remove` take, the services and
 * the zones. A command added to the parser and not to the reference fails
 * here, in the language that misses it.
 *
 * In a page, a command counts where it is written as code: in a block of
 * syntax, in `inline code`, or typed at the prompt of an example (what the
 * terminal prints under it does not count).
 */

import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { REFERENCE_URL } from '@/terminal/executor';
import { loadDocs } from '../../scripts/docs/source.mjs';
import { parseSession } from '../../scripts/docs/markdown.mjs';
import { LANGUAGES, SITE_URL } from '../../scripts/docs/config.mjs';
import parserSource from '@/terminal/parser.ts?raw';

const tree = ts.createSourceFile('parser.ts', parserSource, ts.ScriptTarget.Latest, true);

function find<T extends ts.Node>(test: (node: ts.Node) => node is T, under: ts.Node = tree): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node) => {
    if (test(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(under);
  return found;
}

function functionNamed(name: string): ts.FunctionDeclaration {
  const found = find(ts.isFunctionDeclaration).find((node) => node.name?.text === name);
  if (!found) throw new Error(`parser.ts has no function ${name}`);
  return found;
}

/** The string labels of the `case`s of the switch on `expression` inside a function */
function casesOf(fn: ts.FunctionDeclaration, expression: string): string[] {
  const switches = find(ts.isSwitchStatement, fn).filter((node) => node.expression.getText(tree) === expression);
  return switches.flatMap((node) =>
    node.caseBlock.clauses.flatMap((clause) =>
      ts.isCaseClause(clause) && ts.isStringLiteral(clause.expression) ? [clause.expression.text] : []
    )
  );
}

/** The strings of a table: `const NAME = ['a', 'b']`, or the keys of `const NAME = { a: …, b: … }` */
function tableOf(name: string): string[] {
  const declaration = find(ts.isVariableDeclaration).find((node) => node.name.getText(tree) === name);
  const value = declaration?.initializer;
  if (!value) throw new Error(`parser.ts has no table ${name}`);
  if (ts.isArrayLiteralExpression(value)) {
    return value.elements.filter(ts.isStringLiteral).map((element) => element.text);
  }
  if (ts.isObjectLiteralExpression(value)) {
    return value.properties.flatMap((property) => (property.name && ts.isIdentifier(property.name) ? [property.name.text] : []));
  }
  throw new Error(`${name} is not a table`);
}

/** The words `noun` is compared with in a function: `noun === 'route'` */
function nounsOf(fn: ts.FunctionDeclaration): string[] {
  return find(ts.isBinaryExpression, fn)
    .filter((node) => node.left.getText(tree) === 'noun' && node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken)
    .flatMap((node) => (ts.isStringLiteral(node.right) ? [node.right.text] : []));
}

const verbs = casesOf(functionNamed('parse'), 'verb');
const showTargets = tableOf('SHOW_TARGETS');
const setProperties = tableOf('SET_PROPERTIES');
const services = tableOf('SERVICES');
const zones = tableOf('ZONES');
const interfaceSettings = casesOf(functionNamed('parseInterface'), 'word.lower');
const nouns = nounsOf(functionNamed('parseAddRemove'));

const model = loadDocs();

/** What the terminal pages of a language write as code: syntax blocks, inline code, commands typed */
function codeOf(lang: string): string[] {
  const pages = model.pages.filter((page) => page.lang === lang && page.section === 'terminal');
  return pages.flatMap((page) => [
    ...page.inlineCode.map((code) => code.content),
    ...page.code.flatMap((block) =>
      block.lang === 'ncl' ? parseSession(block.content).steps.map((step) => step.command) : block.content.split('\n')
    ),
  ]).map((line) => line.trim());
}

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('what the terminal knows, read from its parser', () => {
  it('is read', () => {
    expect(verbs).toEqual(expect.arrayContaining(['ping', 'trace', 'show', 'interface', 'nslookup', '?']));
    expect(showTargets).toContain('vlans');
    expect(setProperties).toContain('gateway');
    expect(services).toContain('https');
    expect(zones).toContain('dmz');
    expect(interfaceSettings).toEqual(expect.arrayContaining(['up', 'down', 'access', 'trunk', 'default', 'pool']));
    expect(nouns).toEqual(expect.arrayContaining(['route', 'backup', 'rule', 'forward', 'record', 'vlan']));
  });
});

describe.each(LANGUAGES)('the terminal reference (%s)', (lang) => {
  const code = codeOf(lang);
  const lines = (pattern: RegExp) => code.some((line) => pattern.test(line));

  it('has every verb, and every alias of one', () => {
    const missing = verbs.filter((verb) => !lines(new RegExp(`^${escape(verb)}(\\s|$|\\|)`)));
    expect(missing).toEqual([]);
  });

  it('has every `show`', () => {
    expect(showTargets.filter((target) => !lines(new RegExp(`^show ${target}\\b`)))).toEqual([]);
  });

  it('has every `set`', () => {
    expect(setProperties.filter((property) => !lines(new RegExp(`^set ${property}\\b`)))).toEqual([]);
  });

  it('has every setting of `interface <id> …`', () => {
    const missing = interfaceSettings.filter(
      (setting) => !lines(new RegExp(`^interface \\S+ (?:\\[?dhcp\\]? )?(?:[a-z]+\\|)*${setting}(?=[\\s|]|$)`))
    );
    expect(missing).toEqual([]);
  });

  it('has everything `add` and `remove` take', () => {
    const missing = nouns.flatMap((noun) =>
      ['add', 'remove'].filter((verb) => !(noun === 'backup' && verb === 'remove')).flatMap((verb) =>
        lines(new RegExp(`^${verb} ${noun}\\b`)) ? [] : [`${verb} ${noun}`]
      )
    );
    expect(missing).toEqual([]);
  });

  it('names every service and every zone', () => {
    const words = code.join(' ');
    expect([...services, ...zones].filter((word) => !new RegExp(`\\b${word}\\b`).test(words))).toEqual([]);
  });
});

describe('the last line of `help`', () => {
  it('is the address of the overview of the terminal reference, in English', () => {
    expect(REFERENCE_URL.startsWith(SITE_URL)).toBe(true);
    const href = REFERENCE_URL.slice(SITE_URL.length);
    const page = model.pages.find((one) => one.lang === 'en' && one.href === href);
    expect(page?.rel).toBe('en/terminal/index.md');
  });
});
