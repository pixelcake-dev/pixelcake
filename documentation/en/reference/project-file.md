---
title: "The project file"
description: "The .pixelcake.json file a project is saved in: what it holds, its versions, and what is repaired when it is opened."
order: 1
---

A project is saved as one file with the extension `.pixelcake.json`. It is plain JSON in UTF-8, written with two spaces of indentation and a line break at the end, and it holds the whole project: every board with its devices and links, the network settings and the custom templates. This page is for whoever wants to know what is in the file, or to read or write it with other tools. The field-by-field specification, with every type and every repair, is [docs/project-file.md](https://github.com/pixelcake-dev/pixelcake/blob/main/docs/project-file.md) in the repository.

## The format {#format}

**Saving.** File → Save (Ctrl + S, Cmd + S on a Mac) writes the file. In Chrome and Edge the first save asks where, and the next ones write in the same file until the page is reloaded; File → Save as… always asks. In the other browsers there is no way to write in place: every save downloads the file, and a message says so. The name proposed is the name of the project made safe for a file: lower case, letters and digits with single hyphens, accents taken away, at most 80 characters. A project called `Città di Prova` is proposed as `citta-di-prova.pixelcake.json`; when nothing of the name is left, as `project.pixelcake.json`.

**Opening.** File → Open… chooses a file and, once it is found valid, replaces the open project. If the open project has changes not yet saved to a file, the question “Continue without saving?” comes first. A file that cannot be opened is refused with a message and nothing is changed; a file that can be opened with repairs says so after the opening ([below](#repairs)).

**What is not in it.** The file is made in the browser and written to the disk of the computer: nothing is sent anywhere. It holds the project, not what belongs to the moment: the question asked in a presentation and the failures simulated, the terminal window and what it printed, the theme and the language of the interface.

The file is made to be read back as it was written. Keys are written in a fixed order, so saving the same project twice gives the same text, apart from the time of `savedAt`.

## What it holds {#contents}

The file of the sample network “Office: two networks and a router”, as the app writes it, with what repeats left out where the dots are:

```json
{
  "format": "pixelcake-project",
  "version": 1,
  "name": "Untitled project",
  "description": "",
  "savedAt": "2026-11-17T00:34:09.744Z",
  "settings": {
    "ipClass": "192.168.10.0",
    "subnet": "255.255.255.0",
    "gateway": "192.168.10.1",
    "emailMode": "auto"
  },
  "activeCanvasId": "canvas-1",
  "canvases": [
    {
      "id": "canvas-1",
      "name": "Board 1",
      "devices": [
        {
          "id": "dev-0",
          "type": "Router",
          "templateId": "tpl-router",
          "label": "Router-1",
          "ip": "192.168.10.1",
          "subnet": "255.255.255.0",
          "gateway": "",
          "location": "Server room",
          "position": {
            "x": 400,
            "y": 60
          },
          "portCount": 4,
          "ports": [
            {
              "id": 1,
              "name": "Office LAN",
              "enabled": true,
              "speed": "auto",
              "portType": "lan",
              "ip": "192.168.10.1",
              "subnet": "255.255.255.0"
            },
            …
          ]
        },
        …
      ],
      "connections": [
        {
          "id": "conn-0",
          "source": "dev-3",
          "target": "dev-1",
          "sourceHandle": "top",
          "targetHandle": "bottom",
          "sourceNic": "nic-1",
          "targetPort": 1,
          "type": "access",
          "bandwidth": "1 Gbps"
        },
        …
      ],
      "viewport": { … },
      "deviceCounter": 7,
      "connectionCounter": 6
    }
  ],
  "templates": {
    "devices": [],
    "connections": []
  }
}
```

In the file the boards are called `canvases`: it is the name the format has always had, not a word of the interface. What each part is:

| Field | What it holds |
|---|---|
| `format`, `version` | `"pixelcake-project"` and the version of the format, now `1`. |
| `name`, `description`, `savedAt` | The name of the project, a free text, and the time of the save (UTC). |
| `settings` | The network settings of the project: the network and mask new devices start from, the gateway, the default DNS server, how email is routed (`emailMode`), and the names of the VLANs (`vlans`: a number and a name each). |
| `activeCanvasId`, `canvases` | The board shown when the file is opened, and every board, in the order they are listed in the Explorer. |
| `templates` | The custom device and link templates, so that a project that uses one opens on another installation. The built-in templates are not written. |

A board holds:

| Field | What it holds |
|---|---|
| `devices` | Each device: type, template, name, addresses, position, notes, its ports or network cards with their VLANs, zones, NAT and DHCP pools, static routes, firewall rules, port forwards and DNS records. |
| `connections` | The links: the two devices and, at each end, the port or the network card the cable is attached to; type, bandwidth, label, colour, VLANs. |
| `areas` | The areas drawn behind groups of devices: label, colour, position and size. Left out when a board has none. |
| `marks` | What is written on the board with the marker: see [below](#marks). Left out when nothing is. |
| `viewport` | The pan and the zoom of the board, so that it opens where it was left. |
| `deviceCounter`, `connectionCounter` | The numbers the next device and the next link are given, so that a new one never takes the id of another. |

Two things are never written because they follow from the drawing: the address a card is leased by DHCP, and the address a name resolves to. The engine works them out again every time.

### What is written with the marker {#marks}

Each mark of the [marker](../building/marker.md) is one entry of `marks`, first written first:

```json
{
  "id": "mark-2",
  "kind": "text",
  "color": "ink",
  "width": "thin",
  "points": [412.5, 188],
  "text": "Single point of failure",
  "seed": 1806233473
}
```

- `kind`: `pen`, `text`, `arrow`, `ellipse`, `tick` or `cross`;
- `color`: `accent` (the orange), `red`, `green` or `ink` (the colour of the text of the theme);
- `width`: `thin` or `thick`; for words, their size;
- `points`: points of the board, x and y one after the other, on one line: every point of a line by hand; the tail and the tip of an arrow; the two corners of the box of a circle, a tick or a cross; the top left of the words;
- `text`: the words of a mark of words, one line or more;
- `seed`: what its slight wobble is worked out from, so that it is drawn the same every time.

The marks the presenter writes in a presentation are never in the file. A program that does not know `marks` opens the file all the same and leaves them out.

## Opening an old or damaged file {#repairs}

**Refused.** A file is refused, and nothing is changed, when it cannot be read as a project. The message is shown in a notice that names the file:

| Message | When |
|---|---|
| `The file is not valid JSON.` | The text is not JSON. |
| `The file is not a PixelCake project (the "format" field is missing or not recognised).` | `format` is missing, or is not `"pixelcake-project"`. |
| `The file states a format version that is not valid.` | `version` is not a whole number from 1 up. |
| `The file was made with a newer version of PixelCake (format 2): update the app to open it.` | `version` is higher than the one the app knows. |
| `The project has no boards.` | `canvases` is missing or empty. |
| `Board 2 in the file is not valid.` | A board is not an object. |
| `Board “Name”: the list of devices ("devices") is missing.` | A board has no `devices`, or no `connections` (`the list of links ("connections") is missing`). |
| `The file cannot be read: its content is not valid.` | Something so malformed that reading it failed. |

**Repaired.** Anything else is put right. The project opens, and a notice that says it was opened with some repairs lists what was done, one line each, for twelve seconds. A few of the lines:

- `Format version not stated: the file was read as version 1.` A file with no `version` is read as the first.
- `Project name missing: “Untitled project” used.` and, for a board, `Board 1 has no name: named “Board 1”.`
- `Board “Name”: 2 invalid or duplicate devices ignored.` A device with no `id` or `type`, or with an `id` another has, is dropped; one that is only incomplete is completed, and the notice says `1 incomplete device repaired.`
- `Board “Name”: 1 link to a device that does not exist removed.`
- `Active board not found: “Board 1” opened.`
- `Board “Name”: view missing or not valid, reset to the starting position.` and `ID counters missing or too low, recalculated.`
- `1 invalid custom template ignored.`

The same goes for the smaller parts: a route, a rule, a port forward or a DNS record without what it needs is left out and the others keep their order; a DHCP pool without a first or last address is left out; a list of VLAN names that is not valid is ignored.

**Put right without a word.** Files written by earlier versions, or by hand, keep working because a few things are normalised on the way in, silently:

- A link end attached to a port or card its device does not have, or one that another link already uses, is detached; every end left unattached is then given the first free interface of its device (the lowest free port, otherwise the first free card). On a firewall whose ports carry security zones an end stays unattached: choosing the port is choosing a policy.
- A device with network cards takes its address, mask and gateway from its first card.
- A card on DHCP loses the address, mask, gateway and DNS server it carries: they are not used while it takes its own from a server.
- The notes of a device lose the blank space around them; the names of VLANs are put in order of number; the label of an area is made one line.

A template saved before the drawings of the devices existed has the name of an icon in `icon`; it is read as it is, and the device is drawn as its type until it is given a drawing. A file that is already in the current form is read back exactly as it was written.

## Versions {#versions}

`version` is raised only when a program that knows the previous version could no longer read the file correctly. A new optional field does not raise it: the file of today is version 1, and so were the files written before areas, DHCP and DNS existed, which simply lack those fields. An older app refuses a newer file instead of misreading it, with the message above.

Fields the specification does not list are kept on devices, ports, cards, links and templates when a file is opened and saved again; at the top level, in a board, in the settings and on an area they are not.

> [!LIMITS]
> - The file holds the project, not the history: there is no undo, and a file saved is the whole state, not a list of changes.
> - Two browser tabs open on the same project do not see each other's changes: the last one to write wins. The file is only as new as its last save.
> - Simulated failures belong to a presentation and are not in the file.
> - The format is PixelCake's own. [The YAML export](yaml.md) is the way to hand the network to other tools; it does not carry the positions, the areas or the settings.
