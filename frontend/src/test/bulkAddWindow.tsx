/**
 * For tests of the window that adds devices in bulk (BulkAddDeviceModal):
 * open it, read its rows, press what a user presses.
 *
 * The rows and their controls are found by their classes, and the templates
 * by their names, which are data: nothing here depends on the wording of the
 * interface.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import BulkAddDeviceModal from '@/components/Modals/BulkAddDeviceModal';

/** The DNS server of the project in these tests */
export const PROJECT_DNS = '192.168.1.53';

/** An empty canvas, with the network of the project as it starts and a DNS server */
export function emptyCanvas() {
  useNetworkStore.getState().clearAllDevices();
  useNetworkStore.getState().setGlobalNetworkSettings({
    ipClass: '192.168.1.0',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    dns: PROJECT_DNS,
  });
}

export function openBulkWindow() {
  useUIStore.getState().openModal('bulkAddDevice');
  return render(<BulkAddDeviceModal />);
}

// ---- the rows of the standard devices

export const standardRows = () =>
  Array.from(document.querySelectorAll<HTMLTableRowElement>('.standard-section tbody tr'));

/** The name a row shows: the name of its template */
export const nameOfRow = (row: Element) => row.querySelector('.type-cell span')?.textContent ?? '';

export function rowOf(name: string) {
  const row = standardRows().find((entry) => nameOfRow(entry) === name);
  if (!row) throw new Error(`no row «${name}»`);
  return row;
}

/** The field of a row, standard or configurable, where its quantity is typed */
export const quantityField = (row: Element) => row.querySelector<HTMLInputElement>('.quantity-input')!;

/** The two buttons of a standard row: one less, one more */
export const less = (name: string) => rowOf(name).querySelectorAll<HTMLButtonElement>('.quantity-btn')[0];
export const more = (name: string) => rowOf(name).querySelectorAll<HTMLButtonElement>('.quantity-btn')[1];

/** The standard rows whose quantity is not 0, as «name=quantity» */
export const raised = () =>
  standardRows()
    .filter((row) => quantityField(row).value !== '0')
    .map((row) => `${nameOfRow(row)}=${quantityField(row).value}`);

// ---- the rows of the configurable devices

export const configurableRows = () =>
  Array.from(document.querySelectorAll<HTMLTableRowElement>('.configurable-section tbody tr'));

/** What the menu that adds a configurable row offers */
export function configurableChoices() {
  if (!document.querySelector('.add-menu')) fireEvent.click(document.querySelector('.add-row-btn')!);
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.add-menu-item'));
}

/** Add a row for a template of that menu, and return it */
export function addConfigurable(name: string) {
  const entry = configurableChoices().find((item) => item.textContent?.trim() === name);
  if (!entry) throw new Error(`«${name}» is not in the menu`);
  fireEvent.click(entry);
  return configurableRows()[configurableRows().length - 1];
}

/** The numbers of ports a configurable row lets one choose */
export const portChoices = (row: Element) =>
  Array.from(row.querySelectorAll<HTMLOptionElement>('.config-select option')).map((option) => option.value);

// ---- the rest of the window

/** The field of the search: the one field of the window that is not a quantity */
export const searchField = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('input')).find(
    (input) => !input.classList.contains('quantity-input')
  )!;

/** The button that adds: it says how many devices */
export const addButton = () => screen.getByRole<HTMLButtonElement>('button', { name: /\(\d+\)$/ });

/** How many devices the button that adds says */
export const total = () => Number(/\((\d+)\)$/.exec(addButton().textContent ?? '')?.[1]);
