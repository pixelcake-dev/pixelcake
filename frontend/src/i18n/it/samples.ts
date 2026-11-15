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
  /**
   * The network of a multinational in Italy: a head office in Milan, a second
   * site in Rome, a disaster recovery data centre, seven branches, joined by
   * a carrier's MPLS network. Device names are codes, the same in every
   * language (`R-MI`, `PC-RM-101`); what is said in words is here.
   */
  multinational: {
    /** The area of each site */
    sites: {
      milan: 'Milano · Sede centrale',
      rome: 'Roma · Sede',
      disasterRecovery: 'Bologna · DC di disaster recovery',
      turin: 'Torino · Filiale',
      venice: 'Venezia · Filiale',
      florence: 'Firenze · Filiale',
      naples: 'Napoli · Filiale',
      bari: 'Bari · Magazzino',
      palermo: 'Palermo · Negozio',
      cagliari: 'Cagliari · Filiale',
    },
    /** The areas inside the head office */
    areas: {
      internet: 'Internet',
      dmz: 'DMZ',
      serverRoom,
      floor: (n: number) => `Piano ${n}`,
    },
    /** The carrier's network every site is joined to */
    carrier: 'Rete MPLS',
    devices: {
      customer: 'Cliente',
      remoteWorker: 'Telelavoro',
      /** A guest's phone or tablet, with the code of the site, as the other devices have */
      guest: (site: string, n: number) => `Ospite-${site}-${n}`,
    },
    /** The name of each VLAN, the same number on every site */
    vlans: {
      default: 'Predefinita',
      users: 'Utenti',
      voice: 'Voce',
      guests: 'Ospiti',
      cameras: 'Telecamere',
      tills: 'Casse',
    },
    ports: {
      inside: 'Interno',
      servers: 'Server',
      lan: 'LAN',
      shop: 'Negozio',
      /** A port of a router or a firewall named after the VLAN it serves */
      ofVlan: (name: string, vlan: number) => `${name} (VLAN ${vlan})`,
      lineTo: (place: string) => `Linea ${place}`,
    },
    /** Places named in the ports and in the notes of the routes */
    places: {
      milan: 'Milano',
      rome: 'Roma',
      disasterRecovery: 'DC DR',
      turin: 'Torino',
      venice: 'Venezia',
      florence: 'Firenze',
      naples: 'Napoli',
      bari: 'Bari',
      palermo: 'Palermo',
      cagliari: 'Cagliari',
    },
    cables: {
      mainLine: 'Linea principale',
      drFibre: 'Fibra DR',
    },
    /** What a route, a port forward or a rule is there for */
    notes: {
      viaMainLine: (place: string) => `${place}, linea principale`,
      viaBackup: (place: string) => `${place}, di riserva su MPLS`,
      branch: (place: string) => `filiale di ${place}`,
      company: 'rete aziendale',
      otherSites: 'le altre sedi, attraverso il router WAN',
      headOfficeGuests: 'gli ospiti della sede, dietro il firewall',
      shopGuests: 'ospiti del negozio di Palermo',
      publicSite: 'sito pubblico',
      incomingMail: 'posta in arrivo',
      publicDns: 'DNS pubblico',
      vpn: 'accesso da remoto',
      guestsNeverInside: 'gli ospiti non entrano mai nella rete aziendale',
      guestsAskPublicDns: 'gli ospiti chiedono i nomi al DNS pubblico',
      guestsBrowse: 'gli ospiti navigano',
      publicSiteFromOutside: 'il sito pubblico, da fuori',
      mailFromOutside: 'la posta in arrivo, da fuori',
      dnsFromOutside: 'il DNS pubblico, da fuori',
      vpnFromOutside: "l'accesso da remoto, da fuori",
      vpnToApplications: 'da remoto, le applicazioni web interne',
      proxyBrowses: 'il proxy naviga per i dipendenti',
      staffThroughProxy: 'i dipendenti navigano solo attraverso il proxy',
      siteReadsErp: 'il sito legge il catalogo dal gestionale',
      camerasOnlyRecorder: 'le telecamere parlano solo con il registratore, sulla loro rete',
      sensorsToArchive: "i sensori mandano i dati all'archivio di Milano",
      sensorsNothingElse: "e nient'altro",
      tillsToServer: 'le casse parlano con il loro server a Milano',
      tillsNothingElse: "e con nient'altro",
      guestsOut: 'poi escono su Internet, attraverso Milano',
    },
    /** The names the DNS servers of the company answer for */
    hostNames: {
      erp: 'erp.gruppo.example',
      mail: 'posta.gruppo.example',
      intranet: 'intranet.gruppo.example',
      files: 'archivio.gruppo.example',
      tills: 'casse.gruppo.example',
      www: 'www.gruppo.example',
      vpn: 'vpn.gruppo.example',
    },
  },
};
