/**
 * templateStore — the templates the app comes with, and what it reads from
 * a browser that kept those of an older version: nothing kept is lost, and
 * the templates added since are there.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DeviceTemplate } from '@/types';
import {
  TEMPLATE_STORAGE_VERSION,
  migrateTemplateStorage,
  useTemplateStore,
} from './templateStore';

const KEY = 'pixelcake-templates-v8';
const store = () => useTemplateStore.getState();
const byId = (id: string) => store().templates.find((template) => template.id === id);

/** The templates the app comes with, as a new browser gets them */
let DEFAULTS: DeviceTemplate[] = [];

beforeEach(() => {
  localStorage.clear();
  store().loadDefaultTemplates();
  store().loadDefaultConnectionTemplates();
  DEFAULTS = store().templates;
});

const NEW_END_DEVICES = ['tpl-laptop', 'tpl-smartphone', 'tpl-tablet', 'tpl-ipphone'];

describe('the templates the app comes with', () => {
  it('are twenty-four, each with an id and a name of its own', () => {
    expect(DEFAULTS).toHaveLength(24);
    expect(new Set(DEFAULTS.map((template) => template.id)).size).toBe(24);
    expect(new Set(DEFAULTS.map((template) => template.name)).size).toBe(24);
    expect(DEFAULTS.every((template) => !template.isCustom)).toBe(true);
  });

  it('a laptop, a smartphone, a tablet and an IP phone are end devices with one card, as the printer is', () => {
    const printer = byId('tpl-printer')!;
    expect(NEW_END_DEVICES.map((id) => byId(id)?.name)).toEqual(['Laptop', 'Smartphone', 'Tablet', 'IP Phone']);
    for (const id of NEW_END_DEVICES) {
      const { id: _id, name: _name, icon: _icon, ...kind } = byId(id)!;
      const { id: _printerId, name: _printerName, icon: _printerIcon, ...printerKind } = printer;
      void [_id, _name, _icon, _printerId, _printerName, _printerIcon];
      expect(kind, id).toEqual(printerKind);
    }
    expect(byId('tpl-laptop')).toMatchObject({ type: 'PC', supportsNICs: true, supportsPorts: false });
  });

  it('they come after the ones that were there, which keep their order: a PC is still the first end device', () => {
    const ids = DEFAULTS.map((template) => template.id);
    expect(ids.slice(-4)).toEqual(NEW_END_DEVICES);
    expect(ids.slice(0, 20)).toEqual([
      'tpl-pc',
      'tpl-switch',
      'tpl-router',
      'tpl-server',
      'tpl-firewall',
      'tpl-accesspoint',
      'tpl-loadbalancer',
      'tpl-database',
      'tpl-cloud',
      'tpl-mailserver',
      'tpl-vps',
      'tpl-webserver',
      'tpl-proxy',
      'tpl-storage-s3',
      'tpl-nas',
      'tpl-dnsserver',
      'tpl-dhcpserver',
      'tpl-iotgateway',
      'tpl-ipcamera',
      'tpl-printer',
    ]);
    // (a device of type PC with no template is shown as the first template of its type)
    expect(DEFAULTS.find((template) => template.type === 'PC')?.id).toBe('tpl-pc');
  });
});

describe('what a browser kept from an older version', () => {
  const custom: DeviceTemplate = {
    id: 'tpl-1700000000000',
    name: 'Centralino',
    type: 'Server',
    icon: 'mdi:phone',
    color: '#aa5500',
    isCustom: true,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  };
  /** The twenty templates of before, one of them renamed by the user, and one of the user's own */
  const old = () => ({
    templates: [
      ...DEFAULTS.slice(0, 20).map((template) =>
        template.id === 'tpl-pc' ? { ...template, name: 'Postazione' } : template
      ),
      custom,
    ],
    connectionTemplates: store().connectionTemplates.slice(0, 2),
  });

  it('counts versions from 1; what was kept before had none, which reads as 0', () => {
    expect(TEMPLATE_STORAGE_VERSION).toBe(1);
    expect(useTemplateStore.persist.getOptions().version).toBe(TEMPLATE_STORAGE_VERSION);
    expect(useTemplateStore.persist.getOptions().name).toBe(KEY);
  });

  it('gets the four new end devices, after everything that was there', () => {
    const kept = old();
    const read = migrateTemplateStorage(kept, 0);

    expect(read.templates.slice(0, 21)).toEqual(kept.templates);
    expect(read.templates.slice(21).map((template) => template.id)).toEqual(NEW_END_DEVICES);
    expect(read.templates.slice(21)).toEqual(DEFAULTS.slice(-4));
    // what the user made and what the user changed are as they were
    expect(read.templates.find((template) => template.id === custom.id)).toEqual(custom);
    expect(read.templates.find((template) => template.id === 'tpl-pc')?.name).toBe('Postazione');
    expect(read.connectionTemplates).toEqual(kept.connectionTemplates);
  });

  it('adds nothing twice: one of the new templates that is there already is left as it is', () => {
    const kept = old();
    const mine = { ...DEFAULTS.find((template) => template.id === 'tpl-tablet')!, name: 'Tavoletta' };
    kept.templates.push(mine);

    const read = migrateTemplateStorage(kept, 0);

    expect(read.templates.filter((template) => template.id === 'tpl-tablet')).toEqual([mine]);
    expect(read.templates).toHaveLength(21 + 1 + 3);
  });

  it('leaves alone what this version kept', () => {
    const kept = { templates: [custom], connectionTemplates: [] };
    expect(migrateTemplateStorage(kept, TEMPLATE_STORAGE_VERSION)).toEqual(kept);
  });

  it('reads something that is not what it expects as a new browser would', () => {
    for (const odd of [null, undefined, 'x', 7, {}, { templates: 'no', connectionTemplates: 3 }]) {
      const read = migrateTemplateStorage(odd, 0);
      expect(read.templates).toEqual(DEFAULTS);
      expect(read.connectionTemplates.length).toBeGreaterThan(0);
    }
  });

  it('is read so when the app starts: the storage of before, then the store', async () => {
    const kept = old();
    // (as the app of before wrote it: with no version, which the store read as 0)
    localStorage.setItem(KEY, JSON.stringify({ state: kept, version: 0 }));

    await useTemplateStore.persist.rehydrate();

    expect(store().templates.map((template) => template.id)).toEqual([
      ...kept.templates.map((template) => template.id),
      ...NEW_END_DEVICES,
    ]);
    expect(byId(custom.id)).toMatchObject({ name: 'Centralino', icon: 'mdi:phone', isCustom: true });
    expect(byId('tpl-pc')?.name).toBe('Postazione');
    expect(byId('tpl-laptop')).toMatchObject({ name: 'Laptop', type: 'PC' });
    // and it is kept as this version keeps it
    store().updateTemplate(custom.id, { name: 'Centralino VoIP' });
    const written = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(written.version).toBe(TEMPLATE_STORAGE_VERSION);
    expect(written.state.templates).toHaveLength(25);
  });
});
