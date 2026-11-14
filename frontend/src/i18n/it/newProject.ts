import { common } from './common';

/** The window that creates a project */

const example = (value: string) => `es. ${value}`;

export const newProject = {
  title: 'Nuovo Progetto',
  create: 'Crea Progetto',

  info: {
    legend: 'Informazioni Progetto',
    name: 'Nome Progetto *',
    namePlaceholder: example('Infrastructure HQ'),
    description: 'Descrizione',
    descriptionPlaceholder: 'Breve descrizione del progetto...',
  },

  /** What the new devices of the project start from */
  network: {
    legend: 'Impostazioni di Rete Globali',
    network: 'Classe IP',
    mask: 'Subnet Mask',
    dns: 'Server DNS (facoltativo)',
    dnsPlaceholder: example('192.168.1.53'),
  },

  /** Why the project is not created */
  problems: {
    nameMissing: 'Il nome del progetto è obbligatorio',
    dnsNotAnAddress: (value: string) => `Server DNS: ${common.validation.notIPv4(value)}`,
  },
};
