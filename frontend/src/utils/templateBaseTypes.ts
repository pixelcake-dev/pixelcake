/**
 * The base types a template can have, and what a template of each is made of.
 * The one list for every form that makes a template (the custom devices and
 * the generic ones), so that a custom template is made as the built-in one of
 * its type: ports or network cards, VLAN and spanning tree, port counts.
 *
 * Pure: no React, no stores.
 */

import type { DeviceTemplate } from '@/types/network';

/** The groups the base types are shown in, in this order */
export type BaseTypeGroup = 'network' | 'servers' | 'endpoints';

export interface BaseType {
  /** What a device keeps as its type, and what the engine reads */
  type: string;
  /** What is shown in the lists */
  label: string;
  group: BaseTypeGroup;
}

/** Every base type the app has, ordered by group */
export const BASE_TYPES: readonly BaseType[] = [
  { type: 'Switch', label: 'Switch', group: 'network' },
  { type: 'Router', label: 'Router', group: 'network' },
  { type: 'Firewall', label: 'Firewall', group: 'network' },
  { type: 'AccessPoint', label: 'Access Point', group: 'network' },
  { type: 'LoadBalancer', label: 'Load Balancer', group: 'network' },
  { type: 'Server', label: 'Server', group: 'servers' },
  { type: 'Database', label: 'Database', group: 'servers' },
  { type: 'Cloud', label: 'Cloud', group: 'servers' },
  { type: 'PC', label: 'PC', group: 'endpoints' },
];

export const BASE_TYPE_GROUPS: readonly BaseTypeGroup[] = ['network', 'servers', 'endpoints'];

/** The base types with numbered ports (and VLANs and spanning tree) instead of network cards */
const PORTED_TYPES = ['Switch', 'Router', 'Firewall'];

/** The fields of a template that follow from its base type */
export type TemplateFieldsOfType = Pick<
  DeviceTemplate,
  'supportsVLAN' | 'supportsSTP' | 'supportsPorts' | 'supportsNICs' | 'portOptions' | 'defaultPortCount'
>;

export function templateFieldsOfType(type: string): TemplateFieldsOfType {
  const ported = PORTED_TYPES.includes(type);
  const fields: TemplateFieldsOfType = {
    supportsVLAN: ported,
    supportsSTP: ported,
    supportsPorts: ported,
    supportsNICs: !ported,
  };
  if (type === 'Switch') {
    fields.portOptions = [5, 8, 16, 24, 48];
    fields.defaultPortCount = 24;
  } else if (type === 'Router' || type === 'Firewall') {
    fields.portOptions = [2, 4, 8, 16];
    fields.defaultPortCount = 8;
  }
  return fields;
}
