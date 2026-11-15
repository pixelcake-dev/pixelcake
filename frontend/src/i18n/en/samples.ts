import type { Dictionary } from '../dictionary';

/** The sample networks: every name given to what they create */

// A sample is created in the language of the interface at that moment; once
// on the board its names are content, and they stay as they were created.
// Only the names that change with the language are here: `SW-Core`, `Mail`,
// `Internet`, `VLAN 10` and the like are written in the samples themselves
// (utils/sample*.ts). A port named after the device cabled to it takes the
// entry of that device.

// What more than one sample has: the same thing goes by the same name in all
const offices = 'Offices';
const serverRoom = 'Server room';
const officesVlan = (vlan: number) => `Offices (VLAN ${vlan})`;
const serversVlan = (vlan: number) => `Servers (VLAN ${vlan})`;
const vlans = { default: 'Default', offices, servers: 'Servers' };
const areas = { offices, servers: 'Servers' };
const inside = 'Internal';
const insideNetworks = 'internal networks';

export const samples: Dictionary['samples'] = {
  /** The small company the welcome screen loads: offices, Wi-Fi, servers and a DMZ */
  company: {
    devices: {
      officeSwitch: 'SW-Offices',
      accountsPc: 'PC-Accounts',
      salesPc: 'PC-Sales',
      printer: 'Printer',
      accessPoint: 'AP-Offices',
      laptop: (index: number) => `Laptop-${index}`,
      serverSwitch: 'SW-Servers',
      erpDatabase: 'DB-ERP',
      erpWebServer: 'Web-ERP',
      customerPortal: 'Customer-Portal',
      remoteCustomer: 'Remote-Customer',
    },
    /** Where a device is */
    places: {
      offices,
      serverRoom,
      offSite: 'Off-site',
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
      customerPortal: 'customer portal',
      incomingMail: 'incoming mail',
      portalReadsDatabase: 'the portal reads the database',
    },
    vlans,
    areas,
    /** The names the DNS server of the company answers for */
    hostNames: {
      erp: 'erp.company.example',
      mail: 'mail.company.example',
      portal: 'portal.company.example',
    },
  },

  /** The small office: two networks and a router */
  office: {
    places: {
      offices,
      serverRoom,
    },
    ports: {
      officeLan: 'Office LAN',
      serverLan: 'Server LAN',
    },
  },

  /** One site with VLANs, a DMZ and a firewall */
  site: {
    devices: {
      officePc: (index: number) => `PC-Office-${index}`,
      internalServer: 'Srv-Internal',
      /** The PC outside, on the Internet, and the web server the firewall publishes */
      remotePc: 'Remote-PC',
      publicWebServer: 'Web-Public',
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
    areas: { inside: 'Internal network' },
    /** What the route, the port forward and the rule of the firewall are there for */
    notes: {
      insideNetworks,
      publicWebsite: 'public website',
    },
  },

  /** Two sites, the head office and a branch, joined by a main line and a backup line */
  twoSites: {
    devices: {
      backupRouter: 'R-Backup',
      headOfficeRouter: 'R-HQ',
      branchRouter: 'R-Branch',
      floorSwitch: (floor: number) => `SW-Floor-${floor}`,
      headOfficePc: (index: number) => `PC-HQ-${index}`,
      branchSwitch: 'SW-Branch',
      branchPc: (index: number) => `PC-Branch-${index}`,
    },
    places: {
      backupCarrier: 'Backup carrier',
      headOffice: 'Head office',
      headOfficeFloor: (floor: number) => `Head office, floor ${floor}`,
      branch: 'Branch',
    },
    /** Ports named for where they lead */
    ports: {
      toHeadOffice: 'To the head office',
      toBranch: 'To the branch',
      headOfficeNetwork: 'Head office network',
      branchNetwork: 'Branch network',
    },
    /** The two lines between the sites: the label of each cable, and the name of the ports it joins */
    cables: {
      mainLine: 'Main line',
      backupLine: 'Backup line',
    },
    /** Where each route leads, and over which line */
    notes: {
      headOffice: 'head office',
      branch: 'branch',
      headOfficeMainLine: 'head office, main line',
      headOfficeBackupLine: 'head office, backup line',
      branchMainLine: 'branch, main line',
      branchBackupLine: 'branch, backup line',
    },
  },
  multinational: {
    sites: {
      milan: 'Milan · Head office',
      rome: 'Rome · Office',
      disasterRecovery: 'Bologna · Disaster recovery DC',
      turin: 'Turin · Branch',
      venice: 'Venice · Branch',
      florence: 'Florence · Branch',
      naples: 'Naples · Branch',
      bari: 'Bari · Warehouse',
      palermo: 'Palermo · Shop',
      cagliari: 'Cagliari · Branch',
    },
    areas: {
      internet: 'Internet',
      dmz: 'DMZ',
      serverRoom,
      floor: (n: number) => `Floor ${n}`,
    },
    carrier: 'MPLS network',
    devices: {
      customer: 'Customer',
      remoteWorker: 'Remote worker',
      guest: (site: string, n: number) => `Guest-${site}-${n}`,
    },
    vlans: {
      default: 'Default',
      users: 'Users',
      voice: 'Voice',
      guests: 'Guests',
      cameras: 'Cameras',
      tills: 'Tills',
    },
    ports: {
      inside: 'Internal',
      servers: 'Servers',
      lan: 'LAN',
      shop: 'Shop',
      ofVlan: (name: string, vlan: number) => `${name} (VLAN ${vlan})`,
      lineTo: (place: string) => `Line to ${place}`,
    },
    places: {
      milan: 'Milan',
      rome: 'Rome',
      disasterRecovery: 'DR DC',
      turin: 'Turin',
      venice: 'Venice',
      florence: 'Florence',
      naples: 'Naples',
      bari: 'Bari',
      palermo: 'Palermo',
      cagliari: 'Cagliari',
    },
    cables: {
      mainLine: 'Main line',
      drFibre: 'DR fibre',
    },
    notes: {
      viaMainLine: (place: string) => `${place}, main line`,
      viaBackup: (place: string) => `${place}, backup over MPLS`,
      branch: (place: string) => `${place} branch`,
      company: 'company network',
      otherSites: 'the other sites, through the WAN router',
      headOfficeGuests: 'the head office guests, behind the firewall',
      shopGuests: 'guests of the Palermo shop',
      publicSite: 'public website',
      incomingMail: 'incoming mail',
      publicDns: 'public DNS',
      vpn: 'remote access',
      guestsNeverInside: 'guests never reach the company network',
      guestsAskPublicDns: 'guests ask the public DNS for names',
      guestsBrowse: 'guests browse the web',
      publicSiteFromOutside: 'the public website, from outside',
      mailFromOutside: 'incoming mail, from outside',
      dnsFromOutside: 'the public DNS, from outside',
      vpnFromOutside: 'remote access, from outside',
      vpnToApplications: 'from remote access, the internal web applications',
      proxyBrowses: 'the proxy browses for the staff',
      staffThroughProxy: 'the staff browse only through the proxy',
      siteReadsErp: 'the website reads the catalogue from the ERP',
      camerasOnlyRecorder: 'cameras talk only to the recorder, on their own network',
      sensorsToArchive: 'the sensors send their data to the archive in Milan',
      sensorsNothingElse: 'and nothing else',
      tillsToServer: 'the tills talk to their server in Milan',
      tillsNothingElse: 'and to nothing else',
      guestsOut: 'then out to the Internet, through Milan',
    },
    hostNames: {
      erp: 'erp.group.example',
      mail: 'mail.group.example',
      intranet: 'intranet.group.example',
      files: 'files.group.example',
      tills: 'tills.group.example',
      www: 'www.group.example',
      vpn: 'vpn.group.example',
    },
  },
};
