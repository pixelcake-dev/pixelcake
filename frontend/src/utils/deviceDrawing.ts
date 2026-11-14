/**
 * Which drawing a device is shown with, and the states its upper layer can
 * tell. The drawings themselves are data (data/deviceDrawings.ts, generated
 * from the files of assets/device-drawings).
 *
 * Pure: no React, no stores.
 */

import {
  DEVICE_DRAWINGS,
  DEVICE_DRAWING_CUT,
  DEVICE_DRAWING_SIZE,
  type DeviceDrawingId,
} from '@/data/deviceDrawings';

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

/**
 * The drawing of a device among these templates: by the template it was made
 * from, else by the first template of its type (as the canvas has always
 * chosen the template of a device)
 */
export function drawingOfDevice(
  device: { templateId?: string; type: string },
  templates: ReadonlyArray<{ id: string; icon: string; type: string }>
): DeviceDrawingId {
  const template = device.templateId
    ? templates.find((entry) => entry.id === device.templateId)
    : templates.find((entry) => entry.type === device.type);
  return drawingOf(template, device.type);
}

/** The three colours a drawing is made of */
export interface DrawingColours {
  /** The lower layer */
  lower: string;
  /** The upper layer: the colour of the state */
  state: string;
  /** What is behind the drawing: the symbol and the cut are of this colour */
  ground: string;
}

/**
 * A drawing as markup for the inside of an `<svg>` 128 units wide and high,
 * with its colours written in: what the exported picture is made of. Built
 * as DeviceDrawing builds it on screen: the shapes whole, then in a window as
 * high as the upper layer, then in a window as high as the cut.
 */
export function drawingMarkup(drawing: DeviceDrawingId, colours: DrawingColours): string {
  const { layer, shapes } = DEVICE_DRAWINGS[drawing];
  const paint = (device: string, onIt: string) =>
    shapes.replaceAll('class="l"', `fill="${device}"`).replaceAll('class="g"', `fill="${onIt}"`);
  const cutTop = layer - DEVICE_DRAWING_CUT / 2;
  return (
    `<g>${paint(colours.lower, colours.ground)}</g>` +
    `<svg width="${DEVICE_DRAWING_SIZE}" height="${layer}" viewBox="0 0 ${DEVICE_DRAWING_SIZE} ${layer}">${paint(colours.state, colours.ground)}</svg>` +
    `<svg y="${cutTop}" width="${DEVICE_DRAWING_SIZE}" height="${DEVICE_DRAWING_CUT}" viewBox="0 ${cutTop} ${DEVICE_DRAWING_SIZE} ${DEVICE_DRAWING_CUT}">${paint(colours.ground, colours.ground)}</svg>`
  );
}
