/** The simulation panel and what a simulation reports */

import type { FlowModelType } from '@/types/network';

/** How the notice of a failure names each kind of exchange */
const flowNames: Record<FlowModelType, string> = {
  ping: 'Ping',
  email: 'Email',
  web: 'Web',
  download: 'Download',
};

export const simulation = {
  source: 'Partenza',
  sourcePlaceholder: 'Cerca dispositivo di partenza...',
  destination: 'Destinazione',
  destinationPlaceholder: 'Cerca dispositivo di destinazione...',
  flowModel: 'Modello di Flusso',
  flowModels: {
    ping: 'Ping (ICMP)',
    email: 'Messaggio Email (SMTP)',
    web: 'Pagina Web (HTTP)',
    download: 'Download File (FTP)',
  },
  start: 'Avvia Simulazione',
  stop: 'Ferma Simulazione',
  needsTwoDevices: 'Servono almeno due dispositivi sul canvas.',

  /** What a simulation that is refused, or that fails, says in a notice */
  notices: {
    addTwoDevices: 'Aggiungi almeno due dispositivi per avviare una simulazione.',
    chooseBothEnds: 'Seleziona dispositivo di partenza e destinazione.',
    sameDevice: 'Il dispositivo di partenza e destinazione non possono coincidere.',
    failed: (flow: FlowModelType) => `Simulazione ${flowNames[flow]} fallita`,
    /** In place of the reason, when the engine gives none */
    unknownReason: 'motivo sconosciuto',
  },
};
