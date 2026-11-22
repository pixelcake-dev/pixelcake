---
title: "DHCP e DNS"
description: "I comandi che mettono una scheda in DHCP, danno a un'interfaccia un intervallo di indirizzi da assegnare, indicano un server DNS e gestiscono i suoi record."
order: 6
---

Due servizi permettono a un dispositivo di ricevere ciò che altrimenti andrebbe scritto a mano. Il DHCP dà a una scheda di rete indirizzo, subnet mask, gateway e server DNS. Il DNS permette di usare un nome al posto di un indirizzo. Questi comandi impostano entrambi, come le schede «DHCP» e «DNS» della finestra di un dispositivo, e `show dhcp` e `show dns` rileggono il risultato ([Comandi show](show.md#show-dhcp)). Come il motore calcola un'assegnazione e una ricerca, e che cosa lascia fuori, è spiegato in [DHCP](../services/dhcp.md) e in [DNS](../services/dns.md). Come si usa un nome in una domanda lo spiega [Interrogare](asking.md#targets).

Gli esempi usano la rete di esempio «Azienda: uffici, Wi-Fi, server e DMZ», dove Router-Core assegna gli indirizzi degli uffici e del Wi-Fi e Srv-Auth è il server DNS. Nella sintassi qui sotto `<name>` è il nome di una scheda (`eth0`), `<id>` il numero di una porta o il nome di una scheda, `<address>` un indirizzo IPv4; `on <device>` si può tralasciare dentro `use <device>`. La notazione è spiegata nella [panoramica](index.md#conventions). I comandi sono in inglese, come tutto il terminale, e i nomi di host della rete di esempio sono quelli italiani (`gestionale.azienda.example`).

## interface … dhcp {#dhcp-client}

```text
interface <name> dhcp [on] <device>
interface <name> dhcp off [on] <device>
```

Una scheda di rete prende l'indirizzo dal server DHCP della sua rete, oppure smette di farlo. La risposta dice quale indirizzo viene assegnato alla scheda, con subnet mask, gateway e server DNS, e da quale intervallo; oppure, quando nessun server può servirla, perché. `dhcp off` lascia la scheda senza indirizzo, e la risposta dice come darglielo. `dhcp none` è uguale a `dhcp off`.

| Parametro | Che cos'è |
|---|---|
| `<name>` | Il nome di una scheda di rete di un dispositivo finale |
| `<device>` | Il dispositivo a cui appartiene la scheda |

- Un router, un firewall e uno switch non hanno un client DHCP: i loro indirizzi si scrivono a mano, e il comando viene rifiutato. Per la porta di un router o di un firewall il rifiuto nomina `interface <n> pool`, qui sotto.
- Una scheda che è a sua volta un server DHCP (ha un intervallo da assegnare) smette di assegnare indirizzi quando ne chiede uno: una scheda non fa le due cose, e la risposta lo dice.
- Finché una scheda è in DHCP non ha un indirizzo proprio. Un indirizzo scritto a mano, con `interface <name> ip` o con `set ip` (quando è la prima scheda), la toglie dal DHCP ([Interfacce e VLAN](interfaces-and-vlans.md#ip)). Gateway e server DNS arrivano con l'assegnazione, e `interface <name> gateway` e `interface <name> dns` vengono rifiutati.
- Un'assegnazione non viene ricordata: il motore la ricalcola dal disegno ogni volta, come l'indirizzo libero più basso dell'intervallo ([quale indirizzo](../services/dhcp.md#which-address)).

```ncl sample=company
pixelcake> show ip PC-Vendite
PC-Vendite — addressing
  ip:       192.168.10.12
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.12 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10
pixelcake> interface eth0 dhcp on PC-Vendite
interface eth0 on PC-Vendite now takes its address from DHCP
  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10 by Router-Core port 1
pixelcake> interface eth0 dhcp on PC-Vendite
interface eth0 on PC-Vendite already takes its address from DHCP
  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10 by Router-Core port 1
pixelcake> ping Web-Gestionale from PC-Vendite
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Reply from 192.168.30.30: hops=6 time=0.46ms
pixelcake> interface eth0 dhcp off on PC-Vendite
interface eth0 on PC-Vendite no longer takes its address from DHCP: it has no address now
  give it one: interface eth0 ip <address>/<prefix> on PC-Vendite
pixelcake> ping Web-Gestionale from PC-Vendite
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Ping failed (error): request: PC-Vendite has no IP address configured
pixelcake> interface eth0 ip 192.168.10.12/24 on PC-Vendite
interface eth0 on PC-Vendite: 192.168.10.12 / 255.255.255.0
pixelcake> interface eth0 gateway 192.168.10.1 on PC-Vendite
interface eth0 on PC-Vendite: gateway 192.168.10.1
```

Una scheda a cui nessun server risponde non ha indirizzo, e la risposta dice perché:

```ncl sample=office
pixelcake> interface eth0 dhcp on Web-01
interface eth0 on Web-01 now takes its address from DHCP
  warning: no address yet: no DHCP server answers on its network
pixelcake> show dhcp
DHCP — 0 pools, 0 leases
WITHOUT AN ADDRESS
  ✗ Web-01 eth0: no DHCP server answers on its network
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> ping Mail-01 from Web-01
Pinging Mail-01 (192.168.20.20) from Web-01...
Ping failed (error): request: Web-01 has no address: no DHCP server answers on its network
pixelcake> interface 1 dhcp on Router-1
DHCP gives an address to the network cards of end devices: port 1 on Router-1 gets its own by hand
  to hand out addresses from it: interface 1 pool <first> to <last> on Router-1
pixelcake> interface 2 dhcp on SW-Office
DHCP gives an address to the network cards of end devices: port 2 on SW-Office gets its own by hand
```

## interface … pool {#pool}

```text
interface <id> [dhcp] pool <first> to <last> [gateway <address>] [dns <address>] [on] <device>
interface <id> pool none [on] <device>
```

Un'interfaccia assegna alla sua rete gli indirizzi di un intervallo (il `pool` del comando): una porta di un router o di un firewall, oppure una scheda di un server. Con ogni indirizzo il server consegna la subnet mask della sua interfaccia, un gateway e un server DNS. Un'interfaccia ha un solo intervallo: uno nuovo sostituisce il vecchio.

| Parametro | Che cos'è |
|---|---|
| `<id>` | Il numero di una porta, o il nome di una scheda di un server. L'interfaccia deve avere un indirizzo: l'intervallo è per la sua rete |
| `<first>`, `<last>` | Il primo e l'ultimo indirizzo dell'intervallo, entrambi dentro la rete dell'interfaccia. `to` si può tralasciare, oppure i due si scrivono `<first>-<last>` |
| `gateway <address>` | Il gateway consegnato. `gw` è la stessa parola. Senza, un router o un firewall consegna l'indirizzo della porta stessa, e un server non ne consegna nessuno: allora i suoi client comunicano solo dentro la loro rete |
| `dns <address>` | Il server DNS consegnato. Senza, nessuno |
| `none` | Spegne il server DHCP dell'interfaccia. `off` è uguale |

`interface <id> dhcp pool …` è lo stesso comando con una parola in più. Le due opzioni `gateway` e `dns` si possono scrivere in un ordine o nell'altro. La risposta dà il numero degli indirizzi dell'intervallo, ciò che viene consegnato, chi ha già un indirizzo da quell'intervallo e un avviso quando un altro server risponde sulla stessa rete: risponde il primo del disegno che ha ancora un indirizzo da dare ([chi risponde a chi](../services/dhcp.md#servers)). `pool none` dice chi resta senza indirizzo.

```ncl sample=company
pixelcake> show dhcp Router-Core
DHCP of Router-Core
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 98 free of 100
LEASES
  192.168.20.100   Portatile-1 eth0         from Router-Core port 2
  192.168.20.101   Portatile-2 eth0         from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> interface 1 pool none on Router-Core
port 1 on Router-Core no longer hands out addresses
pixelcake> interface eth0 dhcp on PC-Vendite
interface eth0 on PC-Vendite now takes its address from DHCP
  warning: no address yet: no DHCP server answers on its network
pixelcake> interface 1 pool 192.168.10.100 to 192.168.10.149 dns 192.168.30.10 on Router-Core
port 1 on Router-Core now hands out 192.168.10.100 to 192.168.10.149: 50 addresses, gateway 192.168.10.1, DNS server 192.168.30.10
  leased now: PC-Vendite 192.168.10.100
pixelcake> interface 1 pool 192.168.10.100 to 192.168.10.149 dns 192.168.30.10 on Router-Core
port 1 on Router-Core already hands out 192.168.10.100 to 192.168.10.149
pixelcake> interface 1 pool none on Router-Core
port 1 on Router-Core no longer hands out addresses
  without an address now: PC-Vendite
pixelcake> interface 1 pool none on Router-Core
port 1 on Router-Core hands out no addresses already
```

Le forme brevi, e un server che assegna indirizzi:

```ncl sample=office
pixelcake> interface 1 pool 192.168.10.100-192.168.10.150 on Router-1
port 1 on Router-1 now hands out 192.168.10.100 to 192.168.10.150: 51 addresses, gateway 192.168.10.1
  no card on its network asks for an address yet: interface <name> dhcp on <device>
pixelcake> interface 1 dhcp pool 192.168.10.100 192.168.10.150 gateway 192.168.10.1 dns 192.168.20.10 on Router-1
port 1 on Router-1 now hands out 192.168.10.100 to 192.168.10.150: 51 addresses, gateway 192.168.10.1, DNS server 192.168.20.10
  no card on its network asks for an address yet: interface <name> dhcp on <device>
pixelcake> interface eth0 pool 192.168.20.100 to 192.168.20.150 on Web-01
interface eth0 on Web-01 now hands out 192.168.20.100 to 192.168.20.150: 51 addresses, no gateway: its clients talk inside their network only
  no card on its network asks for an address yet: interface <name> dhcp on <device>
pixelcake> interface eth0 dhcp on PC-1
interface eth0 on PC-1 now takes its address from DHCP
  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.20.10 by Router-1 port 1
pixelcake> show ip PC-1
PC-1 — addressing
  ip:       192.168.10.100 (dhcp)
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.20.10 (dhcp from Router-1 port 1)
```

## interface … dns {#dns-server}

```text
interface <name> dns <address>|none [on] <device>
```

Il server DNS che una scheda di rete interroga quando al posto di un indirizzo si usa un nome: l'indirizzo di un dispositivo del disegno che ha dei record. `dns none` fa sì che la scheda non interroghi nessuno; `clear` è la stessa parola. Un dispositivo fa le sue domande dalla prima scheda attiva che indica un server. Un router, un firewall e uno switch non hanno schede e non interrogano nessuno.

| Parametro | Che cos'è |
|---|---|
| `<name>` | Il nome di una scheda di rete |
| `<address>` | L'indirizzo del server DNS. Viene controllato come indirizzo, non come dispositivo: se nessun dispositivo ce l'ha, lo dice il motore quando fa la domanda |

Su una scheda che è in DHCP il comando viene rifiutato: il server DNS arriva con l'assegnazione, dall'opzione `dns` di `interface … pool`.

```ncl sample=company
pixelcake> show dns PC-Vendite
DNS of PC-Vendite
  eth0: asks 192.168.30.10 (Srv-Auth)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> interface eth0 dns none on PC-Vendite
interface eth0 on PC-Vendite asks no DNS server now
pixelcake> ping gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite...
Lookup failed: PC-Vendite has no DNS server: it cannot look up gestionale.azienda.example
pixelcake> interface eth0 dns 192.168.30.10 on PC-Vendite
interface eth0 on PC-Vendite: DNS server 192.168.30.10
pixelcake> interface eth0 dns 192.168.30.10 on PC-Vendite
interface eth0 on PC-Vendite already asks 192.168.30.10
pixelcake> interface eth0 dns 8.8.8.8 on PC-Vendite
interface eth0 on PC-Vendite: DNS server 8.8.8.8
pixelcake> resolve gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite (DNS server 8.8.8.8)...
Lookup failed: PC-Vendite asks 8.8.8.8 for names, an address no device has
pixelcake> interface 1 dns 192.168.30.10 on Router-Core
port 1 on Router-Core is a port: a DNS server is named on a network card
pixelcake> interface eth0 dns 192.168.30.10 on Portatile-1
interface eth0 on Portatile-1 takes its address from DHCP: the DNS server comes with the lease
  it is the one of the pool: interface <n> pool <first> to <last> dns <address> on <server>
```

## add record {#add-record}

```text
add record <name> [to] <address> [on] <server>
```

Aggiunge un record a un server: un nome di host e l'indirizzo che gli corrisponde. Il server risponde alle domande sui nomi che conosce, e su nessun altro.

| Parametro | Che cos'è |
|---|---|
| `<name>` | Un nome di host con almeno un punto, `gestionale.azienda.example`. Maiuscole e minuscole non contano: viene salvato in minuscolo |
| `<address>` | Un indirizzo IPv4, oppure un dispositivo: il comando scrive allora l'indirizzo del dispositivo e dice quale. Al posto di `to` si può scrivere `is` o `at`, oppure niente |
| `<server>` | Un dispositivo di tipo Server. Dentro `use <device>` si tralascia |

Un nome ha un indirizzo solo: un nome già presente prende il nuovo indirizzo, e la risposta dice qual era; lo stesso nome con lo stesso indirizzo non aggiunge nulla. Un dispositivo indicato al posto dell'indirizzo viene scritto con l'indirizzo che ha adesso: se poi il suo indirizzo cambia, il record non lo segue.

```ncl sample=company
pixelcake> add record intranet.azienda.example Web-Gestionale on Srv-Auth
Srv-Auth: record 4 added — intranet.azienda.example is 192.168.30.30
  Web-Gestionale → 192.168.30.30
pixelcake> resolve intranet.azienda.example from PC-Vendite
Looking up intranet.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
intranet.azienda.example is 192.168.30.30 (answered by Srv-Auth)
pixelcake> add record INTRANET.azienda.example 192.168.30.31 on Srv-Auth
Srv-Auth: record 4 — intranet.azienda.example is now 192.168.30.31 (was 192.168.30.30)
pixelcake> add record INTRANET.azienda.example 192.168.30.31 on Srv-Auth
Srv-Auth already has it: record 4
pixelcake> show dns Srv-Auth
DNS of Srv-Auth
RECORDS (it answers for these names, and for no other)
   1  gestionale.azienda.example       192.168.30.30
   2  posta.azienda.example            192.168.30.40
   3  portale.azienda.example          172.16.0.10
   4  intranet.azienda.example         192.168.30.31
  eth0: asks nobody
  name a DNS server: interface eth0 dns <address> on Srv-Auth
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
```

## remove record {#remove-record}

```text
remove record <n>|<name> [from] <server>
delete record <n>|<name> [from] <server>
```

Toglie un record, per il suo numero nell'elenco del server (`show dns <server>` li numera) o per il suo nome. I record successivi salgono di un posto. `delete` è uguale a `remove`, e `on` si può scrivere al posto di `from`.

| Parametro | Che cos'è |
|---|---|
| `<n>` | Il numero di un record, da 1 |
| `<name>` | Il nome di un record |
| `<server>` | Il server che ha il record |

```ncl sample=company
pixelcake> remove record 1 from Srv-Auth
Srv-Auth: record 1 removed — gestionale.azienda.example is 192.168.30.30
pixelcake> remove record posta.azienda.example from Srv-Auth
Srv-Auth: record 1 removed — posta.azienda.example is 192.168.30.40
pixelcake> show dns Srv-Auth
DNS of Srv-Auth
RECORDS (it answers for these names, and for no other)
   1  portale.azienda.example          172.16.0.10
  eth0: asks nobody
  name a DNS server: interface eth0 dns <address> on Srv-Auth
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> remove record 4 from Srv-Auth
Srv-Auth has no record 4 (it has 1)
pixelcake> remove record gestionale.azienda.example from Srv-Auth
Srv-Auth has no record for gestionale.azienda.example
pixelcake> resolve portale.azienda.example from PC-Vendite
Looking up portale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
portale.azienda.example is 172.16.0.10 (answered by Srv-Auth)
```

## Quando un comando viene rifiutato {#refusals}

Un comando che non si può eseguire non cambia nulla, e dice perché, o che forma avrebbe dovuto avere:

```ncl sample=company
pixelcake> interface 3 dhcp on Router-Core
DHCP gives an address to the network cards of end devices: port 3 on Router-Core gets its own by hand
  to hand out addresses from it: interface 3 pool <first> to <last> on Router-Core
pixelcake> interface eth0 pool 192.168.10.150 to 192.168.10.100 on Srv-Auth
192.168.10.150 is outside 192.168.30.0/24, the network of eth0 on Srv-Auth
pixelcake> interface 1 pool 10.0.0.1 to 10.0.0.9 on Router-Core
10.0.0.1 is outside 192.168.10.0/24, the network of port 1 on Router-Core
pixelcake> interface 1 pool 192.168.10.100 on Router-Core
unknown command: "interface 1 pool 192.168.10.100 on Router-Core"
  a pool goes from its first address to its last — try: interface <n> pool <first> to <last> [gateway <address>] [dns <address>] [on] <device> — or "pool none" to stop
  type "help" for the command list
pixelcake> interface eth0 pool 192.168.10.100 to 192.168.10.110 on PC-Vendite
addresses are handed out by a port of a router or a firewall, or by a card of a server: PC-Vendite is a PC
pixelcake> interface eth0 dns banana on PC-Vendite
"banana" is not a valid IPv4 address
pixelcake> add record x.azienda.example 192.168.30.30 on PC-Vendite
PC-Vendite is a PC: records are kept by servers
pixelcake> add record x.azienda.example Nessuno on Srv-Auth
"Nessuno" is not an address or a device
pixelcake> add record x.azienda.example Internet on Srv-Auth
Internet has no address for a name to stand for
pixelcake> remove record 9 from Srv-Auth
Srv-Auth has no record 9 (it has 3)
pixelcake> remove record nessuno.azienda.example from Srv-Auth
Srv-Auth has no record for nessuno.azienda.example
```

## Vedi anche {#see-also}

- [DHCP](../services/dhcp.md), [DNS](../services/dns.md): come il motore calcola un'assegnazione e una ricerca, e ciò che non fa.
- [Comandi show](show.md#show-dhcp): `show dhcp` e `show dns`, per leggere ciò che questi comandi hanno impostato.
- [Interrogare](asking.md#resolve): `resolve`, e un nome usato al posto di un indirizzo.
- [Interfacce e VLAN](interfaces-and-vlans.md#ip): indirizzo e gateway di una scheda scritti a mano.
