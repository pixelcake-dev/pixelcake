/** The sample networks: every name given to what they create */

// A sample is created in the language of the interface at that moment; once
// on the board its names are content, and they stay as they were created.
// Only the names that change with the language are here: `SW-Core`, `Mail`,
// `Internet`, `VLAN 10` and the like are written in the samples themselves
// (utils/sample*.ts). A port named after the device cabled to it takes the
// entry of that device.

// What more than one sample has: the same thing goes by the same name in all
const offices = 'Uffici';
const serverRoom = 'Sala server';
const officesVlan = (vlan: number) => `Uffici (VLAN ${vlan})`;
const serversVlan = (vlan: number) => `Server (VLAN ${vlan})`;
/** The names a sample gives its VLANs in the settings of the project; 1 is where the ports nobody set are */
const vlans = { default: 'Predefinita', offices, servers: 'Server' };
/** The names of the areas of a sample that are not the same in every language */
const areas = { offices, servers: 'Server' };
const inside = 'Interno';
const insideNetworks = 'reti interne';

export const samples = {
  /** The small company the welcome screen loads: offices, Wi-Fi, servers and a DMZ */
  company: {
    devices: {
      officeSwitch: 'SW-Uffici',
      accountsPc: 'PC-Contabilità',
      salesPc: 'PC-Vendite',
      printer: 'Stampante',
      accessPoint: 'AP-Uffici',
      laptop: (index: number) => `Portatile-${index}`,
      serverSwitch: 'SW-Server',
      erpDatabase: 'DB-Gestionale',
      erpWebServer: 'Web-Gestionale',
      customerPortal: 'Portale-Clienti',
      remoteCustomer: 'Cliente-Remoto',
    },
    /** Where a device is */
    places: {
      offices,
      serverRoom,
      offSite: 'Fuori sede',
    },
    /** Ports named for the network behind them */
    ports: {
      offices: officesVlan,
      servers: serversVlan,
      inside,
    },
    /** What a route, a port forward or a rule of the firewall is there for */
    notes: {
      insideNetworks,
      customerPortal: 'portale clienti',
      incomingMail: 'posta in arrivo',
      portalReadsDatabase: 'il portale legge il database',
    },
    vlans,
    areas,
    /** The names the DNS server of the company answers for */
    hostNames: {
      erp: 'gestionale.azienda.example',
      mail: 'posta.azienda.example',
      portal: 'portale.azienda.example',
    },
  },

  /** The small office: two networks and a router */
  office: {
    places: {
      offices,
      serverRoom,
    },
    ports: {
      officeLan: 'LAN Uffici',
      serverLan: 'LAN Server',
    },
  },

  /** One site with VLANs, a DMZ and a firewall */
  site: {
    devices: {
      officePc: (index: number) => `PC-Uffici-${index}`,
      internalServer: 'Srv-Interno',
      /** The PC outside, on the Internet, and the web server the firewall publishes */
      remotePc: 'PC-Remoto',
      publicWebServer: 'Web-Pubblico',
    },
    places: {
      offices,
      serverRoom,
    },
    ports: {
      offices: officesVlan,
      servers: serversVlan,
      inside,
    },
    vlans,
    /** The side of the firewall that is trusted: the area around its devices */
    areas: { inside: 'Rete interna' },
    /** What the route, the port forward and the rule of the firewall are there for */
    notes: {
      insideNetworks,
      publicWebsite: 'sito pubblico',
    },
  },

  /** Two sites, the head office and a branch, joined by a main line and a backup line */
  twoSites: {
    devices: {
      backupRouter: 'R-Riserva',
      headOfficeRouter: 'R-Sede',
      branchRouter: 'R-Filiale',
      floorSwitch: (floor: number) => `SW-Piano-${floor}`,
      headOfficePc: (index: number) => `PC-Sede-${index}`,
      branchSwitch: 'SW-Filiale',
      branchPc: (index: number) => `PC-Filiale-${index}`,
    },
    places: {
      backupCarrier: 'Operatore di riserva',
      headOffice: 'Sede',
      headOfficeFloor: (floor: number) => `Sede, piano ${floor}`,
      branch: 'Filiale',
    },
    /** Ports named for where they lead */
    ports: {
      toHeadOffice: 'Verso la sede',
      toBranch: 'Verso la filiale',
      headOfficeNetwork: 'Rete della sede',
      branchNetwork: 'Rete della filiale',
    },
    /** The two lines between the sites: the label of each cable, and the name of the ports it joins */
    cables: {
      mainLine: 'Linea principale',
      backupLine: 'Linea di riserva',
    },
    /** Where each route leads, and over which line */
    notes: {
      headOffice: 'sede',
      branch: 'filiale',
      headOfficeMainLine: 'sede, linea principale',
      headOfficeBackupLine: 'sede, linea di riserva',
      branchMainLine: 'filiale, linea principale',
      branchBackupLine: 'filiale, linea di riserva',
    },
  },
};
