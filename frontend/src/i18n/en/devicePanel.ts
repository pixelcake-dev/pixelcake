import type { Dictionary } from '../dictionary';

/** The panel that adds devices and loads the sample networks */
export const devicePanel: Dictionary['devicePanel'] = {
  tabs: {
    devices: 'Devices',
    samples: 'Samples',
  },

  searchPlaceholder: 'Search devices...',
  noDevicesFor: (query: string) => `No devices found for "${query}"`,
  bulkAdd: 'Bulk add',
  area: {
    name: 'Area',
    description: 'A rectangle with a name, behind a group of devices',
  },

  /** What a device of each built-in type is, under its name in the list; `other` for the rest */
  descriptions: {
    pc: 'End device for users',
    switch: 'Local network aggregation',
    router: 'Gateway and routing between networks',
    server: 'Application or data server',
    firewall: 'Network protection and security',
    accessPoint: 'Wi-Fi access point',
    loadBalancer: 'Load distribution',
    database: 'Database server',
    cloud: 'Cloud or virtual service',
    other: 'Network device',
  },
  /** The same for a template made by the user, of the type it is built on */
  customTemplate: (type: string) => `Custom template (${type})`,

  /** The tab of the sample networks */
  samples: {
    intro: 'Sample networks, already configured. Loading one replaces the open board.',
    company: {
      title: 'Company: offices, Wi-Fi, servers and DMZ',
      description: 'The sample network: VLANs on a trunk, access point, firewall with three rules',
    },
    office: {
      title: 'Office: two networks and a router',
      description: 'To start with: ping, web, email',
    },
    site: {
      title: 'Site: VLANs, DMZ and firewall',
      description: 'Two VLANs, routes, zones and a rule that publishes a website',
    },
    twoSites: {
      title: 'Two sites: main line and backup line',
      description: 'For trying failures: nearly every cable has another way',
    },
    /** Asked before a sample takes the place of a drawing */
    replaceQuestion: {
      title: 'Load the sample network?',
      detail: 'It takes the place of what is on the board.',
      confirm: 'Load',
    },
  },
};
