import type { Dictionary } from '../dictionary';

/**
 * The guide. Every sentence states something the app really does: whoever
 * changes a behaviour described here changes the text too, in both languages.
 * Words between backticks are shown as code; a name between “” is the name
 * of a control, written as that control shows it (a test checks each one).
 */
export const help: Dictionary['help'] = {
  title: 'Guide',
  close: 'Close the guide',
  sections: 'Guide sections',

  tabs: {
    guide: 'How to use it',
    commands: 'Terminal commands',
    about: 'About',
  },

  intro:
    'PixelCake is for drawing a small network, configuring it and checking whether one device ' +
    'reaches another.',

  steps: {
    addDevices: {
      title: 'Add devices',
      text:
        'In the bar on the left open “Add device” (the + button) and choose a type from the ' +
        'list: check the name and confirm; the IP address is suggested automatically and can be ' +
        'changed, or left to DHCP; a name another device already has is not accepted. The device ' +
        'appears in the first free place of the part of the board you are looking at, row by row ' +
        'from the top left, and is already selected. “Bulk ' +
        'add” creates many at once. In the “Samples” tab of the same panel there are five sample ' +
        'networks ready to use: that of a small company (the same as on the welcome screen), a ' +
        'simple one, one with VLANs, a DMZ and a firewall, one with two sites and a backup ' +
        'line, and the large network of a multinational, with ten sites in Italy. Loading one ' +
        'replaces what is on the board. Each sample comes with its own network ' +
        'settings (Settings → Network): the network new devices start from, the DNS server, the ' +
        'names of the VLANs.',
    },
    moveAndSelect: {
      title: 'Move and select them',
      text:
        'Drag a device to move it. With Ctrl + click you select more than one; dragging on empty ' +
        'space draws a selection box, which also takes the areas wholly inside it. With two ' +
        'devices selected or more, “Enclose in an area” appears above them. Ctrl + C and Ctrl + V ' +
        'copy and paste the selection: the copy takes the first free name (PC-1 gives the first ' +
        'free PC-n), each network card a new MAC, and the PCs and the other end devices that are ' +
        'not servers ask DHCP for their address. The Delete key deletes the selection, after ' +
        'asking. Dragging with the right button on empty space moves the ' +
        'view, and the wheel zooms. All the shortcuts are in Settings → Advanced. View → ' +
        '“Auto-layout” → “Vertical” or “Horizontal” lays them out again: on top what the traffic ' +
        'leaves the network through (the Internet, else the firewall, else the router), below it ' +
        'one level for each cable; the areas go with their devices. It asks first, since every ' +
        'device is moved. Edit → “Undo” (Ctrl + Z) takes back the last change to the drawing, and ' +
        '“Redo” (Ctrl + Y) makes it again.',
    },
    connect: {
      title: 'Connect them',
      text:
        'Move the pointer over the edge of a device: the side under the pointer turns orange. ' +
        'Drag from there to another device and let go over it: the cable reaches the side where ' +
        'you let it go. At each end the link is assigned to a free port or network card. On a firewall with security ' +
        'zones the port has to be chosen by hand. Right-click the link and choose “Edit link” to ' +
        'change the interfaces, the type, the bandwidth, the label and the colour. View → ' +
        '“Connect devices with no cable” gives a cable to each device that has none: to the ' +
        'nearest switch of its network, on a free port meant for it (laptops, smartphones and ' +
        'tablets first to an access point); a group of devices with no router or firewall goes to ' +
        'the nearest router, firewall or core switch of its network. Routers, firewalls and the ' +
        'Internet are cabled by hand. A notice then says how many cables were added, and which ' +
        'devices were left without one, and why.',
    },
    areas: {
      title: 'Group them with areas',
      text:
        'An area is a coloured rectangle with a name, drawn behind a group of devices to say ' +
        'what they are: Core, Edge, Offices, Internet. The sample networks, all but the ' +
        'simplest, already have theirs. In the “Add device” panel there is “Area”, which adds ' +
        'one at the centre of the view; or select the devices and choose Edit → “Enclose in an ' +
        'area” (it is also in the right-click menu of a device): the area is drawn around them. ' +
        'Type the name and press Enter. Grab an area by its name or its border: dragging it ' +
        'moves it, and the devices stay where they are; when it is selected alone it shows eight ' +
        'handles to resize it. Ctrl + click on its name adds it to the selection of the devices, ' +
        'and it is moved, copied and deleted with them. A double click on the name renames it, a ' +
        'right click opens a menu with “Rename”, the colours and “Delete”, and the Delete key, ' +
        'after asking, deletes the selected area. ' +
        'The inside of an area does not get in the way: devices inside it are selected, ' +
        'connected and moved as usual. Areas also show in a presentation and in the exported ' +
        'image, and are saved with the project. View → “Show areas” hides them and shows them ' +
        'again: a choice of this browser, which does not change the drawing. Hidden, they show ' +
        'neither in a presentation nor in the image, and cannot be taken; a new area shows them ' +
        'again.',
    },
    configure: {
      title: 'Configure them',
      text:
        'A double click on a device opens its window (the same as right click → “Details ' +
        '(edit)”). The first tab, “General”, adapts to the kind of device: for a PC or a server it ' +
        'shows the name and the address, which is typed there; for a switch, the VLANs and how the ' +
        'ports are split; for a router or a firewall, the ports in use, each with its address, what ' +
        'it is connected to and its role. Switches, routers and firewalls also have the “Ports” ' +
        'tab: choose a port and its settings appear below; the “Number of ports” is changed there ' +
        'too. The other devices have “Network cards”, with the name, speed and MAC of each card. ' +
        'In “General” every device also has its “Notes”: free text, of several lines, for what ' +
        'does not fit in a field. On the drawing a small square after the name says the device ' +
        'has a note; hover over the device to read it. Problems ' +
        'are shown under the field as you type; changes take effect only when you press “Save”.',
    },
    route: {
      title: 'Route between networks',
      text:
        'Every port of a router or a firewall can have an address (“Ports” tab): it is the gateway ' +
        'of the devices connected there, and the network of that port is reached without a route. ' +
        'The networks behind another router are written in the “Routes” tab, with the address of ' +
        'the next hop; the gateway of the router is its default route. The same tab shows the ' +
        'routing table that results. A route is needed for the return path too. A second route to ' +
        'the same network is a backup: it takes over when the line of the first is down.',
    },
    vlans: {
      title: 'Separate with VLANs',
      text:
        'In the “Ports” tab of a switch every port is either an access port, in one VLAN, or a ' +
        'trunk, which carries several VLANs tagged. Two ports in different VLANs do not talk to ' +
        'each other: to let them communicate you need a router with a port in each. Once a port ' +
        'has a VLAN, the ones you did not touch are in VLAN 1. VLANs can be called by name: in ' +
        'Settings → Network, under “Project VLANs”, you find the ones used on the board and type ' +
        'the name of each; “Add VLAN” adds another. Once saved, the name appears next to the ' +
        'number, for example VLAN 10 “Offices”, in the window of the switch and in the settings of ' +
        'its ports. In the terminal VLANs stay numbers.',
    },
    firewall: {
      title: 'Filter with the firewall',
      text:
        'The ports of a firewall are put in a zone: trust, untrust or dmz. Without rules the zone ' +
        'policy decides: traffic towards a more trusted zone is denied, the rest passes. The ' +
        'exceptions are written in the “Rules” tab, read top to bottom: the first that matches ' +
        'decides, by service (ping, web, email, DNS), source and destination. Where a cable is not ' +
        'attached to a port, or its port is in no zone, the zones cannot decide: a firewall with an ' +
        'enabled rule then blocks what no rule allows. A firewall lets through the reply to a flow ' +
        'it allowed itself. A router has the same “Rules” tab: its rules ' +
        'filter what it routes. A router with no rules lets everything through; once it has an ' +
        'enabled one, it blocks what no rule allows, as a real router does.',
    },
    nat: {
      title: 'Go out to the Internet with NAT',
      text:
        'A Cloud symbol named “Internet” does not carry private addresses (10.x, 172.16–31.x, ' +
        '192.168.x): whoever is inside does not get out and whoever is outside does not get in, ' +
        'until a router or a firewall translates the addresses. In the “NAT” tab of the router or ' +
        'the firewall, tick the port that faces the Internet (it is the same choice as “NAT ' +
        'enabled” on the port, in the “Ports” tab): traffic that leaves takes the address of that ' +
        'port, and the reply comes back to whoever asked. To reach a server on the inside from ' +
        'outside, press “Add port forward” below: service, the port it arrives on, the inside ' +
        'address. Whoever is outside sends the request to the address of the port, and the reply ' +
        'comes back from there. On a firewall the rule that allows it is needed too, in the ' +
        '“Rules” tab. The sample network on the welcome screen is set up this way.',
    },
    dhcp: {
      title: 'Hand out addresses with DHCP',
      text:
        'A device can get its address automatically: in the “Network cards” tab, under “Address”, ' +
        'choose “Automatic (DHCP)” instead of “Manual”. A DHCP server on the same network hands it ' +
        'out: a router or firewall port, or the card of a server. It is enabled in the “DHCP” tab ' +
        'of that device, by ticking the port or the card: the range from “First address” to “Last ' +
        'address” is suggested, and can be changed (it is the same choice as “DHCP server enabled” ' +
        'on the port or on the card). The subnet mask and the gateway come with the address. The ' +
        'addresses are worked out from the drawing, the same way every time: the devices are ' +
        'served in the order they appear and each takes the first free address, skipping the ones ' +
        'set manually. The “DHCP” tab also lists who took which address, and on the drawing a ' +
        'leased address is followed by “DHCP”. A card that finds no server is left without an ' +
        'address, and its window says why; when it is the first card of the device, the top of ' +
        'its drawing on the board turns yellow. A router does not pass the request on to another ' +
        'network: DHCP relay is not simulated, nor are reservations and lease times. In the sample ' +
        'network on the welcome screen the two laptops get their address this way, from ' +
        'Router-Core.',
    },
    dns: {
      title: 'Call devices by name with DNS',
      text:
        'A server can act as a DNS server: in its “DNS” tab press “Add record” and type a name, ' +
        'for example `erp.company.example`, and the address it stands for. Each device decides ' +
        'whom to ask: in the “Network cards” tab the “DNS server” field holds the address of the ' +
        'server. To avoid typing it every time, Settings → Network has “Default DNS server”: new ' +
        'devices start with it on their card and, once it is saved, it can also be assigned below ' +
        'to the devices on the board that have none. A device that takes its address from DHCP ' +
        'gets that too, if “DNS server for clients (optional)” is filled in on the DHCP server. A ' +
        'name is used in the terminal in place of an address: `ping erp.company.example from ' +
        'PC-Sales` first asks the DNS server for the address, with a query that crosses the ' +
        'network like any other exchange and can stop in the same ways, and then pings; `resolve ' +
        'erp.company.example from PC-Sales` only sends the query. For a firewall the query is the ' +
        '“DNS” service, chosen in rules and in port forwards. Nothing is cached: the name is ' +
        'looked up again every time. Not simulated: a secondary DNS server, forwarding to other ' +
        'servers, and reverse lookup; the simulation and the presentation choose devices from ' +
        'menus and do not use names. In the sample network on the welcome screen Srv-Auth knows ' +
        'three names, the offices and the laptops ask it, and Remote-Customer has nobody to ask.',
    },
    ask: {
      title: 'Ask whether one device reaches another',
      text:
        'Open “Simulation” (the button with the lightning bolt), choose “Source”, “Destination” ' +
        'and the “Traffic type” (ping, email, web page or download), then press “Start ' +
        'simulation”. The packet travels across the network on the drawing. If it does not ' +
        'arrive, the animation stops where the traffic is blocked and a message gives the reason: ' +
        'which device, which port, which route or which rule. Once the packet has gone all the ' +
        'way, the top of the drawing of the device that answers turns green, or that of the ' +
        'device where the question stops turns red, with a border of the same colour; they stay ' +
        'so until the next question, a change to the drawing or a click on an empty spot of the ' +
        'board. Questions asked from the terminal do the same.',
    },
    terminal: {
      title: 'Use the terminal',
      text:
        '“Console”, in the bar on the left, opens the terminal. Right-click a device → “Console” ' +
        'opens it already on that device. The commands are in English: for example, on the sample ' +
        'network on the welcome screen, `ping Web-ERP from PC-Sales`, `trace Web-ERP from Laptop-1 ' +
        'as web` or `show routes Router-Core`. Those that change the network, such as `add route ' +
        '192.168.40.0/24 via 10.0.0.2 on Router-Core`, edit the same drawing you see. The list is ' +
        'in the “Terminal commands” tab.',
    },
    present: {
      title: 'Present the network',
      text:
        '“Present”, at the top right, puts the drawing tools away: the drawing stays, fitted to ' +
        'the window and no longer editable with the mouse, with a panel next to it. A click on a ' +
        'device opens a small menu: “Start here” and “Arrive here” choose the two ends of the ' +
        'question, which can also be chosen from the “From” and “To” menus of the panel. Once the ' +
        'traffic type is chosen (Ping, Web or Email) the packet sets off by itself and the panel ' +
        'says whether it arrives, which devices it goes through and, if it stops, where and why. ' +
        'In the bar at the top you set the speed of the packet, open the terminal and go to full ' +
        'screen. You leave with “Exit” or with the Esc key.',
    },
    failures: {
      title: 'Ask what happens if something breaks',
      text:
        'In a presentation, a click on a device or on a cable and then “Simulate a failure” ' +
        'treats it as broken. The drawing does not change, and the failure is gone when you leave. ' +
        'The question on screen is asked again at once: if there is another path the packet takes ' +
        'it, otherwise it stops and the panel says where. Between switches the path is the ' +
        'shortest that works; a router moves to the backup route when the line of the main route ' +
        'has failed. Under “Simulated failures” is the effect on the rest of the network: how many ' +
        'exchanges between the end devices stop, how many take another path, how many do not ' +
        'change. A click on one of them shows it. The sample network “Two sites: main line and ' +
        'backup line” is made for trying this. Spanning tree is not simulated.',
    },
    picture: {
      title: 'Export the drawing as an image',
      text:
        'File → Export image… shows a preview of the whole drawing, without selections. ' +
        'Choose the format: PNG, for documents, slides and messages, in three ' +
        'sizes, or SVG, a vector file. Choose the theme, light or dark, whatever the theme on ' +
        'screen, and with “Project name at the top” and “Transparent background” what is around ' +
        'the drawing. “Save PNG…” asks where to save the file; in browsers that cannot ask, the ' +
        'button is “Download PNG”. Where the browser allows it, “Copy to clipboard” leaves the ' +
        'image ready to paste. In a presentation the same window opens from the “Export image” ' +
        'button of the bar at the top: the image shows the simulated failures and the path of the ' +
        'answer and, with “Question and answer under the drawing”, includes the question and its ' +
        'answer.',
    },
    canvases: {
      title: 'Split the project into boards',
      text:
        'A project can have several boards. In “Explorer”, the first button of the bar on the ' +
        'left, you add one with “New board”, rename them, duplicate them with “Duplicate board” ' +
        '(the copy, with everything on it, comes right after), delete them (at least one always ' +
        'stays) and move from one to another with a click. The name and the description of the project ' +
        'are changed there too.',
    },
    save: {
      title: 'Save to a file',
      text:
        'The work stays in the browser even after the page is reloaded. To keep it, or to take it ' +
        'to another computer, use File → Save (Ctrl + S): the project, with all its boards, is ' +
        'written to a `.pixelcake.json` file, which File → Open… opens again. In Chrome and in ' +
        'Edge the chosen file is updated at every save; in other browsers it is downloaded.',
    },
    yaml: {
      title: 'Import and export in YAML',
      text:
        '“Import/Export”, in the bar on the left, exports the network of the open board as YAML, ' +
        'to copy or to download, and loads it back from a `.yaml` or `.yml` file, in place of the ' +
        'one that is there or in addition to it. The Terraform export is only a draft and cannot ' +
        'be applied.',
    },
    language: {
      title: 'Choose the language',
      text:
        'The interface is in Italian and in English: choose with IT and EN at the top right, ' +
        'next to the theme, or in Settings → Appearance. It changes at once, without reloading ' +
        'the page, and your choice is saved in this browser. What you wrote does not change, nor ' +
        'do the names the app has already given: a project, a board, the devices of a sample ' +
        'network stay in the language they were made in. The terminal speaks English in both ' +
        'languages.',
    },
  },

  prototype:
    'PixelCake is a beta: it is for reasoning about a small network, not for validating a ' +
    'real one.',

  commands: {
    intro:
      'The same list is printed by typing `help` in the terminal. Device names are not ' +
      'case-sensitive and can be made of several words. Where a command asks for a target you ' +
      'can also write a name such as `www.company.example`: the source device first asks its own ' +
      'DNS server for the address.',
    /** `<docs>` is the link to the terminal reference of the documentation, in a new tab of the browser */
    reference:
      'Every command, with its full syntax and real examples, is explained in the <docs>terminal ' +
      'reference</docs> of the documentation, which opens in a new browser tab.',
    command: 'Command',
    does: 'What it does',
  },

  about: {
    description: 'A visual environment for drawing a small network and checking it',
    version: 'Version',
    licence: 'Licence',
    licenceText: 'AGPL-3.0, open source',
    site: 'Website',
    repository: 'Repository',
    technologies: 'Technologies',
    /** What the app bundles from others, each name a link to the text of its licence */
    thirdParty: {
      title: 'Third-party licences',
      fonts: 'Fonts',
      icons: 'icons',
      /** Between the last two names of a list */
      and: ' and ',
    },
  },
};
