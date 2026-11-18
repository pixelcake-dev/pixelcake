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
  sourcePlaceholder: 'Cerca dispositivo di partenza…',
  destination: 'Destinazione',
  destinationPlaceholder: 'Cerca dispositivo di destinazione…',
  flowModel: 'Tipo di traffico',
  flowModels: {
    ping: 'Ping (ICMP)',
    email: 'Messaggio email (SMTP)',
    web: 'Pagina web (HTTP)',
    download: 'Download di un file (FTP)',
  },
  start: 'Avvia simulazione',
  stop: 'Ferma simulazione',
  needsTwoDevices: 'Servono almeno due dispositivi sul canvas.',

  /** What a simulation that is refused, or that fails, says in a notice */
  notices: {
    addTwoDevices: 'Aggiungi almeno due dispositivi per avviare una simulazione',
    chooseBothEnds: 'Seleziona il dispositivo di partenza e quello di destinazione',
    sameDevice: 'Il dispositivo di partenza e quello di destinazione non possono coincidere',
    /** A device that pings itself: the packet never leaves it */
    loopback: (name: string) => `${name} risponde a se stesso: il pacchetto non esce dal dispositivo`,
    failed: (flow: FlowModelType) => `Simulazione ${flowNames[flow]} fallita`,
    /** In place of the reason, when the engine gives none */
    unknownReason: 'motivo sconosciuto',
  },
};
