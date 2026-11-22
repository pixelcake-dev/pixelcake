---
title: "YAML import and export"
description: "The network of a board as YAML, to copy, download and load back; and the Terraform sketch."
order: 2
---

The devices and the links of the open board can be written out as a YAML text, copied or downloaded, and read back from a `.yaml` or `.yml` file. It is a way to look at a network as text, to keep it in a repository, or to build one with a script. It is not the way to save a project: the YAML holds the network, where each device is drawn and the areas, and not the settings, the templates or the other boards; [the project file](project-file.md) is the one that holds everything. The same window offers a Terraform export, which is only a sketch ([below](#limits)).

## Exporting {#export}

“Import/Export”, in the bar on the left, opens the window; the first tab is the export. “Format:” chooses YAML or “Terraform HCL (draft)”. The text is shown as it will be written, with the number of lines and the number of devices and links of the board. “Copy to clipboard” copies it; the second button downloads it as `<name of the project>-topology.yaml`, the name written in lower case with every character that is not a letter, a digit, a hyphen or an underscore turned into a hyphen. A board with no devices has nothing to export, and both buttons are off.

The areas of the board are written too, and the place of each device, so that an area is still around its devices when the file is loaded back. The areas are written even when they are hidden (View → “Show areas”).

Only the open board is exported. A project with several boards is exported one board at a time, by switching board and opening the window again.

## Importing {#import}

The second tab takes a file: drop it on the box, or click the box to choose it. Only `.yaml` and `.yml` are accepted; any other file gets “Format not supported. Use a .yaml or .yml file.” Nothing is changed yet: the window shows the file name, how many devices and links it holds, the list “Devices found” with the type and the address of each, and, if the file has problems, the list “Warnings”.

“Mode:” says where the devices go:

- “Replace the topology” empties the board first, devices, links and areas, and loads the file in its place. When the board holds something, a question comes first: “Replace the topology?”, which says how many devices, links and areas will be removed. “Replace” goes on, “Cancel” or Esc leaves the board as it is. Edit → “Undo”, or Ctrl + Z, brings the board back as it was, in one step. The network settings of the project and the names of its VLANs are not touched.
- “Add to the topology” keeps what is on the board and adds the devices, links and areas of the file, with new ids. The new group is put to the right of the drawing that is there, level with its top and 120 units away from it, so it never lies over what you have drawn; the layout inside the group, and the areas around its devices, are kept. A device whose name the board has already is given the first free name (`PC-1` becomes `PC-1-1`), and a notice says which.

“Import” does it, and a notice says how many devices and links came in. The button is off while the file holds no device.

A file written by the app says where each device is drawn (`position`). A file that does not, such as one written by hand or by a script, has its devices laid out on a grid: as many columns as the square root of the number, rounded up, 250 units apart across and 200 down, starting at 100, 100, in the order of the file. View → Auto-layout puts the drawing in order again (it asks first, and Ctrl + Z undoes it).

The reader accepts the file as the app writes it, with everything under a `pixelcake:` key, and also the same lists at the top of the file with no `pixelcake:` around them. What it does not need is read as a default: a device with no name is `Device-1`, `Device-2`…, one with no type is a `PC`, an interface with no state is on. What is wrong is said in the warnings:

| Warning | When |
|---|---|
| `YAML parsing error: …` | The text is not YAML; the reason of the reader follows, with the line. |
| `The YAML file contains no valid data` | The file is empty, or it is a single value. |
| `YAML structure not recognised` | The `pixelcake:` key holds something that is not a set of fields. |
| `No devices found in the file` | There is no `devices` list, or it is empty. |
| `Device 3: invalid format, ignored` | An entry of `devices` is not a set of fields. |
| `Router-1: invalid IP address "abc"` | The address of a device or of a port is not four groups of up to three digits. Only the shape is checked: `300.1.1.1` passes. |
| `Port 1: VLAN 5000 out of range (1–4094), left out` | A VLAN of a port, of a device (`SW-1: VLAN …`) or of a link (`Link 3: VLAN …`) is outside the range. It is not imported; the others of the list are. |
| `Names used more than once, …` | Two devices have one name, compared as the terminal compares names: without regard to capitals or to spaces round it. The first keeps the name, each later one is given the first free name, `PC-1-1`, `PC-1-2`…, and the warning lists each "old" → "new". The links that name it go to the first device. |
| `Area 2: no position or size, ignored` | An entry of `areas` has no `position` and `size`, or one that cannot be drawn. |
| `FW-Edge: rule 2 incomplete or invalid, ignored` | A rule needs an `allow` or `deny`, a service, and both ends. Routes, port forwards and DNS records say the same of themselves (`route 1 without a destination or a next hop`, `port forward 1 incomplete or invalid`, `DNS record 1 without a name or an address`). The others keep their order. |
| `Port 2: DHCP server without a first or a last address, ignored` | A pool with no `start` or no `end`. |
| `Link 3: medium "banana" not valid, left out` | A link with a `medium` the app does not know, a `length_m` that is not a number above 0 (40,000 km at most) or a `delay_ms` that is not a number from 0 to 10,000. The link is imported without it. |
| `Link 4: source “PC-9” not found` | A link names a device the file does not have (`target` likewise). The link is left out. |
| `Link 2: port 3 not found on “A”, end not assigned` | The port, or the card, a link names is not on that device. The link stays and the end is attached to a free interface when the file loads. |
| `Link 2: port 1 of “B” already used by another link, end not assigned` | Two links name one interface. The first keeps it. |

A file with warnings can still be imported: what is wrong is left out and the rest is read.

## The fields {#fields}

The start of the file the sample network “Office: two networks and a router” is exported to:

```yaml
# PixelCake Topology Export
# Generated: 2026-11-17
# Devices: 7 | Connections: 6

pixelcake:
  version: "1.0"
  project: Untitled project
  exported: 2026-11-17

  devices:
    - name: Router-1
      type: Router
      template_id: tpl-router
      ip: 192.168.10.1
      subnet: 255.255.255.0
      location: Server room
      ports:
        - id: 1
          name: Office LAN
          enabled: true
          ip: 192.168.10.1
          subnet: 255.255.255.0
          speed: auto
          mode: lan
        …
  connections:
    - source: PC-1
      target: SW-Office
      source_nic: eth0
      target_port: 1
      type: access
      bandwidth: 1 Gbps
    …
```

The comment lines at the top and `version`, `project` and `exported` are for whoever reads the file: the importer does not use them. A link names its two devices by name, and the port or the card at each end: `source_port: 8` for a port, `source_nic: eth0` for a card (by its name). When its cable was set, a link also carries `medium` (`copper`, `fibre`, `wifi`, `dsl`, `ftth`, `mobile` or `satellite`), `length_m` (the length in metres) and `delay_ms` (a delay written by hand, in ms, one way); without them its medium is worked out and it has no length ([the time a packet takes](../building/cables.md#delay)).

What a device carries, when it has it: `type`, `template_id` (which kind of server or storage it is), `ip`, `subnet`, `gateway`, `vendor`, `location`, `notes`, `vlan` (the list of the device), `stp`, `position` (where it is drawn, as `{x: 100, y: 50}`, written last), and then lists. A port has `id`, `name`, `enabled`, `ip`, `subnet`, `speed`, `mode`, `vlan` (a number for an access port, a list for a trunk), `poe`, `nat`, `dhcp_server`, `security_zone`, `description`. A card has `name`, `enabled`, `ip`, `subnet`, `gateway`, `dns`, `speed`, `mac`, `description`, and `dhcp: true` in place of the addresses when it takes its own from a server. The lists are `routes` (`destination`, `via`), `firewall_rules`, `port_forwards` and `dns_records`.

Rules and forwards are written in the order they are read, which is the order that matters:

```yaml
      routes:
        - destination: 192.168.0.0/16
          via: 10.0.0.1
          description: internal networks
      firewall_rules:
        - action: allow
          service: web
          from: untrust
          to: 172.16.0.10
          description: customer portal
        - action: allow
          service: email
          from: untrust
          to: 192.168.30.40
          description: incoming mail
      port_forwards:
        - service: web
          interface: 3
          to: 172.16.0.10
          description: customer portal
```

That is part of FW-Edge in the company sample. The address a card is leased by DHCP is never written, and neither is the address a name resolves to: they follow from the drawing.

The areas come after the links, one entry each, with the label, the colour (`slate`, `green`, `amber`, `red`, `violet` or `teal`), the top left corner and the size, in the units of the places of the devices:

```yaml
  areas:
    - label: Core
      color: violet
      position: {x: 80, y: 20}
      size: {width: 300, height: 200}
```

## Limits {#limits}

> [!LIMITS]
> - **The YAML is not the project.** It leaves out the network settings of the project, the names of the VLANs, the custom templates, the colour of a link and the other boards. To keep a project, save the project file.
> - **Names are the keys.** A link finds its devices by name, so two devices with one name cannot be told apart: the reader renames the later ones and says so, and a link that names the shared name goes to the first. A name that YAML would read as a number or a boolean, such as `10`, `1.50` or `true`, is kept as the text it was written as, and the app writes it in quotes.
> - **Only the shape is checked.** A mask, a gateway, a zone, a service or a type that is not one the app knows is read as it is: a device of type `Banana` is imported. The simulation then treats it as best it can.
> - **The Terraform export is a sketch.** It writes placeholder resource types (`network_switch`, `compute_instance`…) and names no provider, so `terraform apply` has nothing to apply it to. It carries addresses, VLANs, ports, cards, DNS records and links, and leaves out routes, firewall rules, port forwards and notes. Two devices whose names differ only in punctuation (`PC 1` and `PC-1`) get the same resource name, and a double quote in a name is not escaped. It is there to show where the project is going, not to be used.
> - **There is no import of Terraform.** Reading a `.tfstate` file, or any Terraform, is not implemented: only YAML comes in.
