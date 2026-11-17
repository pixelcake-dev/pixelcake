---
title: "Firewall zones and rules"
description: "Security zones on the ports of a firewall, the zone policy, and the ordered rules that make exceptions to it."
order: 2
---

A firewall in PixelCake decides on every packet that crosses it. It has two tools: the security zone of each of its ports, and a list of rules. Without rules the zones decide, with a fixed policy. A rule makes an exception to the policy, and the first rule that matches decides.

The examples on this page use the sample network “Site: VLANs, DMZ and firewall”. Its firewall, FW-Edge, has the offices behind port 1, a DMZ with a web server behind port 2, and the Internet at port 3.

![The site sample. FW-Edge is in the middle, with three cables. One goes up to the Internet symbol and Remote-PC, in the Internet area. One goes left to Router-Core, which has SW-Core, two PCs and Srv-Internal behind it, in the Internal network area. One goes right to SW-DMZ and Web-Public, in the DMZ area.](../../media/firewall/zones.en.svg "The site sample. The three ports of FW-Edge face the internal network (trust), the DMZ (dmz) and the Internet (untrust).")

## Zones {#zones}

A zone says how far a network is trusted. There are three, and a port is in one of them or in none:

- **trust**: the network the firewall protects, the offices.
- **dmz**: a network of servers that are reached from outside, kept apart from the offices.
- **untrust**: the outside, the Internet.

The zone belongs to the port, not to the device or the cable. In the window of the firewall, open the “Ports” tab, choose the port and set “Security zone”: “None”, “Trust (trusted network)”, “Untrust (not trusted)” or “DMZ (demilitarised zone)”. Nothing changes until you press “Save”. In the terminal it is `interface <n> zone <zone> on <firewall>` ([reference](../terminal/firewall-and-nat.md#zone)); `show ports` has a column for it:

```ncl sample=site
pixelcake> show ports FW-Edge
PORT   STATE      MODE     VLAN       ZONE     IP               LINK
1      up         lan      -          trust    10.0.0.2         Router-Core (port 3)
2      up         dmz      -          dmz      172.16.0.1       SW-DMZ (port 8)
3      up         wan      -          untrust  203.0.113.1      Internet (eth0)
4      up         lan      -          -        -                -
```

The “Port mode” of a port (LAN, WAN or DMZ) is a label and decides nothing: on a firewall what counts is the security zone.

The engine needs to know which port a cable is attached to, to know which zone a packet comes in by and goes out by. A link drawn to a firewall that has zones is not attached to a port by itself: you choose the port, and with it the zone, in the window of the link. Right-click the link, choose “Edit link”, and under “Interfaces” choose the port in the list headed `Interface on FW-Edge`. An end that is not attached has no zone: a rule that names a zone is skipped, and the trace says so in a note.

A port with “None” as its zone is the same: no zone, no policy. A rule that names a zone is skipped there, with the same note, and what no other rule decides is allowed; the trace says `no zone binding: allowed`:

```ncl sample=site
pixelcake> interface 2 zone none on FW-Edge
port 2 on FW-Edge is in no security zone now
pixelcake> show ports FW-Edge
PORT   STATE      MODE     VLAN       ZONE     IP               LINK
1      up         lan      -          trust    10.0.0.2         Router-Core (port 3)
2      up         dmz      -          -        172.16.0.1       SW-DMZ (port 8)
3      up         wan      -          untrust  203.0.113.1      Internet (eth0)
4      up         lan      -          -        -                -
pixelcake> browse Web-Public from PC-Office-1
Browsing Web-Public (172.16.0.10) from PC-Office-1...
  ✓ HTTP request: PC-Office-1 → Web-Public
  ✓ HTTP response: Web-Public → PC-Office-1
Page received from Web-Public
  note: HTTP request: firewall FW-Edge: no rule matches and no zone binding: allowed
  note: HTTP response: firewall FW-Edge: no rule matches and no zone binding: allowed
```

## The zone policy {#policy}

When no rule decides, the zones do. A new flow towards a more trusted zone is denied, and the rest passes:

| From | To | A new flow is |
|---|---|---|
| untrust | trust | denied |
| untrust | dmz | denied |
| dmz | trust | denied |
| every other pair, a zone to itself included | | allowed |

The offices can reach the DMZ and the Internet. The DMZ cannot reach the offices, and the Internet cannot reach either. The answer says which pair it was:

```ncl sample=site
pixelcake> trace Web-Public from PC-Office-1
Tracing route to Web-Public (172.16.0.10) from PC-Office-1:
  1  ○ PC-Office-1 (PC)
  2  ○ SW-Core (Switch)  — VLAN 10
  3  ○ Router-Core (Router)  — routed: default route via 10.0.0.2 (port 3)
  4  ○ FW-Edge (Firewall)  — routed: 172.16.0.0/24 is on port 2; firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  5  ○ SW-DMZ (Switch)
  6  ● Web-Public (Server)
  note: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
Trace complete: destination reached.
pixelcake> trace PC-Office-1 from Web-Public
Tracing route to PC-Office-1 (192.168.10.11) from Web-Public:
  1  ○ Web-Public (Server)
  2  ○ SW-DMZ (Switch)
  3  ✗ FW-Edge (Firewall)  — firewall FW-Edge: no rule matches, zone policy dmz → trust denied
Trace failed (blocked): firewall FW-Edge: no rule matches, zone policy dmz → trust denied
```

With no rules at all the reason reads `firewall policy on FW-Edge: dmz → trust denied`, and with rules that do not match, `firewall FW-Edge: no rule matches, zone policy dmz → trust denied`. The “Rules” tab says the same under “When no rule matches”.

## Rules {#rules}

A rule makes an exception to the policy: it lets in what the policy denies, or keeps out what it allows. In the window of the firewall go to the “Rules” tab. Under “Firewall rules”, press “Add rule” and fill in the row:

- “Action”: “Allow” or “Deny”.
- “Service”: “Ping”, “Web”, “Email”, “DNS”, or “Any”.
- “From” and “To”: `any`, a zone (`trust`, `untrust`, `dmz`), an address, or a network such as `192.168.10.0/24`. A name of anything else is refused.
- “Enabled”: a rule that is not ticked is skipped.

“Move up” and “Move down” change the order; “Delete rule” takes a row away. The number in the first column is the number the terminal and the traces use.

Rules are read from the top. The first enabled rule whose service, source and destination all match decides, and the rules after it are not looked at. When none matches, the policy decides. “From” is the source of the packet and “To” its destination, as the firewall sees them: a zone matches the zone of the port the packet came in by, or goes out by.

On the site sample the offices can reach the web server in the DMZ, as the policy says. Here a rule is added at the end that denies the web to the DMZ for one office PC, the one at 192.168.10.12. The other PC is not touched by it:

```ncl sample=site
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from untrust            to 172.16.0.10
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  the reply to an allowed flow always passes
pixelcake> add rule deny web from 192.168.10.12 to dmz on FW-Edge
FW-Edge: rule 2 added — deny web from 192.168.10.12 to dmz
pixelcake> browse Web-Public from PC-Office-2
Browsing Web-Public (172.16.0.10) from PC-Office-2...
  ✗ HTTP request: PC-Office-2 → Web-Public
Browse failed (blocked): HTTP request: firewall FW-Edge: denied by rule 2 (deny web from 192.168.10.12 to dmz)
  dropped at: FW-Edge
pixelcake> browse Web-Public from PC-Office-1
Browsing Web-Public (172.16.0.10) from PC-Office-1...
  ✓ HTTP request: PC-Office-1 → Web-Public
  ✓ HTTP response: Web-Public → PC-Office-1
Page received from Web-Public
  note: HTTP request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

PC-Office-2 is stopped by rule 2, and the answer names it. Now an exception is written above it, at position 1, for the same address:

```ncl continue
pixelcake> add rule 1 allow web from 192.168.10.12 to 172.16.0.10 on FW-Edge
FW-Edge: rule 1 added — allow web from 192.168.10.12 to 172.16.0.10
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from 192.168.10.12      to 172.16.0.10
   2  allow web    from untrust            to 172.16.0.10
   3  deny  web    from 192.168.10.12      to dmz
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  the reply to an allowed flow always passes
pixelcake> browse Web-Public from PC-Office-2
Browsing Web-Public (172.16.0.10) from PC-Office-2...
  ✓ HTTP request: PC-Office-2 → Web-Public
  ✓ HTTP response: Web-Public → PC-Office-2
Page received from Web-Public
  note: HTTP request: firewall FW-Edge: allowed by rule 1 (allow web from 192.168.10.12 to 172.16.0.10)
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

The same address now matches rule 1 before it reaches rule 3, and the page opens. The order is the whole of it: an exception goes above the rule it is an exception to, and a rule that catches everything goes last.

The “Rules” tab warns when a rule names a zone that no port is in: such a rule never matches.

## Replies {#replies}

A firewall keeps state. When it allowed a request, the reply to that request passes, whatever the rules and the policy say about new flows in the other direction. Without it the reply of a server on the Internet would be a new flow towards a more trusted zone, and the policy would deny it. The engine keeps that state for the flow, not for each firewall: a reply passes every firewall on its way back, even one the request did not cross. The note says so:

```ncl sample=site
pixelcake> ping Web-Public from PC-Office-1
Pinging Web-Public (172.16.0.10) from PC-Office-1...
Reply from 172.16.0.10: hops=6 time=9ms
  note: request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: reply: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

Even a rule that denies the direction does not stop the reply. Here the first rule denies everything from the DMZ to the offices, and the offices still get the page back:

```ncl sample=site
pixelcake> add rule 1 deny any from dmz to trust on FW-Edge
FW-Edge: rule 1 added — deny any from dmz to trust
pixelcake> browse Web-Public from PC-Office-1
Browsing Web-Public (172.16.0.10) from PC-Office-1...
  ✓ HTTP request: PC-Office-1 → Web-Public
  ✓ HTTP response: Web-Public → PC-Office-1
Page received from Web-Public
  note: HTTP request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: HTTP response: firewall FW-Edge: reply to an allowed flow passes rule 1 (deny any from dmz to trust)
```

The rule is for new flows that start in the DMZ. The reply to a flow that started in the offices is not one.

## The firewall itself {#itself}

What is addressed to the firewall itself is not filtered. Here a rule denies everything from the Internet, and the firewall still answers a ping on its outside address:

```ncl sample=site
pixelcake> add rule deny any from untrust to any on FW-Edge
FW-Edge: rule 2 added — deny any from untrust to any
pixelcake> ping 203.0.113.1 from Remote-PC
Pinging FW-Edge (203.0.113.1) from Remote-PC...
Reply from 203.0.113.1: hops=3 time=3ms
  note: request: Internet is not simulated: traffic assumed to pass
  note: reply: Internet is not simulated: traffic assumed to pass
```

Only what goes through is judged by the rules. The administration of the firewall is not simulated.

## Limits {#limits}

> [!LIMITS]
> - A rule has four services: ping, web, email and DNS, or any of them. There are no port numbers and no protocols: a rule cannot tell one web port from another, or allow SSH.
> - Three zones, with names that are fixed: trust, untrust and dmz. There are no other zones and no custom policy between zones; the rules are the only exceptions.
> - A reply passes because it is a reply to an allowed flow; there is no table of connections, no timeout and no limit on how many are open. So a reply that comes back by another way passes a firewall that never saw the request.
> - What is addressed to the firewall itself is not filtered.
> - The packet is looked at by address and by zone only. There is no inspection of what it carries, no logging, no rate limit and no schedule. The IPS/IDS option of a port is documentation: the engine does not simulate it.
> - A link end that is not attached to a port has no zone. The rules that name a zone are skipped there, and the trace says so; the traffic is not stopped for it.
