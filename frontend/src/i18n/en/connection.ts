import type { Dictionary } from '../dictionary';

/** A link: its window and the types of link */
export const connection: Dictionary['connection'] = {
  /** The two devices of the link, by name; one that is no longer there has none */
  title: (source: string | undefined, target: string | undefined) =>
    `Edit link: ${source || 'Unknown'} → ${target || 'Unknown'}`,

  interfaces: {
    legend: 'Interfaces',
    on: (deviceName: string | undefined) => `Interface on ${deviceName ?? 'unknown device'}`,
    notAssigned: 'Not assigned',
    /** An entry of the list: the interface as it is named elsewhere, and what keeps it from being chosen */
    option: (label: string, state: { enabled: boolean; inUse: boolean }) =>
      `${label}${state.enabled ? '' : ' — disabled'}${state.inUse ? ' (in use)' : ''}`,
    note:
      'Port state, security zone and gateway are checked only on the ends ' +
      'assigned to an interface.',
  },

  type: 'Link type',
  noType: 'None (default)',
  colourPreview: 'Colour preview',
  bandwidth: 'Bandwidth (e.g. 1 Gbps, 100 Mbps)',
  label: 'Custom label',
  labelPlaceholder: 'Optional label',
  customColour: 'Custom colour (optional)',
  customColourNote: 'The custom colour overrides the colour of the type.',
};
