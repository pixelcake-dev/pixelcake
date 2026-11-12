# PixelCake project file, version 1

A PixelCake project is saved as a single JSON file with the extension
`.pixelcake.json`. The file is UTF-8, pretty-printed with two spaces, and ends
with a newline. It holds the whole project: its canvases with their devices
and connections, the project-wide network settings and the custom templates
the project may use.

The reference implementation is `frontend/src/utils/projectFile.ts`
(`serializeProject`, `parseProjectFile`); the TypeScript types are in
`frontend/src/types/project.ts` and `frontend/src/types/network.ts`.

## Example

```json
{
  "format": "pixelcake-project",
  "version": 1,
  "name": "Sede Milano",
  "description": "",
  "savedAt": "2026-11-11T12:00:00.000Z",
  "settings": {
    "ipClass": "192.168.1.0",
    "subnet": "255.255.255.0",
    "gateway": "192.168.1.1",
    "emailMode": "auto"
  },
  "activeCanvasId": "canvas-1",
  "canvases": [
    {
      "id": "canvas-1",
      "name": "Canvas 1",
      "devices": [
        {
          "id": "dev-0",
          "type": "Switch",
          "templateId": "tpl-switch",
          "label": "SW-1",
          "ip": "192.168.1.2",
          "subnet": "255.255.255.0",
          "gateway": "192.168.1.1",
          "position": { "x": 200, "y": 120 },
          "portCount": 2,
          "ports": [
            { "id": 1, "enabled": true, "vlan": 10, "portType": "access" },
            { "id": 2, "enabled": true }
          ]
        },
        {
          "id": "dev-1",
          "type": "PC",
          "templateId": "tpl-pc",
          "label": "PC-1",
          "ip": "192.168.1.10",
          "subnet": "255.255.255.0",
          "gateway": "192.168.1.1",
          "position": { "x": 80, "y": 300 },
          "nics": [
            {
              "id": "nic-1",
              "name": "eth0",
              "enabled": true,
              "speed": "auto",
              "ip": "192.168.1.10",
              "subnet": "255.255.255.0",
              "gateway": "192.168.1.1"
            }
          ]
        }
      ],
      "connections": [
        {
          "id": "conn-0",
          "source": "dev-1",
          "target": "dev-0",
          "sourceNic": "nic-1",
          "targetPort": 1,
          "type": "access"
        }
      ],
      "viewport": { "x": 0, "y": 0, "zoom": 1 },
      "deviceCounter": 2,
      "connectionCounter": 1
    }
  ],
  "templates": { "devices": [], "connections": [] }
}
```

## Top level

| Field | Type | Meaning |
|-------|------|---------|
| `format` | string | Always `"pixelcake-project"`. |
| `version` | integer | Version of this format. This document describes `1`. |
| `name` | string | Project name. |
| `description` | string | Free text, may be empty. |
| `savedAt` | string | When the file was written, ISO 8601 in UTC. Informational. |
| `settings` | object | Project-wide network settings, see below. |
| `activeCanvasId` | string | `id` of the canvas shown when the project is opened. |
| `canvases` | array | One or more canvases, in display order. |
| `templates` | object | Custom templates, see below. |

### `settings`

| Field | Type | Meaning |
|-------|------|---------|
| `ipClass` | string | Network address new devices are numbered in, e.g. `"192.168.1.0"`. |
| `subnet` | string | Default subnet mask. |
| `gateway` | string | Default gateway. |
| `emailMode` | `"auto"` \| `"internal"` \| `"cloud"` | Optional. How the email flow of the simulation is routed; a missing value means `"auto"`. |

## Canvas

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the project. The application creates ids of the form `canvas-N`. |
| `name` | string | Name shown in the explorer. |
| `devices` | array | Devices on the canvas. |
| `connections` | array | Links between devices of the same canvas. |
| `viewport` | object | Pan and zoom of the view: `x`, `y` (numbers) and `zoom` (number greater than 0). |
| `deviceCounter` | integer | Number the next device id (`dev-N`) will use. |
| `connectionCounter` | integer | Number the next connection id (`conn-N`) will use. |

Device and connection ids are unique within their canvas, not across the
project: two canvases may both contain a `dev-0`. A counter is always greater
than the number in every `dev-N` / `conn-N` id in use on its canvas, so a new
item never takes the id of an existing one.

### Device

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the canvas. |
| `type` | string | Device type, e.g. `PC`, `Switch`, `Router`, `Server`, `Firewall`, `AccessPoint`, `LoadBalancer`, `Database`, `Cloud`. |
| `templateId` | string | Optional. Template the device was created from (icon and display name). |
| `label` | string | Name of the device. |
| `ip`, `subnet`, `gateway` | string | Device-level address. For a device with NICs these mirror its first NIC. |
| `vendor`, `location` | string | Optional. |
| `position` | object | `x`, `y` on the canvas. |
| `vlan` | integer[] | Optional. VLAN ids the device carries. |
| `stp` | object | Optional. `enabled` (boolean), `mode` (`STP`, `RSTP`, `PVST+`, `MST`), `priority` (integer). |
| `portCount` | integer | Optional. Number of ports (switches, routers, firewalls). |
| `ports` | array | Optional. Per-port configuration, see below. |
| `nics` | array | Optional. Network interface cards (end devices), see below. |
| `routes` | array | Optional. Static routes of a router or firewall, see below. The device's `gateway` is its default route. |
| `firewallRules` | array | Optional. Rules of a firewall, in the order they are read: the first that matches decides. See below. |

Port:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | integer | Port number, unique within the device. |
| `name` | string | Optional. |
| `enabled` | boolean | Administrative state. |
| `speed` | `10M`, `100M`, `1G`, `2.5G`, `10G`, `auto` | Optional. |
| `vlan` | integer \| integer[] | Optional (switches). One VLAN for an access port, a list for a trunk. A trunk without a list carries every VLAN. Once any port of a switch has a VLAN, its ports without one are access ports in VLAN 1. |
| `portType` | `access`, `trunk`, `wan`, `lan`, `dmz` | Optional. `access` / `trunk` say how a switch port treats VLANs; the others are descriptive. |
| `poe` | boolean | Optional. |
| `description` | string | Optional. |
| `ip`, `subnet` | string | Optional. Layer 3 address of the port (routers, firewalls). |
| `nat` | boolean | Optional (routers). Kept as documentation: addresses are not translated. |
| `securityZone` | `trust`, `untrust`, `dmz` | Optional (firewalls). The zone the firewall policy and rules refer to. |
| `ips` | boolean | Optional (firewalls). Kept as documentation. |

NIC:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the device, e.g. `nic-1`. |
| `name` | string | Interface name, e.g. `eth0`. |
| `enabled` | boolean | Administrative state. |
| `speed` | `10M`, `100M`, `1G`, `2.5G`, `10G`, `auto` | Link speed. |
| `ip`, `subnet`, `gateway` | string | Address of the interface. |
| `mac`, `description` | string | Optional. |

Route:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the device, e.g. `route-1`. |
| `destination` | string | Network in CIDR form, e.g. `192.168.30.0/24`. `0.0.0.0/0` is a default route. |
| `nextHop` | string | Address the traffic is handed to. It must be on a network one of the device's ports is in, or the route cannot be used. |
| `description` | string | Optional. |

Firewall rule:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the device, e.g. `rule-1`. |
| `action` | `allow`, `deny` | What the rule does with the traffic it matches. |
| `service` | `any`, `ping`, `web`, `email` | The traffic it applies to. |
| `source`, `destination` | string | `any`, a zone (`trust`, `untrust`, `dmz`), an address or a network in CIDR form. |
| `enabled` | boolean | Optional. `false` switches the rule off; a rule is on when the field is missing. |
| `description` | string | Optional. |

Rules are read in the order of the array. When none matches, the zones of
the two ports decide: traffic towards a more trusted zone is denied
(`untrust` → `trust`, `untrust` → `dmz`, `dmz` → `trust`), the rest is
allowed.

### Connection

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the canvas. |
| `source`, `target` | string | Ids of the two devices, both on the same canvas. |
| `sourceHandle`, `targetHandle` | string \| null | Optional. Side of the device the line is drawn from. |
| `sourcePort`, `sourceNic` | integer, string | Optional. Port (`ports[].id`) or NIC (`nics[].id`) of the source device the link is attached to. |
| `targetPort`, `targetNic` | integer, string | Optional. The same for the target device. |
| `type` | string | Optional. Connection type, e.g. `access`, `trunk`, `uplink`, `backbone`, or the `type` of a custom connection template. |
| `bandwidth` | string | Optional. |
| `vlan` | integer[] | Optional. |
| `label`, `color` | string | Optional. |
| `stpPortState` | `forwarding`, `blocking`, `disabled`, `learning` | Optional. |
| `stpPortPriority` | integer | Optional. |

An end of a connection is attached to at most one interface: a port or a NIC,
never both. An interface is used by at most one connection.

## Templates

`templates.devices` and `templates.connections` hold the custom templates
defined in the application that saved the file (built-in templates are not
written). They let a project that uses a custom device or connection type be
opened on another installation.

Device template, in this order: `id`, `name`, `type`, `icon` (an Iconify icon
name), `color`, `terraformFields` (object, optional), `isCustom`,
`supportsVLAN`, `supportsSTP`, `supportsPorts`, `supportsNICs` (booleans),
`portOptions` (integer[], optional), `defaultPortCount` (integer, optional).

Connection template, in this order: `id`, `name`, `type`, `description`
(optional), `color`, `lineStyle` (`solid`, `dashed`, `dotted`), `strokeWidth`
(number), `strokeWidthHighlighted` (number, optional), `strokeDasharray`
(string, optional), `isCustom`.

`isCustom` is written as `true` and read as `true` whatever the file says: a
template that arrives in a project file is a custom template.

When a file is opened, a template is added only if none with the same `id`
exists (for connection templates: nor one with the same `type`). Existing
templates are never overwritten.

## Reading a file

A file is refused, with nothing changed, when:

- it is not valid JSON;
- `format` is missing or is not `"pixelcake-project"`;
- `version` is not a positive integer, or is greater than the version the
  application knows (the file was written by a newer version);
- `canvases` is missing or empty;
- a canvas is not an object, or has no `devices` array or no `connections`
  array.

Everything else is repaired, and each repair is reported to the user:

| Found in the file | Repair |
|-------------------|--------|
| No `version` | Read as version 1. |
| No `name` | `"Progetto senza nome"`. |
| No `description` | Empty. |
| No `settings`, or fields of it missing or of the wrong type | The defaults shown in the example. An unknown `emailMode` is dropped. |
| Canvas without `name` | `Canvas N`, N being its position. |
| Canvas without `id`, or with an `id` already used by an earlier canvas | A new `canvas-N` id. |
| `activeCanvasId` not among the canvases | The first canvas. |
| `viewport` missing or not usable | `{ "x": 0, "y": 0, "zoom": 1 }`. |
| A device that is not an object, has no `id` or `type`, or repeats an `id` | Dropped. |
| A device without `label`, `ip`, `subnet`, `gateway` or `position`, or with invalid entries in `ports` / `nics` | Completed: `label` becomes the id, addresses become empty, `position` becomes `0, 0`, invalid interface entries are dropped. |
| A route without `id`, `destination` or `nextHop`; a rule without `id`, with an `action` other than `allow` / `deny`, an unknown `service`, or no `source` / `destination` | Dropped: the other routes and rules keep their order. |
| A connection that is not an object or has no `id`, `source` or `target` | Dropped. |
| Connections sharing an `id` | The first one is kept. |
| A connection whose `source` or `target` is not a device of the canvas | Dropped. |
| A counter missing, not a non-negative integer, or not above the ids in use | Raised to one above the highest id in use. |
| No `templates` | None. |
| A template missing a required field | Dropped. |

Two normalisations are applied silently, so that files written by earlier
versions keep working:

- a connection end attached to a port or NIC its device does not have, or to
  an interface already used by an earlier connection, is detached; then every
  unattached end is attached to the first free interface of its device (the
  lowest-numbered free enabled port, otherwise the first free enabled NIC,
  otherwise the first free interface). An end stays unattached when its
  device has no free interface, or is a firewall whose ports carry security
  zones: choosing the port there is choosing a policy;
- the device-level `ip`, `subnet` and `gateway` of a device with NICs are set
  from its first NIC.

A file that is already in this form is read back exactly as it was written.

## Writing a file

- Keys are written in a fixed order: for each object, the fields in the order
  this document lists them, then any other field in alphabetical order.
  Saving the same project twice gives the same text, apart from `savedAt`.
- Fields without a value are omitted, not written as `null` (`sourceHandle`
  and `targetHandle` are the exception: `null` is a value for them).
- Fields this document does not list are kept on devices, ports, NICs,
  connections and templates. At the top level and on a canvas they are not
  preserved.

## Versioning

`version` is increased when a reader of the previous version could no longer
read the file correctly. A reader must refuse a file whose `version` is
greater than the one it implements. New optional fields do not change the
version.
