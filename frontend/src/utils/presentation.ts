/**
 * Presentation mode — turning what the engine answers into what is shown.
 * Pure helpers: no React. The words for the audience come from the
 * dictionary, in the language the interface has at the moment of the call:
 * a component that shows them must be drawn again when the language changes
 * (`useT`). The reasons and notes of the engine are shown as the engine
 * wrote them.
 */

import { sameWay } from '@/engine';
import type { FlowResult, ImpactReport, ImpactedFlow } from '@/engine';
import type { PresentationFlow, PresentationRoute } from '@/store/presentationStore';
import { getT, type Dictionary } from '@/i18n';

/** The name of an exchange: Ping, Web, Email */
export function flowName(flow: PresentationFlow): string {
  return getT().common.services[flow];
}

/** What an exchange is, in one line */
export function flowHint(flow: PresentationFlow): string {
  return getT().presentation.flowHints[flow];
}

/** A list the way a sentence says it: `A`, `A and B`, `A, B and C` */
export function listInWords(items: string[]): string {
  return getT().presentation.list(items);
}

/** The legs the engine names, and the entry of the dictionary that titles each */
const LEG_KEYS = new Map<string, keyof Dictionary['presentation']['legs']>([
  ['request', 'request'],
  ['reply', 'reply'],
  ['HTTP request', 'httpRequest'],
  ['HTTP response', 'httpResponse'],
  ['download request', 'downloadRequest'],
  ['download data', 'downloadData'],
  ['SMTP submit', 'smtpSubmit'],
  ['delivery', 'delivery'],
  ['SMTP to cloud provider', 'smtpToCloud'],
  ['cloud delivery', 'cloudDelivery'],
]);

/**
 * The title of one leg of an exchange, in the language of the interface.
 * The engine names the legs in English: a leg it names in a way not known
 * here keeps the name the engine gave it.
 */
export function legTitle(purpose: string): string {
  const key = LEG_KEYS.get(purpose);
  return key ? getT().presentation.legs[key] : purpose;
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
  /** It arrives, it does not arrive, it cannot be tried: a word or two */
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
  const words = getT().presentation.answer;

  if (answer.verdict === 'success') {
    return {
      tone: 'ok',
      headline: words.headlines.ok,
      detail: words.arrives[flow](sourceLabel, targetLabel),
    };
  }

  const failing = answer.legs[answer.legs.length - 1];
  // The reason of the leg itself: the flow repeats it with the leg name in front
  const reason = failing?.trace.failureReason ?? answer.failureReason ?? 'unknown reason';

  if (answer.verdict === 'error') {
    return { tone: 'unknown', headline: words.headlines.unknown, detail: words.cannotTry, reason };
  }
  if (answer.verdict === 'unreachable') {
    return { tone: 'ko', headline: words.headlines.ko, detail: words.noCable, reason };
  }

  const drop = dropHop(answer);
  if (!drop) return { tone: 'ko', headline: words.headlines.ko, detail: words.lost, reason };

  const leg = legTitle(drop.leg.purpose);
  const neverLeft = drop.leg.trace.hops.length === 1;
  return {
    tone: 'ko',
    headline: words.headlines.ko,
    detail: neverLeft ? words.neverLeaves(drop.hop.label, leg) : words.stopsAt(drop.hop.label, leg),
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
  const words = getT().presentation.comparison;
  const arrived = intact.verdict === 'success';
  const arrives = now.verdict === 'success';

  if (arrived && arrives) {
    if (sameWay(intact, now)) return words.untouched;
    const before = new Set(intact.animationPath);
    const added = [...new Set(now.animationPath)].filter(id => !before.has(id)).map(labelOf);
    return added.length > 0 ? words.anotherWayThrough(added) : words.anotherWay;
  }
  if (arrived) return words.arrivedBefore;
  if (arrives) return words.didNotArriveBefore;
  return words.neverArrived;
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

/** So many exchanges, counted in words: one, or several */
export function exchanges(count: number): string {
  return getT().presentation.exchanges(count);
}

/**
 * What the simulated failures do to the exchanges between end devices, in
 * one sentence. Undefined when there is nothing to measure it on.
 */
export function impactSentence(impact: ImpactReport, flow: PresentationFlow): string | undefined {
  if (impact.endpoints.length < 2 || impact.working === 0) return undefined;

  return getT().presentation.impact.sentence({
    flowName: flowName(flow),
    endpoints: impact.endpoints.length,
    working: impact.working,
    broken: impact.broken.length,
    rerouted: impact.rerouted.length,
    unchanged: impact.unchanged,
  });
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
  const words = getT().presentation.caption;

  const impactLine = impact ? impactSentence(impact, flow) : undefined;

  if (!question || !answer) {
    if (failures.length === 0) return null;
    return {
      tone: null,
      heading: words.failures(failures),
      lines: impactLine ? [impactLine] : [],
    };
  }

  const summary = summarizeAnswer(answer, flow, question.sourceLabel, question.targetLabel);
  const comparison = intactAnswer ? compareWithIntact(answer, intactAnswer, labelOf) : undefined;
  // (two whole sentences, one after the other)
  const lines = [comparison ? `${summary.detail} ${comparison}` : summary.detail];
  // The reason is the engine's own (English), as in the panel
  if (summary.reason) lines.push(words.reason(summary.reason));
  if (failures.length > 0) lines.push(words.failuresLine(failures));
  if (impactLine) lines.push(impactLine);

  return {
    tone: summary.tone,
    heading: words.heading(flowName(flow), question.sourceLabel, question.targetLabel, summary.tone),
    lines,
  };
}
