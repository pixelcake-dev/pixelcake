import { common } from './common';

/** The window that creates a project */

const example = (value: string) => `es. ${value}`;

export const newProject = {
  title: 'Nuovo progetto',
  create: 'Crea progetto',

  info: {
    legend: 'Informazioni sul progetto',
    name: 'Nome del progetto',
    namePlaceholder: example('Rete della sede'),
    description: 'Descrizione',
    descriptionPlaceholder: 'Breve descrizione del progetto…',
  },

  /** What the new devices of the project start from */
  network: {
    legend: 'Impostazioni di rete globali',
    network: 'Rete',
    mask: 'Subnet mask',
    dns: 'Server DNS (facoltativo)',
    dnsPlaceholder: example('192.168.1.53'),
  },

  /** Why the project is not created */
  problems: {
    nameMissing: 'Il nome del progetto è obbligatorio',
    dnsNotAnAddress: (value: string) => `Server DNS: ${common.validation.notIPv4(value)}`,
  },
};
