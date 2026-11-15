import type { Dictionary } from '../dictionary';
import { formatCount } from '../numbers';

/** A number of things as English writes it ("14,891") */
const amount = (value: number) => formatCount('en', value);

/** Reading a project file: what was repaired, what is wrong */

/** What is said of one board of the file: its name comes first */
const inCanvas = (canvasName: string, what: string) => `Board “${canvasName}”: ${what}`;

export const projectFile: Dictionary['projectFile'] = {
  /** A file that cannot be opened: what is wrong with it */
  errors: {
    notJson: 'The file is not valid JSON.',
    notProject: 'The file is not a PixelCake project (the "format" field is missing or not recognised).',
    versionNotValid: 'The file states a format version that is not valid.',
    newerVersion: (version: number) =>
      `The file was made with a newer version of PixelCake (format ${version}): ` +
      'update the app to open it.',
    noCanvases: 'The project has no boards.',
    canvasNotValid: (number: number) => `Board ${number} in the file is not valid.`,
    noDeviceList: (canvasName: string) =>
      inCanvas(canvasName, 'the list of devices ("devices") is missing.'),
    noConnectionList: (canvasName: string) =>
      inCanvas(canvasName, 'the list of links ("connections") is missing.'),
    unreadable: 'The file cannot be read: its content is not valid.',
  },

  /** A file that was opened: what was put right on the way */
  repairs: {
    noVersion: 'Format version not stated: the file was read as version 1.',
    noProjectName: (givenName: string) => `Project name missing: “${givenName}” used.`,
    noDescription: 'Project description missing: left empty.',

    noSettings: 'Network settings missing: default values used.',
    incompleteSettings: 'Network settings incomplete: completed with the default values.',
    defaultDnsNotValid: 'Default DNS server not valid: ignored.',
    vlanListNotValid: 'List of VLAN names not valid: ignored.',
    vlanNamesDropped: (count: number) =>
      count === 1
        ? '1 invalid or duplicate VLAN name ignored.'
        : `${amount(count)} invalid or duplicate VLAN names ignored.`,
    vlanNamesCut: (count: number, maxLength: number) =>
      count === 1
        ? `1 VLAN name too long, shortened to ${amount(maxLength)} characters.`
        : `${amount(count)} VLAN names too long, shortened to ${amount(maxLength)} characters.`,

    canvasUnnamed: (number: number, givenName: string) =>
      `Board ${number} has no name: named “${givenName}”.`,
    devicesDropped: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1
          ? '1 invalid or duplicate device ignored.'
          : `${amount(count)} invalid or duplicate devices ignored.`
      ),
    devicesRepaired: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1 ? '1 incomplete device repaired.' : `${amount(count)} incomplete devices repaired.`
      ),
    connectionsDropped: (canvasName: string, count: number) =>
      inCanvas(canvasName, count === 1 ? '1 invalid link ignored.' : `${amount(count)} invalid links ignored.`),
    connectionsDuplicate: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1
          ? '1 link with a duplicate ID removed.'
          : `${amount(count)} links with a duplicate ID removed.`
      ),
    connectionsDetached: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1
          ? '1 link to a device that does not exist removed.'
          : `${amount(count)} links to devices that do not exist removed.`
      ),
    areasDropped: (canvasName: string, count: number) =>
      inCanvas(canvasName, count === 1 ? '1 invalid area ignored.' : `${amount(count)} invalid areas ignored.`),
    areasRepaired: (canvasName: string, count: number) =>
      inCanvas(
        canvasName,
        count === 1 ? '1 incomplete area repaired.' : `${amount(count)} incomplete areas repaired.`
      ),
    viewReset: (canvasName: string) =>
      inCanvas(canvasName, 'view missing or not valid, reset to the starting position.'),
    countersRaised: (canvasName: string) =>
      inCanvas(canvasName, 'ID counters missing or too low, recalculated.'),
    canvasIdsGiven: (count: number) =>
      count === 1
        ? '1 board with a missing or duplicate ID: given a new ID.'
        : `${amount(count)} boards with a missing or duplicate ID: given new IDs.`,
    activeCanvasNotFound: (openedName: string) => `Active board not found: “${openedName}” opened.`,

    noTemplateList: 'List of custom templates missing: no template imported.',
    templatesDropped: (count: number) =>
      count === 1
        ? '1 invalid custom template ignored.'
        : `${amount(count)} invalid custom templates ignored.`,
  },
};
