import type { Dictionary } from '../dictionary';
import type { ImpactCounts } from '../it/presentation';

/** Presentation mode: bar, panel, menu, and the sentences of an answer */

/** `A`, `A and B`, `A, B and C` */
const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const exchanges = (count: number) => (count === 1 ? '1 exchange' : `${count} exchanges`);

const takeAnotherWay = (count: number) => `${count} ${count === 1 ? 'takes' : 'take'} another path`;

const doNotChange = (count: number) => `${count} ${count === 1 ? 'does not change' : 'do not change'}`;

/** The answer in a word or two, by its colour: it arrives, it does not, it cannot be tried */
const headlines = {
  ok: 'Arrives',
  ko: 'Does not arrive',
  unknown: 'Cannot be tested',
};

const failuresNamed = (names: string[]) =>
  `${names.length === 1 ? 'Simulated failure' : 'Simulated failures'}: ${list(names)}`;

export const presentation: Dictionary['presentation'] = {
  list,
  exchanges,

  /** What each exchange is, under the pointer (their names are in `common.services`) */
  flowHints: {
    ping:
      'A question and its answer: the simplest way to find out whether two devices can reach ' +
      'each other',
    web: 'The request for a page and the page that comes back',
    email: 'An email: from the sender to the mail server, from the server to the recipient',
  },

  /** The legs of an exchange (the engine names them in English) */
  legs: {
    request: 'Request',
    reply: 'Reply',
    httpRequest: 'Page request',
    httpResponse: 'Server response',
    downloadRequest: 'File request',
    downloadData: 'File transfer',
    smtpSubmit: 'Sending to the mail server',
    delivery: 'Delivery to the recipient',
    smtpToCloud: 'Sending to the external mail service',
    cloudDelivery: 'Delivery from the external service',
  },

  /** The bar that takes the place of the menu bar */
  bar: {
    badge: 'Presentation',
    canvases: 'Project boards',
    packetSpeed: 'Packet speed',
    speeds: {
      slow: 'Slow',
      normal: 'Normal',
      fast: 'Fast',
    },
    terminal: 'Terminal',
    exportPicture: 'Export image',
    fullScreen: 'Full screen',
    exitFullScreen: 'Exit full screen',
    lightTheme: 'Switch to light theme',
    darkTheme: 'Switch to dark theme',
    exit: 'Exit',
  },

  /** The panel next to the board */
  panel: {
    label: 'Presentation panel',
    open: 'Open the panel',
    close: 'Close the panel',
  },

  question: {
    heading: 'Question',
    from: 'From',
    to: 'To',
    fromPlaceholder: 'Where it starts…',
    toPlaceholder: 'Where it arrives…',
    swapEnds: 'Swap source and destination',
    exchangeType: 'Traffic type',
    stop: 'Stop',
    showAgain: 'Show again',
  },

  answer: {
    heading: 'Answer',
    chooseTarget: 'Now choose where it arrives.',
    chooseSource: 'Now choose where it starts.',
    chooseBoth:
      'Choose where it starts and where it arrives: with the two menus above, or with a click on a device in the drawing.',
    reasonHint: 'The reason, as the engine gives it',

    headlines,
    /** It arrives: what happened, in the words of each exchange */
    arrives: {
      ping: (source: string, target: string) => `${target} replies to ${source}.`,
      web: (source: string, target: string) => `${source} opens the page on ${target}.`,
      email: (source: string, target: string) => `The email from ${source} reaches ${target}.`,
    },
    cannotTry: 'Something is missing to run the test.',
    noCable: 'No path of cables joins the two devices.',
    lost: 'The packet is lost on the way.',
    /** `leg` is the title of the leg it happens on */
    neverLeaves: (device: string, leg: string) => `It does not even leave ${device} (${leg.toLowerCase()}).`,
    stopsAt: (device: string, leg: string) => `It stops at ${device} (${leg.toLowerCase()}).`,
  },

  /** The answer next to the one the same question gets with nothing broken */
  comparison: {
    untouched: 'The failures do not affect this path: it works as before.',
    anotherWay: 'It still arrives, by another path.',
    anotherWayThrough: (devices: string[]) =>
      `It still arrives, by another path: it now goes through ${list(devices)}.`,
    arrivedBefore: 'Without the failures it would arrive.',
    didNotArriveBefore: 'Without the failures it would not arrive.',
    neverArrived: 'It would not arrive even without the failures.',
  },

  failures: {
    heading: 'Simulated failures',
    hint:
      'What happens if something breaks? Click a device or a cable in the drawing, then ' +
      '“Simulate a failure”. The drawing itself is not changed.',
    repair: 'Repair',
    repairDevice: (name: string) => `Repair ${name}`,
    repairCable: (name: string) => `Repair the cable ${name}`,
    /** How a cut cable is named in the list of the failures */
    cable: (name: string) => `cable ${name}`,
    repairAll: 'Repair all',
  },

  /** What the failures do to the exchanges between end devices */
  impact: {
    heading: 'On the rest of the network',
    tooFewEndDevices: 'Measuring the effect takes at least two end devices (PCs, servers…) with an address.',
    nothingWorked: (flowName: string) =>
      `With ${flowName}, no exchange between the end devices worked even before the failures.`,
    scope: (flowName: string, endpoints: number, working: number) =>
      `${flowName} between the ${endpoints} end devices: ${exchanges(working)} that ${working === 1 ? 'works' : 'work'} without the failures.`,
    stop: (count: number) =>
      count === 0 ? 'None of them stop' : `${count} ${count === 1 ? 'stops' : 'stop'}`,
    takeAnotherWay,
    doNotChange,
    shortestWay:
      'The engine takes the shortest path that works; protocols such as spanning tree are not ' +
      'simulated.',

    show: (source: string, target: string) => `Show from ${source} to ${target}`,
    andMore: (count: number) => `and ${count} more`,
    andMoreDevices: (count: number) => `and ${count} more ${count === 1 ? 'device' : 'devices'}`,
    showAll: 'Show all',
    showLess: 'Show less',

    /** The whole of it in one sentence, for the caption of a picture */
    sentence: ({ flowName, endpoints, working, broken, rerouted, unchanged }: ImpactCounts) => {
      const parts = [
        broken === 0
          ? working === 1
            ? 'the only exchange does not stop'
            : `none of the ${working} exchanges stop`
          : working === 1
            ? 'the only exchange stops'
            : `${broken} of ${working} exchanges ${broken === 1 ? 'stops' : 'stop'}`,
      ];
      if (rerouted > 0) parts.push(takeAnotherWay(rerouted));
      if (unchanged > 0 && working > 1) parts.push(doNotChange(unchanged));
      return `On the rest of the network (${flowName} between the ${endpoints} end devices): ${parts.join(', ')}.`;
    },
  },

  /** The way of the packet, hop by hop */
  path: {
    heading: 'Path',
    /** A reply that comes back the way the request went: `<leg/>` is the title of the leg */
    retraced: '<leg/> <same>along the same path</same>',
    engineNotes: 'Engine notes',
  },

  /** The small menu a click on a device or on a cable opens */
  menu: {
    startHere: 'Start here',
    arriveHere: 'Arrive here',
    simulateFailure: 'Simulate a failure',
    repair: 'Repair',
    cable: (name: string) => `Cable ${name}`,
    repairCable: 'Repair the cable',
  },

  /** What a picture of the presentation says under the drawing */
  caption: {
    heading: (flowName: string, source: string, target: string, tone: keyof typeof headlines) =>
      `${flowName} from ${source} to ${target}: ${headlines[tone].toLowerCase()}`,
    /** The reason is the engine's own */
    reason: (reason: string) => `Reason: ${reason}`,
    /** The simulated failures as a heading, and as a line */
    failures: failuresNamed,
    failuresLine: (names: string[]) => `${failuresNamed(names)}.`,
  },
};
