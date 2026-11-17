---
title: "Aiuto e sessione"
description: "I comandi del terminale stesso: help, entrare e uscire da un dispositivo, pulire lo schermo."
order: 9
---

Questi comandi riguardano il terminale, non la rete: stampano l'elenco dei comandi, dicono di quale dispositivo parlano i comandi, e puliscono lo schermo. Non cambiano nulla nel disegno. La notazione dei blocchi di sintassi è spiegata nella [panoramica](index.md#conventions).

## help {#help}

```text
help [<word>]
? [<word>]
```

`help` stampa i comandi del terminale, una riga ciascuno: la sintassi e ciò che fa. `?` è lo stesso comando. L'elenco qui sotto è quello che il terminale stampa; è anche l'elenco di Aiuto → Comandi del terminale nella barra dei menu. L'ultima riga dà l'indirizzo di questo riferimento. Il testo è in inglese, come tutto il terminale.

```ncl sample=empty
pixelcake> help
PixelCake terminal — NCL v0.5 (Network Command Language, vendor-neutral)
  ping <target> [from <device>]                              does it answer? request and reply
  trace <target> [from <device>] [as web|email|dns]          one way, hop by hop, with what each device did
  browse | mail | download <target> [from <device>]          a whole web, email or download exchange
  resolve <name> [from <device>]                             ask the DNS server of a device what address a name stands for
  show devices | vlans | connections                         topology overview
  show interfaces [of] <device>                              unified ports + NICs table (the standard view)
  show ip [of] <device>                                      compact addressing summary (also ipconfig/ifconfig)
  show routes | rules | nat [of] <device>                    routing table, firewall rules, address translation
  show dhcp [[of] <device>]                                  DHCP: who hands out addresses, who got which, who got none
  show dns [[of] <device>]                                   DNS: the names a server answers for, the server each card asks
  show config | ports | neighbors <device>                   device detail
  set ip|gateway|subnet|name of <device> to <value>          change device config
  interface <n> up|down on <device>                          interface state (also enable|disable port <n>)
  interface <n> ip <address>/<prefix> on <device>            address of a router/firewall port or network card
  interface <n> access <vlan> | trunk <vlans>|all | default  VLAN of a switch port
  interface <n> zone trust|untrust|dmz|none on <device>      security zone of a firewall port
  interface <n> nat [off] on <device>                        source NAT on a router/firewall port: what leaves takes its address
  interface <name> dhcp [off] on <device>                    a network card takes its address from a DHCP server
  interface <n> [dhcp] pool <first> to <last> on <device>    DHCP server on a router/firewall port or a server card (pool none)
  interface <name> dns <address>|none on <device>            the DNS server a network card asks when a name is used
  add route <network>|default via <next hop> on <device>     static route (remove route <network> from <device>)
  add backup route <network> via <next hop> on <device>      second route to a network, used when the line of the first is down
  add rule allow|deny <service> from <src> to <dst> on <fw>  firewall rule (remove rule <n> from <fw>)
  add forward <svc> from interface <n> to <address> on <dev> publish a service inside (remove forward <n> from <dev>)
  add record <name> <address> on <server>                    a name a DNS server answers for (remove record <n>|<name> from <server>)
  add vlan <id> to <device>                                  VLAN list of a device (remove vlan <id> from <device>)
  connect <A> to <B>                                         create a link (disconnect <A> from <B>)
  use <device> / exit                                        enter/leave device context (implies "from" and "on")
  clear, help [command]                                      screen and this reference
  device names are case-insensitive and may be multi-word; IPs work anywhere a device is expected
  a host name (www.company.example) works as a target: the source asks its DNS server for the address first
  every command explained, with examples: https://app.pixelcake.dev/docs/terminal/
```

| Parametro | Che cos'è |
|---|---|
| `<word>` | Una parola da cercare. Può essere una parte di parola, e maiuscole e minuscole non contano |

Con una parola, `help` stampa solo le righe la cui sintassi la contiene: `help route` dà le righe sulle rotte, `help ping` la riga di `ping`. La parola viene cercata nella colonna della sintassi e non nella descrizione. Quando nessuna riga la contiene la risposta lo dice.

```ncl sample=empty
pixelcake> help ping
ping <target> [from <device>]                              does it answer? request and reply
pixelcake> help route
show routes | rules | nat [of] <device>                    routing table, firewall rules, address translation
add route <network>|default via <next hop> on <device>     static route (remove route <network> from <device>)
add backup route <network> via <next hop> on <device>      second route to a network, used when the line of the first is down
pixelcake> ? vlan
show devices | vlans | connections                         topology overview
interface <n> access <vlan> | trunk <vlans>|all | default  VLAN of a switch port
add vlan <id> to <device>                                  VLAN list of a device (remove vlan <id> from <device>)
pixelcake> help banana
no help for "banana" — try "help" for the full list
```

La tabella è più corta del linguaggio: dà una riga per più comandi e non elenca ogni sinonimo. I blocchi di sintassi delle pagine di questa sezione sono quelli completi.

## use ed exit {#use}

```text
use <device>
exit
quit
```

`use <device>` fa di un dispositivo quello di cui parlano tutti i comandi, fino a `exit`. Il prompt prende il nome del dispositivo (`PC-1>`), e in ogni comando `from` e `on` sono sottintesi: `ping Web-01` è un ping dal dispositivo, `show routes` è la sua tabella, `interface 3 down` riguarda una sua porta. Un comando che nomina un altro dispositivo va comunque a quello: dentro `PC-1>`, `show interfaces Router-1` riguarda Router-1. `quit` è uguale a `exit`.

| Parametro | Che cos'è |
|---|---|
| `<device>` | Un dispositivo, indicato come sul canvas o con uno dei suoi indirizzi. La parola `device` o `host` prima del nome viene scartata: `use device SW-Office` |

Un terminale aperto da un dispositivo (clic destro → «Console») parte già dentro di lui. `use` sostituisce il dispositivo in cui ci si trova: non li impila. `exit` risponde `left <device>`, e quando si è già fuori dice che si è già lì.

```ncl sample=office
pixelcake> use PC-1
context: PC-1 — "from" is now implied, "exit" to leave
PC-1> ping Web-01
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms
PC-1> trace Mail-01
Tracing route to Mail-01 (192.168.20.20) from PC-1:
  1  ○ PC-1 (PC)
  2  ○ SW-Office (Switch)
  3  ○ Router-1 (Router)  — routed: 192.168.20.0/24 is on port 2
  4  ○ SW-Servers (Switch)
  5  ● Mail-01 (Server)
Trace complete: destination reached.
PC-1> show ip
PC-1 — addressing
  ip:       192.168.10.11
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1
PC-1> show interfaces Router-1
IFACE      KIND   STATE   IP               VLAN       MODE-ZONE  LINK
1          port   up      192.168.10.1     -          lan        SW-Office (port 8)
2          port   up      192.168.20.1     -          lan        SW-Servers (port 8)
3          port   up      -                -          lan        -
4          port   up      -                -          lan        -
PC-1> use Router-1
context: Router-1 — "from" is now implied, "exit" to leave
Router-1> show routes
ROUTES of Router-1
DESTINATION          VIA              OUT      KIND
192.168.10.0/24      -                port 1   connected
192.168.20.0/24      -                port 2   connected
Router-1> interface 3 ip 10.0.0.1/30
port 3 on Router-1: 10.0.0.1 / 255.255.255.252
Router-1> exit
left Router-1
pixelcake> exit
already at global scope
pixelcake> use Niente
device not found: "Niente"
pixelcake> use device SW-Office
context: SW-Office — "from" is now implied, "exit" to leave
SW-Office> quit
left SW-Office
```

> [!NOTE]
> Il terminale tiene il nome del dispositivo in cui si trova. Rinominare quel dispositivo, con `set name` o nella sua finestra, lascia il prompt sul vecchio nome: esci con `exit` ed entra di nuovo con il nuovo ([Dispositivi e indirizzi](devices-and-addresses.md#set)).

## clear {#clear}

```text
clear
cls
```

Svuota lo schermo del terminale: ciò che era stato stampato prima sparisce. I comandi che hai digitato restano nella cronologia ([più avanti](#keys)), e il disegno non viene toccato. `cls` è lo stesso comando.

```ncl sample=empty
pixelcake> clear
pixelcake> cls
```

## Tasti {#keys}

La riga del terminale usa questi tasti:

| Tasto | Che cosa fa |
|---|---|
| Invio | Esegue la riga. Una riga vuota porta solo a un nuovo prompt |
| Su | Riporta l'ultima riga eseguita, e a ogni pressione quella prima |
| Giù | Va avanti nella cronologia; dopo l'ultima riga ridà ciò che stavi scrivendo |
| Ctrl+C | Ferma la domanda in corso: il pacchetto si ferma sul canvas e il terminale stampa `^C — interrupted`. Quando non c'è nulla in corso fa ciò che fa altrove, e copia il testo selezionato |

Scrivere una lettera esce dalla cronologia e modifica la riga su cui sei. La cronologia tiene ogni riga non vuota della sessione, errori compresi, finché la pagina resta aperta: non viene salvata con il progetto e si perde quando la pagina viene ricaricata. Esc e Tab non fanno nulla nel terminale: Esc non lo chiude, e un nome non viene completato.

Una domanda che viaggia (`ping`, `trace`, `browse`, `mail`, `download`, `resolve`) trattiene il prompt finché il pacchetto non è arrivato o non si è fermato: la riga `▌ running… — press Ctrl+C to interrupt` sta dove starebbe il prompt. I comandi che solo leggono o solo scrivono rispondono subito.

## Vedi anche {#see-also}

- [Panoramica](index.md#open): aprire il terminale, la finestra e il prompt.
- [Interrogare](asking.md): i comandi che trattengono il prompt mentre il pacchetto viaggia.
- [La grammatica](grammar.md): che cosa sottintende `use <device>` per ogni comando.
