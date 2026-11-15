/**
 * Words kept with a template that the interface shows in its own language.
 *
 * The link types the app comes with are stored with a description, and the
 * user can rewrite it. For as long as it is one the app wrote (in any of its
 * languages: a link type saved from the English interface keeps the English
 * one; in any of its versions: the words have been changed since, and a
 * browser may still hold the earlier ones), the description follows the
 * language of the interface. Once the user has changed it, it is content,
 * and is shown as typed.
 */

import { LANGUAGES, dictionaryOf, type Dictionary } from '@/i18n';
import { formerLinkTypeDescriptions as formerItalian } from '@/i18n/it/former';
import { formerLinkTypeDescriptions as formerEnglish } from '@/i18n/en/former';
import type { ConnectionTemplate, DeviceType } from '@/types/network';

type BuiltInLinkType = keyof Dictionary['templates']['links']['builtInDescriptions'];

/** The link types the app comes with, by the id of their template (store/templateStore.ts) */
const BUILT_IN_LINK_TYPES: ReadonlyMap<string, BuiltInLinkType> = new Map<string, BuiltInLinkType>([
  ['conn-access', 'access'],
  ['conn-trunk', 'trunk'],
  ['conn-uplink', 'uplink'],
  ['conn-backbone', 'backbone'],
  ['conn-mpls', 'mpls'],
]);

/**
 * The description of a link type as the interface shows it, in the words of
 * `t` (the dictionary in use: `useT()` in a component).
 */
export function linkTypeDescription(
  template: Pick<ConnectionTemplate, 'id' | 'description'>,
  t: Dictionary
): string | undefined {
  const { description } = template;
  const builtIn = BUILT_IN_LINK_TYPES.get(template.id);
  if (!builtIn || !description) return description;

  const writtenByTheApp =
    LANGUAGES.some(
      (language) => dictionaryOf(language).templates.links.builtInDescriptions[builtIn] === description
    ) || [formerItalian, formerEnglish].some((former) => former[builtIn]?.includes(description));
  return writtenByTheApp ? t.templates.links.builtInDescriptions[builtIn] : description;
}

type TypeDescriptions = Dictionary['devicePanel']['descriptions'];
type SpecialisedDescriptions = Dictionary['devicePanel']['specialised'];

/** Where the dictionary keeps what a device of each built-in type is */
const DESCRIPTION_OF_TYPE: ReadonlyMap<DeviceType, keyof TypeDescriptions> = new Map<
  DeviceType,
  keyof TypeDescriptions
>([
  ['PC', 'pc'],
  ['Switch', 'switch'],
  ['Router', 'router'],
  ['Server', 'server'],
  ['Firewall', 'firewall'],
  ['AccessPoint', 'accessPoint'],
  ['LoadBalancer', 'loadBalancer'],
  ['Database', 'database'],
  ['Cloud', 'cloud'],
]);

/**
 * The built-in device templates that are a kind of one of those types, by
 * their id (store/templateStore.ts): each says what it is, not what it is
 * built on. An IoT gateway is drawn and set as an access point, and is not
 * one; a printer is an end device, and not "for users".
 */
const DESCRIPTION_OF_TEMPLATE: ReadonlyMap<string, keyof SpecialisedDescriptions> = new Map<
  string,
  keyof SpecialisedDescriptions
>([
  ['tpl-mailserver', 'mailServer'],
  ['tpl-vps', 'vps'],
  ['tpl-webserver', 'webServer'],
  ['tpl-proxy', 'proxy'],
  ['tpl-storage-s3', 'objectStorage'],
  ['tpl-nas', 'nas'],
  ['tpl-dnsserver', 'dnsServer'],
  ['tpl-dhcpserver', 'dhcpServer'],
  ['tpl-iotgateway', 'iotGateway'],
  ['tpl-ipcamera', 'ipCamera'],
  ['tpl-printer', 'printer'],
  ['tpl-laptop', 'laptop'],
  ['tpl-smartphone', 'smartphone'],
  ['tpl-tablet', 'tablet'],
  ['tpl-ipphone', 'ipPhone'],
]);

/**
 * What a built-in device template is, under its name in the panel that adds
 * devices, in the words of `t`: its own when it has them, else those of its
 * type.
 */
export function deviceTemplateDescription(template: { id: string; type: DeviceType }, t: Dictionary): string {
  const own = DESCRIPTION_OF_TEMPLATE.get(template.id);
  if (own) return t.devicePanel.specialised[own];
  return t.devicePanel.descriptions[DESCRIPTION_OF_TYPE.get(template.type) ?? 'other'];
}
