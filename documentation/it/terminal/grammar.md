---
title: "La grammatica"
description: "Il linguaggio del terminale scritto per intero: la grammatica, le tolleranze, i principi."
order: 10
---

Questa pagina è per chi vuole tutto il linguaggio in una pagina sola: le regole su cui è costruito, la grammatica, e le parole che accetta oltre a quelle che la grammatica nomina. Le altre pagine di questa sezione spiegano un comando alla volta; questa spiega come si legge una riga. La specifica del linguaggio, che l'app segue, è il file [docs/terminal-commands.md](https://github.com/pixelcake-dev/pixelcake/blob/main/docs/terminal-commands.md) del repository: riporta la versione del linguaggio, e le sue sessioni sono eseguite dagli stessi test degli esempi di questo riferimento. È scritta in inglese, come il linguaggio.

## Principi {#principles}

1. **Prima il verbo.** Una riga comincia con ciò che si deve fare: `ping`, `trace`, `show`, `set`, `add`, `connect`, `use`.
2. **Le preposizioni sono facoltative** dove non c'è ambiguità: `show config of Switch-1` e `show config Switch-1` sono la stessa riga.
3. **Le parole di ruolo spezzano i nomi.** `from`, `to`, `of`, `on` e `via` dicono che cos'è ogni parte della riga, così che il nome di un dispositivo di più parole non abbia bisogno di virgolette: `ping PC Sales 1 from Core Switch HQ`.
4. **Il contesto.** `use <device>` fa di un dispositivo quello di cui parlano tutti i comandi: il prompt prende il suo nome, e `from` e `on` sono sottintesi. `exit` esce ([Aiuto e sessione](help.md#use)).
5. **Parole che non appartengono a nessun produttore.** `show neighbors`, non il nome di un protocollo; `interface 3 down`, non `no shutdown`; `add route`, non `ip route`. *Interfaccia* è una parola sola per una porta e per una scheda di rete, e `interfaces` è la tabella standard di entrambe.
6. **Le tolleranze fanno parte del linguaggio.** Preposizioni facoltative, articoli ignorati, le parole `device` e `host`, nomi tra virgolette, un indirizzo al posto di un dispositivo, e un suggerimento quando un verbo o un dispositivo non si trova ([più avanti](#tolerances)).
7. **Ogni rifiuto dice che cosa ci si aspettava.** Un comando che non si può eseguire risponde con la forma che avrebbe dovuto avere, oppure con il motivo nei termini della rete (`PC-1 is a PC: routes belong on routers and firewalls`), e non cambia nulla.

## La grammatica {#ebnf}

La grammatica è scritta in una notazione vicina all'EBNF. Una parola tra virgolette si digita com'è, `[ … ]` è facoltativo, `{ … }` si ripete, `|` è una scelta e `( … )` raggruppa. Ciò che sta tra `(* … *)` è un commento.

```text
command       ::= diagnostic | inspection | configuration | session

diagnostic    ::= "ping" target ["from" device]
                | "trace" target ["from" device] ["as" service]
                | ("browse" | "mail" | "download") target ["from" device]
                | "resolve" name ["from" device]
service       ::= "ping" | "web" | "email" | "dns"

inspection    ::= "show" show-target [["of"] device]
show-target   ::= "devices" | "interfaces" | "ports" | "vlans"
                | "connections" | "config" | "neighbors" | "ip"
                | "routes" | "rules" | "nat" | "dhcp" | "dns" | "failures"

configuration ::= set-cmd | vlan-cmd | link-cmd | iface-cmd | route-cmd | rule-cmd
                | forward-cmd | record-cmd | failure-cmd
set-cmd       ::= "set" ("ip" | "gateway" | "subnet" | "name")
                        ["of"] device ["to"] value
vlan-cmd      ::= "add" "vlan" number ["to"] device
                | "remove" "vlan" number "from" device
link-cmd      ::= "connect" device ["to"] device
                | "disconnect" device ["from"] device
                | "link" device ["to"] device link-setting {link-setting}
link-setting  ::= "medium" medium
                | "length" (number ("m" | "km") | "none")   (* 600 km, 80m *)
                | "delay" (number ["ms"] | "auto")          (* one way, written by hand *)
medium        ::= "copper" | "fibre" | "wifi" | "dsl" | "ftth" | "mobile"
                | "satellite" | "auto"

iface-cmd     ::= "interface" iface-id iface-setting [["on"] device]
iface-id      ::= number | nic-name                    (* port 3, eth0 *)
iface-setting ::= "up" | "down"
                | "ip" (ipv4 ["/" prefix] | "none")
                | "gateway" (ipv4 | "none")            (* network cards *)
                | "access" vlan                        (* switch ports *)
                | "trunk" (vlan {"," vlan} | "all")    (* switch ports *)
                | "default"                            (* switch ports: no VLAN of its own *)
                | "zone" ("trust" | "untrust" | "dmz" | "none")   (* firewall ports *)
                | "nat" ["on" | "off" | "none"]           (* router/firewall ports *)
                | "dhcp" ["on" | "off" | "none"]          (* network cards *)
                | ["dhcp"] "pool" (ipv4 ["to"] ipv4 ["gateway" ipv4] ["dns" ipv4] | "none")
                                                          (* router/firewall ports, server cards *)
                | "dns" (ipv4 | "none")                   (* network cards *)

route-cmd     ::= "add" ["backup"] "route" network "via" next-hop [["on"] device]
                | "remove" "route" network ["via" next-hop] [("from" | "on") device]
network       ::= ipv4 "/" prefix | "default"
next-hop      ::= ipv4 | device

rule-cmd      ::= "add" "rule" [position] ("allow" | "deny") [service | "any"]
                        "from" endpoint "to" endpoint ["on" device]
                | "remove" "rule" position [("from" | "on") device]
endpoint      ::= "any" | "trust" | "untrust" | "dmz" | ipv4 | network | device

forward-cmd   ::= "add" "forward" [service | "any"] "from" ["interface"] number
                        "to" (ipv4 | device) ["on" device]
                | "remove" "forward" position [("from" | "on") device]

record-cmd    ::= "add" "record" name ["to"] (ipv4 | device) ["on" device]
                | "remove" "record" (position | name) [("from" | "on") device]

failure-cmd   ::= "fail" (device | link)
                | "repair" (device | link | "all")
link          ::= "link" device ("to" | "from") device ["by" ["port" | "interface"] iface-id]
                                                          (* simulated: presentation mode only *)

session       ::= "use" device | "exit" | "clear" | "help" [topic]

target        ::= device | ipv4 | name
device        ::= word { word } | '"' text '"'      (* multi-word, quotable *)
name          ::= label "." label { "." label }     (* www.company.example *)
```

In un contesto di dispositivo (`use …`) le parti `["from" device]`, `[["of"] device]` e `[["on"] device]` valgono per il dispositivo del contesto. `show dhcp` e `show dns` senza dispositivo, fuori da un contesto, riguardano tutto il disegno. Dove un comando finisce con qualcosa che può essere un dispositivo di più parole (la destinazione di una regola, l'indirizzo di un inoltro o di un record), è `on` a separarlo dal dispositivo a cui il comando si riferisce, e non si può tralasciare: `["on" device]`.

La grammatica nomina la forma di ogni comando. Per restare breve lascia fuori le parole che hanno lo stesso significato di una che nomina: sono nella tabella dei [sinonimi](#aliases).

## Parole, nomi e virgolette {#tokens}

- **Una riga viene divisa in parole** dagli spazi. Maiuscole e minuscole non contano né per le parole del linguaggio (`PING`, `Show`), né per il nome di un dispositivo: `web-gestionale` trova Web-Gestionale.
- **Un dispositivo è una sequenza di parole.** Tutto ciò che sta tra due parole di ruolo è un nome di dispositivo, unito con spazi singoli: `ping Core Switch HQ from PC Sales 1` ha due dispositivi di tre parole ciascuno. Le parole di ruolo sono `from`, `to`, `of`, `on` e `via`, e, ultima in un `trace`, `as`.
- **Le virgolette tengono intero un nome.** Una parola tra virgolette non è mai una parola di ruolo e non viene mai ignorata: `ping "Gateway to HQ" from "PC-1"`. Metti tra virgolette un nome che ha dentro una parola di ruolo. Una virgoletta non chiusa vale fino alla fine della riga, e una coppia di virgolette senza nulla in mezzo viene ignorata.
- **Un nome corrisponde a un dispositivo esattamente** (gli spazi contati una volta, maiuscole ignorate), oppure corrisponde un indirizzo: quello del dispositivo, o di una delle sue porte o schede che sia attiva. Un indirizzo sta per il dispositivo, e dove una domanda ha una destinazione conta proprio quell'indirizzo ([Destinazioni](asking.md#targets)). Un nome che non corrisponde non viene mai indovinato: viene rifiutato, con un suggerimento.
- **Due dispositivi con lo stesso nome** (un disegno fatto prima che le finestre e il terminale lo rifiutassero) non vengono mai distinti a caso: un comando che li nomina viene rifiutato con `2 devices are called "PC-1": rename one of them …`, e nemmeno `use` entra in uno dei due. Un indirizzo di uno dei due indica comunque quello.
- **Un nome di host è un nome con almeno un punto**, `www.azienda.example`: dove una domanda ha una destinazione, e un dispositivo o un indirizzo non corrispondono, viene chiesto prima a un server DNS ([Interrogare](asking.md#targets)). È anche il nome di un record ([DHCP e DNS](dhcp-and-dns.md#add-record)). Una parola senza punto non è un nome di host.
- **Un numero** è una o più cifre: una porta, una VLAN da 1 a 4094, una posizione in un elenco. **Una rete** è un indirizzo e un prefisso, `192.168.30.0/24`, oppure `default`.
- **I valori vengono controllati prima di essere scritti**: un indirizzo che non è un indirizzo, una rete che non è una rete, una VLAN fuori da 1–4094 vengono rifiutati con la forma che ci si aspettava. Una maschera è una maschera puntata, `255.255.255.0`, oppure un prefisso, `/24`.

## Tolleranze {#tolerances}

Ciò che il terminale accetta oltre alla forma della grammatica. Fa parte del linguaggio, e ogni voce si ritrova nel codice dell'analizzatore:

- **Preposizioni facoltative.** `of`, `on`, `to` e `from` si possono tralasciare dove la grammatica le mette tra parentesi quadre, e vengono ignorate quando stanno all'inizio di un nome: `show ip of PC-1`, `show ip on PC-1`, `show ip PC-1`.
- **Articoli.** `the` e `a` all'inizio di un nome vengono ignorati: `ping the Web-01 from the PC-1`.
- **Le parole `device` e `host`**, all'inizio di un nome, vengono ignorate anch'esse: `use device SW-Office`, `ping Web-01 from host PC-1`. Un nome che le ha dentro (`Meeting Room Host`), o che sta tra virgolette, resta com'è.
- **Un indirizzo dove ci si aspetta un dispositivo**, in ogni comando. Conta proprio l'indirizzo digitato.
- **Un suggerimento quando qualcosa non si trova.** Per un verbo sconosciuto viene suggerito il verbo più vicino (`pinng` → `ping`); per una parola sconosciuta dopo `show`, la più vicina (`did you mean "show devices"?`); per un dispositivo che non si trova, il nome più vicino, quando è abbastanza vicino da essere un errore di battitura (`did you mean "Web-01"?`).
- **Una riga vuota** viene saltata: il terminale stampa un nuovo prompt.

Una riga rifiutata riceve una risposta in tre parti: `unknown command: "<la riga>"`, poi ciò che ci si aspettava o la parola più vicina, poi `type "help" for the command list`. Un dispositivo che non si trova riceve `device not found: "<nome>"`. Tutto il resto è un motivo, nei termini della rete.

### I sinonimi {#aliases}

| Comando | Si scrive anche |
|---|---|
| `show devices` | `ls`, `list` |
| `show <what>` | `sh <what>`. Anche `ls <what>` e `list <what>` |
| `show ip` | `ipconfig`, `ifconfig` |
| `trace` | `traceroute`, `tracert` |
| `browse` | `web`, `curl` |
| `mail` | `email` |
| `download` | `wget` |
| `resolve` | `lookup`, `nslookup` |
| `remove` | `delete` |
| `exit` | `quit` |
| `clear` | `cls` |
| `help` | `?` |
| `interface <n> up`, `interface <n> down` | `enable port <n>`, `disable port <n>` |
| `ip` in `interface <id> ip` | `address` |
| `interface <id> pool …` | `interface <id> dhcp pool …`, e `interface <id> dhcp server …` |
| `none` in `ip`, `gateway`, `zone`, `dns`, `pool` | `clear`. Per `pool` anche `off` |
| `off` in `nat` e `dhcp` | `none`, `no`, `disable` |
| `gateway` in `interface … pool` | `gw` |
| `allow`, `deny` | `permit`, `block` |
| un servizio `any` | `all` |
| un servizio `ping` | `icmp` |
| un servizio `web` | `http`, `https` |
| un servizio `email` | `mail`, `smtp` |
| `interface` in `add forward … from interface <n>` | `port`, oppure niente |
| `<first> to <last>` in `interface … pool` | `<first>-<last>`, oppure `<first> <last>` |

### Le versioni del linguaggio {#versions}

Il linguaggio ha una versione, mostrata da `help` nella prima riga, e descritta nella [panoramica](index.md#version). Fino alla versione 1.0 le forme della grammatica sono stabili, ma i sinonimi e la formulazione delle risposte possono ancora cambiare tra due versioni minori: gli esempi di questo riferimento vengono eseguiti sull'app a ogni modifica, e i test falliscono quando una risposta non è quella stampata qui.

## Vedi anche {#see-also}

- [Panoramica e convenzioni](index.md): come le pagine di questo riferimento scrivono un comando.
- [Aiuto e sessione](help.md): `help`, `use`, `exit`, `clear`.
- [La specifica su GitHub](https://github.com/pixelcake-dev/pixelcake/blob/main/docs/terminal-commands.md).
