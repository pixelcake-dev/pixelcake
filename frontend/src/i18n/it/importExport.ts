/** YAML and Terraform: the window, and what an import reports */

const devices = (count: number) => `${count} dispositivi`;
const connections = (count: number) => `${count} connessioni`;

export const importExport = {
  /** How many devices and connections: of the canvas, of a file */
  devices,
  connections,

  exportTab: {
    format: 'Formato:',
    terraformDraft: 'Terraform HCL (bozza)',
    terraformNote:
      '<strong>È una bozza: non si può applicare con Terraform.</strong> I tipi di risorsa sono ' +
      'segnaposto e non è indicato alcun provider. Per salvare la topologia e poterla ricaricare ' +
      'usa il formato YAML.',
    noDevices: 'Nessun dispositivo nella topologia corrente.',
    addDevicesFirst: 'Aggiungi dispositivi al canvas per poterli esportare.',
    lines: (count: number) => `${count} righe`,

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

    warningCount: (count: number) => `${count} avvisi`,
    devicesFound: 'Dispositivi trovati',
    warnings: 'Avvisi',

    mode: 'Modalità:',
    replace: 'Sostituisci topologia',
    append: 'Aggiungi alla topologia',
    confirm: 'Importa',

    unsupportedFormat: 'Formato non supportato. Usa file .yaml o .yml',
    cannotRead: 'Errore durante la lettura del file',
    nothingToImport: 'Nessun dispositivo da importare',
    replacedNotice: (deviceCount: number, connectionCount: number) =>
      `Topologia importata: ${devices(deviceCount)}, ${connections(connectionCount)}`,
    appendedNotice: (deviceCount: number, connectionCount: number) =>
      `Aggiunti: ${devices(deviceCount)}, ${connections(connectionCount)}`,
  },

  /** What reading a YAML file reports, one line each */
  warnings: {
    /** `reason` is what the YAML reader said, when it said something */
    yamlError: (reason: string | undefined) =>
      reason === undefined ? 'Errore parsing YAML: Errore sconosciuto' : `Errore parsing YAML: ${reason}`,
    noData: 'Il file YAML non contiene dati validi',
    unknownStructure: 'Struttura YAML non riconosciuta',
    noDevices: 'Nessun dispositivo trovato nel file',

    deviceNotValid: (number: number) => `Dispositivo ${number}: formato non valido, ignorato`,
    deviceAddressNotValid: (deviceName: string, address: string) =>
      `${deviceName}: IP "${address}" non valido`,
    portAddressNotValid: (portId: number, address: string) => `Port ${portId}: IP "${address}" non valido`,
    portVlanOutOfRange: (portId: number) => `Port ${portId}: VLAN fuori range (1-4094)`,
    portPoolIncomplete: (portId: number) =>
      `Port ${portId}: server DHCP senza primo o ultimo indirizzo, ignorato`,
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
      `Connessione ${number}: sorgente "${deviceName}" non trovata`,
    targetNotFound: (number: number, deviceName: string) =>
      `Connessione ${number}: destinazione "${deviceName}" non trovata`,
    portNotFound: (number: number, port: string, deviceName: string) =>
      `Connessione ${number}: porta ${port} non trovata su "${deviceName}", estremità non assegnata`,
    portTaken: (number: number, portId: number, deviceName: string) =>
      `Connessione ${number}: porta ${portId} di "${deviceName}" già usata da un'altra connessione, estremità non assegnata`,
    cardNotFound: (number: number, cardName: string, deviceName: string) =>
      `Connessione ${number}: interfaccia "${cardName}" non trovata su "${deviceName}", estremità non assegnata`,
    cardTaken: (number: number, cardName: string, deviceName: string) =>
      `Connessione ${number}: interfaccia "${cardName}" di "${deviceName}" già usata da un'altra connessione, estremità non assegnata`,
  },
};
