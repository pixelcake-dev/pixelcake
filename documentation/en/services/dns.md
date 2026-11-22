---
title: "DNS"
description: "Calling a device by name: the records of a server, the DNS server each card asks, and a lookup that crosses the network like any other exchange."
order: 5
---

DNS lets a name stand for an address. In PixelCake a server keeps a list of names, each with one address; a network card is told which server to ask; and a command of the terminal that is given a name asks that server first, then goes on to the address it gets. The lookup is a real exchange, and it can fail like any other. The engine has no cache: a name is looked up each time a question uses it.

Names work in the terminal only: `ping`, `trace`, `browse`, `mail` and `download` take a host name where they take a device, and `resolve` does the lookup alone. The simulation panel and the presentation choose devices from menus and do not use names.

The examples use the sample network “Company: offices, Wi-Fi, servers and DMZ”, where the server Srv-Auth knows three names.

## Records {#records}

A DNS server is a server with at least one record. In the window of the server, open the “DNS” tab. Under “Known names”, press “Add record”, and fill in a “Name” and an “Address”, for example `erp.company.example` and `192.168.30.30`. Nothing changes until you press “Save”. In the terminal, `add record <name> <address> on <server>` ([reference](../terminal/dhcp-and-dns.md#add-record)).

A name is a host name: letters, digits and hyphens, with at least one dot. Upper and lower case are the same. A name has one address only: writing it again changes its address. A server answers only for the names written on it, and a device with no record does not answer as a DNS server.

`show dns` lists the records of every server in the drawing, and who asks whom:

```ncl sample=company
pixelcake> show dns
DNS — 1 server, 3 records
RECORDS of Srv-Auth (192.168.30.10)
   1  erp.company.example              192.168.30.30
   2  mail.company.example             192.168.30.40
   3  portal.company.example           172.16.0.10
WHO ASKS WHOM
  PC-Accounts eth0         192.168.30.10
  PC-Sales eth0            192.168.30.10
  Printer eth0             192.168.30.10
  Laptop-1 eth0            192.168.30.10  (with its lease)
  Laptop-2 eth0            192.168.30.10  (with its lease)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
```

A name that is not on the server gets a failure that says so. The lookup itself worked: the request reached the server and the reply came back, which is why both lines are marked as arrived. Write the record and the same question is answered:

```ncl sample=company
pixelcake> resolve intranet.company.example from PC-Sales
Looking up intranet.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Sales → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Sales
Lookup failed: Srv-Auth has no record for intranet.company.example
pixelcake> add record intranet.company.example Web-ERP on Srv-Auth
Srv-Auth: record 4 added — intranet.company.example is 192.168.30.30
  Web-ERP → 192.168.30.30
pixelcake> resolve intranet.company.example from PC-Sales
Looking up intranet.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Sales → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Sales
intranet.company.example is 192.168.30.30 (answered by Srv-Auth)
```

## Who asks whom {#who-asks}

Each device decides whom to ask, on its own network card. In the “Network cards” tab, the “DNS server” field of a card holds the address of the server. It is an address, not a name. A device asks through its first enabled card that names a server. A router, a firewall and a switch have no cards, and ask nobody.

A card that takes its address from DHCP does not choose: it asks the server that the range it comes from hands out, “DNS server for clients” in the DHCP server ([DHCP](dhcp.md#servers)). The terminal refuses to write a DNS server on such a card. `show dns` on a device says which server it asks and whether it came with the lease:

```ncl sample=company
pixelcake> show dns Laptop-1
DNS of Laptop-1
  eth0: asks 192.168.30.10 (Srv-Auth), handed out with its lease by Router-Core port 2
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
```

To avoid typing the address on every card, Settings → Network has “Default DNS server”: new devices start with it on their card and, once it is saved, it can be assigned to the devices on the board that have none ([Addresses and gateways](../building/addresses.md#project-network)).

A device that has nobody to ask cannot look up a name, and says so. Taking the DNS server away from a card does the same:

```ncl sample=company
pixelcake> resolve portal.company.example from Remote-Customer
Looking up portal.company.example from Remote-Customer...
Lookup failed: Remote-Customer has no DNS server: it cannot look up portal.company.example
pixelcake> show dns PC-Sales
DNS of PC-Sales
  eth0: asks 192.168.30.10 (Srv-Auth)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> interface eth0 dns none on PC-Sales
interface eth0 on PC-Sales asks no DNS server now
pixelcake> ping erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales...
Lookup failed: PC-Sales has no DNS server: it cannot look up erp.company.example
pixelcake> show dns PC-Sales
DNS of PC-Sales
  eth0: asks nobody
  name a DNS server: interface eth0 dns <address> on PC-Sales
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
```

A server that is asked has to be a DNS server, and the address has to belong to a device. Two more reasons:

```ncl sample=company
pixelcake> interface eth0 dns 192.168.30.30 on PC-Sales
interface eth0 on PC-Sales: DNS server 192.168.30.30
pixelcake> resolve erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales (DNS server 192.168.30.30)...
  ✓ DNS request: PC-Sales → Web-ERP
  ✓ DNS reply: Web-ERP → PC-Sales
Lookup failed: 192.168.30.30 is Web-ERP, which is not a DNS server: it keeps no records
pixelcake> interface eth0 dns 8.8.8.8 on PC-Sales
interface eth0 on PC-Sales: DNS server 8.8.8.8
pixelcake> resolve erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales (DNS server 8.8.8.8)...
Lookup failed: PC-Sales asks 8.8.8.8 for names, an address no device has
```

## A lookup {#lookup}

A lookup is a round trip. A request goes from the device to the address of its DNS server and the reply comes back, as a flow of the service DNS. Both are followed like any other packet: VLANs, routes, firewall rules, NAT and failures apply, and a lookup stops in the same ways. Only when both arrive is the record read. Then the command goes on to the address found, exactly as if it had been typed.

`resolve <name>` does the lookup alone, and the command that follows shows it before its own answer:

```ncl sample=company
pixelcake> resolve erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Sales → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Sales
erp.company.example is 192.168.30.30 (answered by Srv-Auth)
pixelcake> ping erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Sales → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Sales
erp.company.example is 192.168.30.30 (answered by Srv-Auth)
Pinging Web-ERP (192.168.30.30) from PC-Sales...
Reply from 192.168.30.30: hops=6 time=0.46ms
```

Both lines say what went where: the DNS request, PC-Sales to Srv-Auth, and the DNS reply, back. The ping that follows is a separate question, to Web-ERP.

Across a firewall the lookup is judged by its rules, as the service “DNS”. In the sample the web server of the DMZ is given Srv-Auth as its DNS server. Srv-Auth is in the servers’ network, and the firewall refuses a new flow from the DMZ towards a more trusted zone, the lookup included. A rule for DNS lets it through, and the reply comes back as the reply to an allowed flow:

```ncl sample=company
pixelcake> interface eth0 dns 192.168.30.10 on Customer-Portal
interface eth0 on Customer-Portal: DNS server 192.168.30.10
pixelcake> resolve erp.company.example from Customer-Portal
Looking up erp.company.example from Customer-Portal (DNS server 192.168.30.10)...
  ✗ DNS request: Customer-Portal → Srv-Auth
Lookup failed (blocked): DNS request: firewall FW-Edge: no rule matches, zone policy dmz → trust denied
  dropped at: FW-Edge
pixelcake> add rule allow dns from dmz to 192.168.30.10 on FW-Edge
FW-Edge: rule 4 added — allow dns from dmz to 192.168.30.10
pixelcake> resolve erp.company.example from Customer-Portal
Looking up erp.company.example from Customer-Portal (DNS server 192.168.30.10)...
  ✓ DNS request: Customer-Portal → Srv-Auth
  ✓ DNS reply: Srv-Auth → Customer-Portal
erp.company.example is 192.168.30.30 (answered by Srv-Auth)
  note: DNS request: firewall FW-Edge: allowed by rule 4 (allow dns from dmz to 192.168.30.10)
  note: DNS reply: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
```

A port forward can name the service DNS too. In the multinational sample the customer outside asks 203.0.113.1, the public address of the firewall, which sends the question to the public DNS server of the company:

```ncl sample=multinational
pixelcake> show dns Customer
DNS of Customer
  eth0: asks 203.0.113.1 (FW-MI)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> resolve www.group.example from Customer
Looking up www.group.example from Customer (DNS server 203.0.113.1)...
  ✓ DNS request: Customer → DNS-PUB
  ✓ DNS reply: DNS-PUB → Customer
www.group.example is 203.0.113.1 (answered by DNS-PUB)
  note: 203.0.113.1 is FW-MI, which forwards dns to DNS-PUB (port forward 3)
  note: DNS request: Internet A is not simulated: traffic assumed to pass
  note: DNS request: firewall FW-MI: allowed by rule 6 (allow dns from untrust to 172.16.10.53)
  note: DNS reply: firewall FW-MI: no rule matches, zone policy dmz → untrust allowed
  note: DNS reply: Internet A is not simulated: traffic assumed to pass
```

If the DNS server is down, or the way to it is cut, the names find no address while the addresses still answer:

```ncl sample=company
pixelcake> interface eth0 down on Srv-Auth
interface eth0 on Srv-Auth is now down
pixelcake> ping erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✗ DNS request: PC-Sales → Srv-Auth
Lookup failed (blocked): DNS request: interface eth0 on Srv-Auth is disabled
  dropped at: Srv-Auth
pixelcake> ping Web-ERP from PC-Sales
Pinging Web-ERP (192.168.30.30) from PC-Sales...
Reply from 192.168.30.30: hops=6 time=0.46ms
```

## Limits {#limits}

> [!LIMITS]
> - A card names one DNS server. There is no second server to fall back on.
> - A server answers only for its own records. It does not ask another server, so there are no forwarders and no recursion, and a public DNS server that is not in the drawing is nobody.
> - No cache and no TTL: every question that uses a name looks it up again.
> - No reverse lookup, no wildcard names and no aliases: a name is a host name with one address.
> - A device with no network card, such as a router, a firewall or a switch, asks nobody.
> - Names work in the terminal only. The simulation panel and the presentation pick devices from menus.
