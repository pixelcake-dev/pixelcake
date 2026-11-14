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
  sections: 'Sections of the guide',

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
      title: 'Add the devices',
      text:
        'In the bar on the left open “Add device” (the + button) and choose a type from the list: ' +
        'check the name and confirm; the IP address is suggested automatically and can be changed, ' +
        'or left to DHCP. The device appears at the centre of the part of the board you are looking ' +
        'at (or in the first free place next to it) and is already selected. “Bulk add” creates ' +
        'many at once. In the “Samples” tab of the same panel there are four sample networks ready ' +
        'to use: that of a small company (the same as on the welcome screen), a simple one, one ' +
        'with VLANs, a DMZ and a firewall, and one with two sites and a backup line. Loading one ' +
        'takes the place of what is on the board.',
    },
    moveAndSelect: {
      title: 'Move and select them',
      text:
        'Drag a device to move it. With Ctrl + click you select more than one; dragging on empty ' +
        'space draws a selection box. Dragging with the right button on empty space moves the ' +
        'view, and the wheel zooms. All the shortcuts are in Settings → Advanced.',
    },
    connect: {
      title: 'Connect them',
      text:
        'Every device has four connection points, one on each side: they show when you move the ' +
        'pointer over it or select it. Drag from one point to a point of another device: at each ' +
        'end the link is assigned to a free port or network card. On a firewall with security ' +
        'zones the port has to be chosen by hand. With a right click on the link, “Edit link” lets ' +
        'you change the interfaces, the type, the bandwidth, the label and the colour.',
    },
    areas: {
      title: 'Group them with areas',
      text:
        'An area is a coloured rectangle with a name, drawn behind a group of devices to say what ' +
        'they are: Core, Edge, Offices, Internet. In the “Add device” panel there is “Area”, which ' +
        'adds one at the centre of the view; or select the devices and choose Edit → “Enclose in ' +
        'an area” (it is also in the right click on a device): the area is drawn around them. Type ' +
        'the name and press Enter. An area is picked up by its name or by its border: dragging it ' +
        'moves it, and the devices stay where they are; when it is selected it shows eight handles ' +
        'to resize it. A double click on the name renames it, a right click opens a menu with ' +
        '“Rename”, the colours and “Delete”, and the Delete key deletes the selected area. The ' +
        'inside of an area is not in the way: in there devices are selected, linked and moved as ' +
        'always. Areas also show in a presentation and in the exported picture, and are saved ' +
        'with the project.',
    },
    configure: {
      title: 'Configure them',
      text:
        'A double click on a device opens its window (the same as right click → “Details ' +
        '(edit)”). The first screen, “General”, is made for the device: for a PC or a server it ' +
        'shows the name and the address, which is typed there; for a switch, the VLANs and how the ' +
        'ports are split; for a router or a firewall, the ports in use, each with its address, its ' +
        'link and what it does. Switches, routers and firewalls also have the “Ports” tab: choose ' +
        'a port and its settings appear below; the “Number of ports” is changed there too. The ' +
        'other devices have “Network cards”, with the name, speed and MAC of each card. In ' +
        '“General” every device also has its “Notes”: free text, of several lines, for what does ' +
        'not fit in a field. On the drawing you read them by resting the pointer on the device. ' +
        'What is wrong is said under the field as you type; the changes count only after you ' +
        'press “Save”.',
    },
    route: {
      title: 'Route between networks',
      text:
        'Every port of a router or a firewall can have an address (“Ports” tab): it is the gateway ' +
        'of the devices linked there, and the network of that port is reached with nothing else. ' +
        'The networks that lie behind another router are written in the “Routes” tab, with the ' +
        'address of the next hop; the gateway of the router is its default route. The same tab ' +
        'shows the routing table that results. A route is needed for the way back too. A second ' +
        'route to the same network is a backup: it takes over when the line of the first is down.',
    },
    vlans: {
      title: 'Separate with VLANs',
      text:
        'In the “Ports” tab of a switch every port is either an access port, in one VLAN, or a ' +
        'trunk, which carries several VLANs tagged. Two ports in different VLANs do not talk to ' +
        'each other: to let them communicate you need a router with a port in each. Once a port ' +
        'has a VLAN, the ones you did not touch are in VLAN 1. VLANs can be called by name: in ' +
        'Settings → Network, under “VLANs of the project”, you find the ones used on the board and ' +
        'type the name of each; “Add VLAN” adds another. Once saved, the name appears next to the ' +
        'number, for example VLAN 10 “Offices”, in the window of the switch and in the settings of ' +
        'its ports. In the terminal VLANs stay numbers.',
    },
    firewall: {
      title: 'Filter with the firewall',
      text:
        'The ports of a firewall are put in a zone: trust, untrust or dmz. Without rules the zone ' +
        'policy decides: traffic towards a more trusted zone is denied, the rest passes. The ' +
        'exceptions are written in the “Rules” tab, read top to bottom: the first that matches ' +
        'decides, by service (ping, web, email, DNS), source and destination. The reply to an ' +
        'allowed flow always passes.',
    },
    nat: {
      title: 'Go out to the Internet with NAT',
      text:
        'A Cloud symbol named “Internet” does not carry private addresses (10.x, 172.16-31.x, ' +
        '192.168.x): whoever is inside does not get out and whoever is outside does not get in, ' +
        'until a router or a firewall translates the addresses. In the “NAT” tab of the router or ' +
        'the firewall, tick the port that faces the Internet (it is the same choice as “NAT ' +
        'enabled” on the port, in the “Ports” tab): what leaves takes the address of that port, ' +
        'and the reply comes back to whoever asked. To reach from outside a server that is inside, ' +
        'press “Add port forward” below: service, the port it arrives on, the inside address. ' +
        'Whoever is outside asks the address of the port, and the reply comes back to them from ' +
        'there. On a firewall the rule that allows it is needed too, in the “Rules” tab. The ' +
        'sample network of the welcome screen is made this way.',
    },
    dhcp: {
      title: 'Hand out addresses with DHCP',
      text:
        'A device can take its address by itself: in the “Network cards” tab, under “Address”, ' +
        'choose “Automatic (DHCP)” instead of “Manual”. A DHCP server of the same network hands it ' +
        'out: a router or firewall port, or the card of a server. It is switched on in the “DHCP” ' +
        'tab of that device, with the tick next to the port or the card: the range from “First ' +
        'address” to “Last address” is suggested, and can be changed (it is the same choice as ' +
        '“DHCP server enabled” on the port or on the card). The subnet mask and the gateway come ' +
        'with the address. The addresses are worked out from the drawing, the same way every ' +
        'time: the devices are served in the order they appear and each takes the first free ' +
        'address, skipping the ones written by hand. The “DHCP” tab also lists who took which ' +
        'address, and on the drawing a leased address is followed by “DHCP”. A card that finds no ' +
        'server is left without an address, and its window says why. A router does not pass the ' +
        'request on to another network: the relay is not simulated, nor are reservations and ' +
        'lease times. In the sample network of the welcome screen the two laptops take their ' +
        'address this way, from Router-Core.',
    },
    dns: {
      title: 'Call devices by name with DNS',
      text:
        'A server can act as a DNS server: in its “DNS” tab press “Add record” and type a name, ' +
        'for example `erp.company.example`, and the address it stands for. Each device decides ' +
        'whom to ask: in the “Network cards” tab the “DNS server” field holds the address of the ' +
        'server. So as not to type it every time, Settings → Network has “Default DNS server”: new ' +
        'devices start with it on their card and, once it is saved, it can also be assigned below ' +
        'to the devices of the board that have none. Whoever takes its address from DHCP gets that ' +
        'too, if “DNS server handed out (optional)” is filled in on the DHCP server. A name is ' +
        'used in the terminal in place of an address: `ping erp.company.example from PC-Sales` ' +
        'first asks the DNS server for the address, with a question that crosses the network like ' +
        'any other exchange and can stop in the same ways, and then pings; `resolve ' +
        'erp.company.example from PC-Sales` only asks the question. For a firewall the question ' +
        'is the “DNS” service, chosen in rules and in port forwards. Nothing is remembered: the ' +
        'name is asked again every time. Not simulated: a second DNS server to fall back on, ' +
        'passing the question on to other servers, and reverse lookup; the simulation and the ' +
        'presentation choose devices from menus and do not use names. In the sample network of ' +
        'the welcome screen Srv-Auth knows three names, the offices and the laptops ask it, and ' +
        'Remote-Customer has nobody to ask.',
    },
    ask: {
      title: 'Ask whether one device reaches another',
      text:
        'Open “Simulation” (the button with the lightning bolt), choose “Source”, “Destination” ' +
        'and the “Flow model” (ping, email, web page or download), then press “Start simulation”. ' +
        'The packet travels the network on the drawing. If it does not arrive, the animation ' +
        'stops where the traffic is blocked and a message gives the reason: which device, which ' +
        'port, which route or which rule.',
    },
    terminal: {
      title: 'Use the terminal',
      text:
        '“Console”, in the bar on the left, opens the terminal. A right click on a device → ' +
        '“Console” opens it already set on that device. The commands are in English: for example, ' +
        'on the sample network of the welcome screen, `ping Web-ERP from PC-Sales`, `trace ' +
        'Web-ERP from Laptop-1 as web` or `show routes Router-Core`. Those that change the ' +
        'network, such as `add route 192.168.40.0/24 via 10.0.0.2 on Router-Core`, edit the same ' +
        'drawing you see. The list is in the “Terminal commands” tab.',
    },
    present: {
      title: 'Present the network',
      text:
        '“Present”, at the top right, puts the drawing tools away: the drawing stays, fitted to ' +
        'the window and no longer editable with the mouse, with a panel next to it. A click on a ' +
        'device opens a small menu: “Start here” and “Arrive here” choose the two ends of the ' +
        'question, which can also be chosen from the “From” and “To” menus of the panel. Once the ' +
        'kind of exchange is chosen (Ping, Web or Email) the packet sets off by itself and the ' +
        'panel says whether it arrives, which devices it goes through and, if it stops, where and ' +
        'why. In the bar at the top you set the speed of the packet, open the terminal and go to ' +
        'full screen. You leave with “Exit” or with the Esc key.',
    },
    failures: {
      title: 'Ask what happens if something breaks',
      text:
        'In a presentation, a click on a device or on a cable and then “Simulate a failure” takes ' +
        'it as broken. The drawing does not change, and the failure is gone when you leave. The ' +
        'question on screen is asked again at once: if there is another way the packet takes it, ' +
        'otherwise it stops and the panel says where. Between switches the way is the shortest ' +
        'that works; a router moves to the backup route when the line of the main route has ' +
        'failed. Under “Simulated failures” is the effect on the rest of the network: how many ' +
        'exchanges between the end devices stop, how many take another way, how many do not ' +
        'change. A click on one of them shows it. The sample network “Two sites: main line and ' +
        'backup line” is made for trying this. Spanning tree is not simulated.',
    },
    picture: {
      title: 'Export the drawing as a picture',
      text:
        'File → Export picture… shows a preview of the whole drawing, without selections or ' +
        'connection points. Choose the format: PNG, for documents, slides and messages, in three ' +
        'sizes, or SVG, a vector file. Choose the theme, light or dark whatever the screen shows, ' +
        'and with “Project name at the top” and “Transparent background” what is around the ' +
        'drawing. “Save PNG…” asks where to save the file; in browsers that cannot ask, the button ' +
        'is “Download PNG”. Where the browser allows it, “Copy to clipboard” leaves the picture ' +
        'ready to paste. In a presentation the same window opens from the “Export picture” button ' +
        'of the bar at the top: the picture shows the simulated failures and the path of the ' +
        'answer and, with “Question and answer under the drawing”, carries the question and its ' +
        'answer.',
    },
    canvases: {
      title: 'Split the project into boards',
      text:
        'A project can have several boards. In “Explorer”, the first button of the bar on the ' +
        'left, you add one with “New board”, rename them, delete them (at least one always stays) ' +
        'and move from one to another with a click. The name and the description of the project ' +
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
  },

  prototype:
    'PixelCake is a prototype: it is for reasoning about a small network, not for validating a ' +
    'real one.',

  commands: {
    intro:
      'The same list is printed by typing `help` in the terminal. Device names are not ' +
      'case-sensitive and can be made of several words. Where a command asks for a target you ' +
      'can also write a name such as `www.azienda.example`: the source device first asks its own ' +
      'DNS server for the address.',
    command: 'Command',
    does: 'What it does',
  },

  about: {
    description: 'A visual environment for drawing a small network and checking it',
    version: 'Version',
    licence: 'Licence',
    licenceText: 'AGPL-3.0, open source',
    repository: 'Repository',
    technologies: 'Technologies',
  },
};
