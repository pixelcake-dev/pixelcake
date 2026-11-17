---
title: "Templates"
description: "The kinds of device and of link the app comes with, and the ones you make."
order: 10
---

A template is the blueprint of a kind of device, or of a kind of link. A device made from a template takes its name, its drawing, and whether it has ports or network cards. A link made with a type takes its colour, its line and its thickness. Templates are kept in the browser, for all the projects you open in it, and are managed in Settings → “Templates”.

## Built-in templates {#built-in}

**Devices.** The 24 kinds of [Devices](devices.md#kinds) are 24 templates. Settings → “Templates”, then “Devices”, then “Generic devices” shows them as cards, with the drawing, the name and the base type: PC, Switch, Router, Server, Firewall, Access Point, Load Balancer, Database or Cloud. The mail server, the printer and the laptop are templates of the base type Server and PC, with a drawing of their own. On each card a pencil, “Edit template”, and a bin, “Delete template”.

- **Editing** changes the “Name” and the “Drawing”. The “Base type” is locked: “The type cannot be changed, to avoid problems with existing devices.” Press “Save changes”. A device already on a board keeps the name it has, and is drawn with the new drawing, because a device looks up its template.
- **Deleting** asks first, naming the template and warning that existing devices of this type may no longer be drawn as before. Those devices stay, and are drawn with the drawing of their base type. The template is gone from the panel “Add” and from [Bulk add](bulk-add.md); there is no button that brings a built-in one back.
- **“New template”** makes another generic template for a base type that has none left. As the built-in ones cover the nine base types, a new one is refused (“This type already exists among the generic templates”) until you delete the ones of that type. To make a new kind of device, make a custom template.

**Links.** Settings → “Templates”, then “Links”, lists the link types: Access, Trunk, Uplink, Backbone and MPLS, each with its type ID, its description and its line. They are the entries of “Link type” in the window of a cable ([Cables and links](cables.md#edit)). A built-in type can be edited, not deleted.

A link type has a “Name”, a “Type ID” (lower case, without spaces, unique, and it cannot be changed once created), a “Description”, a “Colour”, a “Line style” (“Solid”, “Dashed” or “Dotted”) and a “Thickness” from 1 to 10 pixels; a “Preview” shows the line. Press “Create type” for a new one, “New link type” being the button that opens the form. A type is a look and nothing else: the engine does not read it.

## Your own templates {#custom}

In Settings → “Templates” → “Devices”, the tab “Custom devices” is for kinds of device you make. “New template” opens a form:

1. “Template name”: for example `AWS EC2 Instance`.
2. “Base type”: Server, Firewall, Load Balancer, Database, Cloud, Router or Switch.
3. “Drawing”: one of the 24, in the groups Network, Servers, Data and End devices. It starts as the drawing of the base type.
4. Press “Save template”.

The base type decides what the new kind is made of. A Switch, a Router or a Firewall has numbered ports (and VLANs and spanning tree on a switch); the other four have network cards, one to begin with. The base type also decides what the engine does with it: a custom Router routes, a custom Switch forwards inside a network, a custom Cloud lets traffic through, as the built-in ones do ([Devices](devices.md#kinds)). The roles that go with a name, such as the Mail Server that an email is relayed through, belong to the built-in template, not to a custom one that is merely called mail.

The new template is listed in the panel “Add”, after the others, as "Custom template (Server)", with its base type in brackets, and is made into a device like any other. “Delete template” in the list takes it away, after a question; the devices made from it stay on the board.

> [!NOTE]
> The tab says “Custom templates with Terraform fields”, but the form has no Terraform field: a name, a base type and a drawing are all it holds. The Terraform export is only a sketch.

## In the project file {#in-the-file}

The templates you made travel with the project. When you save a project, its **custom** templates, device and link ones, are written in the file; the built-in and the generic ones are not. When a file is opened, each template in it is added if the browser has none with the same ID (a link type: none with the same type ID), and the ones that are there are never overwritten. A project that uses a custom kind of device can so be opened on another computer, and a device whose template is missing is still drawn, with the drawing of its base type.

The details of the file are in [Project file](../reference/project-file.md#contents).

## Limits {#limits}

> [!LIMITS]
> - A template has no behaviour of its own: only a base type, a drawing, and the names of its ports and cards. What it does in the engine comes from the base type.
> - The built-in and generic templates live in this browser only: they are not in the project file, and another browser starts with the 24.
> - A kind of device cannot be given its own ports, its own port counts or its own settings; the port counts are those of the base type.
