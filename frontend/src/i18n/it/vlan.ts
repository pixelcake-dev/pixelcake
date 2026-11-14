/** VLANs: the field, the names of the project */

const example = (value: string) => `es. ${value}`;

export const vlan = {
  /** A VLAN in a list of numbers, with the name the project gave it: `10 «Uffici»` */
  numberAndName: (id: number, name: string) => `${id} «${name}»`,

  /** The field that takes several VLAN numbers, each shown as a tag */
  input: {
    placeholder: example('10, 20, 30'),
    outOfRange: 'La VLAN deve essere tra 1 e 4094',
    duplicate: 'VLAN già presente',
    remove: (id: number) => `Togli la VLAN ${id}`,
    hint: 'Premi Invio o virgola per aggiungere una VLAN (1–4094).',
  },

  /** The table of the VLANs of the project and of their names (Impostazioni → Rete) */
  names: {
    title: 'VLAN del progetto',
    name: 'Nome',
    onThisCanvas: 'Su questo canvas',
    remove: 'Togli',
    newNumber: 'Numero della nuova VLAN',
    numberPlaceholder: example('30'),
    nameOf: (id: string) => `Nome della VLAN ${id}`,
    newName: 'Nome della nuova VLAN',
    /** In the empty name of a VLAN the drawing uses */
    unnamed: 'senza nome',
    namePlaceholder: example('Uffici'),
    inUse: 'in uso',
    notUsed: 'non usata',
    removeNameOf: (id: string) => `Togli il nome della VLAN ${id}`,
    removeNew: 'Togli la nuova VLAN',
    none: 'Nessuna VLAN ha un nome, e questo canvas non ne usa.',
    add: 'Aggiungi VLAN',

    /** What is wrong with a row */
    problems: {
      numberMissing: (name: string) => `Manca il numero della VLAN «${name}»`,
      notAVlan: (typed: string) => `"${typed}" non è una VLAN: il numero va da 1 a 4094`,
      nameMissing: (id: number) => `Manca il nome della VLAN ${id}`,
      duplicate: (id: number) => `La VLAN ${id} è già nell'elenco`,
    },
  },
};
