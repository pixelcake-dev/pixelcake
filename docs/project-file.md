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
| `dns` | string | Optional. Address of the DNS server written on the card of a new end device. Without it a new card names no DNS server. |
| `emailMode` | `"auto"` \| `"internal"` \| `"cloud"` | Optional. How the email flow of the simulation is routed; a missing value means `"auto"`. |
| `vlans` | array | Optional. The names of the VLANs of the project: one `{ "id": 10, "name": "Uffici" }` for each VLAN that has a name, lowest `id` first. `id` is a VLAN number (an integer from 1 to 4094), `name` a text of 32 characters at most. A VLAN stays a number on devices, ports and connections: the name is only shown next to it. |

## Canvas

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the project. The application creates ids of the form `canvas-N`. |
| `name` | string | Name shown in the explorer. |
| `devices` | array | Devices on the canvas. |
| `connections` | array | Links between devices of the same canvas. |
| `areas` | array | Optional. The areas drawn behind the devices, in the order they are drawn, see below. Left out when the canvas has none. |
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
| `ip`, `subnet`, `gateway` | string | Device-level address. For a device with NICs these mirror its first NIC, and are empty when that NIC takes its address from DHCP. |
| `vendor`, `location` | string | Optional. |
| `notes` | string | Optional. Free text about the device; lines are separated by `\n`. |
| `position` | object | `x`, `y` on the canvas. |
| `vlan` | integer[] | Optional. VLAN ids the device carries. |
| `stp` | object | Optional. `enabled` (boolean), `mode` (`STP`, `RSTP`, `PVST+`, `MST`), `priority` (integer). |
| `portCount` | integer | Optional. Number of ports (switches, routers, firewalls). |
| `ports` | array | Optional. Per-port configuration, see below. |
| `nics` | array | Optional. Network interface cards (end devices), see below. |
| `routes` | array | Optional. Static routes of a router or firewall, see below. The device's `gateway` is its default route. |
| `firewallRules` | array | Optional. Rules of a firewall, in the order they are read: the first that matches decides. See below. |
| `portForwards` | array | Optional. Port forwards of a router or firewall, in the order they are read: the first that matches is taken. See below. |
| `dnsRecords` | array | Optional. The names a server answers for as a DNS server, see below. |

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
| `nat` | boolean | Optional (routers, firewalls). Source NAT: a new flow the device forwards out of this port leaves with the address of the port, and its reply is sent on to the real sender. |
| `dhcpServer` | object | Optional (routers, firewalls). DHCP server for the network of this port: the pool it hands out, see below. |
| `securityZone` | `trust`, `untrust`, `dmz` | Optional (firewalls). The zone the firewall policy and rules refer to. |
| `ips` | boolean | Optional (firewalls). Kept as documentation. |

NIC:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the device, e.g. `nic-1`. |
| `name` | string | Interface name, e.g. `eth0`. |
| `enabled` | boolean | Administrative state. |
| `speed` | `10M`, `100M`, `1G`, `2.5G`, `10G`, `auto` | Link speed. |
| `ip`, `subnet`, `gateway` | string | Address of the interface. Empty while `dhcp` is `true`. |
| `dns` | string | Optional. Address of the DNS server the card asks when a name is used in place of an address. Not on a card whose `dhcp` is `true`: there it comes with the lease. |
| `dhcp` | boolean | Optional. `true`: the card takes its address, mask, gateway and DNS server from the DHCP server of its network, and keeps none of its own. |
| `dhcpServer` | object | Optional (servers). DHCP server for the network of this card: the pool it hands out, see below. Not on a card whose `dhcp` is `true`. |
| `mac`, `description` | string | Optional. |

DHCP pool (`dhcpServer` of a port or of a NIC):

| Field | Type | Meaning |
|-------|------|---------|
| `start` | string | First address of the range handed out. |
| `end` | string | Last address of the range. Both must be in the network of the interface. |
| `gateway` | string | Optional. Gateway handed out with the address. Without it: the address of the port itself on a router or firewall, none on a server. |
| `dns` | string | Optional. Address of the DNS server handed out with the address. It may be on any network. Without it the cards served get none. |

The mask handed out is the one of the interface. **A lease is never written
in the file**: which card gets which address is worked out from the drawing
each time, in the order of the `devices` array and, within a device, of its
`nics`. Each card gets the lowest address of the range that is not written on
any port or NIC of the canvas and is not leased already.

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
| `service` | `any`, `ping`, `web`, `email`, `dns` | The traffic it applies to. `dns` is a name lookup. |
| `source`, `destination` | string | `any`, a zone (`trust`, `untrust`, `dmz`), an address or a network in CIDR form. |
| `enabled` | boolean | Optional. `false` switches the rule off; a rule is on when the field is missing. |
| `description` | string | Optional. |

Rules are read in the order of the array. When none matches, the zones of
the two ports decide: traffic towards a more trusted zone is denied
(`untrust` → `trust`, `untrust` → `dmz`, `dmz` → `trust`), the rest is
allowed.

Port forward:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the device, e.g. `forward-1`. |
| `service` | `any`, `ping`, `web`, `email`, `dns` | The traffic it takes. |
| `port` | integer | The port whose address is published: what arrives for that address, for the service, is forwarded. |
| `to` | string | The address the traffic is sent on to. |
| `enabled` | boolean | Optional. `false` switches the forward off; a forward is on when the field is missing. |
| `description` | string | Optional. |

Forwards are read in the order of the array. The answer leaves with the
address of the port, the one that was asked. A firewall filters a forwarded
flow by its real destination, the `to` of the forward: the forward says
where the traffic goes, a rule has to say that it may.

DNS record:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the device, e.g. `record-1`. |
| `name` | string | Host name, with at least one dot: `gestionale.azienda.example`. Upper and lower case are the same. |
| `address` | string | The address the name stands for. |

Records are read on devices of type `Server`. A server answers only for the
names in its list; a name written twice gives the address of its first
record. A record whose `name` is not a host name, or whose `address` is not
an address, is kept in the file and not used. **The address a name resolved
to is never written in the file**: a name is looked up again each time a
question uses it, by a request to the `dns` address of the card that asks.

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

### Area

An area is a rectangle with a short label, drawn behind a group of devices to
say what they are (`Core`, `Edge`, `Uffici`). It is a drawing and nothing
else: no device belongs to it, and nothing that follows a packet reads it.

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique within the canvas. The application creates ids of the form `area-N`. |
| `label` | string | The text in its corner: one line of 40 characters at most. May be empty. |
| `color` | `slate`, `green`, `amber`, `red`, `violet`, `teal` | One of the six colours of the palette. Each has a value in the light theme and one in the dark. |
| `position` | object | `x`, `y` of its top left corner on the canvas. |
| `size` | object | `width`, `height` (numbers greater than 0; the application makes none smaller than 120 by 80). |

Fields this document does not list are not kept on an area.

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
| A `dns` of the settings that is not an IPv4 address | Dropped: the project has no default DNS server. (An empty one is dropped without a word.) |
| A `vlans` of the settings that is not an array; an entry of it without an `id` from 1 to 4094 or without a `name`, or repeating the `id` of an earlier entry; a `name` longer than 32 characters | The list is dropped; the entry is dropped (the first of two with one `id` is kept); the name is cut to 32 characters. |
| Canvas without `name` | `Canvas N`, N being its position. |
| Canvas without `id`, or with an `id` already used by an earlier canvas | A new `canvas-N` id. |
| `activeCanvasId` not among the canvases | The first canvas. |
| `viewport` missing or not usable | `{ "x": 0, "y": 0, "zoom": 1 }`. |
| A device that is not an object, has no `id` or `type`, or repeats an `id` | Dropped. |
| A device without `label`, `ip`, `subnet`, `gateway` or `position`, or with invalid entries in `ports` / `nics` | Completed: `label` becomes the id, addresses become empty, `position` becomes `0, 0`, invalid interface entries are dropped. |
| A `notes` that is not text | Dropped: the device keeps everything else. |
| A route without `id`, `destination` or `nextHop`; a rule without `id`, with an `action` other than `allow` / `deny`, an unknown `service`, or no `source` / `destination`; a port forward without `id`, with an unknown `service`, a `port` that is not an integer, or no `to` | Dropped: the other routes, rules and forwards keep their order. |
| A `dhcpServer` that is not an object, or without `start` or `end` as text, or with a `gateway` or a `dns` that is not text; a `dhcp` that is not a boolean; a `dns` of a NIC that is not text | Dropped: the port or NIC keeps everything else. |
| A DNS record without `id`, `name` or `address` as text | Dropped: the other records keep their order. |
| An area that is not an object, or without a `position` or a `size` made of numbers (a `size` of 0 or less included); an `areas` that is not an array | Dropped: there is nothing to draw. |
| An area without `id`, or with one an earlier area has; with a `color` that is not of the palette; with a `label` that is not text; smaller than 120 by 80 | Completed: a new `area-N` id, the colour `slate`, an empty label, the smallest size. |
| A connection that is not an object or has no `id`, `source` or `target` | Dropped. |
| Connections sharing an `id` | The first one is kept. |
| A connection whose `source` or `target` is not a device of the canvas | Dropped. |
| A counter missing, not a non-negative integer, or not above the ids in use | Raised to one above the highest id in use. |
| No `templates` | None. |
| A template missing a required field | Dropped. |

Six normalisations are applied silently, so that files written by earlier
versions (or by hand) keep working:

- a connection end attached to a port or NIC its device does not have, or to
  an interface already used by an earlier connection, is detached; then every
  unattached end is attached to the first free interface of its device (the
  lowest-numbered free enabled port, otherwise the first free enabled NIC,
  otherwise the first free interface). An end stays unattached when its
  device has no free interface, or is a firewall whose ports carry security
  zones: choosing the port there is choosing a policy;
- the device-level `ip`, `subnet` and `gateway` of a device with NICs are set
  from its first NIC;
- a NIC whose `dhcp` is `true` loses whatever `ip`, `subnet`, `gateway` and
  `dns` it carries: they are not used while it is on DHCP, and could be
  mistaken for what it is leased;
- the `notes` of a device lose the white space around them and get one kind
  of line end (`\n`); notes left empty are dropped;
- the `vlans` of the settings are put in the order of their `id`, their names
  lose the white space around them, and an empty list is dropped;
- the `label` of an area is made one line, without the white space around
  it, and an empty `areas` list is dropped.

A file that is already in this form is read back exactly as it was written.

## Writing a file

- Keys are written in a fixed order: for each object, the fields in the order
  this document lists them, then any other field in alphabetical order.
  Saving the same project twice gives the same text, apart from `savedAt`.
- Fields without a value are omitted, not written as `null` (`sourceHandle`
  and `targetHandle` are the exception: `null` is a value for them).
- Fields this document does not list are kept on devices, ports, NICs,
  connections and templates. At the top level, on a canvas, in the settings
  and on an area they are not preserved.

## Versioning

`version` is increased when a reader of the previous version could no longer
read the file correctly. A reader must refuse a file whose `version` is
greater than the one it implements. New optional fields do not change the
version.
