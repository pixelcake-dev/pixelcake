/** Device and link templates: lists and editors */

/** The button that adds a link type: the empty list names it */
const newLinkType = 'Nuovo Tipo di Connessione';

export const templates = {
  title: 'Template',

  /** The two kinds of template, each in its own tab */
  kinds: {
    links: 'Connessioni',
    devices: 'Dispositivi',
  },

  devices: {
    tabs: {
      generic: 'Dispositivi Generici',
      custom: 'Dispositivi Personalizzati',
    },

    /** Fields the editor of a generic template and the form of a custom one share */
    baseType: 'Tipo di Base',
    colour: 'Colore',

    generic: {
      intro: 'Dispositivi predefiniti disponibili per uso rapido',
      add: 'Nuovo Template',
      edit: 'Modifica template',
      delete: 'Elimina template',
      deleteQuestion: {
        title: (name: string) => `Eliminare il template «${name}»?`,
        detail: 'I dispositivi esistenti di questo tipo potrebbero non essere più disegnati come prima.',
      },
    },

    editor: {
      titleEdit: 'Modifica Template Generico',
      titleNew: 'Nuovo Template Generico',
      saveChanges: 'Salva Modifiche',
      create: 'Crea Template',
      name: 'Nome',
      namePlaceholder: 'es. PC, Stampante, Dispositivo IoT',
      chooseType: '-- Seleziona tipo --',
      typeLocked:
        'Il tipo non può essere modificato, per evitare problemi con i dispositivi esistenti.',
      icon: 'Icona (Iconify)',
      preview: 'Anteprima',
      errors: {
        nameRequired: 'Il nome è obbligatorio',
        typeRequired: 'Il tipo di base è obbligatorio',
        typeExists: 'Questo tipo esiste già tra i template generici',
        iconRequired: "L'icona è obbligatoria",
      },
    },

    custom: {
      intro: 'Template personalizzati con campi Terraform',
      add: 'Nuovo Template',
      formTitle: 'Crea Nuovo Template',
      name: 'Nome del Template',
      namePlaceholder: 'es. AWS EC2 Instance',
      icon: 'Icona Iconify',
      iconPlaceholder: 'es. mdi:server',
      save: 'Salva Template',
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
      titleEdit: 'Modifica Tipo di Connessione',
      titleNew: newLinkType,
      saveChanges: 'Salva Modifiche',
      create: 'Crea Tipo',
      name: 'Nome',
      namePlaceholder: 'es. Trunk, Access, WAN',
      typeId: 'ID del Tipo',
      typeIdPlaceholder: 'es. trunk, access, wan',
      typeIdHint:
        'Identificatore univoco (minuscolo, senza spazi). Non modificabile dopo la creazione.',
      description: 'Descrizione',
      descriptionPlaceholder: 'es. Connessione trunk tra switch',
      colour: 'Colore',
      lineStyle: 'Stile della Linea',
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
