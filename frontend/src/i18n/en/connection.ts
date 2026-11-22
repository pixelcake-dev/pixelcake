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

  /** The cable the link stands for: what it is, how long, and the time a packet takes on it */
  cable: {
    legend: 'Cable',
    medium: 'Medium',
    /** The entries of the list, the first one worked out from the two ends */
    media: {
      auto: 'Automatic',
      copper: 'Copper (Ethernet)',
      fibre: 'Optical fibre',
      wifi: 'Wi-Fi',
      dsl: 'DSL to the provider',
      ftth: 'Fibre to the provider (FTTH)',
      mobile: 'Mobile network 4G/5G',
      satellite: 'Satellite (geostationary)',
    },
    mediumNote: 'Automatic: Wi-Fi between a laptop, a smartphone or a tablet and an access point, copper otherwise.',
    length: 'Length',
    unit: 'Unit',
    lengthPlaceholder: 'none',
    delay: 'Delay (ms)',
    delayPlaceholder: 'automatic',
    delayNote: 'Empty: from the medium and the length. Written by hand, one way, it takes their place.',
    oneWay: 'One-way delay',
    /** A number the engine wrote, with a point: English writes it so */
    decimal: (value: string) => value,
    /** `time` is written by the engine, with a point */
    computed: (time: string, why: string) => `${time} ms: ${why}`,
    /** What the time comes from: the medium, then the length (`length` also from the engine) */
    why: {
      written: 'written by hand',
      medium: {
        copper: 'copper',
        fibre: 'fibre',
        wifi: 'Wi-Fi',
        dsl: 'DSL',
        ftth: 'FTTH',
        mobile: 'mobile network',
        satellite: 'satellite',
      },
      automatic: (medium: string) => `${medium} (automatic)`,
      withLength: (medium: string, length: string) => `${medium}, ${length}`,
    },
    problems: {
      notLength: 'Write a number above 0, such as 600 or 0.5',
      tooLong: 'A cable is 40,000 km long at most',
      notDelay: 'Write the milliseconds as a number, such as 7 or 0.5',
      tooSlow: 'A delay written by hand is 10,000 ms at most',
    },
  },
};
