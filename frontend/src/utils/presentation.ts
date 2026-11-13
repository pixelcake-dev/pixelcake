/**
 * Presentation mode — turning what the engine answers into what is shown.
 * Pure helpers: no React, no stores. The words for the audience are Italian;
 * the reasons and notes of the engine are shown as the engine wrote them.
 */

import { sameWay } from '@/engine';
import type { FlowResult, ImpactReport, ImpactedFlow } from '@/engine';
import type { PresentationFlow, PresentationRoute } from '@/store/presentationStore';

export const FLOW_NAMES: Record<PresentationFlow, string> = {
  ping: 'Ping',
  web: 'Web',
  email: 'Email',
};

export const FLOW_HINTS: Record<PresentationFlow, string> = {
  ping: 'Una domanda e la sua risposta: il modo più semplice per sapere se due dispositivi si vedono',
  web: 'La richiesta di una pagina e la pagina che torna indietro',
  email: 'Una mail: dal mittente al server di posta, dal server al destinatario',
};

/** `A`, `A e B`, `A, B e C` */
export function listInWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

const LEG_TITLES: Record<string, string> = {
  request: 'Andata',
  reply: 'Ritorno',
  'HTTP request': 'Richiesta della pagina',
  'HTTP response': 'Risposta del server',
  'download request': 'Richiesta del file',
  'download data': 'Arrivo del file',
  'SMTP submit': 'Invio al server di posta',
  delivery: 'Consegna al destinatario',
  'SMTP to cloud provider': 'Invio al servizio di posta esterno',
  'cloud delivery': 'Consegna dal servizio esterno',
};

/** The Italian title of one leg of an exchange (the engine names them in English) */
export function legTitle(purpose: string): string {
  return LEG_TITLES[purpose] ?? purpose;
}

/** One device the packet goes through, as a row of the answer */
export interface AnswerStep {
  /**
   * Position of the device in the animation of the whole exchange: the row
   * is reached when the animated packet gets to that position
   */
  animationIndex: number;
  deviceId: string;
  label: string;
  deviceType: string;
  status: 'forwarded' | 'delivered' | 'blocked';
  /** What the engine says about this hop (English) */
  note?: string;
}

export interface AnswerLeg {
  title: string;
  steps: AnswerStep[];
  /**
   * True when the leg goes back through the very devices of the leg before
   * it, in reverse: a reply that returns the way the request came
   */
  retracesPrevious: boolean;
}

/**
 * The legs of an answer, each row tied to its position in the animation.
 * A leg starts on the device the one before ended on: the two rows share a
 * position, exactly as the animation does not repeat that device.
 */
export function answerLegs(answer: FlowResult): AnswerLeg[] {
  let index = -1;
  let last: string | undefined;
  return answer.legs.map((leg, legIndex) => ({
    title: legTitle(leg.purpose),
    retracesPrevious: legIndex > 0 && retraces(leg, answer.legs[legIndex - 1]),
    steps: leg.trace.hops.map(hop => {
      if (hop.deviceId !== last) {
        index += 1;
        last = hop.deviceId;
      }
      const step: AnswerStep = {
        animationIndex: index,
        deviceId: hop.deviceId,
        label: hop.label,
        deviceType: hop.deviceType,
        status: hop.status,
      };
      // The reason of a drop is shown once, under the headline
      if (hop.note && hop.status !== 'blocked') step.note = hop.note;
      return step;
    }),
  }));
}

/** True when `leg` arrives, through the devices of `previous` in reverse order */
function retraces(leg: FlowResult['legs'][number], previous: FlowResult['legs'][number]): boolean {
  if (leg.trace.verdict !== 'success') return false;
  const back = leg.trace.hops.map(hop => hop.deviceId);
  const there = previous.trace.hops.map(hop => hop.deviceId).reverse();
  return back.length === there.length && back.every((id, index) => id === there[index]);
}

/** The hop an answer was dropped on, when it was */
function dropHop(answer: FlowResult) {
  const failing = answer.legs[answer.legs.length - 1];
  const last = failing?.trace.hops[failing.trace.hops.length - 1];
  return last?.status === 'blocked' ? { leg: failing, hop: last } : undefined;
}

/** What the canvas marks for an answer: its cables, and where it stops */
export function routeOf(answer: FlowResult | null): PresentationRoute | null {
  if (!answer || answer.animationPath.length === 0) return null;
  return {
    links: [...new Set(answer.animationLinks.filter(id => id !== ''))],
    arrives: answer.verdict === 'success',
    dropDeviceId: dropHop(answer)?.hop.deviceId ?? null,
  };
}

export type AnswerTone = 'ok' | 'ko' | 'unknown';

export interface AnswerSummary {
  tone: AnswerTone;
  /** "Arriva" / "Non arriva" / "Non si può provare" */
  headline: string;
  /** One plain sentence */
  detail: string;
  /** The reason as the engine gives it (English); absent when it arrives */
  reason?: string;
}

/** The answer in two lines for the audience */
export function summarizeAnswer(
  answer: FlowResult,
  flow: PresentationFlow,
  sourceLabel: string,
  targetLabel: string
): AnswerSummary {
  if (answer.verdict === 'success') {
    const detail: Record<PresentationFlow, string> = {
      ping: `${targetLabel} risponde a ${sourceLabel}.`,
      web: `${sourceLabel} apre la pagina di ${targetLabel}.`,
      email: `La mail di ${sourceLabel} arriva a ${targetLabel}.`,
    };
    return { tone: 'ok', headline: 'Arriva', detail: detail[flow] };
  }

  const failing = answer.legs[answer.legs.length - 1];
  // The reason of the leg itself: the flow repeats it with the leg name in front
  const reason = failing?.trace.failureReason ?? answer.failureReason ?? 'unknown reason';

  if (answer.verdict === 'error') {
    return {
      tone: 'unknown',
      headline: 'Non si può provare',
      detail: 'Manca qualcosa per fare la prova.',
      reason,
    };
  }
  if (answer.verdict === 'unreachable') {
    return {
      tone: 'ko',
      headline: 'Non arriva',
      detail: 'Nessun cavo collega i due dispositivi.',
      reason,
    };
  }

  const drop = dropHop(answer);
  if (!drop) return { tone: 'ko', headline: 'Non arriva', detail: 'Il pacchetto si perde per strada.', reason };

  const leg = legTitle(drop.leg.purpose).toLowerCase();
  const neverLeft = drop.leg.trace.hops.length === 1;
  return {
    tone: 'ko',
    headline: 'Non arriva',
    detail: neverLeft
      ? `Non esce nemmeno da ${drop.hop.label} (${leg}).`
      : `Si ferma su ${drop.hop.label} (${leg}).`,
    reason,
  };
}

/**
 * One sentence comparing an answer with the answer the same question gets
 * when nothing is broken: what the simulated failures did to it.
 */
export function compareWithIntact(
  now: FlowResult,
  intact: FlowResult,
  labelOf: (deviceId: string) => string
): string {
  const arrived = intact.verdict === 'success';
  const arrives = now.verdict === 'success';

  if (arrived && arrives) {
    if (sameWay(intact, now)) return 'I guasti non toccano questo percorso: va come prima.';
    const before = new Set(intact.animationPath);
    const added = [...new Set(now.animationPath)].filter(id => !before.has(id)).map(labelOf);
    return added.length > 0
      ? `Arriva lo stesso, per un'altra strada: ora passa da ${listInWords(added)}.`
      : "Arriva lo stesso, per un'altra strada.";
  }
  if (arrived) return 'Senza guasti arrivava.';
  if (arrives) return 'Senza guasti non arrivava.';
  return 'Non arrivava nemmeno senza guasti.';
}

/** The exchanges of one device that a failure touched */
export interface ImpactGroup {
  sourceId: string;
  label: string;
  targets: Array<{ id: string; label: string; reason?: string }>;
}

/**
 * Touched exchanges gathered by the device they start from, devices and
 * destinations in the order of `endpoints`.
 */
export function groupBySource(
  flows: ImpactedFlow[],
  endpoints: string[],
  labelOf: (deviceId: string) => string
): ImpactGroup[] {
  const order = (id: string) => {
    const index = endpoints.indexOf(id);
    return index === -1 ? endpoints.length : index;
  };
  const groups = new Map<string, ImpactGroup>();
  for (const flow of [...flows].sort(
    (a, b) => order(a.sourceId) - order(b.sourceId) || order(a.targetId) - order(b.targetId)
  )) {
    const group = groups.get(flow.sourceId) ?? {
      sourceId: flow.sourceId,
      label: labelOf(flow.sourceId),
      targets: [],
    };
    const failing = flow.after.legs[flow.after.legs.length - 1];
    group.targets.push({
      id: flow.targetId,
      label: labelOf(flow.targetId),
      reason:
        flow.after.verdict === 'success'
          ? undefined
          : (failing?.trace.failureReason ?? flow.after.failureReason),
    });
    groups.set(flow.sourceId, group);
  }
  return [...groups.values()];
}

/** `1 comunicazione` / `3 comunicazioni` */
export function exchanges(count: number): string {
  return count === 1 ? '1 comunicazione' : `${count} comunicazioni`;
}

/**
 * What the simulated failures do to the exchanges between end devices, in
 * one sentence. Undefined when there is nothing to measure it on.
 */
export function impactSentence(impact: ImpactReport, flow: PresentationFlow): string | undefined {
  if (impact.endpoints.length < 2 || impact.working === 0) return undefined;

  const broken = impact.broken.length;
  const rerouted = impact.rerouted.length;
  const parts = [
    broken === 0
      ? impact.working === 1
        ? "l'unica comunicazione non si interrompe"
        : `nessuna delle ${impact.working} comunicazioni si interrompe`
      : impact.working === 1
        ? "l'unica comunicazione si interrompe"
        : `${broken} ${broken === 1 ? 'comunicazione' : 'comunicazioni'} su ${impact.working} ${broken === 1 ? 'si interrompe' : 'si interrompono'}`,
  ];
  if (rerouted > 0) {
    parts.push(`${rerouted} ${rerouted === 1 ? 'passa' : 'passano'} da un'altra strada`);
  }
  if (impact.unchanged > 0 && impact.working > 1) {
    parts.push(`${impact.unchanged} ${impact.unchanged === 1 ? 'non cambia' : 'non cambiano'}`);
  }
  return `Sul resto della rete (${FLOW_NAMES[flow]} tra i ${impact.endpoints.length} dispositivi finali): ${parts.join(', ')}.`;
}

/** What a picture of the presentation says under the drawing */
export interface PresentationCaption {
  /** The colour of the answer; null when no question is asked */
  tone: AnswerTone | null;
  heading: string;
  lines: string[];
}

export interface CaptionInput {
  flow: PresentationFlow;
  /** The two ends of the question, when both are chosen */
  question: { sourceLabel: string; targetLabel: string } | null;
  answer: FlowResult | null;
  /** The answer with nothing broken; null with no failures */
  intactAnswer: FlowResult | null;
  /** The simulated failures, each as the panel names it ("R-Sede", "cavo A – B") */
  failures: string[];
  impact: ImpactReport | null;
  labelOf: (deviceId: string) => string;
}

/**
 * The question on screen, its answer and the simulated failures, in the
 * words of the panel. Null when the presentation shows neither a question
 * nor a failure: the drawing needs no caption then.
 */
export function captionOf(input: CaptionInput): PresentationCaption | null {
  const { flow, question, answer, intactAnswer, failures, impact, labelOf } = input;

  const failureLine =
    failures.length === 0
      ? undefined
      : `${failures.length === 1 ? 'Guasto simulato' : 'Guasti simulati'}: ${listInWords(failures)}.`;
  const impactLine = impact ? impactSentence(impact, flow) : undefined;

  if (!question || !answer) {
    if (!failureLine) return null;
    return {
      tone: null,
      heading: failureLine.slice(0, -1),
      lines: impactLine ? [impactLine] : [],
    };
  }

  const summary = summarizeAnswer(answer, flow, question.sourceLabel, question.targetLabel);
  const comparison = intactAnswer ? compareWithIntact(answer, intactAnswer, labelOf) : undefined;
  const lines = [comparison ? `${summary.detail} ${comparison}` : summary.detail];
  // The reason is the engine's own (English), as in the panel
  if (summary.reason) lines.push(`Motivo: ${summary.reason}`);
  if (failureLine) lines.push(failureLine);
  if (impactLine) lines.push(impactLine);

  return {
    tone: summary.tone,
    heading: `${FLOW_NAMES[flow]} da ${question.sourceLabel} a ${question.targetLabel}: ${summary.headline.toLowerCase()}`,
    lines,
  };
}
