/**
 * Which drawing a device is shown with, and the states its upper layer can
 * tell. The drawings themselves are data (data/deviceDrawings.ts, generated
 * from the files of assets/device-drawings).
 *
 * Pure: no React, no stores.
 */

import { DEVICE_DRAWINGS, type DeviceDrawingId } from '@/data/deviceDrawings';

/**
 * What the upper layer of a drawing says, by its colour:
 *
 *  - rest:     nothing to say
 *  - selected: the device is selected
 *  - ok:       the answer on screen arrives here
 *  - warning:  something of the device is to be put right
 *  - error:    the answer on screen stops here
 *  - off:      the device is taken as broken
 */
export type DeviceState = 'rest' | 'selected' | 'ok' | 'warning' | 'error' | 'off';

/** The drawing of each template the app comes with */
export const DRAWING_OF_TEMPLATE: Readonly<Record<string, DeviceDrawingId>> = {
  'tpl-pc': 'pc',
  'tpl-switch': 'switch',
  'tpl-router': 'router',
  'tpl-server': 'server',
  'tpl-firewall': 'firewall',
  'tpl-accesspoint': 'access-point',
  'tpl-loadbalancer': 'load-balancer',
  'tpl-database': 'database',
  'tpl-cloud': 'cloud',
  'tpl-mailserver': 'server-mail',
  'tpl-vps': 'server-vps',
  'tpl-webserver': 'server-web',
  'tpl-proxy': 'server-proxy',
  'tpl-storage-s3': 'storage-s3',
  'tpl-nas': 'nas',
  'tpl-dnsserver': 'server-dns',
  'tpl-dhcpserver': 'server-dhcp',
  'tpl-iotgateway': 'iot',
  'tpl-ipcamera': 'telecamera-ip',
  'tpl-printer': 'stampante',
  'tpl-laptop': 'laptop',
  'tpl-smartphone': 'smartphone',
  'tpl-tablet': 'tablet',
  'tpl-ipphone': 'telefono-ip',
};

/** The drawing of each base type: what a device of no known template is shown with */
export const DRAWING_OF_TYPE: Readonly<Record<string, DeviceDrawingId>> = {
  PC: 'pc',
  Switch: 'switch',
  Router: 'router',
  Server: 'server',
  Firewall: 'firewall',
  AccessPoint: 'access-point',
  LoadBalancer: 'load-balancer',
  Database: 'database',
  Cloud: 'cloud',
};

/** What a device of a type the app does not know is shown with */
export const FALLBACK_DRAWING: DeviceDrawingId = 'server';

export function isDrawingId(value: unknown): value is DeviceDrawingId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DEVICE_DRAWINGS, value);
}

/**
 * The drawing of a device, from its template (which may be missing) and its
 * type. The template says it with its `icon`, when that names one of the
 * drawings; a template with anything else there (one made before the
 * drawings, when an icon was a name of the Iconify sets) is shown with its
 * own drawing if the app comes with it, else with the one of its base type.
 */
export function drawingOf(
  template: { id?: string; icon?: string; type?: string } | undefined,
  type: string
): DeviceDrawingId {
  if (template && isDrawingId(template.icon)) return template.icon;
  return (
    (template?.id ? DRAWING_OF_TEMPLATE[template.id] : undefined) ??
    DRAWING_OF_TYPE[template?.type ?? type] ??
    DRAWING_OF_TYPE[type] ??
    FALLBACK_DRAWING
  );
}
