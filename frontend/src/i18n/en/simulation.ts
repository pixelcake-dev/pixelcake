import type { Dictionary } from '../dictionary';
import type { FlowModelType } from '@/types/network';

/** The simulation panel and what a simulation reports */

/** How the notice of a failure names each kind of exchange */
const flowNames: Record<FlowModelType, string> = {
  ping: 'Ping',
  email: 'Email',
  web: 'Web',
  download: 'Download',
};

export const simulation: Dictionary['simulation'] = {
  source: 'Source',
  sourcePlaceholder: 'Search for a source device…',
  destination: 'Destination',
  destinationPlaceholder: 'Search for a destination device…',
  flowModel: 'Traffic type',
  flowModels: {
    ping: 'Ping (ICMP)',
    email: 'Email message (SMTP)',
    web: 'Web page (HTTP)',
    download: 'File download (FTP)',
  },
  start: 'Start simulation',
  stop: 'Stop simulation',
  needsTwoDevices: 'The board needs at least two devices.',

  /** What a simulation that is refused, or that fails, says in a notice */
  notices: {
    addTwoDevices: 'Add at least two devices to start a simulation',
    chooseBothEnds: 'Select a source and a destination device',
    sameDevice: 'The source and the destination cannot be the same device',
    failed: (flow: FlowModelType) => `${flowNames[flow]} simulation failed`,
    /** In place of the reason, when the engine gives none */
    unknownReason: 'unknown reason',
  },
};
