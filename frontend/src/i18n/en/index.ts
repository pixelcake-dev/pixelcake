/**
 * The English dictionary. Each namespace is typed on the Italian one: a
 * missing entry, or one of another kind, does not compile.
 */

import type { Dictionary } from '../dictionary';
import { common } from './common';
import { welcome } from './welcome';
import { menu } from './menu';
import { sidebar } from './sidebar';
import { explorer } from './explorer';
import { devicePanel } from './devicePanel';
import { simulation } from './simulation';
import { canvas } from './canvas';
import { contextMenu } from './contextMenu';
import { addDevice } from './addDevice';
import { inspector } from './inspector';
import { interfaces } from './interfaces';
import { routes } from './routes';
import { firewall } from './firewall';
import { nat } from './nat';
import { dhcp } from './dhcp';
import { dns } from './dns';
import { vlan } from './vlan';
import { connection } from './connection';
import { settings } from './settings';
import { networkSettings } from './networkSettings';
import { advanced } from './advanced';
import { templates } from './templates';
import { newProject } from './newProject';
import { project } from './project';
import { files } from './files';
import { projectFile } from './projectFile';
import { importExport } from './importExport';
import { exportImage } from './exportImage';
import { presentation } from './presentation';
import { terminal } from './terminal';
import { help } from './help';
import { ui } from './ui';
import { samples } from './samples';

export const en: Dictionary = {
  common,
  welcome,
  menu,
  sidebar,
  explorer,
  devicePanel,
  simulation,
  canvas,
  contextMenu,
  addDevice,
  inspector,
  interfaces,
  routes,
  firewall,
  nat,
  dhcp,
  dns,
  vlan,
  connection,
  settings,
  networkSettings,
  advanced,
  templates,
  newProject,
  project,
  files,
  projectFile,
  importExport,
  exportImage,
  presentation,
  terminal,
  help,
  ui,
  samples,
};
