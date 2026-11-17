---
title: "Show commands"
description: "The commands that read the network without changing it: devices, interfaces, VLANs, routes, rules, NAT, DHCP, DNS."
order: 8
---

> [!TODO]
> A reference page: one section per show command, each with one real output on a sample.

## show devices {#show-devices}

```text
show devices
ls
list
```

> [!TODO]
> Every device with its type and address; ls and list.

## show interfaces {#show-interfaces}

```text
show interfaces [of] <device>
```

> [!TODO]
> Ports and cards in one table.

## show ports {#show-ports}

```text
show ports [of] <device>
```

> [!TODO]
> The ports alone.

## show vlans {#show-vlans}

```text
show vlans
```

> [!TODO]
> Every VLAN and where it is.

## show connections {#show-connections}

```text
show connections [of <device>]
```

> [!TODO]
> Links with the interface at each end.

## show config {#show-config}

```text
show config [of] <device>
```

> [!TODO]
> Everything about one device.

## show neighbors {#show-neighbors}

```text
show neighbors [of] <device>
```

> [!TODO]
> The devices connected to one.

## show ip {#show-ip}

```text
show ip [of] <device>
ipconfig [<device>]
ifconfig [<device>]
```

> [!TODO]
> Addresses in short; ipconfig, ifconfig.

## show routes {#show-routes}

```text
show routes [of] <device>
```

> [!TODO]
> The routing table as the engine reads it.

## show rules {#show-rules}

```text
show rules [of] <device>
```

> [!TODO]
> The rules of a firewall, then the policy.

## show nat {#show-nat}

```text
show nat [of] <device>
```

> [!TODO]
> Source NAT and port forwards.

## show dhcp {#show-dhcp}

```text
show dhcp [[of] <device>]
```

> [!TODO]
> Pools, leases, cards without an address.

## show dns {#show-dns}

```text
show dns [[of] <device>]
```

> [!TODO]
> Records and who asks whom.

## sh {#sh}

```text
sh <what> [[of] <device>]
```

> [!TODO]
> sh is show.
