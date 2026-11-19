/** Device and link templates: lists and editors */

import type { DeviceDrawingGroup, DeviceDrawingId } from '@/data/deviceDrawings';
import { formatCount } from '../numbers';

/** The button that adds a link type: the empty list names it */
const newLinkType = 'Nuovo tipo di connessione';

export const templates = {
  title: 'Template',

  /** The two kinds of template, each in its own tab */
  kinds: {
    links: 'Connessioni',
    devices: 'Dispositivi',
  },

  devices: {
    tabs: {
      generic: 'Dispositivi generici',
      custom: 'Dispositivi personalizzati',
    },

    /** Fields the editor of a generic template and the form of a custom one share */
    baseType: 'Tipo di base',
    /** The groups the base types are shown in */
    baseTypeGroups: { network: 'Rete', servers: 'Server e dati', endpoints: 'Dispositivi finali' },
    /** The drawing a device of the template is shown with, chosen among those of the app */
    drawing: 'Disegno',
    /** The groups the drawings are shown in, those of the kit they come from */
    drawingGroups: {
      rete: 'Rete',
      server: 'Server',
      dati: 'Dati',
      dispositivi: 'Dispositivi finali',
    } satisfies Record<DeviceDrawingGroup, string>,
    /** The name of each drawing, as the kit calls it: the title of its choice, and its name for a screen reader */
    drawingNames: {
      router: 'Router',
      switch: 'Switch',
      firewall: 'Firewall',
      'access-point': 'Access point',
      'load-balancer': 'Load balancer',
      cloud: 'Cloud / Internet',
      server: 'Server',
      'server-mail': 'Server mail',
      'server-web': 'Server web',
      'server-vps': 'Server VPS',
      'server-proxy': 'Server proxy',
      'server-dns': 'Server DNS',
      'server-dhcp': 'Server DHCP',
      database: 'Database',
      'storage-s3': 'Storage S3',
      nas: 'NAS',
      pc: 'PC',
      laptop: 'Laptop',
      smartphone: 'Smartphone',
      tablet: 'Tablet',
      'telefono-ip': 'Telefono IP',
      stampante: 'Stampante',
      'telecamera-ip': 'Telecamera IP',
      iot: 'Dispositivo IoT',
    } satisfies Record<DeviceDrawingId, string>,

    generic: {
      intro: 'Dispositivi predefiniti disponibili per uso rapido',
      add: 'Nuovo template',
      edit: 'Modifica template',
      delete: 'Elimina template',
      restore: 'Ripristina i template predefiniti',
      restored: (count: number) =>
        count === 1 ? 'Ripristinato 1 template predefinito' : `Ripristinati ${formatCount('it', count)} template predefiniti`,
      nothingToRestore: 'I template predefiniti ci sono già tutti',
      deleteQuestion: {
        title: (name: string) => `Eliminare il template «${name}»?`,
        detail: 'I dispositivi esistenti di questo tipo potrebbero non essere più disegnati come prima.',
      },
    },

    editor: {
      titleEdit: 'Modifica template generico',
      titleNew: 'Nuovo template',
      saveChanges: 'Salva modifiche',
      create: 'Crea template',
      name: 'Nome',
      namePlaceholder: 'es. PC, Stampante, Dispositivo IoT',
      chooseType: '-- Seleziona tipo --',
      typeLocked:
        'Il tipo non può essere modificato, per evitare problemi con i dispositivi esistenti.',
      errors: {
        nameRequired: 'Il nome è obbligatorio',
        typeRequired: 'Il tipo di base è obbligatorio',
      },
    },

    custom: {
      intro: 'Template personalizzati: un nome, un tipo di base e un disegno',
      add: 'Nuovo template',
      formTitle: 'Crea nuovo template',
      name: 'Nome del template',
      namePlaceholder: 'es. AWS EC2 Instance',
      save: 'Salva template',
      empty: 'Nessun template personalizzato. Creane uno.',
      deleteQuestion: 'Eliminare questo template?',
    },
  },

  links: {
    intro: 'Tipi di connessione disponibili tra i dispositivi',
    add: newLinkType,
    edit: 'Modifica tipo di connessione',
    delete: 'Elimina tipo di connessione',
    empty: 'Nessun tipo di connessione disponibile',
    emptyHint: `Clicca su «${newLinkType}» per iniziare`,
    deleteQuestion: {
      title: (name: string) => `Eliminare il tipo di connessione «${name}»?`,
      detail: 'Le connessioni esistenti di questo tipo potrebbero non essere più disegnate come prima.',
    },

    editor: {
      titleEdit: 'Modifica tipo di connessione',
      titleNew: newLinkType,
      saveChanges: 'Salva modifiche',
      create: 'Crea tipo',
      name: 'Nome',
      namePlaceholder: 'es. Trunk, Access, WAN',
      typeId: 'ID del tipo',
      typeIdPlaceholder: 'es. trunk, access, wan',
      typeIdHint:
        'Identificatore univoco (minuscolo, senza spazi). Non modificabile dopo la creazione.',
      description: 'Descrizione',
      descriptionPlaceholder: 'es. Connessione trunk tra switch',
      colour: 'Colore',
      lineStyle: 'Stile della linea',
      lineStyles: {
        solid: 'Continua',
        dashed: 'Tratteggiata',
        dotted: 'Punteggiata',
      },
      thickness: 'Spessore',
      thicknessHint: 'Da 1 a 10 pixel.',
      preview: 'Anteprima',
      errors: {
        nameRequired: 'Il nome è obbligatorio',
        typeRequired: 'Il tipo è obbligatorio',
        typeExists: 'Questo tipo esiste già',
        invalidColour: 'Colore non valido (formato: #RRGGBB)',
        thicknessOutOfRange: 'Lo spessore deve essere tra 1 e 10',
      },
    },

    /**
     * What each link type the app comes with is for. The Italian ones are
     * also what the browser keeps with those templates (store/templateStore.ts);
     * utils/templateText.ts shows them in the language of the interface for
     * as long as the user has not rewritten them.
     */
    builtInDescriptions: {
      access: 'Connessione di accesso ai dispositivi finali',
      trunk: 'Connessione trunk tra switch',
      uplink: 'Uplink a core/Internet',
      backbone: 'Infrastruttura critica',
      mpls: 'Connessione MPLS WAN',
    },
  },
};
