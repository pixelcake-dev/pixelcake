---
title: "The grammar"
description: "The language of the terminal written out in full: the grammar, the tolerances, the principles."
order: 10
---

This page is for whoever wants the whole language on one page: the rules it is built on, the grammar, and the words it accepts besides the ones the grammar names. The other pages of this section explain each command; this one explains how a line is read. The specification of the language, which the app follows, is the file [docs/terminal-commands.md](https://github.com/pixelcake-dev/pixelcake/blob/main/docs/terminal-commands.md) of the repository: it carries the version of the language, and its sessions are run by the same tests as the examples of this reference.

## Principles {#principles}

1. **Verb first.** A line starts with what to do: `ping`, `trace`, `show`, `set`, `add`, `connect`, `use`.
2. **Prepositions are optional noise** where nothing is ambiguous: `show config of Switch-1` and `show config Switch-1` are the same line.
3. **Role keywords split names.** `from`, `to`, `of`, `on` and `via` say what each part of the line is, so that a device name of several words needs no quotes: `ping PC Sales 1 from Core Switch HQ`.
4. **Context.** `use <device>` makes a device the one every command is about: the prompt takes its name, and `from` and `on` are implied. `exit` leaves ([Help and the session](help.md#use)).
5. **Vendor-neutral words.** `show neighbors`, not the name of a protocol; `interface 3 down`, not `no shutdown`; `add route`, not `ip route`. An interface is one word for a port and a network card, and `interfaces` is the standard table of both.
6. **Tolerances are part of the language.** Optional prepositions, dropped articles, the words `device` and `host`, double-quoted names, an address in place of a device, and a suggestion when a verb or a device is not found ([below](#tolerances)).
7. **Every refusal says what was expected.** A command that cannot be run answers with the form it should have had, or with the reason in the terms of the network (`PC-1 is a PC: routes belong on routers and firewalls`), and changes nothing.

## The grammar {#ebnf}

The grammar is written in a notation close to EBNF. A word in quotes is typed as it is, `[ … ]` is optional, `{ … }` is repeated, `|` is a choice, and `( … )` groups. What stands between `(* … *)` is a comment.

```text
command       ::= diagnostic | inspection | configuration | session

diagnostic    ::= "ping" target ["from" device]
                | "trace" target ["from" device] ["as" service]
                | ("browse" | "mail" | "download") target ["from" device]
                | "resolve" name ["from" device]
service       ::= "ping" | "web" | "email" | "dns"

inspection    ::= "show" show-target [["of"] device]
show-target   ::= "devices" | "interfaces" | "ports" | "vlans"
                | "connections" | "config" | "neighbors" | "ip"
                | "routes" | "rules" | "nat" | "dhcp" | "dns"

configuration ::= set-cmd | vlan-cmd | link-cmd | iface-cmd | route-cmd | rule-cmd
                | forward-cmd | record-cmd
set-cmd       ::= "set" ("ip" | "gateway" | "subnet" | "name")
                        ["of"] device ["to"] value
vlan-cmd      ::= "add" "vlan" number ["to"] device
                | "remove" "vlan" number "from" device
link-cmd      ::= "connect" device ["to"] device
                | "disconnect" device ["from"] device

iface-cmd     ::= "interface" iface-id iface-setting [["on"] device]
iface-id      ::= number | nic-name                    (* port 3, eth0 *)
iface-setting ::= "up" | "down"
                | "ip" (ipv4 ["/" prefix] | "none")
                | "gateway" (ipv4 | "none")            (* network cards *)
                | "access" vlan                        (* switch ports *)
                | "trunk" (vlan {"," vlan} | "all")    (* switch ports *)
                | "default"                            (* switch ports: no VLAN of its own *)
                | "zone" ("trust" | "untrust" | "dmz" | "none")   (* firewall ports *)
                | "nat" ["on" | "off" | "none"]           (* router/firewall ports *)
                | "dhcp" ["on" | "off" | "none"]          (* network cards *)
                | ["dhcp"] "pool" (ipv4 ["to"] ipv4 ["gateway" ipv4] ["dns" ipv4] | "none")
                                                          (* router/firewall ports, server cards *)
                | "dns" (ipv4 | "none")                   (* network cards *)

route-cmd     ::= "add" ["backup"] "route" network "via" next-hop [["on"] device]
                | "remove" "route" network ["via" next-hop] [("from" | "on") device]
network       ::= ipv4 "/" prefix | "default"
next-hop      ::= ipv4 | device

rule-cmd      ::= "add" "rule" [position] ("allow" | "deny") [service | "any"]
                        "from" endpoint "to" endpoint ["on" device]
                | "remove" "rule" position [("from" | "on") device]
endpoint      ::= "any" | "trust" | "untrust" | "dmz" | ipv4 | network | device

forward-cmd   ::= "add" "forward" [service | "any"] "from" ["interface"] number
                        "to" (ipv4 | device) ["on" device]
                | "remove" "forward" position [("from" | "on") device]

record-cmd    ::= "add" "record" name ["to"] (ipv4 | device) ["on" device]
                | "remove" "record" (position | name) [("from" | "on") device]

session       ::= "use" device | "exit" | "clear" | "help" [topic]

target        ::= device | ipv4 | name
device        ::= word { word } | '"' text '"'      (* multi-word, quotable *)
name          ::= label "." label { "." label }     (* www.company.example *)
```

In a device context (`use …`) the `["from" device]`, `[["of"] device]` and `[["on"] device]` parts default to the context device. `show dhcp` and `show dns` with no device, outside a context, are about the whole drawing. Where a command ends with something that may be a device of several words (the destination of a rule, the address of a forward or of a record), `on` is what parts it from the device the command is for, and cannot be left out: `["on" device]`.

The grammar names the form of each command. It leaves out, to stay short, the words that mean the same as one it names: they are in the table of [aliases](#aliases).

## Tokens, names and quotes {#tokens}

- **A line is cut into words** at spaces. Case does not matter for the words of the language (`PING`, `Show`), nor for the name of a device: `web-erp` finds Web-ERP.
- **A device is a run of words.** Everything between two role keywords is one device name, joined with single spaces: `ping Core Switch HQ from PC Sales 1` has two devices of three and three words. The keywords are `from`, `to`, `of`, `on` and `via`, and, last in a `trace`, `as`.
- **Double quotes keep a name whole.** A word in quotes is never a keyword and is never dropped: `ping "Gateway to HQ" from "PC-1"`. Quote a name that has a keyword inside it. A quote that is not closed runs to the end of the line, and a pair of quotes with nothing between is ignored.
- **A name matches a device exactly** (spaces counted once, case ignored), or an address does: the address of the device, or of any of its ports or cards that is enabled. An address stands for the device, and where a question has a target it is the address aimed at ([Targets](asking.md#targets)). A name that does not match is never guessed: it is refused, with a suggestion.
- **A host name is a name with at least one dot**, `www.company.example`: where a question has a target, and a device or an address does not match, it is looked up in a DNS server first ([Asking](asking.md#targets)). It is also the name of a record ([DHCP and DNS](dhcp-and-dns.md#add-record)). A word with no dot is not a host name.
- **A number** is one or more digits: a port, a VLAN from 1 to 4094, a position in a list. **A network** is an address and a prefix, `192.168.30.0/24`, or `default`.
- **Values are checked before they are written**: an address that is not an address, a network that is not a network, a VLAN out of 1–4094 are refused with the form that was expected. The mask of `set subnet` is the one value that is not checked.

## Tolerances {#tolerances}

What the terminal accepts besides the form of the grammar. It is part of the language, and every item is one line to read in the parser:

- **Optional prepositions.** `of`, `on`, `to` and `from` may be left out where the grammar puts them in brackets, and are skipped when they stand at the head of a name: `show ip of PC-1`, `show ip on PC-1`, `show ip PC-1`.
- **Articles.** `the` and `a` at the head of a name are dropped: `ping the Web-01 from the PC-1`.
- **The words `device` and `host`**, at the head of a name, are dropped too: `use device SW-Office`, `ping Web-01 from host PC-1`. A name that has them inside (`Meeting Room Host`), or in quotes, is kept as it is.
- **An address where a device is expected**, in every command. A typed address is the address aimed at.
- **A suggestion when something is not found.** An unknown verb is answered with the closest verb (`pinng` → `ping`); an unknown word after `show`, with the closest one (`did you mean "show devices"?`); a device that is not found, with the closest name, when it is close enough to be a slip (`did you mean "Web-01"?`).
- **A line that is empty** is skipped: the terminal prints a new prompt.

A line that is refused is answered in three parts: `unknown command: "<the line>"`, then what was expected or the closest word, then `type "help" for the command list`. A device that is not found is answered `device not found: "<name>"`. Anything else is a reason, in the words of the network.

### The aliases {#aliases}

| Command | Also written |
|---|---|
| `show devices` | `ls`, `list` |
| `show <what>` | `sh <what>`. `ls <what>` and `list <what>` too |
| `show ip` | `ipconfig`, `ifconfig` |
| `trace` | `traceroute`, `tracert` |
| `browse` | `web`, `curl` |
| `mail` | `email` |
| `download` | `wget` |
| `resolve` | `lookup`, `nslookup` |
| `remove` | `delete` |
| `exit` | `quit` |
| `clear` | `cls` |
| `help` | `?` |
| `interface <n> up`, `interface <n> down` | `enable port <n>`, `disable port <n>` |
| `ip` in `interface <id> ip` | `address` |
| `interface <id> pool …` | `interface <id> dhcp pool …`, and `interface <id> dhcp server …` |
| `none` in `ip`, `gateway`, `zone`, `dns`, `pool` | `clear`. For `pool` also `off` |
| `off` in `nat` and `dhcp` | `none`, `no`, `disable` |
| `gateway` in a pool | `gw` |
| `allow`, `deny` | `permit`, `block` |
| a service `any` | `all` |
| a service `ping` | `icmp` |
| a service `web` | `http`, `https` |
| a service `email` | `mail`, `smtp` |
| `interface` in `add forward … from interface <n>` | `port`, or nothing |
| `<first> to <last>` in a pool | `<first>-<last>`, or `<first> <last>` |

### The versions of the language {#versions}

The language has a version, shown by `help` in its first line, and described in [the overview](index.md#version). Until version 1.0 the forms in the grammar are stable, but aliases and the wording of the answers may still change between two minor versions: the examples of this reference are run against the app at every change, and fail when an answer is not the one printed here.

## See also {#see-also}

- [Overview and conventions](index.md): how the pages of this reference write a command.
- [Help and the session](help.md): `help`, `use`, `exit`, `clear`.
- [The specification on GitHub](https://github.com/pixelcake-dev/pixelcake/blob/main/docs/terminal-commands.md).
