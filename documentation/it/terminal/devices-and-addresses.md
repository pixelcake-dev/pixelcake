---
title: "Dispositivi e indirizzi"
description: "I comandi che cambiano indirizzo, maschera, gateway e nome di un dispositivo, e che aggiungono o tolgono un cavo."
order: 2
---

Questi comandi cambiano un dispositivo nel suo insieme, oppure il cavo tra due dispositivi. Ciò che appartiene a una porta o a una scheda di rete (il suo indirizzo, il suo stato, la sua VLAN, la sua zona) si imposta con `interface` e ha pagine proprie: [Interfacce e VLAN](interfaces-and-vlans.md), [Firewall e NAT](firewall-and-nat.md) e [DHCP e DNS](dhcp-and-dns.md). Come ogni comando che cambia la rete, modificano il disegno che vedi: la modifica è subito sul canvas e viene conservata con il progetto come ogni altra ([panoramica](index.md#edits)).

Un dispositivo si indica con il nome che ha sul canvas, oppure con uno dei suoi indirizzi; `[of]` e `[to]` sono parole che il terminale accetta ma che si possono omettere. La [panoramica](index.md#conventions) spiega il resto della notazione. I comandi sono in inglese, come tutto il terminale.

## set {#set}

```text
set ip [of] <device> [to] <address>
set gateway [of] <device> [to] <address>
set subnet [of] <device> [to] <mask>
set name [of] <device> [to] <new name>
```

Imposta una proprietà di un dispositivo: il suo indirizzo, il suo gateway predefinito, la sua maschera o il suo nome. Sono i campi indirizzo, subnet mask, gateway e nome della scheda «Generale» della finestra del dispositivo ([indirizzi](../building/addresses.md)).

| Parametro | Che cos'è |
|---|---|
| `<device>` | Il dispositivo da cambiare. Dentro `use <device>` si tralascia |
| `<address>` | Un indirizzo IPv4, `192.168.10.21`. Viene controllato prima di essere scritto |
| `<mask>` | La subnet mask, `255.255.255.0`. Il comando scrive ciò che viene digitato: non viene controllata |
| `<new name>` | Il nuovo nome del dispositivo, di una o più parole. Viene per ultimo nel comando, quindi non servono virgolette |

Che cosa fa ciascuno:

- **Su un dispositivo con schede di rete**, `set ip`, `set gateway` e `set subnet` cambiano la prima scheda, quella che la finestra del dispositivo mostra come suo indirizzo. Per ogni altra scheda si usano `interface <name> ip` e `interface <name> gateway` ([Interfacce e VLAN](interfaces-and-vlans.md#ip)).
- **Su un router o su un firewall**, `set gateway` imposta la rotta predefinita, e la risposta lo dice. `add route default` fa lo stesso con un prossimo salto che può essere un dispositivo ([Rotte](routes.md)). `set ip` imposta l'indirizzo con cui il dispositivo è conosciuto; l'indirizzo di ogni porta si imposta con `interface <n> ip`.
- **Su uno switch**, `set ip` imposta l'indirizzo a cui lo switch risponde, perché nessuna porta di uno switch ne ha uno.
- **Se l'indirizzo è già di un altro dispositivo**, il comando lo scrive lo stesso e stampa un avviso con il nome di quel dispositivo.
- **Se la prima scheda prende l'indirizzo dal DHCP**, `set ip` toglie la scheda dal DHCP e scrive l'indirizzo, con la maschera `255.255.255.0` e senza gateway. `set subnet` e `set gateway` vengono rifiutati: arrivano con l'assegnazione ([DHCP e DNS](dhcp-and-dns.md#dhcp-client)).

```ncl sample=office
pixelcake> set ip of PC-1 to 192.168.10.21
PC-1: ip set to 192.168.10.21
pixelcake> set ip PC-1 192.168.10.12
PC-1: ip set to 192.168.10.12
  warning: 192.168.10.12 is also the address of PC-2
pixelcake> set subnet of PC-1 to 255.255.255.128
PC-1: subnet set to 255.255.255.128
pixelcake> set gateway of PC-1 to 192.168.10.254
PC-1: gateway set to 192.168.10.254
pixelcake> show config PC-1
PC-1 — PC
  ip:       192.168.10.12
  subnet:   255.255.255.128
  gateway:  192.168.10.254
  vlans:    none (untagged)
  nic eth0: 192.168.10.12 / 255.255.255.128 gw 192.168.10.254 
pixelcake> set gateway of Router-1 to 10.0.0.9
Router-1: gateway set to 10.0.0.9
  the gateway of a router is its default route — "show routes Router-1"
pixelcake> set ip of SW-Office to 192.168.10.3
SW-Office: ip set to 192.168.10.3
```

Il nome può essere di più parole, e un nome che un altro dispositivo ha già non viene rifiutato.

```ncl sample=office
pixelcake> set name of PC-1 to Accettazione
PC-1 renamed to "Accettazione"
pixelcake> ping Web-01 from Accettazione
Pinging Web-01 (192.168.20.10) from Accettazione...
Reply from 192.168.20.10: hops=5 time=7ms
pixelcake> show devices
DEVICE                   TYPE           IP               VLANS
Router-1                 Router         192.168.10.1     -
SW-Office                Switch         192.168.10.2     -
SW-Servers               Switch         192.168.20.2     -
Accettazione             PC             192.168.10.11    -
PC-2                     PC             192.168.10.12    -
Web-01                   Server         192.168.20.10    -
Mail-01                  Server         192.168.20.20    -
```

> [!WARNING]
> Rinominare il dispositivo in cui ti trovi (`use <device>`) lascia il prompt sul vecchio nome, e i comandi che hanno bisogno del dispositivo rispondono che non ne è indicato nessuno. Esci con `exit` ed entra di nuovo con il nuovo nome.

## connect, disconnect {#connect}

```text
connect <device> [to] <device>
disconnect <device> [from] <device>
```

`connect` disegna una connessione tra due dispositivi, come quando sul canvas trascini un cavo dall'uno all'altro; `disconnect` la toglie. Ogni estremità di una nuova connessione viene assegnata alla prima interfaccia libera del suo dispositivo: la porta con il numero più basso, oppure una scheda di rete, e la risposta dice quale. I due dispositivi si possono indicare in un ordine o nell'altro, e `to` o `from` si possono tralasciare quando ciascun nome è di una parola sola.

| Parametro | Che cos'è |
|---|---|
| `<device>` | Un dispositivo. I due devono essere diversi |

Che cosa dice la risposta:

- Un'estremità senza interfaccia libera (tutte le porte sono occupate, oppure il dispositivo non ne ha) viene disegnata lo stesso, ma non assegnata a un'interfaccia, e la risposta lo dice. Una connessione non assegnata a un'interfaccia non si può controllare porta per porta: le regole che riguardano le porte vengono saltate, e il motore lo scrive nelle sue note.
- Su un firewall le cui porte hanno zone di sicurezza l'estremità non viene mai assegnata da sola, anche se ci sono porte libere: è la porta a decidere la zona. La risposta lo dice, e dice dove scegliere la porta, nella finestra della connessione (vedi [Su un firewall con zone](../building/cables.md#firewall)).
- Su un firewall le cui porte sono in zone di sicurezza l'estremità non viene assegnata nemmeno così: la porta, e con essa la zona, si sceglie nella finestra della connessione, che si apre con «Modifica connessione». La risposta dice che la porta di una nuova connessione si sceglie a mano, e che fino ad allora quell'estremità non è assegnata.
- `connect` tra due dispositivi che hanno già una connessione non fa nulla, e lo dice. Anche `disconnect` tra due dispositivi che non ne hanno lo dice.

```ncl sample=office
pixelcake> disconnect PC-1 from SW-Office
disconnected PC-1 ↔ SW-Office
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (unreachable): request: no physical path between PC-1 and Web-01
pixelcake> connect PC-1 to SW-Office
connected PC-1 (eth0) ↔ SW-Office (port 1)
pixelcake> show connections of PC-1
CONNECTIONS of PC-1 (1)
  PC-1 ↔ SW-Office  [eth0 ↔ port 1]
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms
pixelcake> connect PC-1 to SW-Office
PC-1 and SW-Office are already connected
pixelcake> disconnect PC-1 SW-Office
disconnected PC-1 ↔ SW-Office
pixelcake> disconnect PC-1 SW-Office
PC-1 and SW-Office are not connected
```

## Quando un comando viene rifiutato {#refusals}

Un comando che non si può eseguire non cambia nulla, e dice perché, o che forma avrebbe dovuto avere:

```ncl sample=office
pixelcake> set ip of PC-1 to 192.168.10.999
"192.168.10.999" is not a valid IPv4 address
pixelcake> set ip of PC-9 to 192.168.10.30
device not found: "PC-9"
  did you mean "PC-1"?
pixelcake> set ip to 192.168.10.30
specify a device: "set ip of <device> to <value>"
pixelcake> set colour of PC-1 to red
unknown command: "set colour of PC-1 to red"
  try: set ip|gateway|subnet|name [of] <device> [to] <value>
  type "help" for the command list
pixelcake> connect PC-1 to PC-1
cannot connect a device to itself
pixelcake> connect PC-1 to Printer
device not found: "Printer"
pixelcake> connect PC-1
unknown command: "connect PC-1"
  try: connect <device A> to <device B>
  type "help" for the command list
```

## Vedi anche {#see-also}

- [Indirizzi e gateway](../building/addresses.md): indirizzo, maschera e gateway di un dispositivo nella sua finestra.
- [Interfacce e VLAN](interfaces-and-vlans.md#ip): l'indirizzo di una porta o di una scheda.
- [Comandi show](show.md#show-ip): `show ip` e `show config`, per leggere ciò che questi comandi hanno cambiato.
- [Cavi e connessioni](../building/cables.md): le connessioni sul canvas.
