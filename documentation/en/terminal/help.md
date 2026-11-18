---
title: "Help and the session"
description: "The commands of the terminal itself: help, entering and leaving a device, clearing the screen."
order: 9
---

These commands are about the terminal, not about the network: they print the list of commands, say which device the commands are about, and clear the screen. They change nothing in the drawing. The notation of the syntax blocks is explained in the [overview](index.md#conventions).

## help {#help}

```text
help [<word>]
? [<word>]
```

`help` prints the commands of the terminal, one line each: the syntax, and what it does. `?` is the same command. The list below is the one the terminal prints; it is also the list of Help → Terminal commands in the menu bar. Its last line gives the address of this reference.

```ncl sample=empty
pixelcake> help
PixelCake terminal — NCL v0.5 (Network Command Language, vendor-neutral)
  ping <target> [from <device>]                              does it answer? request and reply
  trace <target> [from <device>] [as web|email|dns]          one way, hop by hop, with what each device did
  browse | mail | download <target> [from <device>]          a whole web, email or download exchange
  resolve <name> [from <device>]                             ask the DNS server of a device what address a name stands for
  show devices | vlans | connections                         topology overview
  show interfaces [of] <device>                              unified ports + NICs table (the standard view)
  show ip [of] <device>                                      compact addressing summary (also ipconfig/ifconfig)
  show routes | rules | nat [of] <device>                    routing table, rules, address translation
  show dhcp [[of] <device>]                                  DHCP: who hands out addresses, who got which, who got none
  show dns [[of] <device>]                                   DNS: the names a server answers for, the server each card asks
  show config | ports | neighbors <device>                   device detail
  set ip|gateway|subnet|name of <device> to <value>          change device config
  interface <n> up|down on <device>                          interface state (also enable|disable port <n>)
  interface <n> ip <address>/<prefix> on <device>            address of a router/firewall port or network card
  interface <n> access <vlan> | trunk <vlans>|all | default  VLAN of a switch port
  interface <n> zone trust|untrust|dmz|none on <device>      security zone of a firewall port
  interface <n> nat [off] on <device>                        source NAT on a router/firewall port: what leaves takes its address
  interface <name> dhcp [off] on <device>                    a network card takes its address from a DHCP server
  interface <n> [dhcp] pool <first> to <last> on <device>    DHCP server on a router/firewall port or a server card (pool none)
  interface <name> dns <address>|none on <device>            the DNS server a network card asks when a name is used
  add route <network>|default via <next hop> on <device>     static route (remove route <network> from <device>)
  add backup route <network> via <next hop> on <device>      second route to a network, used when the line of the first is down
  add rule allow|deny <service> from <src> to <dst> on <fw>  rule of a router or firewall (remove rule <n> from <fw>)
  add forward <svc> from interface <n> to <address> on <dev> publish a service inside (remove forward <n> from <dev>)
  add record <name> <address> on <server>                    a name a DNS server answers for (remove record <n>|<name> from <server>)
  add vlan <id> to <device>                                  VLAN list of a device (remove vlan <id> from <device>)
  connect <A> to <B>                                         create a link (disconnect <A> from <B>)
  use <device> / exit                                        enter/leave device context (implies "from" and "on")
  clear, help [command]                                      screen and this reference
  device names are case-insensitive and may be multi-word; IPs work anywhere a device is expected
  a host name (www.company.example) works as a target: the source asks its DNS server for the address first
  every command explained, with examples: https://app.pixelcake.dev/docs/terminal/
```

| Parameter | What it is |
|---|---|
| `<word>` | A word to look for. It may be part of a word, and case does not matter |

With a word, `help` prints only the lines whose syntax contains it: `help route` gives the lines about routes, `help ping` the line of `ping`. The word is looked for in the syntax column and not in the description. When no line has it the answer says so.

```ncl sample=empty
pixelcake> help ping
ping <target> [from <device>]                              does it answer? request and reply
pixelcake> help route
show routes | rules | nat [of] <device>                    routing table, rules, address translation
add route <network>|default via <next hop> on <device>     static route (remove route <network> from <device>)
add backup route <network> via <next hop> on <device>      second route to a network, used when the line of the first is down
pixelcake> ? vlan
show devices | vlans | connections                         topology overview
interface <n> access <vlan> | trunk <vlans>|all | default  VLAN of a switch port
add vlan <id> to <device>                                  VLAN list of a device (remove vlan <id> from <device>)
pixelcake> help banana
no help for "banana" — try "help" for the full list
```

The table is shorter than the language: it gives one line for several commands and does not list every alias. The syntax blocks of the pages of this section are the complete ones.

## use and exit {#use}

```text
use <device>
exit
quit
```

`use <device>` makes a device the one every command is about, until `exit`. The prompt takes the name of the device (`PC-1>`), and in every command `from` and `on` are implied: `ping Web-01` is a ping from the device, `show routes` is its table, `interface 3 down` is one of its ports. A command that names another device still goes to that one: inside `PC-1>`, `show interfaces Router-1` is about Router-1. `quit` is the same as `exit`.

| Parameter | What it is |
|---|---|
| `<device>` | A device, named as on the board or by one of its addresses. The word `device` or `host` before the name is dropped: `use device SW-Office` |

A terminal opened from a device (right-click → “Console”) starts already inside it. `use` replaces the device it was inside: it does not stack. `exit` says `left <device>`, and at the top says that it is already there.

```ncl sample=office
pixelcake> use PC-1
context: PC-1 — "from" is now implied, "exit" to leave
PC-1> ping Web-01
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms
PC-1> trace Mail-01
Tracing route to Mail-01 (192.168.20.20) from PC-1:
  1  ○ PC-1 (PC)
  2  ○ SW-Office (Switch)
  3  ○ Router-1 (Router)  — routed: 192.168.20.0/24 is on port 2
  4  ○ SW-Servers (Switch)
  5  ● Mail-01 (Server)
Trace complete: destination reached.
PC-1> show ip
PC-1 — addressing
  ip:       192.168.10.11
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1
PC-1> show interfaces Router-1
IFACE      KIND   STATE   IP               VLAN       MODE-ZONE  LINK
1          port   up      192.168.10.1     -          -          SW-Office (port 8)
2          port   up      192.168.20.1     -          -          SW-Servers (port 8)
3          port   up      -                -          -          -
4          port   up      -                -          -          -
PC-1> use Router-1
context: Router-1 — "from" is now implied, "exit" to leave
Router-1> show routes
ROUTES of Router-1
DESTINATION          VIA              OUT      KIND
192.168.10.0/24      -                port 1   connected
192.168.20.0/24      -                port 2   connected
Router-1> interface 3 ip 10.0.0.1/30
port 3 on Router-1: 10.0.0.1 / 255.255.255.252
Router-1> exit
left Router-1
pixelcake> exit
already at global scope
pixelcake> use Nothing
device not found: "Nothing"
pixelcake> use device SW-Office
context: SW-Office — "from" is now implied, "exit" to leave
SW-Office> quit
left SW-Office
```

> [!NOTE]
> The terminal keeps the name of the device it is inside. Renaming that device, with `set name` or in its window, moves the prompt to the new name ([Devices and addresses](devices-and-addresses.md#set)).

## clear {#clear}

```text
clear
cls
```

Empties the screen of the terminal: what was printed before goes away. The commands you typed are still in the history ([below](#keys)), and the drawing is not touched. `cls` is the same command.

```ncl sample=empty
pixelcake> clear
pixelcake> cls
```

## Keys {#keys}

The line of the terminal takes these keys:

| Key | What it does |
|---|---|
| Enter | Runs the line. An empty line only moves to a new prompt |
| Up | Brings back the last line you ran, and with each press the one before it |
| Down | Goes forward in the history; past the last line it gives back what you were typing |
| Ctrl+C | Stops the question that is running: the packet stops on the board and the terminal prints `^C — interrupted`. When nothing is running it does what it does anywhere else, and copies the selected text |

Typing a letter leaves the history and edits the line you are on. The history holds every non-empty line of the session, errors included, for as long as the page is open: it is not saved with the project, and it is lost when the page is reloaded. Tab does nothing in the terminal: a name is not completed. Esc closes the terminal, as its cross does; a question that is still travelling is interrupted first, as Ctrl+C does.

A question that travels (`ping`, `trace`, `browse`, `mail`, `download`, `resolve`) holds the prompt until the packet has arrived or stopped: the line `▌ running… — press Ctrl+C to interrupt` is where the prompt would be. The commands that only read or only write answer at once.

## See also {#see-also}

- [Overview](index.md#open): opening the terminal, the window, and the prompt.
- [Asking](asking.md): the commands that hold the prompt while the packet travels.
- [The grammar](grammar.md): what `use <device>` implies for every command.
