/** Settings, network tab: what a new device starts from */

const example = (value: string) => `es. ${value}`;

/** `PC-1, PC-2 e Srv-1`; after the first four, how many more */
const listOf = (names: string[]) => {
  const shown = names.slice(0, 4);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(', ')} e ${more === 1 ? 'un altro' : `altri ${more}`}`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}`;
};

export const networkSettings = {
  title: 'Impostazioni Rete Globale',
  intro: 'Valgono per tutto il progetto. Cambiarle non tocca i dispositivi che ci sono già.',

  newDevices: {
    legend: 'Nuovi dispositivi',
    network: 'Classe IP di Partenza',
    networkPlaceholder: example('192.168.1.0'),
    mask: 'Subnet Mask di Default',
    maskPlaceholder: example('255.255.255.0'),
    gateway: 'Gateway di Default',
    gatewayPlaceholder: example('192.168.1.1'),
    dns: 'Server DNS di Default',
    dnsPlaceholder: 'facoltativo',
    hint:
      'A un dispositivo nuovo viene proposto il primo indirizzo libero di questa rete, con ' +
      'questa subnet mask e questo gateway. Un router o un firewall nasce senza gateway: la ' +
      "sua rotta predefinita si sceglie nella sua scheda. Il server DNS, se c'è, viene " +
      'scritto sulla scheda di rete dei nuovi PC, server e degli altri dispositivi finali.',
  },

  /** Under a field that must not be left empty */
  required: 'Obbligatorio',

  /** The DNS server of the project, offered to the devices of the board that ask nobody */
  assignDns: {
    /** `names`: the devices that ask nobody */
    missing: (names: string[]) =>
      names.length === 1
        ? `Su questo canvas ${names[0]} non ha un server DNS.`
        : `Su questo canvas ${names.length} dispositivi non hanno un server DNS.`,
    button: (server: string) => `Assegna ${server}`,
    question: {
      title: (server: string, names: string[]) =>
        names.length === 1
          ? `Assegnare il server DNS ${server} a ${names[0]}?`
          : `Assegnare il server DNS ${server} a ${names.length} dispositivi?`,
      detail: (names: string[]) =>
        (names.length === 1
          ? 'Viene scritto sulla sua scheda di rete.'
          : `Viene scritto sulla scheda di rete di ${listOf(names)}.`) +
        ' Chi ha già un server DNS lo tiene, e le schede in DHCP non vengono toccate: ' +
        "il loro arriva con l'indirizzo.",
      confirm: 'Assegna',
    },
    /** `names`: the devices it was written on */
    done: (names: string[]) =>
      names.length === 1
        ? `Server DNS assegnato a ${names[0]}`
        : `Server DNS assegnato a ${names.length} dispositivi`,
  },

  /** Over the table of the VLANs of the project */
  vlansHint:
    'Un nome per ogni VLAN, scritto una volta: compare accanto al numero dove la VLAN è ' +
    'mostrata, nella scheda di uno switch e nelle impostazioni delle sue porte. Le VLAN usate ' +
    'su questo canvas sono già in elenco. Una riga lasciata senza nome non viene salvata.',

  simulation: {
    legend: 'Simulazione',
    emailMode: 'Modalità Email (SMTP)',
    auto: 'Auto (rileva automaticamente)',
    internal: 'Mail server interno',
    hint:
      'Determina come viaggiano le email in simulazione: tramite un Mail Server interno o ' +
      "attraverso l'uscita internet.",
  },

  save: 'Salva Impostazioni Rete',
  allRequired: 'Tutti i campi sono obbligatori',
  saved: 'Impostazioni di rete salvate',
};
