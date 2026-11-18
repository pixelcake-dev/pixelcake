/**
 * Presentation mode — what the engine answers, turned into what is shown.
 * The answers are real ones, from the third sample network.
 */

import { describe, it, expect } from 'vitest';
import { assessImpact, planAndEvaluateFlow, withFailures } from '@/engine';
import type { Failures, FlowResult } from '@/engine';
import type { FlowModelType } from '@/types';
import { createRedundancySample } from './sampleRedundancy';
import {
  answerLegs,
  captionOf,
  compareWithIntact,
  exchanges,
  groupBySource,
  impactSentence,
  legTitle,
  listInWords,
  routeOf,
  summarizeAnswer,
} from './presentation';

const sample = createRedundancySample();
const id = (label: string) => {
  const found = sample.devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found.id;
};
const labelOf = (deviceId: string) => sample.devices.find(d => d.id === deviceId)?.label ?? deviceId;

const broken = (devices: string[] = [], connections: string[] = []): Failures => ({
  devices: devices.map(id),
  connections,
});

function ask(from: string, to: string, failures?: Failures, flow: FlowModelType = 'ping'): FlowResult {
  return planAndEvaluateFlow(flow, id(from), id(to), withFailures(sample, failures));
}

describe('listInWords', () => {
  it('joins the way Italian does', () => {
    expect(listInWords([])).toBe('');
    expect(listInWords(['A'])).toBe('A');
    expect(listInWords(['A', 'B'])).toBe('A e B');
    expect(listInWords(['A', 'B', 'C'])).toBe('A, B e C');
  });
});

describe('legTitle', () => {
  it('names the legs the engine produces, and leaves an unknown one as it is', () => {
    expect(legTitle('request')).toBe('Andata');
    expect(legTitle('reply')).toBe('Ritorno');
    expect(legTitle('HTTP request')).toBe('Richiesta della pagina');
    expect(legTitle('SMTP submit')).toBe('Invio al server di posta');
    expect(legTitle('something new')).toBe('something new');
  });

  it('has a title for every leg of every exchange that can be presented', () => {
    for (const flow of ['ping', 'web'] as const) {
      for (const leg of ask('PC-Sede-1', 'Srv-File', undefined, flow).legs) {
        expect(legTitle(leg.purpose), leg.purpose).not.toBe(leg.purpose);
      }
    }
  });
});

describe('answerLegs', () => {
  it('ties every row to its position in the animation, sharing the turning point', () => {
    const answer = ask('PC-Sede-1', 'Srv-File');
    const legs = answerLegs(answer);
    expect(legs.map(leg => leg.title)).toEqual(['Andata', 'Ritorno']);
    expect(legs[0].steps.map(step => [step.label, step.animationIndex])).toEqual([
      ['PC-Sede-1', 0],
      ['SW-Piano-1', 1],
      ['SW-Core', 2],
      ['Srv-File', 3],
    ]);
    expect(legs[1].steps.map(step => [step.label, step.animationIndex])).toEqual([
      ['Srv-File', 3],
      ['SW-Core', 4],
      ['SW-Piano-1', 5],
      ['PC-Sede-1', 6],
    ]);
    // every position of the animation has its row, and no row points outside it
    const positions = legs.flatMap(leg => leg.steps.map(step => step.animationIndex));
    expect(Math.max(...positions)).toBe(answer.animationPath.length - 1);
    for (const leg of legs) {
      for (const step of leg.steps) {
        expect(answer.animationPath[step.animationIndex]).toBe(step.deviceId);
      }
    }
  });

  it('keeps the notes of the engine on the hops, but not the reason of a drop', () => {
    const routed = answerLegs(ask('PC-Filiale-1', 'Srv-File'))[0].steps;
    expect(routed.find(step => step.label === 'R-Filiale')?.note).toBe(
      'routed: 192.168.1.0/24 via 10.0.0.1 (port 2)'
    );

    const dropped = answerLegs(ask('PC-Sede-1', 'Srv-File', broken(['SW-Core'])))[0].steps;
    expect(dropped[dropped.length - 1]).toMatchObject({ label: 'SW-Piano-1', status: 'blocked' });
    expect(dropped[dropped.length - 1].note).toBeUndefined();
  });

  it('marks a reply that comes back the way the request went', () => {
    const legs = answerLegs(ask('PC-Sede-1', 'Srv-File'));
    expect(legs.map(leg => leg.retracesPrevious)).toEqual([false, true]);
  });

  it('does not mark a reply that takes another way, nor one that is dropped', () => {
    // a firewall-free asymmetry is hard to draw: build one by hand
    const there = ask('PC-Sede-1', 'Srv-File');
    const other = ask('PC-Sede-2', 'Srv-File');
    const asymmetric: FlowResult = { ...there, legs: [there.legs[0], other.legs[1]] };
    expect(answerLegs(asymmetric).map(leg => leg.retracesPrevious)).toEqual([false, false]);

    const dropped: FlowResult = {
      ...there,
      legs: [there.legs[0], { ...there.legs[1], trace: { ...there.legs[1].trace, verdict: 'blocked' } }],
    };
    expect(answerLegs(dropped)[1].retracesPrevious).toBe(false);
  });

  it('is empty for an exchange that could not even be planned', () => {
    // (a page from a device to itself: a ping to itself is answered by the device)
    expect(answerLegs(ask('PC-Sede-1', 'PC-Sede-1', undefined, 'web'))).toEqual([]);
  });
});

describe('routeOf', () => {
  it('is nothing without an answer, or for one with nowhere to draw', () => {
    expect(routeOf(null)).toBeNull();
    expect(routeOf(ask('PC-Sede-1', 'PC-Sede-1', undefined, 'web'))).toBeNull();
  });

  it('lists the cables of an answer that arrives, each once', () => {
    const route = routeOf(ask('PC-Sede-1', 'Srv-File'));
    expect(route).toEqual({
      links: ['link-pc-sede-1', 'link-core-piano-1', 'link-srv-file'],
      arrives: true,
      dropDeviceId: null,
    });
  });

  it('stops where the packet is dropped', () => {
    const route = routeOf(ask('PC-Sede-1', 'Srv-File', broken(['SW-Core'])));
    expect(route).toEqual({
      links: ['link-pc-sede-1'],
      arrives: false,
      dropDeviceId: id('SW-Piano-1'),
    });
  });

  it('has no cables when the packet never leaves, and still says where it stops', () => {
    const route = routeOf(ask('PC-Sede-1', 'Srv-File', broken(['PC-Sede-1'])));
    expect(route).toEqual({ links: [], arrives: false, dropDeviceId: id('PC-Sede-1') });
  });
});

describe('summarizeAnswer', () => {
  it('says it arrives, in the words of the exchange', () => {
    expect(summarizeAnswer(ask('PC-Sede-1', 'Srv-File'), 'ping', 'PC-Sede-1', 'Srv-File')).toEqual({
      tone: 'ok',
      headline: 'Arriva',
      detail: 'Srv-File risponde a PC-Sede-1.',
    });
    const web = ask('PC-Sede-1', 'Srv-File', undefined, 'web');
    expect(summarizeAnswer(web, 'web', 'PC-Sede-1', 'Srv-File').detail).toBe(
      'PC-Sede-1 apre la pagina di Srv-File.'
    );
  });

  it('says where it stops, on which leg, with the reason as the engine gives it', () => {
    const answer = ask('PC-Sede-1', 'Srv-File', broken(['SW-Core']));
    expect(summarizeAnswer(answer, 'ping', 'PC-Sede-1', 'Srv-File')).toEqual({
      tone: 'ko',
      headline: 'Non arriva',
      detail: 'Si ferma su SW-Piano-1 (andata).',
      reason: 'SW-Core is down',
    });
  });

  it('says so when the packet does not even leave its device', () => {
    const answer = ask('PC-Sede-1', 'Srv-File', broken([], ['link-pc-sede-1']));
    const summary = summarizeAnswer(answer, 'ping', 'PC-Sede-1', 'Srv-File');
    expect(summary.detail).toBe('Non esce nemmeno da PC-Sede-1 (andata).');
    expect(summary.reason).toBe('link PC-Sede-1–SW-Piano-1 is down');
  });

  it('tells "cannot be tried" from "does not arrive"', () => {
    const noAddress = {
      devices: sample.devices.map(d =>
        d.label === 'Srv-File' ? { ...d, ip: '', nics: d.nics?.map(n => ({ ...n, ip: '' })) } : d
      ),
      connections: sample.connections,
    };
    const answer = planAndEvaluateFlow('ping', id('PC-Sede-1'), id('Srv-File'), noAddress);
    expect(summarizeAnswer(answer, 'ping', 'PC-Sede-1', 'Srv-File')).toEqual({
      tone: 'unknown',
      headline: 'Non si può provare',
      detail: 'Manca qualcosa per fare la prova.',
      reason: 'Srv-File has no IP address configured',
    });
  });

  it('says there is no cable at all between two devices that are not joined', () => {
    const island = {
      devices: sample.devices,
      connections: sample.connections.filter(c => c.id !== 'link-pc-sede-1'),
    };
    const answer = planAndEvaluateFlow('ping', id('PC-Sede-1'), id('Srv-File'), island);
    const summary = summarizeAnswer(answer, 'ping', 'PC-Sede-1', 'Srv-File');
    expect(summary.tone).toBe('ko');
    expect(summary.detail).toBe('Nessun percorso di cavi collega i due dispositivi.');
    expect(summary.reason).toBe('no physical path between PC-Sede-1 and Srv-File');
  });
});

describe('compareWithIntact', () => {
  const compare = (from: string, to: string, failures: Failures) =>
    compareWithIntact(ask(from, to, failures), ask(from, to), labelOf);

  it('a failure elsewhere', () => {
    expect(compare('PC-Sede-1', 'Srv-File', broken(['R-Riserva']))).toBe(
      'I guasti non toccano questo percorso: va come prima.'
    );
  });

  it('another way, naming what it now goes through', () => {
    expect(compare('PC-Filiale-1', 'Srv-File', broken([], ['link-principale']))).toBe(
      "Arriva lo stesso, per un'altra strada: ora passa da R-Riserva."
    );
    expect(compare('PC-Sede-1', 'Srv-File', broken([], ['link-core-piano-1']))).toBe(
      "Arriva lo stesso, per un'altra strada: ora passa da SW-Piano-2."
    );
  });

  it('another way through the same devices (a second cable)', () => {
    const there = ask('PC-Sede-1', 'Srv-File');
    const otherCable: FlowResult = {
      ...there,
      animationLinks: there.animationLinks.map(link => (link === 'link-core-piano-1' ? 'twin' : link)),
    };
    expect(compareWithIntact(otherCable, there, labelOf)).toBe("Arriva lo stesso, per un'altra strada.");
  });

  it('it arrived, it no longer does', () => {
    expect(compare('PC-Sede-1', 'Srv-File', broken(['SW-Core']))).toBe('Senza guasti arrivava.');
  });

  it('it did not arrive before either', () => {
    const noGateway = ask('PC-Sede-1', 'Srv-File', broken(['SW-Core']));
    expect(compareWithIntact(noGateway, noGateway, labelOf)).toBe('Non arrivava nemmeno senza guasti.');
  });
});

describe('groupBySource', () => {
  it('gathers the touched exchanges by device, in the order of the drawing, with the reason', () => {
    const report = assessImpact(sample, broken(['Srv-File']), { flow: 'ping' });
    const groups = groupBySource(report.broken, report.endpoints, labelOf);
    expect(groups.map(group => [group.label, group.targets.map(target => target.label)])).toEqual([
      ['Srv-File', ['PC-Sede-1', 'PC-Sede-2', 'PC-Filiale-1', 'PC-Filiale-2']],
      ['PC-Sede-1', ['Srv-File']],
      ['PC-Sede-2', ['Srv-File']],
      ['PC-Filiale-1', ['Srv-File']],
      ['PC-Filiale-2', ['Srv-File']],
    ]);
    expect(groups[0].targets[0].reason).toBe('Srv-File is down');
    expect(groups[1].targets[0].reason).toBe('Srv-File is down');
  });

  it('has no reason for an exchange that still works', () => {
    const report = assessImpact(sample, broken([], ['link-principale']), { flow: 'ping' });
    const groups = groupBySource(report.rerouted, report.endpoints, labelOf);
    expect(groups).toHaveLength(5);
    expect(groups.every(group => group.targets.every(target => target.reason === undefined))).toBe(true);
  });

  it('is empty when nothing was touched', () => {
    expect(groupBySource([], ['a', 'b'], labelOf)).toEqual([]);
  });
});

describe('exchanges', () => {
  it('counts in Italian', () => {
    expect(exchanges(1)).toBe('1 comunicazione');
    expect(exchanges(0)).toBe('0 comunicazioni');
    expect(exchanges(20)).toBe('20 comunicazioni');
  });
});

describe('impactSentence', () => {
  const impact = (failures: Failures, flow: FlowModelType = 'ping') =>
    assessImpact(sample, failures, { flow });

  it('counts what stops, what goes another way and what stays as it was', () => {
    expect(impactSentence(impact(broken(['SW-Core'])), 'ping')).toBe(
      'Sul resto della rete (Ping tra i 5 dispositivi finali): 16 comunicazioni su 20 si interrompono, 4 non cambiano.'
    );
    expect(impactSentence(impact(broken([], ['link-principale'])), 'ping')).toBe(
      "Sul resto della rete (Ping tra i 5 dispositivi finali): nessuna delle 20 comunicazioni si interrompe, 12 passano da un'altra strada, 8 non cambiano."
    );
  });

  it('names the exchange it measured', () => {
    expect(impactSentence(impact(broken(['SW-Core']), 'web'), 'web')).toMatch(
      /^Sul resto della rete \(Web tra i 5 dispositivi finali\): /
    );
  });

  it('agrees in number', () => {
    const report = impact(broken(['SW-Core']));
    const one = (overrides: Partial<typeof report>) => impactSentence({ ...report, ...overrides }, 'ping');
    const [first, second] = report.broken;

    expect(one({ broken: [first], rerouted: [second], unchanged: 1, working: 3 })).toBe(
      "Sul resto della rete (Ping tra i 5 dispositivi finali): 1 comunicazione su 3 si interrompe, 1 passa da un'altra strada, 1 non cambia."
    );
    // one exchange in all: no "1 su 1"
    expect(one({ broken: [first], rerouted: [], unchanged: 0, working: 1 })).toBe(
      "Sul resto della rete (Ping tra i 5 dispositivi finali): l'unica comunicazione si interrompe."
    );
    expect(one({ broken: [], rerouted: [], unchanged: 1, working: 1 })).toBe(
      "Sul resto della rete (Ping tra i 5 dispositivi finali): l'unica comunicazione non si interrompe."
    );
  });

  it('says nothing where there is nothing to measure it on', () => {
    const report = impact(broken(['SW-Core']));
    // one end device, or none
    expect(impactSentence({ ...report, endpoints: report.endpoints.slice(0, 1) }, 'ping')).toBeUndefined();
    // nothing worked before the failures either
    expect(impactSentence({ ...report, working: 0 }, 'ping')).toBeUndefined();
  });
});

describe('captionOf', () => {
  const caption = (
    question: [string, string] | null,
    failures: Failures = broken(),
    flow: 'ping' | 'web' | 'email' = 'ping'
  ) => {
    const isBroken = failures.devices.length + failures.connections.length > 0;
    return captionOf({
      flow,
      question: question ? { sourceLabel: question[0], targetLabel: question[1] } : null,
      answer: question ? ask(question[0], question[1], failures, flow) : null,
      intactAnswer: question && isBroken ? ask(question[0], question[1], undefined, flow) : null,
      failures: [
        ...failures.devices.map(labelOf),
        ...failures.connections.map(connection => `cavo ${connection}`),
      ],
      impact: isBroken ? assessImpact(sample, failures, { flow }) : null,
      labelOf,
    });
  };

  it('is nothing when the presentation shows neither a question nor a failure', () => {
    expect(caption(null)).toBeNull();
  });

  it('a question that arrives: what was asked, and the answer in the words of the panel', () => {
    expect(caption(['PC-Sede-1', 'Srv-File'])).toEqual({
      tone: 'ok',
      heading: 'Ping da PC-Sede-1 a Srv-File: arriva',
      lines: ['Srv-File risponde a PC-Sede-1.'],
    });
    expect(caption(['PC-Sede-1', 'Srv-File'], broken(), 'web')).toMatchObject({
      heading: 'Web da PC-Sede-1 a Srv-File: arriva',
      lines: ['PC-Sede-1 apre la pagina di Srv-File.'],
    });
  });

  it('a question and a failure it survives: the other way, the failure, the rest of the network', () => {
    expect(caption(['PC-Filiale-1', 'Srv-File'], broken([], ['link-principale']))).toEqual({
      tone: 'ok',
      heading: 'Ping da PC-Filiale-1 a Srv-File: arriva',
      lines: [
        "Srv-File risponde a PC-Filiale-1. Arriva lo stesso, per un'altra strada: ora passa da R-Riserva.",
        'Guasto simulato: cavo link-principale.',
        "Sul resto della rete (Ping tra i 5 dispositivi finali): nessuna delle 20 comunicazioni si interrompe, 12 passano da un'altra strada, 8 non cambiano.",
      ],
    });
  });

  it('a question that a failure stops: where, why (as the engine says it), and what broke', () => {
    const stopped = caption(['PC-Sede-1', 'Srv-File'], broken(['SW-Core', 'R-Riserva']));
    expect(stopped?.tone).toBe('ko');
    expect(stopped?.heading).toBe('Ping da PC-Sede-1 a Srv-File: non arriva');
    expect(stopped?.lines).toEqual([
      'Si ferma su SW-Piano-1 (andata). Senza guasti arrivava.',
      'Motivo: SW-Core is down',
      'Guasti simulati: SW-Core e R-Riserva.',
      'Sul resto della rete (Ping tra i 5 dispositivi finali): 16 comunicazioni su 20 si interrompono, 4 non cambiano.',
    ]);
  });

  it('a question that cannot be tried says so, in its own colour', () => {
    // (a page from a device to itself: a ping to itself is answered by the device)
    const toItself = planAndEvaluateFlow('web', id('PC-Sede-1'), id('PC-Sede-1'), sample);
    expect(toItself.verdict).toBe('error');
    const result = captionOf({
      flow: 'web',
      question: { sourceLabel: 'PC-Sede-1', targetLabel: 'PC-Sede-1' },
      answer: toItself,
      intactAnswer: null,
      failures: [],
      impact: null,
      labelOf,
    });
    expect(result?.tone).toBe('unknown');
    expect(result?.heading).toMatch(/ da PC-Sede-1 a PC-Sede-1: non si può provare$/);
    expect(result?.lines[0]).toBe('Manca qualcosa per fare la prova.');
    expect(result?.lines[1]).toMatch(/^Motivo: /);
  });

  it('failures without a question: the failures are the heading', () => {
    expect(caption(null, broken(['SW-Core']))).toEqual({
      tone: null,
      heading: 'Guasto simulato: SW-Core',
      lines: [
        'Sul resto della rete (Ping tra i 5 dispositivi finali): 16 comunicazioni su 20 si interrompono, 4 non cambiano.',
      ],
    });
    expect(caption(null, broken(['SW-Core', 'R-Riserva'], ['link-principale']))?.heading).toBe(
      'Guasti simulati: SW-Core, R-Riserva e cavo link-principale'
    );
  });
});
