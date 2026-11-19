---
title: "Templates"
description: "The kinds of device and of link the app comes with, and the ones you make."
order: 10
---

A template is the blueprint of a kind of device, or of a kind of link. A device made from a template takes its name, its drawing, and whether it has ports or network cards. A link made with a type takes its colour, its line and its thickness. Templates are kept in the browser, for all the projects you open in it, and are managed in Settings → “Templates”.

## Built-in templates {#built-in}

**Devices.** The 24 kinds of [Devices](devices.md#kinds) are 24 templates. Settings → “Templates”, then “Devices”, then “Generic devices” shows them as cards, with the drawing, the name and the base type: PC, Switch, Router, Server, Firewall, Access Point, Load Balancer, Database or Cloud. The mail server, the printer and the laptop are templates of the base type Server and PC, with a drawing of their own. On each card a pencil, “Edit template”, and a bin, “Delete template”. At the top of the tab, “Restore built-in templates” and “New template”.

- **Editing** changes the “Name” and the “Drawing”. The “Base type” is locked: “The type cannot be changed, to avoid problems with existing devices.” Press “Save changes”. A device already on a board keeps the name it has, and is drawn with the new drawing, because a device looks up its template.
- **Deleting** asks first, naming the template and warning that existing devices of this type may no longer be drawn as before. Those devices stay, and are drawn with the drawing of their base type. The template is gone from the panel “Add” and from [Bulk add](bulk-add.md) until “Restore built-in templates” puts it back.
- **“Restore built-in templates”** puts back the built-in templates that were deleted, each in its place among the others, and a notice says how many (“All the built-in templates are there already” when none was missing). It touches nothing else: a built-in template you edited keeps its new name and drawing, and the templates you made are left as they are. The templates are kept in the browser, under one key and one version, as before; restoring changes the list and nothing about how it is stored.
- **“New template”** opens a form with a “Name”, a “Base type” and a “Drawing”, and “Create template” makes it. The base type can be any of the nine, also one a built-in template has already: the new template is a variant, with a name and a drawing of its own for the same base type, such as a CAD workstation next to the PC. It is a custom template: it is listed in the tab “Custom devices”, which opens at once, it travels with the project ([below](#in-the-file)), and “Restore built-in templates” leaves it alone.

**Links.** Settings → “Templates”, then “Links”, lists the link types: Access, Trunk, Uplink, Backbone and MPLS, each with its type ID, its description and its line. They are the entries of “Link type” in the window of a cable ([Cables and links](cables.md#edit)). A built-in type can be edited, not deleted.

A link type has a “Name”, a “Type ID” (lower case, without spaces, unique, and it cannot be changed once created), a “Description”, a “Colour”, a “Line style” (“Solid”, “Dashed” or “Dotted”) and a “Thickness” from 1 to 10 pixels; a “Preview” shows the line. Press “Create type” for a new one, “New link type” being the button that opens the form. A type is a look and nothing else: the engine does not read it.

## Your own templates {#custom}

In Settings → “Templates” → “Devices”, the tab “Custom devices” is for kinds of device you make. “New template” opens a form:

1. “Template name”: for example `AWS EC2 Instance`.
2. “Base type”: any of the nine, in three groups: Network (Switch, Router, Firewall, Access Point, Load Balancer), Servers (Server, Database, Cloud) and End devices (PC).
3. “Drawing”: one of the 24, in the groups Network, Servers, Data and End devices. It starts as the drawing of the base type.
4. Press “Save template”.

The base type decides what the new kind is made of. A Switch, a Router or a Firewall has numbered ports (and VLANs and spanning tree on a switch); the other six, the PC and the Access Point among them, have network cards, one to begin with. A Switch, a Router and a Firewall also come with the port counts of the built-in ones. The base type also decides what the engine does with it: a custom Router routes, a custom Switch forwards inside a network, a custom Access Point bridges, a custom Cloud lets traffic through, as the built-in ones do ([Devices](devices.md#kinds)). The roles that go with a name, such as the Mail Server that an email is relayed through, belong to the built-in template, not to a custom one that is merely called mail.

The new template is listed in the panel “Add”, after the others, as "Custom template (Server)", with its base type in brackets, and is made into a device like any other. “Delete template” in the list takes it away, after a question; the devices made from it stay on the board.

The tab says what a template holds: “Custom templates: a name, a base type and a drawing”. There is no Terraform field in it; the Terraform export is only a sketch.

## In the project file {#in-the-file}

The templates you made travel with the project. When you save a project, its **custom** templates, device and link ones, are written in the file; the built-in and the generic ones are not. When a file is opened, each template in it is added if the browser has none with the same ID (a link type: none with the same type ID), and the ones that are there are never overwritten. A project that uses a custom kind of device can so be opened on another computer, and a device whose template is missing is still drawn, with the drawing of its base type.

The details of the file are in [Project file](../reference/project-file.md#contents).

## Limits {#limits}

> [!LIMITS]
> - A template has no behaviour of its own: only a base type, a drawing, and the names of its ports and cards. What it does in the engine comes from the base type.
> - The built-in and generic templates live in this browser only: they are not in the project file, and another browser starts with the 24.
> - A kind of device cannot be given its own ports, its own port counts or its own settings; the port counts are those of the base type.
