---
title: "NAT and port forwards"
description: "Going out to the Internet with the address of a port, and publishing a server inside at that address."
order: 3
---

A private address, such as 192.168.10.11, means something only inside its own network. To go out to the Internet a device needs a public one, and to be reached from the Internet a server needs to be published at one. A router or a firewall does both by translating addresses (NAT): what goes out takes the address of a port, and what arrives at that address for a service is passed on to a server inside.

The examples use the sample network “Site: VLANs, DMZ and firewall”. Its firewall, FW-Edge, has the Internet at port 3, with the public address 203.0.113.1.

## The Internet does not carry private addresses {#private}

A Cloud symbol named Internet refuses a packet whose source or destination is in a private range: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 and 169.254.0.0/16. The reason says which of the two addresses it is and what should have translated it. A Cloud symbol with any other name, a carrier’s network or a private line, carries whatever crosses it.

So a network needs NAT to reach the Internet and to be reached from it. Here NAT is switched off on port 3 of FW-Edge. An office PC cannot get out, and the Internet cannot reach the PC:

```ncl sample=site
pixelcake> interface 3 nat off on FW-Edge
port 3 on FW-Edge no longer does NAT: what leaves by it keeps its own address
pixelcake> ping Remote-PC from PC-Office-1
Pinging Remote-PC (203.0.113.50) from PC-Office-1...
Ping failed (blocked): request: Internet does not carry private addresses: 192.168.10.11 has to be translated before it goes out, and NAT is off on port 3 on FW-Edge
  dropped at: Internet
  note: request: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed
pixelcake> trace PC-Office-1 from Remote-PC
Tracing route to PC-Office-1 (192.168.10.11) from Remote-PC:
  1  ○ Remote-PC (PC)
  2  ✗ Internet (Cloud)  — Internet does not carry private addresses: 192.168.10.11 is not reachable from outside: no port forward publishes it for ping
Trace failed (blocked): Internet does not carry private addresses: 192.168.10.11 is not reachable from outside: no port forward publishes it for ping
```

## Source NAT {#source-nat}

Source NAT is a setting of a port. A new flow that the router or the firewall forwards out of a port with NAT leaves with the address of that port, and the trace of the device says `NAT: source 192.168.10.11 → 203.0.113.1`. The device remembers the flow: when the reply comes back to that address it is sent on to the real sender. A reply is never translated as a flow of its own, and what the device sends itself is not translated.

To switch it on, open the window of the router or the firewall and go to the “NAT” tab. Under “Ports with NAT” tick the port that faces the Internet. It is the same choice as “NAT enabled” on the port, in the “Ports” tab. Only a port that has an address is listed, because what goes out takes that address; when no port has one the tab says so and offers a button to the “Ports” tab. Nothing changes until you press “Save”. In the terminal it is `interface <n> nat on <device>` ([reference](../terminal/firewall-and-nat.md#nat)).

```ncl continue
pixelcake> interface 3 nat on FW-Edge
port 3 on FW-Edge now does NAT: what leaves by it takes the address 203.0.113.1
pixelcake> trace Remote-PC from PC-Office-1
Tracing route to Remote-PC (203.0.113.50) from PC-Office-1:
  1  ○ PC-Office-1 (PC)
  2  ○ SW-Core (Switch)  — VLAN 10
  3  ○ Router-Core (Router)  — routed: default route via 10.0.0.2 (port 3)
  4  ○ FW-Edge (Firewall)  — routed: 203.0.113.0/24 is on port 3; firewall FW-Edge: no rule matches, zone policy trust → untrust allowed; NAT: source 192.168.10.11 → 203.0.113.1
  5  ○ Internet (Cloud)  — Internet is not simulated: traffic assumed to pass
  6  ● Remote-PC (PC)
  note: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed
  note: Internet is not simulated: traffic assumed to pass
Trace complete: destination reached.
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  web    from interface 3   (203.0.113.1) to 172.16.0.10
```

The trace shows the translation at FW-Edge, in the same line as the route and the decision of the firewall. A router can do the same, and the port needs an address:

```ncl sample=office
pixelcake> show nat Router-1
NAT of Router-1
  no interface does NAT: what leaves keeps its own address
FORWARDS (the first that matches is taken)
  none: from outside only the device itself is reached
pixelcake> interface 3 nat on Router-1
port 3 on Router-1 now does NAT
  it has no address yet: nothing is translated until it has one (interface 3 ip <address>)
pixelcake> show nat Router-1
NAT of Router-1
  interface 3   has no address: it translates nothing
FORWARDS (the first that matches is taken)
  none: from outside only the device itself is reached
```

## Port forwards {#forwards}

Source NAT is for who goes out. To let someone outside reach a server inside, the server is published: a port forward says that what arrives at the address of a port, for one service, is sent on to an address inside. In the “NAT” tab, under “Published services (port forwards)”, press “Add port forward” and fill in the row: “Service” (“Ping”, “Web”, “Email”, “DNS” or “Any”), “Arrives on port” and “Goes to address”. In the terminal, `add forward <service> from interface <n> to <address> on <device>` ([reference](../terminal/firewall-and-nat.md#add-forward)).

Whoever is outside sends the request to the address of the port, and the reply comes back from that address: the inside address is never seen. FW-Edge publishes the web server of the DMZ at 203.0.113.1:

```ncl sample=site
pixelcake> browse Web-Public from Remote-PC
Browsing Web-Public (203.0.113.1) from Remote-PC...
  ✓ HTTP request: Remote-PC → Web-Public
  ✓ HTTP response: Web-Public → Remote-PC
Page received from Web-Public
  note: HTTP request: Web-Public is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: HTTP request: Internet is not simulated: traffic assumed to pass
  note: HTTP request: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → untrust allowed
  note: HTTP response: Internet is not simulated: traffic assumed to pass
pixelcake> ping Web-Public from Remote-PC
Pinging Web-Public (172.16.0.10) from Remote-PC...
Ping failed (blocked): request: Internet does not carry private addresses: 172.16.0.10 is not reachable from outside: no port forward publishes it for ping
  dropped at: Internet
pixelcake> trace 172.16.0.10 from Remote-PC as web
Tracing route to Web-Public (172.16.0.10) from Remote-PC as web:
  1  ○ Remote-PC (PC)
  2  ✗ Internet (Cloud)  — Internet does not carry private addresses: 172.16.0.10 is reached from outside at 203.0.113.1, where FW-Edge publishes it (port forward 1)
Trace failed (blocked): Internet does not carry private addresses: 172.16.0.10 is reached from outside at 203.0.113.1, where FW-Edge publishes it (port forward 1)
```

By name the browser asks for Web-Public and is sent to 203.0.113.1, where the web server is published; the note says so. A ping to the same name finds no forward for ping, and the Internet refuses 172.16.0.10. An address typed in the command is the address aimed at, and nothing else is tried in its place: the last command, with the inside address typed, is refused, and the reason says where the server is published.

Forwards are read from the top, like rules: the first that matches the service and the port is taken. A second forward for the same service and port is allowed, but the first is the one taken, and the terminal warns:

```ncl sample=site
pixelcake> add forward web from interface 3 to 172.16.0.99 on FW-Edge
FW-Edge: forward 2 added — forward web from interface 3 to 172.16.0.99
  from outside it is reached at 203.0.113.1
  warning: forward 1 comes first for the same interface and service
  a firewall also needs a rule that lets it in: add rule allow web from untrust to 172.16.0.99 on FW-Edge
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  web    from interface 3   (203.0.113.1) to 172.16.0.10
   2  web    from interface 3   (203.0.113.1) to 172.16.0.99
```

## With the rules of a firewall {#with-rules}

On a firewall, a forward says where the traffic goes. It does not say that the traffic may pass. A rule is needed too, and the firewall sees the packet with the destination already translated: the rule names the address inside, not the public one. The source is not translated yet either: a rule always names real addresses, or a zone.

On the site sample the rule that lets the web in is the first one. Without it the zone policy denies untrust → dmz. With it written again, for the server by name (the terminal stores its address), the page comes back:

```ncl sample=site
pixelcake> remove rule 1 from FW-Edge
FW-Edge: rule 1 removed — allow web from untrust to 172.16.0.10
pixelcake> browse Web-Public from Remote-PC
Browsing Web-Public (203.0.113.1) from Remote-PC...
  ✗ HTTP request: Remote-PC → Web-Public
Browse failed (blocked): HTTP request: firewall policy on FW-Edge: untrust → dmz denied
  dropped at: FW-Edge
  note: HTTP request: Web-Public is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: HTTP request: Internet is not simulated: traffic assumed to pass
pixelcake> add rule allow web from untrust to Web-Public on FW-Edge
FW-Edge: rule 1 added — allow web from untrust to 172.16.0.10
  Web-Public → 172.16.0.10
pixelcake> browse Web-Public from Remote-PC
Browsing Web-Public (203.0.113.1) from Remote-PC...
  ✓ HTTP request: Remote-PC → Web-Public
  ✓ HTTP response: Web-Public → Remote-PC
Page received from Web-Public
  note: HTTP request: Web-Public is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: HTTP request: Internet is not simulated: traffic assumed to pass
  note: HTTP request: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → untrust allowed
  note: HTTP response: Internet is not simulated: traffic assumed to pass
```

The terminal reminds you when you publish something on a firewall:

```ncl sample=site
pixelcake> add forward email from interface 3 to Srv-Internal on FW-Edge
FW-Edge: forward 2 added — forward email from interface 3 to 192.168.20.10
  Srv-Internal → 192.168.20.10
  from outside it is reached at 203.0.113.1
  a firewall also needs a rule that lets it in: add rule allow email from untrust to 192.168.20.10 on FW-Edge
```

## Limits {#limits}

> [!LIMITS]
> - A forward is a service on a port, not a port number. The engine has no TCP or UDP ports: a flow is a ping, web, email or DNS, and two flows never compete for a translation. There is no port translation, and two servers cannot be published on the same service of one address: the first forward is the one taken.
> - Source NAT gives the address of the port. There are no pools of addresses, no one-to-one NAT and no choice of the address.
> - A server reached from inside at its published address is not treated apart from any other request to that address.
> - A device behind two layers of NAT is found by name only through the first.
> - There is no table of translations to read, no timeouts and no limit on how many flows are open.
> - The Internet is not simulated: a Cloud symbol named Internet refuses private addresses and lets everything else through.
