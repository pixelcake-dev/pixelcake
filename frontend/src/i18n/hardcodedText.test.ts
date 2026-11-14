/**
 * Every text of the interface lives in the dictionaries (src/i18n/it, src/i18n/en):
 * a text written straight into a component is shown in one language only,
 * whatever the user chose. This test reads the source and fails on Italian
 * found anywhere else: in a string, in a template, in the text of a JSX
 * element. Comments are not read.
 *
 * It recognises Italian by its words (test/italian.ts). A string that is
 * a name and not a sentence (`PC-Vendite`, a CSS class) is not looked at.
 */

import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { italianIn } from '@/test/italian';

const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Where Italian is at home, or where no text for the user is written */
const NOT_READ = [
  /\.test\.tsx?$/, // tests look for the Italian words of the interface
  /^\/src\/test\//,
  /^\/src\/i18n\/it\//, // the Italian dictionary
  /^\/src\/data\//, // generated: the shapes of the icons
];

/**
 * Words that are Italian and are not text to translate: the id of a device
 * of a sample network, which nobody is shown (ids with a dash in them are
 * not read in the first place), and the name of the Italian language, which
 * the switch writes in Italian whatever the language of the interface.
 */
const NOT_TEXT = new Set(['/src/utils/sampleCompany.ts|stampante', '/src/i18n/language.ts|Italiano']);

interface Finding {
  file: string;
  line: number;
  text: string;
  italian: string[];
}

/** The texts of a source file: strings, templates, JSX text. Not what is imported from where */
function textsOf(file: string, source: string): Array<{ line: number; text: string }> {
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const texts: Array<{ line: number; text: string }> = [];
  const add = (node: ts.Node, text: string) => {
    if (!text.trim()) return;
    const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    texts.push({ line: line + 1, text });
  };
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const isModuleName = ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent);
      // (a string in a type, `Dictionary['canvas']`, is a name of the code)
      const isTypeName = ts.isLiteralTypeNode(parent);
      if (!isModuleName && !isTypeName) add(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      add(node, [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' '));
    } else if (ts.isJsxText(node)) {
      add(node, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return texts;
}

function italianInSource(file: string, source: string): Finding[] {
  return textsOf(file, source)
    .map(({ line, text }) => ({ file, line, text: text.replace(/\s+/g, ' ').trim(), italian: italianIn(text) }))
    .filter((finding) => finding.italian.length > 0)
    .filter((finding) => !NOT_TEXT.has(`${file}|${finding.text}`));
}

describe('no Italian outside the dictionary', () => {
  it('recognises Italian written in a string, a template or a JSX element (the scan itself works)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);

    const component = [
      "const Example = ({ name }: { name: string }) => (",
      "  <div title=\"Chiudi la finestra\">",
      "    <p>Nessun dispositivo trovato</p>",
      "    <span>{`Eliminare ${name}?`}</span>",
      "    <span>{'Salva'}</span>",
      "  </div>",
      ");",
    ].join('\n');
    expect(italianInSource('/src/Example.tsx', component).map((finding) => finding.line)).toEqual([2, 3, 4, 5]);

    const clean = [
      "import { useT } from '@/i18n';",
      "// Chiudi la finestra: a comment is not text of the interface",
      "const Example = () => {",
      "  const t = useT();",
      "  return <div className=\"explorer-canvas-card active\" title={t.common.actions.close}>PC-Vendite</div>;",
      "};",
    ].join('\n');
    expect(italianInSource('/src/Example.tsx', clean)).toEqual([]);
  });

  it('no source file holds Italian text: it belongs in src/i18n/it', () => {
    const findings = Object.entries(sources)
      .filter(([file]) => !NOT_READ.some((pattern) => pattern.test(file)))
      .flatMap(([file, source]) => italianInSource(file, source));

    // One line per finding, so that a failure says where to look
    const report = findings.map(
      (finding) => `${finding.file}:${finding.line}  ${finding.text.slice(0, 90)}  [${finding.italian.join(', ')}]`
    );
    expect(report).toEqual([]);
  });
});
