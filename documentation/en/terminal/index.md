---
title: "Overview and conventions"
description: "The terminal of PixelCake and its language, NCL: how to open it, how a command is written, what an answer says."
order: 1
---

The terminal asks the network questions and changes it with typed commands, in a vendor-neutral language called NCL, the Network Command Language. `ping Web-01 from PC-1` asks whether one device reaches another; `interface 3 down on Router-1` switches a port off. Both work on the drawing you see, and with the same engine as the simulation panel: a question sent from the terminal travels on the board, and a command that changes the network edits the board.

The language is plain English with optional small words, case does not matter, and a name of a device is written as it is on the board. It does not copy the commands of any manufacturer. This section is the reference of the language: every command, with its syntax, what it does, and what it prints when it is refused. The terminal speaks English in both languages of the app, so the commands and the answers on these pages are the same in the Italian pages; only the explanations change.

![A ping typed in the terminal: the packet travels on the board from PC-1 through Switch-1 to Server-1, and the lines of the answer appear as it reaches each device. A trace of the same way follows.](../../media/terminal/ping-on-the-board.en.mp4 "A ping and a trace typed in the terminal, and the packet on the board.")

## Opening the terminal {#open}

There are three ways in:

- **“Console”**, the fourth button of the bar on the left, opens the terminal.
- **Right-click a device → “Console”** opens it already inside that device: the prompt is the name of the device, and `from` and `on` are implied ([`use`](help.md#use)).
- **“Terminal”**, in the bar at the top of a presentation, opens it while presenting ([the terminal while presenting](../asking/presentation.md#terminal)).

The terminal is a window of its own, not a dialog: it has no backdrop, and the board stays usable behind it. It opens small, at the right of the board, so that the drawing stays in view. Drag it by its title bar, resize it from the corner at the bottom right, and close it with the cross at the right of the title bar, or with Esc. Closing does not clear it: what was printed, and the lines you can recall with the Up key, are there when you open it again, until the page is reloaded.

The window starts with `PixelCake Terminal` and `type 'help' to list commands`. The prompt is `pixelcake>`; inside a device it is the name of the device, `PC-1>`. Type a line and press Enter. The keys the line takes are in [Help and the session](help.md#keys). The window and its frame follow the language of the interface (“Terminal” and the label of the input are translated); what is typed and what is printed are English in both.

A question that travels holds the prompt until the packet has gone all the way, and prints its lines as the packet reaches each device. Ctrl+C stops it. When the packet has arrived the device that answers turns green on the board, and when it has been stopped the device that stopped it turns red, until the next question, a change to the drawing, or a click on an empty spot of the board ([Asking](asking.md)).

## How commands are written here {#conventions}

Each command has a **syntax block**: the form of the command, in a box with no prompt. These characters are not typed; they say how to read the form:

| Written | Means |
|---|---|
| `ping`, `from` | A word typed as it is. Case does not matter |
| `<device>` | A value you replace by your own: the name of a device, an address, a number. The kind is said in the table under the block |
| `[from <device>]` | Optional |
| `trust\|untrust\|dmz` | One of these, as it is (written with a bar, `\|`, in a table cell) |
| `[of] <device>` | A small word that may be left out: `show config of PC-1` and `show config PC-1` are the same |
| `<vlan>,<vlan>,…` | A list, as long as needed, with commas |

After the block, a table says what each value is, and the text says what the command does to the network and what it prints. Words that mean the same are shown as aliases in the block: `ls` and `list` under `show devices`.

An **example** is a session with its prompt: the lines that begin with `pixelcake>` are typed, the lines under them are what the terminal prints, word for word. They are run against the app each time the documentation is built, so they are never out of date. Every example starts from a sample network, named above it, and the commands go on one after the other: what an earlier line changed is still changed in the next. The samples are the ones of the “Samples” tab of the “Add” panel ([the samples](../reference/samples.md)).

```ncl sample=office
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=0.44ms
pixelcake> interface 2 down on Router-1
port 2 on Router-1 is now down
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: port 2 on Router-1 is disabled
  dropped at: Router-1
```

In the Italian pages the sample networks are loaded in Italian and the devices have Italian names (PC-Vendite, Portatile-1), while the commands and the answers stay English.

When `use <device>` is typed, the prompt takes the name of the device and the example is written with it: `PC-1> ping Web-01`.

## Devices, addresses, names {#names}

A device is named as it is on the board:

- **Case does not matter**: `pc-1`, `PC-1` and `Pc-1` are the same device.
- **A name may have several words**: `ping PC Sales 1 from Core Switch HQ`. The small words `from`, `to`, `of`, `on` and `via` split the line, so that the name needs no quotes unless it has one of them inside: write it between double quotes then.
- **An address stands for a device**: where a device is expected, one of its addresses may be typed. In a question the address is the one aimed at: `ping 192.168.20.1` reaches that interface of the router, and not the address the router is known by.
- **A host name is a target**: where a question has a target, `www.company.example` may be written. The source asks its DNS server for the address first, and the question then goes to that address ([Asking](asking.md#targets)).
- **A name that is not found is never guessed.** The answer is `device not found: "Web 01"` and, when a device has a name close to it, `did you mean "Web-01"?`. A verb or a word after `show` that is not known is answered in the same way.

`use <device>` makes one device the subject of every command that follows ([Help and the session](help.md#use)). The words `the`, `a`, `device` and `host` before a name are dropped ([The grammar](grammar.md#tolerances)).

## What an answer says {#answers}

An answer is the lines the terminal prints after a command. They come in colours: green for what worked, red for what was refused or failed, grey for what is said in passing (a note, a warning, a hint), and white for tables and lists.

**A question** (`ping`, `trace`, `browse`, `mail`, `download`, `resolve`) ends in one of four words in its last line, its *verdict*: `success`; `blocked`, when a device dropped the packet; `unreachable`, when no cable joins the two devices; `error`, when the question cannot be asked at all. A failed question gives the reason, in the words of the network: the device, the port, the route or the rule. Under it, `dropped at:` names the device that stopped the packet. Lines that start with `note:` are what the engine assumed or did on the way and did not verify. All of it is explained, with examples, in [Asking](asking.md), and in [how the engine decides](../asking/how-the-engine-decides.md#reasons).

**A command that changes the network** prints one line for what it did, in the present: `port 2 on SW-Office is now down`. Under it, in grey, what else follows from it (a warning, a name turned into an address, the next command to try). A command that finds the network already as asked says so in grey and changes nothing: `port 2 on SW-Office is already down`.

**A command that is refused** changes nothing, and says what was expected: the form of the command, or the reason in the terms of the network. An unknown command prints `unknown command: "<the line>"`, then a hint, then `type "help" for the command list`. Every page of this section ends with the refusals of its commands.

## Commands that change the network {#edits}

`set`, `interface`, `add`, `remove`, `connect` and the other commands that write are the same edits as the windows of the devices: they go through the same code, and the result is on the board at once. What they write is saved with the project like any other edit: in the browser at once, in the project file at the next save ([saving and files](../getting-started/saving-and-files.md)).

A command checks what it can before it writes, and writes nothing if it refuses. A change to the drawing clears the answer left on the board by the last question, because that answer was about the drawing as it was. Presentation mode does not change the drawing, and a terminal opened there sees the failures that are being simulated ([Presentation](../asking/presentation.md#terminal)).

## The commands, by group {#groups}

- [Interfaces and VLANs](interfaces-and-vlans.md): switch an interface on or off, give it an address and a gateway, put a switch port in a VLAN, the VLAN list of a device.
- [Devices and addresses](devices-and-addresses.md): the address, mask, gateway and name of a device; `connect` and `disconnect`.
- [Routes](routes.md): `add route`, `add backup route`, `remove route`.
- [Firewall and NAT](firewall-and-nat.md): zones, rules, source NAT, port forwards.
- [DHCP and DNS](dhcp-and-dns.md): a card on DHCP, a pool, the DNS server a card asks, the records of a server.
- [Asking](asking.md): `ping`, `trace`, `browse`, `mail`, `download`, `resolve`, and what a target is.
- [Show commands](show.md): everything that reads the network.
- [Help and the session](help.md): `help`, `use`, `exit`, `clear`, the keys of the terminal.
- [The grammar](grammar.md): the language on one page, with its tolerances and its aliases.

> [!LIMITS]
> The terminal knows what the engine knows. ARP and MAC tables, spanning tree, dynamic routing, router sub-interfaces, ports other than the four services, and the bandwidth and the load of a cable are not simulated, and no command speaks of them; the time of a ping is worked out from the cables and the devices of its path. The commands to break and repair a device or a cable, and to list what stops working, are not in the language yet: failures are simulated in presentation mode ([what is not simulated](../reference/limits-and-faq.md#not-simulated)).

## The version of the language {#version}

The language is versioned on its own, and the version is the first line of `help`: **NCL v0.6**. Until version 1.0 the forms of the commands are stable, but aliases and the wording of the answers may still change between two minor versions. What each version added:

- **0.6**: time. `ping` prints the time of the exchange worked out from its path: the cables, each with its medium and its length or a delay written by hand, and the devices crossed. `link <A> to <B>` sets the medium, the length and the delay of a cable, and `show connections` prints them.
- **0.5**: DNS. A host name works as the target of `ping`, `trace`, `browse`, `mail` and `download`, and `resolve` looks it up alone. A server keeps records (`add record`, `remove record`), a card names its DNS server (`interface <name> dns`), a pool hands one out, `show dns`. `dns` is a service for rules and forwards, and for `trace … as dns`.
- **0.4**: DHCP. A card takes its address from a server (`interface <name> dhcp`), an interface hands out a range (`interface <n> pool`), `show dhcp`. The `show` commands tell a leased address from one written by hand.
- **0.3**: address translation. Source NAT (`interface <n> nat`), port forwards (`add forward`, `remove forward`), `show nat`. The Internet symbol no longer carries private addresses.
- **0.2**: static routes, firewall rules, settings of one interface (address, VLAN, security zone), whole exchanges (`browse`, `mail`, `download`) and `trace … as <service>`.
- **0.1**: `ping` and `trace`, `show` for devices, interfaces, ports, VLANs, connections, config, neighbors and ip, `set`, the VLAN list of a device, `connect` and `disconnect`, `interface <n> up` and `down`, `use`, `clear` and `help`.

The specification is [docs/terminal-commands.md](https://github.com/pixelcake-dev/pixelcake/blob/main/docs/terminal-commands.md) in the repository; this section explains it to the people who use it.
