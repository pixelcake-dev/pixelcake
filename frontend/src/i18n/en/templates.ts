import type { Dictionary } from '../dictionary';

/** Device and link templates: lists and editors */

/** The button that adds a link type: the empty list names it */
const newLinkType = 'New link type';

export const templates: Dictionary['templates'] = {
  title: 'Templates',

  /** The two kinds of template, each in its own tab */
  kinds: {
    links: 'Links',
    devices: 'Devices',
  },

  devices: {
    tabs: {
      generic: 'Generic devices',
      custom: 'Custom devices',
    },

    /** Fields the editor of a generic template and the form of a custom one share */
    baseType: 'Base type',
    /** The drawing a device of the template is shown with, chosen among those of the app */
    drawing: 'Drawing',
    /** The groups the drawings are shown in, those of the kit they come from */
    drawingGroups: {
      rete: 'Network',
      server: 'Servers',
      dati: 'Data',
      dispositivi: 'End devices',
    },
    /** The name of each drawing, as the kit calls it: the title of its choice, and its name for a screen reader */
    drawingNames: {
      router: 'Router',
      switch: 'Switch',
      firewall: 'Firewall',
      'access-point': 'Access point',
      'load-balancer': 'Load balancer',
      cloud: 'Cloud / Internet',
      server: 'Server',
      'server-mail': 'Mail server',
      'server-web': 'Web server',
      'server-vps': 'VPS server',
      'server-proxy': 'Proxy server',
      'server-dns': 'DNS server',
      'server-dhcp': 'DHCP server',
      database: 'Database',
      'storage-s3': 'S3 storage',
      nas: 'NAS',
      pc: 'PC',
      laptop: 'Laptop',
      smartphone: 'Smartphone',
      tablet: 'Tablet',
      'telefono-ip': 'IP phone',
      stampante: 'Printer',
      'telecamera-ip': 'IP camera',
      iot: 'IoT device',
    },

    generic: {
      intro: 'Built-in devices, ready to use',
      add: 'New template',
      edit: 'Edit template',
      delete: 'Delete template',
      deleteQuestion: {
        title: (name: string) => `Delete the template “${name}”?`,
        detail: 'Existing devices of this type may no longer be drawn as before.',
      },
    },

    editor: {
      titleEdit: 'Edit generic template',
      titleNew: 'New generic template',
      saveChanges: 'Save changes',
      create: 'Create template',
      name: 'Name',
      namePlaceholder: 'e.g. PC, Printer, IoT device',
      chooseType: '-- Select a type --',
      typeLocked: 'The type cannot be changed, to avoid problems with existing devices.',
      errors: {
        nameRequired: 'The name is required',
        typeRequired: 'The base type is required',
        typeExists: 'This type already exists among the generic templates',
      },
    },

    custom: {
      intro: 'Custom templates with Terraform fields',
      add: 'New template',
      formTitle: 'Create new template',
      name: 'Template name',
      namePlaceholder: 'e.g. AWS EC2 Instance',
      save: 'Save template',
      empty: 'No custom templates. Create one.',
      deleteQuestion: 'Delete this template?',
    },
  },

  links: {
    intro: 'Link types you can use between devices',
    add: newLinkType,
    edit: 'Edit link type',
    delete: 'Delete link type',
    empty: 'No link types available',
    emptyHint: `Click “${newLinkType}” to start`,
    deleteQuestion: {
      title: (name: string) => `Delete the link type “${name}”?`,
      detail: 'Existing links of this type may no longer be drawn as before.',
    },

    editor: {
      titleEdit: 'Edit link type',
      titleNew: newLinkType,
      saveChanges: 'Save changes',
      create: 'Create type',
      name: 'Name',
      namePlaceholder: 'e.g. Trunk, Access, WAN',
      typeId: 'Type ID',
      typeIdPlaceholder: 'e.g. trunk, access, wan',
      typeIdHint: 'Unique identifier (lower case, no spaces). It cannot be changed once created.',
      description: 'Description',
      descriptionPlaceholder: 'e.g. Trunk link between switches',
      colour: 'Colour',
      lineStyle: 'Line style',
      lineStyles: {
        solid: 'Solid',
        dashed: 'Dashed',
        dotted: 'Dotted',
      },
      thickness: 'Thickness',
      thicknessHint: 'From 1 to 10 pixels.',
      preview: 'Preview',
      errors: {
        nameRequired: 'The name is required',
        typeRequired: 'The type is required',
        typeExists: 'This type already exists',
        invalidColour: 'Invalid colour (format: #RRGGBB)',
        thicknessOutOfRange: 'The thickness must be between 1 and 10',
      },
    },

    /**
     * What each link type the app comes with is for. The Italian ones are
     * also what the browser keeps with those templates (store/templateStore.ts);
     * utils/templateText.ts shows them in the language of the interface for
     * as long as the user has not rewritten them.
     */
    builtInDescriptions: {
      access: 'Access link to end devices',
      trunk: 'Trunk link between switches',
      uplink: 'Uplink to core/Internet',
      backbone: 'Critical infrastructure',
      mpls: 'MPLS WAN link',
    },
  },
};
