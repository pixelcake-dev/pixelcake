import type { Dictionary } from '../dictionary';
import { common } from './common';

/** The window that creates a project */

const example = (value: string) => `e.g. ${value}`;

export const newProject: Dictionary['newProject'] = {
  title: 'New project',
  create: 'Create project',

  info: {
    legend: 'Project information',
    name: 'Project name *',
    namePlaceholder: example('Infrastructure HQ'),
    description: 'Description',
    descriptionPlaceholder: 'Short description of the project...',
  },

  /** What the new devices of the project start from */
  network: {
    legend: 'Global network settings',
    network: 'Network',
    mask: 'Subnet mask',
    dns: 'DNS server (optional)',
    dnsPlaceholder: example('192.168.1.53'),
  },

  /** Why the project is not created */
  problems: {
    nameMissing: 'The project name is required',
    dnsNotAnAddress: (value: string) => `DNS server: ${common.validation.notIPv4(value)}`,
  },
};
