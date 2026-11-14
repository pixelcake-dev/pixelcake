/** Device and link templates: lists and editors */

/** The button that adds a link type: the empty list names it */
const newLinkType = 'Nuovo Tipo Connessione';

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
      custom: 'Dispositivi Custom',
    },

    /** Fields the editor of a generic template and the form of a custom one share */
    baseType: 'Tipo Base',
    colour: 'Colore',

    generic: {
      intro: 'Dispositivi predefiniti disponibili per uso rapido',
      add: 'Aggiungi Nuovo Template',
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
      namePlaceholder: 'es: PC, Printer, IoT Device',
      chooseType: '-- Seleziona tipo --',
      typeLocked: 'Il tipo non può essere modificato per evitare problemi con i dispositivi esistenti',
      icon: 'Icona (Iconify)',
      preview: 'Preview',
      errors: {
        nameRequired: 'Nome obbligatorio',
        typeRequired: 'Tipo base obbligatorio',
        typeExists: 'Tipo già esistente tra i template generici',
        iconRequired: 'Icona obbligatoria',
      },
    },

    custom: {
      intro: 'Template personalizzati con campi Terraform',
      add: '+ Nuovo Template',
      formTitle: 'Crea Nuovo Template',
      name: 'Nome Template',
      namePlaceholder: 'es: AWS EC2 Instance',
      icon: 'Icona Iconify',
      iconPlaceholder: 'es: mdi:server',
      save: 'Salva Template',
      empty: 'Nessun template personalizzato. Creane uno!',
      deleteQuestion: 'Eliminare questo template?',
    },
  },

  links: {
    intro: 'Tipi di connessione disponibili per i collegamenti tra dispositivi',
    add: newLinkType,
    edit: 'Modifica tipo connessione',
    delete: 'Elimina tipo connessione',
    empty: 'Nessun tipo di connessione disponibile',
    emptyHint: `Clicca su "${newLinkType}" per iniziare`,
    deleteQuestion: {
      title: (name: string) => `Eliminare il tipo di connessione «${name}»?`,
      detail: 'Le connessioni esistenti di questo tipo potrebbero non essere più disegnate come prima.',
    },

    editor: {
      titleEdit: 'Modifica Tipo Connessione',
      titleNew: newLinkType,
      saveChanges: 'Salva Modifiche',
      create: 'Crea Tipo',
      name: 'Nome *',
      namePlaceholder: 'es: Trunk, Access, WAN',
      typeId: 'Tipo ID *',
      typeIdPlaceholder: 'es: trunk, access, wan',
      typeIdHint: 'Identificatore univoco (minuscolo, no spazi). Non modificabile dopo la creazione.',
      description: 'Descrizione',
      descriptionPlaceholder: 'es: Link trunk tra switch',
      colour: 'Colore *',
      lineStyle: 'Stile Linea *',
      lineStyles: {
        solid: 'Solida',
        dashed: 'Tratteggiata',
        dotted: 'Puntinata',
      },
      thickness: 'Spessore *',
      thicknessHint: 'Da 1 a 10 pixel',
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
      access: 'Porta di accesso a dispositivi finali',
      trunk: 'Link trunk tra switch',
      uplink: 'Uplink a core/internet',
      backbone: 'Infrastruttura critica',
      mpls: 'Connessione MPLS WAN',
    },
  },
};
