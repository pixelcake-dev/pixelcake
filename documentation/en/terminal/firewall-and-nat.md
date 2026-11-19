---
title: "Firewall and NAT"
description: "The commands for the security zones and rules of a firewall, for source NAT and for port forwards."
order: 5
---

A firewall puts each of its ports in a security zone and filters what goes from one zone to another with an ordered list of rules. A router can carry rules too, its access list, without zones. A router or a firewall can also translate addresses: source NAT on a port, and port forwards that publish a service inside. These commands write the same settings as the “Ports”, “Rules” and “NAT” tabs of the window of the device. What the settings mean, and what the engine does with them, is in [Firewall](../services/firewall.md) and [NAT](../services/nat.md); the pages of this section list the commands. `show rules` and `show nat` read the result back ([Show commands](show.md#show-rules)).

In the syntax below, `<n>` is a port number, `<firewall>` a firewall and `<device>` a router or a firewall; `on <device>` may be left out inside `use <device>`. The notation is explained in the [overview](index.md#conventions).

## interface … zone {#zone}

```text
interface <n> zone trust|untrust|dmz|none [on] <firewall>
```

Puts a port of a firewall in a security zone. `trust` is the inside, `untrust` the outside, `dmz` the zone of the servers published to the outside. `none` takes the port out of every zone.

| Parameter | What it is |
|---|---|
| `<n>` | The number of a port of the firewall |
| `trust`, `untrust`, `dmz`, `none` | The zone of the port, or no zone |

Only the ports of a firewall have a zone. How a flow from one zone to another is judged is in [Firewall](../services/firewall.md#zones).

```ncl sample=company
pixelcake> show ports FW-Edge
PORT   STATE      MODE     VLAN       ZONE     IP               LINK
1      up         lan      -          trust    10.0.0.2         Router-Core (port 4)
2      up         dmz      -          dmz      172.16.0.1       SW-DMZ (port 8)
3      up         wan      -          untrust  203.0.113.1      Internet (eth0)
4      up         lan      -          -        -                -
pixelcake> interface 4 zone dmz on FW-Edge
port 4 on FW-Edge is now in zone dmz
pixelcake> interface 4 zone none on FW-Edge
port 4 on FW-Edge is in no security zone now
pixelcake> interface 4 zone moon on FW-Edge
unknown command: "interface 4 zone moon on FW-Edge"
  unknown zone "moon" — try: interface <n> zone trust|untrust|dmz|none [on] <device>
  type "help" for the command list
pixelcake> interface 1 zone trust on Router-Core
security zones are set on the ports of a firewall: Router-Core is a Router
```

## add rule {#add-rule}

```text
add rule [<position>] allow|deny [<service>|any] from <source> to <destination> [on] <device>
  allow may be written permit, deny block
```

Adds a rule to the list of a router or a firewall. Rules are read from the top, and the first one that matches the service, the source and the destination decides; when none matches, the zone policy of a firewall decides ([rules](../services/firewall.md#rules)), and a router blocks the packet: its list ends with an implicit deny ([rules on a router](../services/firewall.md#router)). The first rule of a router says so in a line of its own, and removing its last rule says that it lets everything through again.

| Parameter | What it is |
|---|---|
| `<position>` | Where the rule goes in the list, from 1. Without it the rule goes last. It may be at most one more than the number of rules |
| `allow`, `deny` | What the rule does. `permit` and `block` are the same |
| `<service>` | One of the [services](#services), or `any`. Without it the rule is for any service |
| `<source>`, `<destination>` | `any`, a zone (`trust`, `untrust`, `dmz`), an address, a network (`192.168.30.0/24`) or a device |
| `<device>` | The router or the firewall the rule goes on. Inside `use <device>` it is left out |

A device given as source or destination is written into the rule as its address, and the answer says which (`Srv-Auth → 192.168.30.10`): the rule keeps that address if the device changes it later. A device that is leased its address says so too. A device with no address is refused. If a rule names a zone that no port of the firewall is in, the rule is added and the answer says so; on a router, which has no zones, the answer says that the rule never matches.

An end device or a switch takes no rules: the answer says that rules belong on routers and firewalls.

```ncl sample=company
pixelcake> add rule 1 deny web from 203.0.113.50 to Customer-Portal on FW-Edge
FW-Edge: rule 1 added — deny web from 203.0.113.50 to 172.16.0.10
  Customer-Portal → 172.16.0.10
pixelcake> browse Customer-Portal from Remote-Customer
Browsing Customer-Portal (203.0.113.1) from Remote-Customer...
  ✗ HTTP request: Remote-Customer → Customer-Portal
Browse failed (blocked): HTTP request: firewall FW-Edge: denied by rule 1 (deny web from 203.0.113.50 to 172.16.0.10)
  dropped at: FW-Edge
  note: HTTP request: Customer-Portal is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: HTTP request: Internet is not simulated: traffic assumed to pass
pixelcake> remove rule 1 from FW-Edge
FW-Edge: rule 1 removed — deny web from 203.0.113.50 to 172.16.0.10
```

Positions, aliases, and a rule for a service of its own:

```ncl sample=company
pixelcake> add rule allow dns from untrust to Srv-Auth on FW-Edge
FW-Edge: rule 4 added — allow dns from untrust to 192.168.30.10
  Srv-Auth → 192.168.30.10
pixelcake> add rule 1 deny ping from any to 192.168.30.0/24 on FW-Edge
FW-Edge: rule 1 added — deny ping from any to 192.168.30.0/24
pixelcake> add rule block from dmz to trust on FW-Edge
FW-Edge: rule 6 added — deny any from dmz to trust
pixelcake> add rule permit icmp from 203.0.113.50 to dmz on FW-Edge
FW-Edge: rule 7 added — allow ping from 203.0.113.50 to dmz
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  deny  ping   from any                to 192.168.30.0/24
   2  allow web    from untrust            to 172.16.0.10
   3  allow email  from untrust            to 192.168.30.40
   4  allow web    from 172.16.0.10        to 192.168.30.20
   5  allow dns    from untrust            to 192.168.30.10
   6  deny  any    from dmz                to trust
   7  allow ping   from 203.0.113.50       to dmz
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  the reply to a flow it allowed passes
```

## remove rule {#remove-rule}

```text
remove rule <n> [from] <device>
delete rule <n> [from] <device>
```

Takes the rule number `<n>` out of the list, as `show rules` numbers them; the rules after it move up by one. `delete` is the same as `remove`, and after the number `on` may be written in place of `from`.

| Parameter | What it is |
|---|---|
| `<n>` | The number of a rule, from 1 |
| `<device>` | The router or the firewall whose rule it is |

```ncl sample=company
pixelcake> remove rule 2 from FW-Edge
FW-Edge: rule 2 removed — allow email from untrust to 192.168.30.40
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from untrust            to 172.16.0.10
   2  allow web    from 172.16.0.10        to 192.168.30.20
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  the reply to a flow it allowed passes
pixelcake> delete rule 1 on FW-Edge
FW-Edge: rule 1 removed — allow web from untrust to 172.16.0.10
pixelcake> remove rule 5 from FW-Edge
FW-Edge has no rule 5 (it has 1)
```

## Services {#services}

```text
ping   (also icmp)
web    (also http, https)
email  (also mail, smtp)
dns
any
```

The services a rule or a forward can name, and the words each is written with. Case does not matter. `any` stands for all four and is what a rule or a forward without a service means; `all` is the same word. `trace … as <service>` takes the four services but not `any` ([Asking](asking.md#trace)). Anything else, such as `ssh` or a port number, is refused: the engine knows these four and no ports.

```ncl sample=company
pixelcake> add rule allow gopher from any to any on FW-Edge
unknown command: "add rule allow gopher from any to any on FW-Edge"
  unknown service "gopher" (ping, web, email, dns or any) — try: add rule [<position>] allow|deny <service>|any from <source> to <destination> [on <device>]
  type "help" for the command list
pixelcake> add rule allow all from trust to untrust on FW-Edge
FW-Edge: rule 4 added — allow any from trust to untrust
```

## interface … nat {#nat}

```text
interface <n> nat [on] <device>
interface <n> nat off [on] <device>
```

Switches source NAT on a port of a router or a firewall: what the device forwards out of that port leaves with the address of the port, and the replies come back to the real sender. `nat off` switches it off; `nat none` is the same. Both are a no-op, and say so, when the port is already as asked.

| Parameter | What it is |
|---|---|
| `<n>` | The number of a port of a router or a firewall |

A port with no address is accepted, and the answer says that nothing is translated until it has one. The hop of a trace tells what was translated (`NAT: source 192.168.10.12 → 203.0.113.1`, [source NAT](../services/nat.md#source-nat)).

```ncl sample=company
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  web    from interface 3   (203.0.113.1) to 172.16.0.10
   2  email  from interface 3   (203.0.113.1) to 192.168.30.40
pixelcake> ping Remote-Customer from PC-Sales
Pinging Remote-Customer (203.0.113.50) from PC-Sales...
Reply from 203.0.113.50: hops=7 time=11ms
  note: request: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed
  note: request: Internet is not simulated: traffic assumed to pass
  note: reply: Internet is not simulated: traffic assumed to pass
  note: reply: firewall FW-Edge: no rule matches, zone policy untrust → trust allowed (reply to an allowed flow)
pixelcake> interface 3 nat off on FW-Edge
port 3 on FW-Edge no longer does NAT: what leaves by it keeps its own address
pixelcake> ping Remote-Customer from PC-Sales
Pinging Remote-Customer (203.0.113.50) from PC-Sales...
Ping failed (blocked): request: Internet does not carry private addresses: 192.168.10.12 has to be translated before it goes out, and NAT is off on port 3 on FW-Edge
  dropped at: Internet
  note: request: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed
pixelcake> interface 3 nat on FW-Edge
port 3 on FW-Edge now does NAT: what leaves by it takes the address 203.0.113.1
pixelcake> interface 3 nat on FW-Edge
port 3 on FW-Edge already does NAT
pixelcake> interface 4 nat on FW-Edge
port 4 on FW-Edge now does NAT
  it has no address yet: nothing is translated until it has one (interface 4 ip <address>)
pixelcake> interface 1 nat on SW-Core
NAT is set on the ports of a router or a firewall: SW-Core is a Switch
```

## add forward {#add-forward}

```text
add forward [<service>|any] from [interface] <n> to <address> [on] <device>
```

Publishes a service of a device inside: what arrives at the address of port `<n>`, for that service, is sent on to the address inside. Forwards are read from the top and the first that matches is taken ([port forwards](../services/nat.md#forwards)).

| Parameter | What it is |
|---|---|
| `<service>` | One of the [services](#services), or `any`. Without it the forward is for any service |
| `<n>` | The number of the port the traffic arrives on, which must have an address. `interface` or `port` may be written before it, or neither |
| `<address>` | The address inside, or a device: the command then writes its address and says which |
| `<device>` | The router or firewall. Inside `use <device>` it is left out |

The answer gives the number of the forward, the address the service is reached at from outside, and, when they apply, a warning that an earlier forward takes the same traffic first and a reminder that a firewall also needs a rule that lets the traffic in ([with the rules of a firewall](../services/nat.md#with-rules)). Adding a forward the device already has says so and adds nothing.

```ncl sample=company
pixelcake> add forward ping from interface 3 to Customer-Portal on FW-Edge
FW-Edge: forward 3 added — forward ping from interface 3 to 172.16.0.10
  Customer-Portal → 172.16.0.10
  from outside it is reached at 203.0.113.1
pixelcake> ping Customer-Portal from Remote-Customer
Pinging Customer-Portal (203.0.113.1) from Remote-Customer...
Ping failed (blocked): request: firewall FW-Edge: no rule matches, zone policy untrust → dmz denied
  dropped at: FW-Edge
  note: request: Customer-Portal is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 3)
  note: request: Internet is not simulated: traffic assumed to pass
pixelcake> add rule allow ping from untrust to Customer-Portal on FW-Edge
FW-Edge: rule 4 added — allow ping from untrust to 172.16.0.10
  Customer-Portal → 172.16.0.10
pixelcake> ping Customer-Portal from Remote-Customer
Pinging Customer-Portal (203.0.113.1) from Remote-Customer...
Reply from 203.0.113.1: hops=5 time=7ms
  note: request: Customer-Portal is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 3)
  note: request: Internet is not simulated: traffic assumed to pass
  note: request: firewall FW-Edge: allowed by rule 4 (allow ping from untrust to 172.16.0.10)
  note: reply: firewall FW-Edge: no rule matches, zone policy dmz → untrust allowed
  note: reply: Internet is not simulated: traffic assumed to pass
pixelcake> add forward ping from port 3 to 172.16.0.10 on FW-Edge
FW-Edge already has it: forward 3
pixelcake> add forward web from 3 to Customer-Portal on FW-Edge
FW-Edge already has it: forward 1
```

## remove forward {#remove-forward}

```text
remove forward <n> [from] <device>
delete forward <n> [from] <device>
```

Takes forward number `<n>` out of the list, as `show nat` numbers them. `delete` is the same as `remove`, and `on` may be written in place of `from`.

| Parameter | What it is |
|---|---|
| `<n>` | The number of a forward, from 1 |
| `<device>` | The router or firewall |

```ncl sample=company
pixelcake> remove forward 1 from FW-Edge
FW-Edge: forward 1 removed — forward web from interface 3 to 172.16.0.10
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  email  from interface 3   (203.0.113.1) to 192.168.30.40
pixelcake> remove forward 5 from FW-Edge
FW-Edge has no forward 5 (it has 1)
pixelcake> browse Customer-Portal from Remote-Customer
Browsing Customer-Portal (172.16.0.10) from Remote-Customer...
  ✗ HTTP request: Remote-Customer → Customer-Portal
Browse failed (blocked): HTTP request: Internet does not carry private addresses: 172.16.0.10 is not reachable from outside: no port forward publishes it for web
  dropped at: Internet
```

## When a command is refused {#refusals}

A command that cannot be done changes nothing, and says why, or what it should have been:

```ncl sample=company
pixelcake> add rule 9 allow web from any to any on FW-Edge
FW-Edge has 3 rules: the position must be 1-4
pixelcake> add rule 0 allow web from any to any on FW-Edge
unknown command: "add rule 0 allow web from any to any on FW-Edge"
  rule positions start at 1 — try: add rule [<position>] allow|deny <service>|any from <source> to <destination> [on <device>]
  type "help" for the command list
pixelcake> add rule allow web from moon to any on FW-Edge
"moon" is not any, a zone (trust, untrust, dmz), an address, a network or a device
pixelcake> add rule allow web from any to Internet on FW-Edge
Internet has no address to write in a rule
pixelcake> add rule allow web from any to any on PC-Sales
PC-Sales is a PC: rules belong on routers and firewalls
pixelcake> remove rule 12 from FW-Edge
FW-Edge has no rule 12 (it has 3)
pixelcake> add forward web from interface 9 to 172.16.0.10 on FW-Edge
FW-Edge has no interface "9" (it has: ports 1-4)
pixelcake> add forward web from interface 4 to 172.16.0.10 on FW-Edge
interface 4 on FW-Edge has no address to publish
pixelcake> add forward web from interface 3 to Nobody on FW-Edge
"Nobody" is not an address or a device
pixelcake> add forward web from interface three to 172.16.0.10 on FW-Edge
unknown command: "add forward web from interface three to 172.16.0.10 on FW-Edge"
  a forward is published from a port: "three" is not a port number — try: add forward <service>|any from interface <n> to <address> [on <device>]
  type "help" for the command list
pixelcake> add forward web from interface 3 to 172.16.0.10 on PC-Sales
PC-Sales is a PC: forwards belong on routers and firewalls
pixelcake> remove forward 0 from FW-Edge
unknown command: "remove forward 0 from FW-Edge"
  forward number must be a number, got "0" — try: remove forward <n> [from <device>]
  type "help" for the command list
pixelcake> remove forward 1 from Router-Core
Router-Core has no forwards
```

## See also {#see-also}

- [Firewall](../services/firewall.md), [NAT](../services/nat.md): zones, the zone policy, rules, translation, and what is not simulated.
- [Show commands](show.md#show-rules): `show rules`, `show nat`, and `show ports` for the zones.
- [Asking](asking.md#trace): `trace … as <service>`, to see which rule decides.
- [Interfaces and VLANs](interfaces-and-vlans.md#ip): the address of a port, which NAT and forwards need.
