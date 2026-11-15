/** Reading a project file: what was repaired, what is wrong */

import { formatCount } from '../numbers';

/** A number of things as Italian writes it («14.891») */
const amount = (value: number) => formatCount('it', value);

/** What is said of one canvas of the file: its name comes first */
const inCanvas = (canvasName: string, what: string) => `Canvas «${canvasName}»: ${what}`;

export const projectFile = {
  /** A file that cannot be opened: what is wrong with it */
  errors: {
    notJson: 'Il file non è un JSON valido.',
    notProject: 'Il file non è un progetto PixelCake (campo "format" mancante o non riconosciuto).',
    versionNotValid: 'Il file indica una versione del formato non valida.',
    newerVersion: (version: number) =>
      `Il file è stato creato con una versione più recente di PixelCake (formato ${version}): ` +
      "aggiorna l'applicazione per aprirlo.",
    noCanvases: 'Il progetto non contiene nessun canvas.',
    canvasNotValid: (number: number) => `Il canvas n. ${number} del file non è valido.`,
    noDeviceList: (canvasName: string) =>
      inCanvas(canvasName, `manca l'elenco dei dispositivi ("devices").`),
    noConnectionList: (canvasName: string) =>
      inCanvas(canvasName, `manca l'elenco delle connessioni ("connections").`),
    unreadable: 'Il file non può essere letto: il contenuto non è valido.',
  },

  /** A file that was opened: what was put right on the way */
  repairs: {
    noVersion: 'Versione del formato non indicata: il file è stato letto come versione 1.',
    noProjectName: (givenName: string) => `Nome del progetto mancante: usato «${givenName}».`,
    noDescription: 'Descrizione del progetto mancante: lasciata vuota.',

    noSettings: 'Impostazioni di rete mancanti: usati i valori predefiniti.',
    incompleteSettings: 'Impostazioni di rete incomplete: completate con i valori predefiniti.',
    defaultDnsNotValid: 'Server DNS predefinito non valido: ignorato.',
    vlanListNotValid: 'Elenco dei nomi delle VLAN non valido: ignorato.',
    vlanNamesDropped: (count: number) =>
      count === 1
        ? '1 nome di VLAN non valido o duplicato ignorato.'
        : `${amount(count)} nomi di VLAN non validi o duplicati ignorati.`,
    vlanNamesCut: (count: number, maxLength: number) =>
      count === 1
        ? `1 nome di VLAN troppo lungo accorciato a ${amount(maxLength)} caratteri.`
        : `${amount(count)} nomi di VLAN troppo lunghi accorciati a ${amount(maxLength)} caratteri.`,

    canvasUnnamed: (number: number, givenName: string) =>
      `Canvas n. ${number} senza nome: chiamato «${givenName}».`,
    devicesDropped: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1
          ? '1 dispositivo non valido o duplicato ignorato.'
          : `${amount(count)} dispositivi non validi o duplicati ignorati.`
      ),
    devicesRepaired: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1
          ? '1 dispositivo incompleto corretto.'
          : `${amount(count)} dispositivi incompleti corretti.`
      ),
    connectionsDropped: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1
          ? '1 connessione non valida ignorata.'
          : `${amount(count)} connessioni non valide ignorate.`
      ),
    connectionsDuplicate: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1
          ? '1 connessione con ID duplicato rimossa.'
          : `${amount(count)} connessioni con ID duplicato rimosse.`
      ),
    connectionsDetached: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1
          ? '1 connessione verso un dispositivo inesistente rimossa.'
          : `${amount(count)} connessioni verso dispositivi inesistenti rimosse.`
      ),
    areasDropped: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1
          ? '1 riquadro non valido ignorato.'
          : `${amount(count)} riquadri non validi ignorati.`
      ),
    areasRepaired: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1
          ? '1 riquadro incompleto corretto.'
          : `${amount(count)} riquadri incompleti corretti.`
      ),
    viewReset: (canvasName: string) =>
      inCanvas(canvasName, 'vista mancante o non valida, riportata alla posizione iniziale.'),
    countersRaised: (canvasName: string) =>
      inCanvas(canvasName, 'contatori degli ID mancanti o troppo bassi, ricalcolati.'),
    canvasIdsGiven: (count: number) =>
      count === 1
        ? '1 canvas con ID mancante o duplicato: assegnato un nuovo ID.'
        : `${amount(count)} canvas con ID mancante o duplicato: assegnati nuovi ID.`,
    activeCanvasNotFound: (openedName: string) => `Canvas attivo non trovato: aperto «${openedName}».`,

    noTemplateList: 'Elenco dei template personalizzati mancante: nessun template importato.',
    templatesDropped: (count: number) =>
      count === 1
        ? '1 template personalizzato non valido ignorato.'
        : `${amount(count)} template personalizzati non validi ignorati.`,
  },
};
