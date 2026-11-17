---
title: "I comandi show"
description: "I comandi che leggono la rete senza cambiarla: dispositivi, interfacce, VLAN, rotte, regole, NAT, DHCP, DNS."
order: 8
---

> [!TODO]
> Una pagina di riferimento: una sezione per comando show, ciascuna con un output vero su una rete di esempio.

## show devices {#show-devices}

```text
show devices
ls
list
```

> [!TODO]
> Ogni dispositivo con tipo e indirizzo; ls e list.

## show interfaces {#show-interfaces}

```text
show interfaces [of] <device>
```

> [!TODO]
> Porte e schede in una tabella.

## show ports {#show-ports}

```text
show ports [of] <device>
```

> [!TODO]
> Solo le porte.

## show vlans {#show-vlans}

```text
show vlans
```

> [!TODO]
> Ogni VLAN e dove si trova.

## show connections {#show-connections}

```text
show connections [of <device>]
```

> [!TODO]
> Le connessioni con l'interfaccia a ogni capo.

## show config {#show-config}

```text
show config [of] <device>
```

> [!TODO]
> Tutto di un dispositivo.

## show neighbors {#show-neighbors}

```text
show neighbors [of] <device>
```

> [!TODO]
> I dispositivi collegati a uno.

## show ip {#show-ip}

```text
show ip [of] <device>
ipconfig [<device>]
ifconfig [<device>]
```

> [!TODO]
> Gli indirizzi in breve; ipconfig, ifconfig.

## show routes {#show-routes}

```text
show routes [of] <device>
```

> [!TODO]
> La tabella di instradamento come la legge il motore.

## show rules {#show-rules}

```text
show rules [of] <device>
```

> [!TODO]
> Le regole di un firewall, poi la politica.

## show nat {#show-nat}

```text
show nat [of] <device>
```

> [!TODO]
> NAT in uscita e inoltri.

## show dhcp {#show-dhcp}

```text
show dhcp [[of] <device>]
```

> [!TODO]
> Intervalli, indirizzi assegnati, schede senza indirizzo.

## show dns {#show-dns}

```text
show dns [[of] <device>]
```

> [!TODO]
> I record e chi chiede a chi.

## sh {#sh}

```text
sh <what> [[of] <device>]
```

> [!TODO]
> sh è show.
