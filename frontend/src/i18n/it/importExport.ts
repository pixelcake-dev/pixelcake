/** YAML and Terraform: the window, and what an import reports */

import { formatCount } from '../numbers';

/** A number of things as Italian writes it («14.891») */
const amount = (value: number) => formatCount('it', value);

const devices = (count: number) => (count === 1 ? '1 dispositivo' : `${amount(count)} dispositivi`);
const connections = (count: number) => (count === 1 ? '1 connessione' : `${amount(count)} connessioni`);

const areas = (count: number) => (count === 1 ? '1 riquadro' : `${amount(count)} riquadri`);

export const importExport = {
  /** How many devices, connections and areas: of the canvas, of a file */
  devices,
  connections,
  areas,

  exportTab: {
    format: 'Formato:',
    terraformDraft: 'Terraform HCL (bozza)',
    terraformNote:
      '<strong>È una bozza: non si può applicare con Terraform.</strong> I tipi di risorsa sono ' +
      'segnaposto e non è indicato alcun provider. Per salvare la topologia e poterla ricaricare ' +
      'usa il formato YAML.',
    noDevices: 'Nessun dispositivo nella topologia corrente.',
    addDevicesFirst: 'Aggiungi dispositivi al canvas per poterli esportare.',
    lines: (count: number) => (count === 1 ? '1 riga' : `${amount(count)} righe`),

    copy: 'Copia negli appunti',
    copied: 'Copiato',
    download: (fileName: string) => `Scarica ${fileName}`,

    copiedNotice: 'Copiato negli appunti',
    copyFailed: 'Errore durante la copia',
    downloadedNotice: (fileName: string) => `File scaricato: ${fileName}`,
  },

  importTab: {
    dropHere: 'Rilascia il file qui',
    dragOrClick: 'Trascina un file qui o clicca per selezionare',
    supportedFormats: 'Formati supportati: .yaml, .yml',

    warningCount: (count: number) => (count === 1 ? '1 avviso' : `${amount(count)} avvisi`),
    devicesFound: 'Dispositivi trovati',
    warnings: 'Avvisi',

    mode: 'Modalità:',
    replace: 'Sostituisci topologia',
    append: 'Aggiungi alla topologia',
    confirm: 'Importa',

    unsupportedFormat: 'Formato non supportato. Usa un file .yaml o .yml.',
    cannotRead: 'Errore durante la lettura del file',
    nothingToImport: 'Nessun dispositivo da importare',
    /** The question before «Sostituisci topologia» empties the canvas: what will be removed */
    replaceTitle: 'Sostituire la topologia?',
    replaceDetail: (deviceCount: number, connectionCount: number, areaCount: number) =>
      `Sul canvas ci sono ${devices(deviceCount)}, ${connections(connectionCount)} e ${areas(areaCount)}: verranno tolti e sostituiti dal contenuto del file. Modifica → Annulla li rimette.`,
    replaceConfirm: 'Sostituisci',
    /** After «Aggiungi alla topologia»: devices of the file that had a name already on the canvas */
    renamedNotice: (renamed: string) =>
      `Nomi già presenti sul canvas, ai dispositivi aggiunti è stato dato un nome libero: ${renamed}`,
    replacedNotice: (deviceCount: number, connectionCount: number) =>
      `Topologia importata: ${devices(deviceCount)}, ${connections(connectionCount)}`,
    appendedNotice: (deviceCount: number, connectionCount: number) =>
      `Aggiunti: ${devices(deviceCount)}, ${connections(connectionCount)}`,
  },

  /** What reading a YAML file reports, one line each */
  warnings: {
    /** `reason` is what the YAML reader said, when it said something */
    yamlError: (reason: string | undefined) =>
      reason === undefined ? 'Errore di lettura del file YAML: errore sconosciuto' : `Errore di lettura del file YAML: ${reason}`,
    noData: 'Il file YAML non contiene dati validi',
    unknownStructure: 'Struttura YAML non riconosciuta',
    noDevices: 'Nessun dispositivo trovato nel file',

    deviceNotValid: (number: number) => `Dispositivo ${number}: formato non valido, ignorato`,
    deviceAddressNotValid: (deviceName: string, address: string) =>
      `${deviceName}: IP "${address}" non valido`,
    portAddressNotValid: (portId: number, address: string) => `Porta ${portId}: IP "${address}" non valido`,
    portVlanOutOfRange: (portId: number, values: string) =>
      `Porta ${portId}: VLAN ${values} fuori intervallo (1–4094), non importata`,
    deviceVlanOutOfRange: (deviceName: string, values: string) =>
      `${deviceName}: VLAN ${values} fuori intervallo (1–4094), non importata`,
    connectionVlanOutOfRange: (number: number, values: string) =>
      `Connessione ${number}: VLAN ${values} fuori intervallo (1–4094), non importata`,
    /** `field` is the key of the file: medium, length_m, delay_ms */
    connectionCableNotValid: (number: number, field: string, value: string) =>
      `Connessione ${number}: ${field} "${value}" non valido, non importato`,
    /** `renamed` is the list of the new names, each written «old» → «new» */
    namesRepeated: (renamed: string) =>
      `Nomi usati più volte, ai dispositivi successivi è stato dato un nome libero: ${renamed}. Le connessioni che citano il nome vanno al primo dispositivo che lo ha`,
    areaNotValid: (number: number) => `Riquadro ${number}: senza posizione o dimensioni, ignorato`,
    portPoolIncomplete: (portId: number) =>
      `Porta ${portId}: server DHCP senza primo o ultimo indirizzo, ignorato`,
    cardPoolIncomplete: (deviceName: string, cardName: string) =>
      `${deviceName}: ${cardName}: server DHCP senza primo o ultimo indirizzo, ignorato`,
    recordIncomplete: (deviceName: string, number: number) =>
      `${deviceName}: record DNS ${number} senza nome o indirizzo, ignorato`,
    routeIncomplete: (deviceName: string, number: number) =>
      `${deviceName}: rotta ${number} senza destinazione o prossimo salto, ignorata`,
    forwardNotValid: (deviceName: string, number: number) =>
      `${deviceName}: inoltro ${number} incompleto o non valido, ignorato`,
    ruleNotValid: (deviceName: string, number: number) =>
      `${deviceName}: regola ${number} incompleta o non valida, ignorata`,

    connectionNotValid: (number: number) => `Connessione ${number}: formato non valido, ignorata`,
    sourceNotFound: (number: number, deviceName: string) =>
      `Connessione ${number}: dispositivo di partenza «${deviceName}» non trovato`,
    targetNotFound: (number: number, deviceName: string) =>
      `Connessione ${number}: dispositivo di destinazione «${deviceName}» non trovato`,
    portNotFound: (number: number, port: string, deviceName: string) =>
      `Connessione ${number}: porta ${port} non trovata su «${deviceName}», estremità non assegnata`,
    portTaken: (number: number, portId: number, deviceName: string) =>
      `Connessione ${number}: porta ${portId} di «${deviceName}» già usata da un'altra connessione, estremità non assegnata`,
    cardNotFound: (number: number, cardName: string, deviceName: string) =>
      `Connessione ${number}: interfaccia «${cardName}» non trovata su «${deviceName}», estremità non assegnata`,
    cardTaken: (number: number, cardName: string, deviceName: string) =>
      `Connessione ${number}: interfaccia «${cardName}» di «${deviceName}» già usata da un'altra connessione, estremità non assegnata`,
  },
};
