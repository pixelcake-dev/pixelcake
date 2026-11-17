/**
 * Every terminal example of the documentation runs, and prints what the page
 * shows. An example is a fenced block opened with ```ncl and the network it
 * starts from:
 *
 *   ```ncl sample=office          a sample network of the app (company, office,
 *                                 site, two-sites, multinational, empty)
 *   ```ncl fixture=two-switches   documentation/fixtures/two-switches.pixelcake.json
 *   ```ncl continue               where the previous example of the page left off
 *
 * The sample is loaded in the language of the page (`lang=en` or `lang=it`
 * chooses another): its devices are named in that language, while the
 * terminal speaks English in both. Inside the block, a line that starts with
 * the prompt (`pixelcake> `, or `PC-1> ` inside `use PC-1`) is typed; the
 * lines under it are what the terminal prints, exactly, in the order it
 * prints them. Empty lines at the end of an answer are left out of the
 * comparison, so that a page may leave one between two commands.
 *
 * The sessions of docs/terminal-commands.md that open with ```ncl are run in
 * the same way: one mechanism for every example that shows real output.
 */

import { describe, it, expect, vi } from 'vitest';
import { executeCommand, type ExecutionResult, type TerminalContext } from '@/terminal/executor';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { setLanguage } from '@/i18n';
import { createCompanySample } from '@/utils/sampleCompany';
import { createSampleTopology } from '@/utils/sampleTopology';
import { createPerimeterSample } from '@/utils/samplePerimeter';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import { createMultinationalSample } from '@/utils/sampleMultinational';
import type { SampleNetwork } from '@/utils/sampleNetwork';
import { parseProjectFile } from '@/utils/projectFile';
import { loadDocs } from '../../scripts/docs/source.mjs';
import { fencesOf, parseSession, type FenceInfo } from '../../scripts/docs/markdown.mjs';
import { SAMPLE_NAMES } from '../../scripts/docs/config.mjs';
import languageSpec from '../../../docs/terminal-commands.md?raw';

/** The short projects an example can start from, by name: documentation/fixtures/<name>.pixelcake.json */
const FIXTURES = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../documentation/fixtures/*.pixelcake.json', { query: '?raw', import: 'default', eager: true })
  ).map(([file, text]) => [file.split('/').pop()!.replace('.pixelcake.json', ''), text])
);

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** The samples an example can name, as the panel «Esempi» / “Samples” loads them */
const SAMPLES: Record<string, () => SampleNetwork> = {
  company: createCompanySample,
  office: createSampleTopology,
  site: createPerimeterSample,
  'two-sites': createRedundancySample,
  multinational: createMultinationalSample,
};

interface Example extends FenceInfo {
  /** Where it is, for the messages: `en/building/vlans.md` */
  file: string;
  /** The line its fence opens on */
  line: number;
  content: string;
  lang: 'en' | 'it';
}

/** The examples, grouped by the file they are in, in the order of the file */
function examplesByFile(): Map<string, Example[]> {
  const byFile = new Map<string, Example[]>();
  const add = (example: Example) => byFile.set(example.file, [...(byFile.get(example.file) ?? []), example]);
  for (const page of loadDocs().pages) {
    for (const block of page.code.filter((code) => code.lang === 'ncl')) {
      const lang = (block.attrs.lang ?? page.lang) as 'en' | 'it';
      add({ ...block, lang, file: page.rel });
    }
  }
  for (const fence of fencesOf(languageSpec).filter((block) => block.lang === 'ncl')) {
    add({ ...fence, lang: (fence.attrs.lang ?? 'en') as 'en' | 'it', file: 'docs/terminal-commands.md' });
  }
  return byFile;
}

const byFile = examplesByFile();

/** Everything a command makes the terminal print, in the order TerminalModal prints it */
function transcript(result: ExecutionResult): string[] {
  const live = result.liveTrace;
  return [
    ...result.lines.map((line) => line.text),
    ...(live ? [...(live.lookup?.lines ?? []), ...live.hopLines, ...live.finalLines].map((line) => line.text) : []),
  ];
}

const withoutTrailingBlanks = (lines: string[]) => {
  const copy = [...lines];
  while (copy.length > 0 && copy[copy.length - 1].trim() === '') copy.pop();
  return copy;
};

/** The network an example starts from, on a board emptied first */
function load(example: Example) {
  setLanguage(example.lang);
  usePresentationStore.getState().exit();
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  const { sample, fixture } = example.attrs;
  if (fixture) {
    const text = FIXTURES[fixture];
    if (text === undefined) throw new Error(`${example.file}:${example.line}: there is no documentation/fixtures/${fixture}.pixelcake.json`);
    const parsed = parseProjectFile(text);
    if (!parsed.ok) throw new Error(`${example.file}:${example.line}: fixture ${fixture}: ${parsed.error}`);
    const { project } = parsed;
    const canvas = project.canvases.find((one) => one.id === project.activeCanvasId) ?? project.canvases[0];
    store.loadSample({ devices: canvas.devices, connections: canvas.connections, settings: project.settings, areas: canvas.areas ?? [] });
  } else if (sample && sample !== 'empty') {
    store.loadSample(SAMPLES[sample]());
  }
}

describe('the terminal examples of the documentation', () => {
  it('know every sample the documentation can name, and no other', () => {
    expect([...Object.keys(SAMPLES), 'empty'].sort()).toEqual([...SAMPLE_NAMES].sort());
  });

  it('are there: in the pages, and the sessions of docs/terminal-commands.md', () => {
    const count = [...byFile.values()].flat().length;
    expect(count).toBeGreaterThan(5);
    expect(byFile.get('docs/terminal-commands.md')?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it.each([...byFile.keys()])('%s: every example prints what the page shows', (file) => {
    let context: TerminalContext = { deviceLabel: null };
    for (const example of byFile.get(file)!) {
      if (!example.flags.includes('continue')) {
        load(example);
        context = { deviceLabel: null };
      } else {
        setLanguage(example.lang);
      }
      const { steps, before } = parseSession(example.content);
      const opening = example.line + 1;
      expect(before.filter((text) => text.trim() !== ''), `${file}:${opening}: an example starts with a command`).toEqual([]);
      expect(steps.length, `${file}:${example.line}: an example types at least one command`).toBeGreaterThan(0);

      for (const step of steps) {
        const where = `${file}:${opening + step.line}  ${step.prompt}> ${step.command}`;
        expect(step.prompt, `${where}\n  the prompt here is "${context.deviceLabel ?? 'pixelcake'}> "`).toBe(context.deviceLabel ?? 'pixelcake');
        const result = executeCommand(step.command, context);
        expect(withoutTrailingBlanks(transcript(result)), where).toEqual(withoutTrailingBlanks(step.output));
        context = result.context;
      }
    }
  });
});
