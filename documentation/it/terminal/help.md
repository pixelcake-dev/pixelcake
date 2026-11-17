---
title: "help e la sessione"
description: "I comandi del terminale stesso: help, entrare in un dispositivo e uscirne, pulire lo schermo."
order: 9
---

> [!TODO]
> Una pagina di riferimento: seguire terminal/interfaces-and-vlans.md. L'output di `help` qui sotto è eseguito dai test: quando cambia la tabella del terminale, questo blocco cambia con lei, nelle due lingue.

## help {#help}

```text
help [<word>]
? [<word>]
```

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
  show routes | rules | nat [of] <device>                    routing table, firewall rules, address translation
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
  add rule allow|deny <service> from <src> to <dst> on <fw>  firewall rule (remove rule <n> from <fw>)
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

> [!TODO]
> Tutta la tabella, o le righe che parlano di una parola; ? è help.

## use ed exit {#use}

```text
use <device>
exit
quit
```

> [!TODO]
> Un dispositivo di cui parla ogni comando; il prompt; quit.

## clear {#clear}

```text
clear
cls
```

> [!TODO]
> Pulisce lo schermo; cls.

## Tasti {#keys}

> [!TODO]
> Su e giù per la cronologia, Ctrl+C per fermare un comando, Esc.
