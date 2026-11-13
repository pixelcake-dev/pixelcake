/**
 * What a test can tell about the space between the fields of a form.
 *
 * jsdom does not lay a page out: there is no distance to measure. What it
 * does show is who gives the fields their distance. An `Input` has no space
 * of its own around it, so a field is apart from the one above only when the
 * two are separate children of a container that puts a gap between its
 * children (FormContainer, a grid). That is what is checked here.
 */

import { expect } from 'vitest';

/** The closest element around this one that puts a gap between its children */
function gapContainer(element: HTMLElement): HTMLElement | null {
  return element.parentElement?.closest<HTMLElement>('[class*="gap-"]') ?? null;
}

/**
 * No label of these fields is glued to the field above it: each field is a
 * child of its own of one container, and the container has a gap.
 */
export function expectSpacedApart(fields: HTMLElement[]): void {
  const containers = new Set(fields.map(gapContainer));
  expect(containers.size, 'the fields are in one container').toBe(1);
  const [container] = containers;
  if (!container) throw new Error('nothing around the fields puts a gap between them');
  expect(container.className, 'the gap of the container').toMatch(/(^|\s)gap-[1-9]/);

  const children = Array.from(container.children);
  const places = fields.map(field => children.findIndex(child => child.contains(field)));
  expect(new Set(places).size, 'each field is a child of its own').toBe(fields.length);
}
