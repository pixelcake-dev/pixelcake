/**
 * Words kept with a template that the interface shows in its own language.
 *
 * The link types the app comes with are stored with a description, and the
 * user can rewrite it. For as long as it is one the app wrote (in any of its
 * languages: a link type saved from the English interface keeps the English
 * one), the description follows the language of the interface. Once the
 * user has changed it, it is content, and is shown as typed.
 */

import { LANGUAGES, dictionaryOf, type Dictionary } from '@/i18n';
import type { ConnectionTemplate } from '@/types/network';

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

  const writtenByTheApp = LANGUAGES.some(
    (language) => dictionaryOf(language).templates.links.builtInDescriptions[builtIn] === description
  );
  return writtenByTheApp ? t.templates.links.builtInDescriptions[builtIn] : description;
}
