---
title: "Asking: ping, trace and the others"
description: "The commands that ask the network a question and follow the answer on the board: ping, trace, browse, mail, download, resolve."
order: 7
---

A question is asked of the network as it is drawn: the engine follows the packet hop by hop, applies VLANs, routes, rules and translation at each device, and says where it arrives or where and why it stops ([how the engine decides](../asking/how-the-engine-decides.md)). It is the same engine as the simulation panel, so the two always agree ([the simulation panel](../asking/simulation-panel.md)). These commands change nothing in the drawing.

While the answer is worked out the packet travels on the board, and the terminal prints the lines as the packet reaches them: the prompt returns when the packet has arrived, or stopped. Ctrl+C interrupts it ([the window](index.md#open)). When the answer ends, the device that answers turns green, and the device where the question stops turns red.

Every question takes a target and, unless the terminal is inside a device (`use <device>`), a source: `<target> from <device>`. The notation is explained in the [overview](index.md#conventions); what a target can be is under [Targets](#targets). Examples run on the sample networks, and the sample is named above each one.

## ping {#ping}

```text
ping <target> [from <device>]
```

Asks whether the target answers: a request from the source to the target, and a reply back. Both directions are worked out, with their own routes, rules and translation, and the question fails if either fails.

| Parameter | What it is |
|---|---|
| `<target>` | A device, an address or a host name ([targets](#targets)) |
| `<device>` | The device the question starts from. Inside `use <device>` it is left out |

An answer that arrives says `Reply from <address>: hops=<n> time=<t>ms`. The number of hops is the number of devices the request crossed, the two ends included. The time is not measured: it is worked out from the number of hops, and says nothing about the speed of the cables.

An answer that does not arrive says `Ping failed (<verdict>): <reason>`, and under it `dropped at:` the device that dropped the packet. The reason says whether it was the request or the reply, and what stopped it: the device, the port, the route or the rule. The verdict is one of four words:

| Verdict | What it means |
|---|---|
| `success` | The question arrived, and was answered |
| `blocked` | A device dropped the packet: the reason names it |
| `unreachable` | No cable joins the two devices, by any path that works |
| `error` | The question cannot even be asked: a device has no address, or the source and the target of `browse`, `mail` or `download` are the same device |

A device can ping itself: it answers without the packet leaving it, in one hop, as a `trace` to itself shows.

Lines that start with `note:` come after the answer. They tell what the engine assumed or did on the way and did not verify: a firewall that decided, an address that was translated, the Internet symbol that was taken as letting everything through.

```ncl sample=company
pixelcake> ping Web-ERP from PC-Sales
Pinging Web-ERP (192.168.30.30) from PC-Sales...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> ping Remote-Customer from PC-Sales
Pinging Remote-Customer (203.0.113.50) from PC-Sales...
Reply from 203.0.113.50: hops=7 time=11ms
  note: request: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed
  note: request: Internet is not simulated: traffic assumed to pass
  note: reply: Internet is not simulated: traffic assumed to pass
  note: reply: firewall FW-Edge: no rule matches, zone policy untrust → trust allowed (reply to an allowed flow)
pixelcake> ping PC-Sales from Remote-Customer
Pinging PC-Sales (192.168.10.12) from Remote-Customer...
Ping failed (blocked): request: Internet does not carry private addresses: 192.168.10.12 is not reachable from outside: no port forward publishes it for ping
  dropped at: Internet
pixelcake> ping Web-ERP from Web-ERP
Pinging Web-ERP (192.168.30.30) from Web-ERP...
Reply from 192.168.30.30: hops=1 time=1ms
pixelcake> ping Internet from PC-Sales
Pinging Internet (no ip) from PC-Sales...
Ping failed (error): request: Internet has no IP address configured
```

## trace {#trace}

```text
trace <target> [from <device>] [as ping|web|email|dns]
traceroute <target> [from <device>]
tracert <target> [from <device>]
```

Follows the request one way, and prints a line for every device it reaches, with what the device did to it: the VLAN it carries, the route it took, the rule that decided, the address it translated. `traceroute` and `tracert` are the same command. There is no reply: a trace is about the way there.

| Parameter | What it is |
|---|---|
| `<target>` | A device, an address or a host name ([targets](#targets)) |
| `<device>` | The device the question starts from |
| `as <service>` | The service the packet is for: `ping` (the default), `web`, `email` or `dns` ([the names a service goes by](firewall-and-nat.md#services)). It matters to the rules of a firewall and to the port forwards, which are for one service |

A line of the trace starts with the number of the device, then a sign: `○` for a device the packet went through, `●` for the one it was delivered to, `✗` for the one that dropped it. The line ends with what the device did, after a dash. A trace that arrives ends with `Trace complete: destination reached.`; one that does not ends with `Trace failed (<verdict>): <reason>`, with the verdict of the table above. When there is no path at all, no hop is printed.

```ncl sample=company
pixelcake> trace Web-ERP from Laptop-1 as web
Tracing route to Web-ERP (192.168.30.30) from Laptop-1 as web:
  1  ○ Laptop-1 (PC)
  2  ○ AP-Offices (AccessPoint)
  3  ○ SW-Offices (Switch)  — VLAN 20
  4  ○ SW-Core (Switch)  — VLAN 20
  5  ○ Router-Core (Router)  — routed: 192.168.30.0/24 is on port 3
  6  ○ SW-Servers (Switch)  — VLAN 30
  7  ● Web-ERP (Server)
Trace complete: destination reached.
pixelcake> trace Customer-Portal from Remote-Customer
Tracing route to Customer-Portal (172.16.0.10) from Remote-Customer:
  1  ○ Remote-Customer (PC)
  2  ✗ Internet (Cloud)  — Internet does not carry private addresses: 172.16.0.10 is not reachable from outside: no port forward publishes it for ping
Trace failed (blocked): Internet does not carry private addresses: 172.16.0.10 is not reachable from outside: no port forward publishes it for ping
pixelcake> trace Customer-Portal from Remote-Customer as web
Tracing route to Customer-Portal (203.0.113.1) from Remote-Customer as web:
  1  ○ Remote-Customer (PC)
  2  ○ Internet (Cloud)  — Internet is not simulated: traffic assumed to pass
  3  ○ FW-Edge (Firewall)  — NAT: destination 203.0.113.1 → 172.16.0.10 (port forward 1); routed: 172.16.0.0/24 is on port 2; firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)
  4  ○ SW-DMZ (Switch)
  5  ● Customer-Portal (Server)
  note: Customer-Portal is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: Internet is not simulated: traffic assumed to pass
  note: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)
Trace complete: destination reached.
```

## browse {#browse}

```text
browse <target> [from <device>]
web <target> [from <device>]
curl <target> [from <device>]
```

A whole web exchange: the HTTP request from the source to the target, then the response back. Each leg is a line, with `✓` when it passed and `✗` when it did not. The exchange is for the service `web`, so a rule or a forward for web applies to it. `web` and `curl` are the same command. The question fails at the first leg that fails, and the legs after it are not tried.

| Parameter | What it is |
|---|---|
| `<target>` | A device, an address or a host name |
| `<device>` | The device the question starts from |

```ncl sample=office
pixelcake> browse Web-01 from PC-1
Browsing Web-01 (192.168.20.10) from PC-1...
  ✓ HTTP request: PC-1 → Web-01
  ✓ HTTP response: Web-01 → PC-1
Page received from Web-01
pixelcake> interface 2 down on Router-1
port 2 on Router-1 is now down
pixelcake> browse Web-01 from PC-1
Browsing Web-01 (192.168.20.10) from PC-1...
  ✗ HTTP request: PC-1 → Web-01
Browse failed (blocked): HTTP request: port 2 on Router-1 is disabled
  dropped at: Router-1
pixelcake> interface 2 up on Router-1
port 2 on Router-1 is now up
pixelcake> curl Web-01 from PC-1
Browsing Web-01 (192.168.20.10) from PC-1...
  ✓ HTTP request: PC-1 → Web-01
  ✓ HTTP response: Web-01 → PC-1
Page received from Web-01
```

## mail {#mail}

```text
mail <target> [from <device>]
email <target> [from <device>]
```

An email, through its relay. The mail does not go straight to the recipient: the source sends it to a mail server, and the server delivers it. Which server is the relay depends on the email mode of the project, “Email mode (SMTP)” in Settings → Network: with “Internal mail server”, the nearest mail server of the drawing; with “Cloud (M365, Gmail…)”, the way out to the Internet; with “Auto (detect automatically)”, the internal one if there is one, and the cloud otherwise, with a note. The legs say which: `SMTP submit` and `delivery`, or `SMTP to cloud provider` and `cloud delivery`. When the source or the target is the relay itself there is a single leg. `email` is the same command.

| Parameter | What it is |
|---|---|
| `<target>` | The recipient: a device, an address or a host name |
| `<device>` | The sender |

```ncl sample=office
pixelcake> mail PC-2 from PC-1
Mailing PC-2 (192.168.10.12) from PC-1...
  ✓ SMTP submit: PC-1 → Mail-01
  ✓ delivery: Mail-01 → PC-2
Mail delivered to PC-2
pixelcake> mail Mail-01 from PC-1
Mailing Mail-01 (192.168.20.20) from PC-1...
  ✓ SMTP submit: PC-1 → Mail-01
Mail delivered to Mail-01
pixelcake> interface 2 down on Router-1
port 2 on Router-1 is now down
pixelcake> mail PC-1 from Web-01
Mailing PC-1 (192.168.10.11) from Web-01...
  ✓ SMTP submit: Web-01 → Mail-01
  ✗ delivery: Mail-01 → PC-1
Mail failed (blocked): delivery: port 2 on Router-1 is disabled
  dropped at: Router-1
```

## download {#download}

```text
download <target> [from <device>]
wget <target> [from <device>]
```

A download: the request from the source to the target, then the data back. To a firewall it is web traffic, so the rules and the forwards for `web` apply. `wget` is the same command.

| Parameter | What it is |
|---|---|
| `<target>` | A device, an address or a host name |
| `<device>` | The device the question starts from |

```ncl sample=company
pixelcake> download Web-ERP from PC-Sales
Downloading from Web-ERP (192.168.30.30) from PC-Sales...
  ✓ download request: PC-Sales → Web-ERP
  ✓ download data: Web-ERP → PC-Sales
Download complete from Web-ERP
pixelcake> download Web-ERP from Remote-Customer
Downloading from Web-ERP (192.168.30.30) from Remote-Customer...
  ✗ download request: Remote-Customer → Web-ERP
Download failed (blocked): download request: Internet does not carry private addresses: 192.168.30.30 is not reachable from outside: no port forward publishes it for web
  dropped at: Internet
```

## resolve {#resolve}

```text
resolve <name> [from <device>]
lookup <name> [from <device>]
nslookup <name> [from <device>]
```

A DNS lookup alone: the device asks its DNS server what address a name stands for, and the answer is printed with the legs of the request and of the reply. `lookup` and `nslookup` are the same command. The lookup is a real exchange, as any other question: VLANs, routes, rules and failures apply to it, and it fails when the device has no DNS server, when the server cannot be reached, or when the server has no record for the name.

| Parameter | What it is |
|---|---|
| `<name>` | A host name with at least one dot: `erp.company.example`. A word with no dot is refused |
| `<device>` | The device that asks. Inside `use <device>` it is left out |

```ncl sample=company
pixelcake> resolve erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Sales → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Sales
erp.company.example is 192.168.30.30 (answered by Srv-Auth)
pixelcake> resolve intranet.company.example from PC-Sales
Looking up intranet.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Sales → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Sales
Lookup failed: Srv-Auth has no record for intranet.company.example
pixelcake> resolve erp.company.example from Remote-Customer
Looking up erp.company.example from Remote-Customer...
Lookup failed: Remote-Customer has no DNS server: it cannot look up erp.company.example
pixelcake> resolve erp.company.example from Router-Core
Looking up erp.company.example from Router-Core...
Lookup failed: Router-Core has no DNS server: it cannot look up erp.company.example
pixelcake> lookup portal.company.example from Laptop-1
Looking up portal.company.example from Laptop-1 (DNS server 192.168.30.10)...
  ✓ DNS request: Laptop-1 → Srv-Auth
  ✓ DNS reply: Srv-Auth → Laptop-1
portal.company.example is 172.16.0.10 (answered by Srv-Auth)
```

## Targets {#targets}

A target is written in one of three ways, and the question is about the device it stands for:

- **A device**, by its name on the board: case does not matter, a name of several words is written as it is, and double quotes keep a name whole, so that a word such as `from` or `to` inside it is not read as a keyword. The question is aimed at the primary address of the device: the first network card of an end device, or the address a router or a firewall is known by.
- **An address**, in place of a device. Any device that has the address is the target, and the question is aimed at that very address: `ping 192.168.20.1` reaches the interface of the router that has it, and not the address the router is known by.
- **A host name**, `www.company.example`: a word with dots that is neither a device nor an address. The source asks its DNS server first, the lookup is printed and travels on the board, and the question then goes to the address found as if it had been typed. When the lookup fails the question stops there, with the reason ([DNS](dhcp-and-dns.md#dns-server)). The commands that take a host name are `ping`, `trace`, `browse`, `mail` and `download`.

```ncl sample=company
pixelcake> ping 192.168.20.1 from PC-Sales
Pinging Router-Core (192.168.20.1) from PC-Sales...
Reply from 192.168.20.1: hops=4 time=5ms
pixelcake> ping Router-Core from PC-Sales
Pinging Router-Core (192.168.10.1) from PC-Sales...
Reply from 192.168.10.1: hops=4 time=5ms
pixelcake> ping erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Sales → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Sales
erp.company.example is 192.168.30.30 (answered by Srv-Auth)
Pinging Web-ERP (192.168.30.30) from PC-Sales...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> browse portal.company.example from Laptop-1
Looking up portal.company.example from Laptop-1 (DNS server 192.168.30.10)...
  ✓ DNS request: Laptop-1 → Srv-Auth
  ✓ DNS reply: Srv-Auth → Laptop-1
portal.company.example is 172.16.0.10 (answered by Srv-Auth)
Browsing Customer-Portal (172.16.0.10) from Laptop-1...
  ✓ HTTP request: Laptop-1 → Customer-Portal
  ✓ HTTP response: Customer-Portal → Laptop-1
Page received from Customer-Portal
  note: HTTP request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

**A device behind NAT.** A device with a private address that a firewall publishes is reached from outside at the address of the firewall. The question is aimed there, and a note says so: `Customer-Portal is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it`. This holds for the commands that name a service (`browse`, `download`, `mail`, `trace … as <service>`); a `ping` or a `trace` without `as` is aimed at the address the device has, and the Internet symbol stops it, as no forward publishes a ping. An address that is typed is always the address aimed at, and nothing else is tried ([NAT](../services/nat.md)).

**A name that is not found.** A target or a source that matches no device is refused with the closest name, when there is one: `device not found: "web erp"`, then `did you mean "Web-ERP"?`. Without `from`, and outside `use`, a question has no source and says so.

```ncl sample=company
pixelcake> ping web erp from PC-Sales
device not found: "web erp"
  did you mean "Web-ERP"?
pixelcake> ping Web-ERP
specify a source: "ping Web-ERP from <device>" — or enter a device context with "use <device>"
pixelcake> ping "Web-ERP" from "PC-Sales"
Pinging Web-ERP (192.168.30.30) from PC-Sales...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> use PC-Sales
context: PC-Sales — "from" is now implied, "exit" to leave
PC-Sales> ping Web-ERP
Pinging Web-ERP (192.168.30.30) from PC-Sales...
Reply from 192.168.30.30: hops=6 time=9ms
PC-Sales> ping Nowhere
device not found: "Nowhere"
PC-Sales> exit
left PC-Sales
```

## When a command is refused {#refusals}

A question that cannot be asked is not answered, and says why, or what it should have been:

```ncl sample=company
pixelcake> ping
unknown command: "ping"
  try: ping <target> [from <device>]
  type "help" for the command list
pixelcake> trace Web-ERP from PC-Sales as gopher
unknown command: "trace Web-ERP from PC-Sales as gopher"
  unknown service "gopher" — try: trace <target> [from <device>] [as ping|web|email|dns]
  type "help" for the command list
pixelcake> browse from PC-Sales
unknown command: "browse from PC-Sales"
  try: browse <target> [from <device>]
  type "help" for the command list
pixelcake> resolve from PC-Sales
unknown command: "resolve from PC-Sales"
  try: resolve <name> [from <device>]
  type "help" for the command list
pixelcake> resolve erp.company.example
specify a source: "resolve erp.company.example from <device>" — or enter a device context with "use <device>"
```

## See also {#see-also}

- [The simulation panel](../asking/simulation-panel.md): the same questions, chosen from menus.
- [How the engine decides](../asking/how-the-engine-decides.md): the order of what happens at each device, and the reasons and notes.
- [Presentation](../asking/presentation.md#terminal): the terminal while presenting, with simulated failures.
- [DHCP and DNS](dhcp-and-dns.md#add-record): the records and the DNS server a name needs.
