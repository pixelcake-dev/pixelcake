---
title: "Comandi show"
description: "I comandi che leggono la rete senza cambiarla: dispositivi, interfacce, VLAN, rotte, regole, NAT, DHCP, DNS."
order: 8
---

I comandi `show` stampano il disegno come lo legge il motore: le tabelle che gli altri comandi cambiano, nell'ordine in cui sono scritte nelle finestre dei dispositivi. Non cambiano nulla e non mandano nessun pacchetto. Un indirizzo che una scheda ha ricevuto dal DHCP è indicato con `(dhcp)` ovunque compaia, per distinguerlo da uno scritto a mano ([DHCP](../services/dhcp.md)).

La maggior parte riguarda un dispositivo solo: `show <what> [of] <device>`, dove il dispositivo si indica con il nome che ha sul canvas o con un indirizzo, e `of` si può tralasciare. Dentro `use <device>` il dispositivo è sottinteso. Se un dispositivo non può avere ciò che si chiede (una tabella di instradamento su uno switch, le regole di un PC), una riga lo dice. `show devices` e `show vlans` riguardano tutto il disegno, e lo stesso vale per `show connections`, `show dhcp` e `show dns` quando non si indica un dispositivo. La notazione è spiegata nella [panoramica](index.md#conventions). I comandi e le tabelle sono in inglese, come tutto il terminale.

Un `show` con una parola che non è nell'elenco viene rifiutato con l'elenco, o con la parola più vicina:

```ncl sample=office
pixelcake> show banana
unknown command: "show banana"
  try: show devices | interfaces | ports | vlans | connections | config | neighbors | ip | routes | rules | nat | dhcp | dns
  type "help" for the command list
pixelcake> show devces
unknown command: "show devces"
  did you mean "show devices"?
  type "help" for the command list
pixelcake> show config
specify a device: "show config <device>" — or enter a context with "use <device>"
```

## show devices {#show-devices}

```text
show devices
ls
list
```

Tutti i dispositivi del disegno, con il tipo, l'indirizzo e le VLAN (l'elenco che il dispositivo conosce, non quelle delle sue porte). `ls` e `list` sono lo stesso comando; se seguiti da altre parole vengono letti come `show`, quindi `ls vlans` è `show vlans`. Un disegno senza dispositivi lo dice.

```ncl sample=office
pixelcake> show devices
DEVICE                   TYPE           IP               VLANS
Router-1                 Router         192.168.10.1     -
SW-Office                Switch         192.168.10.2     -
SW-Servers               Switch         192.168.20.2     -
PC-1                     PC             192.168.10.11    -
PC-2                     PC             192.168.10.12    -
Web-01                   Server         192.168.20.10    -
Mail-01                  Server         192.168.20.20    -
pixelcake> ls
DEVICE                   TYPE           IP               VLANS
Router-1                 Router         192.168.10.1     -
SW-Office                Switch         192.168.10.2     -
SW-Servers               Switch         192.168.20.2     -
PC-1                     PC             192.168.10.11    -
PC-2                     PC             192.168.10.12    -
Web-01                   Server         192.168.20.10    -
Mail-01                  Server         192.168.20.20    -
```

## show interfaces {#show-interfaces}

```text
show interfaces [of] <device>
```

Le porte e le schede di rete di un dispositivo in una tabella sola, qualunque dispositivo sia. È la tabella standard del linguaggio: *interfaccia* è una parola sola per entrambe.

| Colonna | Che cosa dice |
|---|---|
| `IFACE` | Il numero di una porta, o il nome di una scheda |
| `KIND` | `port` o `nic` |
| `STATE` | `up` o `down` |
| `IP` | Il suo indirizzo, oppure `-` |
| `VLAN` | Di una porta di uno switch: la sua VLAN, oppure `10,20` per un trunk con un elenco, oppure `all` per un trunk per tutte le VLAN; `1` per una porta che nessuno ha impostato su uno switch che applica le VLAN. Altrove `-` |
| `MODE-ZONE` | Di una porta: la sua modalità, `access` o `trunk` su uno switch, `lan`, `wan` o `dmz` su un router o un firewall. È la modalità della porta: la zona di sicurezza della porta di un firewall è in `show ports`. Di una scheda: `dhcp` quando prende l'indirizzo dal DHCP, altrimenti `-` |
| `LINK` | A che cosa è collegata: il dispositivo e la sua interfaccia, `SW-Office (port 8)`, oppure `-` |

```ncl sample=office
pixelcake> show interfaces Router-1
IFACE      KIND   STATE   IP               VLAN       MODE-ZONE  LINK
1          port   up      192.168.10.1     -          lan        SW-Office (port 8)
2          port   up      192.168.20.1     -          lan        SW-Servers (port 8)
3          port   up      -                -          lan        -
4          port   up      -                -          lan        -
pixelcake> show interfaces PC-1
IFACE      KIND   STATE   IP               VLAN       MODE-ZONE  LINK
eth0       nic    up      192.168.10.11    -          -          SW-Office (port 1)
```

## show ports {#show-ports}

```text
show ports [of] <device>
```

Solo le porte, con più dettagli: stato, modalità, VLAN, zona di sicurezza e indirizzo. Un dispositivo senza porte (un PC, un server) lo dice.

| Colonna | Che cosa dice |
|---|---|
| `PORT` | Il numero della porta |
| `STATE` | `up` o `down` |
| `MODE` | La modalità della porta |
| `VLAN` | Come in `show interfaces` |
| `ZONE` | La zona di sicurezza della porta di un firewall, `-` per una porta che non ne ha |
| `IP` | L'indirizzo della porta |
| `LINK` | Il dispositivo e l'interfaccia a cui è collegata |

```ncl sample=company
pixelcake> show ports FW-Edge
PORT   STATE      MODE     VLAN       ZONE     IP               LINK
1      up         lan      -          trust    10.0.0.2         Router-Core (port 4)
2      up         dmz      -          dmz      172.16.0.1       SW-DMZ (port 8)
3      up         wan      -          untrust  203.0.113.1      Internet (eth0)
4      up         lan      -          -        -                -
pixelcake> show ports PC-Vendite
PC-Vendite has no configurable ports
```

## show vlans {#show-vlans}

```text
show vlans
```

Ogni VLAN del disegno e dove sta: per uno switch che applica le VLAN porta per porta, le porte di accesso e i trunk che la trasportano; per ogni altro dispositivo, o per uno switch che non le applica, i dispositivi che la elencano nel proprio elenco di VLAN. Un trunk per tutte le VLAN è nominato sotto la tabella. Un disegno senza VLAN lo dice.

```ncl sample=company
pixelcake> show vlans
VLAN   MEMBERS
1      SW-Uffici (ports 5,6,7), SW-Core (ports 2,3,4,5,6), SW-Server (ports 6,7)
10     SW-Uffici (ports 1,2,3; trunk 8), SW-Core (port 7; trunk 1)
20     SW-Uffici (port 4; trunk 8), SW-Core (port 8; trunk 1)
30     SW-Server (ports 1,2,3,4,5,8)
```

## show connections {#show-connections}

```text
show connections [of <device>]
```

Le connessioni del disegno, o quelle di un dispositivo, con l'interfaccia a ciascuna estremità: `[port 3 ↔ eth0]`. Un'estremità non assegnata a un'interfaccia compare come `?`. Dopo ogni connessione ci sono il suo tipo e la sua banda, come sono nel disegno.

```ncl sample=office
pixelcake> show connections
CONNECTIONS (6)
  PC-1 ↔ SW-Office  (access, 1 Gbps)  [eth0 ↔ port 1]
  PC-2 ↔ SW-Office  (access, 1 Gbps)  [eth0 ↔ port 2]
  SW-Office ↔ Router-1  (uplink, 1 Gbps)  [port 8 ↔ port 1]
  Router-1 ↔ SW-Servers  (uplink, 1 Gbps)  [port 2 ↔ port 8]
  Web-01 ↔ SW-Servers  (access, 1 Gbps)  [eth0 ↔ port 1]
  Mail-01 ↔ SW-Servers  (access, 1 Gbps)  [eth0 ↔ port 2]
pixelcake> show connections of SW-Servers
CONNECTIONS of SW-Servers (3)
  Router-1 ↔ SW-Servers  (uplink, 1 Gbps)  [port 2 ↔ port 8]
  Web-01 ↔ SW-Servers  (access, 1 Gbps)  [eth0 ↔ port 1]
  Mail-01 ↔ SW-Servers  (access, 1 Gbps)  [eth0 ↔ port 2]
```

## show config {#show-config}

```text
show config [of] <device>
```

Tutto ciò che il disegno dice di un dispositivo: tipo e produttore, indirizzo, maschera e gateway, posizione e nota, VLAN, lo stato dello STP (che non è simulato), il numero delle sue porte e quante sono attive, ogni scheda di rete, e poi ciò che ha di rotte, regole, NAT, DHCP e DNS, ciascuno con il comando che lo mostra per intero. Ciò che il dispositivo non ha viene tralasciato.

```ncl sample=company
pixelcake> show config FW-Edge
FW-Edge — Firewall
  ip:       10.0.0.2
  subnet:   255.255.255.252
  gateway:  -
  location: Sala server
  vlans:    none (untagged)
  ports:    4/4 enabled — "show ports FW-Edge" for detail
  routes:   1 static — "show routes FW-Edge" for the whole table
  rules:    3 — "show rules FW-Edge" for detail
  nat:      on interface 3, 2 forwards — "show nat FW-Edge" for detail
pixelcake> show config Srv-Auth
Srv-Auth — Server
  ip:       192.168.30.10
  subnet:   255.255.255.0
  gateway:  192.168.30.1
  location: Sala server
  vlans:    none (untagged)
  nic eth0: 192.168.30.10 / 255.255.255.0 gw 192.168.30.1 
  dns:      answers for 3 names — "show dns Srv-Auth" for detail
```

## show neighbors {#show-neighbors}

```text
show neighbors [of] <device>
```

I dispositivi collegati a un dispositivo, con il loro tipo e indirizzo. Un dispositivo senza cavi lo dice.

```ncl sample=office
pixelcake> show neighbors Router-1
NEIGHBORS of Router-1 (2)
  SW-Office                Switch         192.168.10.2
  SW-Servers               Switch         192.168.20.2
```

## show ip {#show-ip}

```text
show ip [of] <device>
ipconfig [<device>]
ifconfig [<device>]
```

L'indirizzamento di un dispositivo in poche righe: indirizzo, maschera e gateway con cui è conosciuto, poi ogni porta con indirizzo e ogni scheda. Una scheda che prende l'indirizzo dal DHCP mostra l'indirizzo assegnato e da quale interfaccia viene, oppure perché non ne ha uno. Una scheda che interroga un server DNS mostra quale. `ipconfig` e `ifconfig` sono lo stesso comando; prima del dispositivo si può scrivere `of` o `on`.

```ncl sample=office
pixelcake> show ip Router-1
Router-1 — addressing
  ip:       192.168.10.1
  subnet:   255.255.255.0
  gateway:  -
  port 1: 192.168.10.1 / 255.255.255.0
  port 2: 192.168.20.1 / 255.255.255.0
pixelcake> ipconfig PC-1
PC-1 — addressing
  ip:       192.168.10.11
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1
pixelcake> ifconfig of PC-2
PC-2 — addressing
  ip:       192.168.10.12
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.12 / 255.255.255.0 gw 192.168.10.1
```

## show routes {#show-routes}

```text
show routes [of] <device>
```

La tabella di instradamento come la legge il motore, una riga per ogni rotta: dove va, da quale prossimo salto, da quale interfaccia esce, e di che tipo è. I tipi sono `connected` (una rete in cui sta una delle sue interfacce con indirizzo), `static` (scritta con `add route`), `default` (una rotta verso ogni rete) e `default (gateway)` (il gateway di una scheda o il gateway di un router). Una rotta che aspetta la caduta di un'altra è indicata con `backup`. Un dispositivo finale ha una tabella sua, con la sua rete e il suo gateway.

Una rotta che non si può usare lo dice sulla sua riga: `(interface down)` quando la sua interfaccia è spenta; `(no link: …)` quando la linea da cui esce non porta nulla, perché la porta all'altro capo è spenta, oppure perché in una [presentazione](../asking/presentation.md#failures) il cavo è tagliato o il dispositivo all'altro capo è spento; e `✗ next hop on none of its networks` quando il prossimo salto non sta su nessuna rete del dispositivo. Il motore salta una rotta così e prende la successiva verso la stessa rete, o la rotta predefinita. Una rotta scritta come qualcosa che non è una rete e un indirizzo viene elencata sotto la tabella, come ignorata. Un router senza indirizzi di interfaccia dice che le sue rotte non vengono usate ([Rotte](routes.md)).

```ncl sample=two-sites
pixelcake> show routes R-Sede
ROUTES of R-Sede
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
192.168.2.0/24       10.0.1.2         port 3   static, backup
pixelcake> interface 2 down on R-Sede
port 2 on R-Sede is now down
pixelcake> show routes R-Sede
ROUTES of R-Sede
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected  (interface down)
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static  (interface down)
192.168.2.0/24       10.0.1.2         port 3   static, backup
pixelcake> show routes R-Filiale
ROUTES of R-Filiale
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected  (no link: port 2 on R-Sede is disabled)
10.0.2.0/30          -                port 3   connected
192.168.2.0/24       -                port 1   connected
192.168.1.0/24       10.0.0.1         port 2   static  (no link: port 2 on R-Sede is disabled)
192.168.1.0/24       10.0.2.1         port 3   static, backup
pixelcake> show routes PC-Sede-1
ROUTES of PC-Sede-1
DESTINATION          VIA              OUT      KIND
192.168.1.0/24       -                eth0     connected
default              192.168.1.1      eth0     default (gateway)
```

## show rules {#show-rules}

```text
show rules [of] <device>
```

Le regole di un router o di un firewall nell'ordine in cui si leggono, ciascuna con il suo numero, l'azione, il servizio, la partenza e la destinazione, e poi ciò che decide quando nessuna corrisponde: su un firewall la politica delle zone; su un router niente, quindi tutto il resto è permesso. Un firewall lascia passare la risposta a un flusso che ha permesso lui stesso. Un dispositivo che non è né un router né un firewall, e non ha regole, dice che non filtra nulla.

```ncl sample=company
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from untrust            to 172.16.0.10
   2  allow email  from untrust            to 192.168.30.40
   3  allow web    from 172.16.0.10        to 192.168.30.20
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  the reply to a flow it allowed passes
pixelcake> show rules Router-Core
RULES of Router-Core (the first that matches decides)
  no rules
  then anything else is allowed
  the reply to a flow it allowed passes
```

## show nat {#show-nat}

```text
show nat [of] <device>
```

NAT in uscita e inoltri: le interfacce che traducono ciò che esce da loro, con l'indirizzo che ciascuna dà, poi gli inoltri nell'ordine in cui si leggono, con l'indirizzo a cui ciascuno è pubblicato. Un dispositivo che non ha né l'uno né l'altro lo dice.

```ncl sample=company
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  web    from interface 3   (203.0.113.1) to 172.16.0.10
   2  email  from interface 3   (203.0.113.1) to 192.168.30.40
pixelcake> show nat PC-Vendite
PC-Vendite is a PC: it translates no addresses
```

## show dhcp {#show-dhcp}

```text
show dhcp [[of] <device>]
```

Di tutto il disegno: gli intervalli da assegnare (`POOLS`: intervallo, gateway e server DNS consegnati, quanti indirizzi sono assegnati e quanti liberi), le assegnazioni (`LEASES`: indirizzo, scheda, interfaccia da cui viene) e le schede rimaste senza indirizzo, ciascuna con il motivo. Di un dispositivo solo: ciò che assegna e ciò che riceve. Un disegno senza DHCP lo dice, e dice come cominciare.

```ncl sample=company
pixelcake> show dhcp
DHCP — 2 pools, 2 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 98 free of 100
LEASES
  192.168.20.100   Portatile-1 eth0         from Router-Core port 2
  192.168.20.101   Portatile-2 eth0         from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> show dhcp Portatile-1
DHCP of Portatile-1
LEASES
  192.168.20.100   Portatile-1 eth0         from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> show dhcp Srv-Auth
Srv-Auth hands out no addresses and asks for none
  hand out addresses: interface <n> pool <first> to <last> on Srv-Auth
  ask for one:        interface eth0 dhcp on Srv-Auth
```

## show dns {#show-dns}

```text
show dns [[of] <device>]
```

Di tutto il disegno: i record di ogni server, e ogni dispositivo che interroga un server DNS, con la scheda da cui interroga. Di un dispositivo solo: i suoi record se è un server, e per ciascuna delle sue schede il server che interroga, quale dispositivo è, e se è arrivato con l'assegnazione. Un disegno senza DNS lo dice, e dice come cominciare.

```ncl sample=company
pixelcake> show dns
DNS — 1 server, 3 records
RECORDS of Srv-Auth (192.168.30.10)
   1  gestionale.azienda.example       192.168.30.30
   2  posta.azienda.example            192.168.30.40
   3  portale.azienda.example          172.16.0.10
WHO ASKS WHOM
  PC-Contabilità eth0      192.168.30.10
  PC-Vendite eth0          192.168.30.10
  Stampante eth0           192.168.30.10
  Portatile-1 eth0         192.168.30.10  (with its lease)
  Portatile-2 eth0         192.168.30.10  (with its lease)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> show dns Portatile-1
DNS of Portatile-1
  eth0: asks 192.168.30.10 (Srv-Auth), handed out with its lease by Router-Core port 2
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
```

## sh {#sh}

```text
sh <what> [[of] <device>]
```

`sh` è `show`: ogni comando qui sopra si può scrivere anche così.

```ncl sample=office
pixelcake> sh vlans
no VLANs configured (all traffic untagged)
pixelcake> sh ip PC-1
PC-1 — addressing
  ip:       192.168.10.11
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1
```

## Quando un comando viene rifiutato {#refusals}

Un dispositivo che non esiste viene rifiutato con il nome più vicino, e un comando che ha bisogno di un dispositivo e non ne ha uno lo dice:

```ncl sample=office
pixelcake> show config Web 01
device not found: "Web 01"
  did you mean "Web-01"?
pixelcake> show routes
specify a device: "show routes <device>" — or enter a context with "use <device>"
pixelcake> show ip PC
device not found: "PC"
  did you mean "PC-1"?
pixelcake> ifconfig
specify a device: "show ip <device>" — or enter a context with "use <device>"
pixelcake> show nat PC-1
PC-1 is a PC: it translates no addresses
pixelcake> show rules PC-1
PC-1 is not a router or a firewall and has no rules: it filters nothing
pixelcake> show ports PC-1
PC-1 has no configurable ports
```

## Vedi anche {#see-also}

- [Interfacce e VLAN](interfaces-and-vlans.md), [Rotte](routes.md), [Firewall e NAT](firewall-and-nat.md), [DHCP e DNS](dhcp-and-dns.md): i comandi che cambiano ciò che questi mostrano.
- [Panoramica](index.md#answers): come si scrivono una domanda e la sua risposta.
