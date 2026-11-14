/** A link: its window and the types of link */
export const connection = {
  /** The two devices of the link, by name; one that is no longer there has none */
  title: (source: string | undefined, target: string | undefined) =>
    `Modifica Connessione: ${source || 'sconosciuto'} → ${target || 'sconosciuto'}`,

  interfaces: {
    legend: 'Interfacce',
    on: (deviceName: string | undefined) => `Interfaccia su ${deviceName ?? 'dispositivo sconosciuto'}`,
    notAssigned: 'Non assegnata',
    /** An entry of the list: the interface as it is named elsewhere, and what keeps it from being chosen */
    option: (label: string, state: { enabled: boolean; inUse: boolean }) =>
      `${label}${state.enabled ? '' : ' — disabilitata'}${state.inUse ? ' (in uso)' : ''}`,
    note:
      'Stato della porta, zona di sicurezza e gateway vengono verificati solo sulle ' +
      "estremità assegnate a un'interfaccia.",
  },

  type: 'Tipo di Connessione',
  noType: 'Nessuno (Predefinito)',
  colourPreview: 'Anteprima del Colore',
  bandwidth: 'Banda (es. 1 Gbps, 100 Mbps)',
  label: 'Etichetta Personalizzata',
  labelPlaceholder: 'Etichetta facoltativa',
  customColour: 'Colore Personalizzato (facoltativo)',
  customColourNote: 'Il colore personalizzato sovrascrive il colore del tipo.',
};
