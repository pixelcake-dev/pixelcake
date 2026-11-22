---
title: "Cavi e connessioni"
description: "Disegnare un cavo tra due dispositivi, la porta o la scheda a cui è collegata ogni estremità, e il tipo, l'etichetta e il colore di una connessione."
order: 3
---

Una connessione è la linea che disegni tra due dispositivi; il cavo è la cosa che rappresenta. Una connessione ha due estremità, e ognuna è assegnata a un'interfaccia del suo dispositivo: una porta su uno switch, un router o un firewall, una scheda di rete su ogni altro dispositivo ([Porte e schede di rete](ports-and-cards.md)). Il motore legge proprio questa assegnazione: segue un pacchetto da interfaccia a interfaccia lungo le connessioni, e a ogni estremità applica le impostazioni della porta o della scheda a cui è assegnata.

## Disegnare un cavo {#draw}

![Due dispositivi, un PC e uno switch, vengono trascinati lontano l'uno dall'altro; un cavo viene tirato dal lato destro del PC, che diventa arancione, fino allo switch; la finestra della connessione mostra poi eth0 sul PC e Porta 1 sullo switch.](../../media/cables/draw.it.mp4 "Disegnare un cavo, e la finestra della connessione che mostra a quale interfaccia è assegnata ogni estremità.")

1. Porta il puntatore sul bordo di un dispositivo. Una fascia lungo ciascuno dei quattro lati della cornice, profonda 12 unità, fa partire un cavo; il lato sotto il puntatore diventa arancione.
2. Premi lì e trascina fino a un altro dispositivo. Una linea segue il puntatore.
3. Rilascia il pulsante in un punto qualsiasi sopra l'altro dispositivo. Il cavo arriva sul lato dove l'hai rilasciato.

Il cavo c'è subito. Un clic lo seleziona, e il tasto Canc (Delete) lo elimina dopo una domanda, come «Elimina connessione» nel menu del clic destro. Il clic destro apre un menu con «Modifica connessione» ed «Elimina connessione». Due dispositivi possono essere uniti da più di un cavo, come i due cavi tra Router-Core e SW-Core nella rete dell'azienda, e ciascuno ha le sue interfacce. Nella modalità presentazione non si può disegnare né modificare nulla.

## Le due estremità {#ends}

Quando disegni un cavo, ogni estremità prende la prima interfaccia libera del suo dispositivo: la porta di numero più basso che sia libera e accesa, altrimenti la prima scheda libera e accesa; se tutte quelle libere sono spente, la prima di esse. Un PC prende `eth0`, uno switch la sua porta 1, poi la porta 2. I cavi incollati tengono le interfacce dei cavi da cui sono stati copiati.

Per vedere o cambiare un'estremità, fai clic destro sul cavo e scegli «Modifica connessione». La finestra ha come titolo i due dispositivi, e sotto «Interfacce» ha un elenco per ogni estremità, intitolato "Interfaccia su" e il nome del dispositivo ("Interfaccia su PC-1"). Una scheda o una porta che un altro cavo usa già è nell'elenco ma non si può scegliere; una spenta è indicata come disabilitata. Un'estremità senza interfaccia dice «Non assegnata»: succede su un dispositivo senza porte o schede libere, o del tutto senza.

L'interfaccia a cui è assegnata un'estremità decide che cosa il motore può verificare lì:

- una porta spenta, o una scheda spenta, ferma il pacchetto, e il motivo la nomina;
- la VLAN di una porta di uno switch è la VLAN in cui il pacchetto si trova su quel cavo ([VLAN](vlans.md));
- l'indirizzo di una porta di router, e il gateway che gli corrisponde, vengono confrontati con ciò che usa chi manda il pacchetto ([Indirizzi e gateway](addresses.md#gateway));
- la zona di sicurezza di una porta di firewall decide quale politica si applica ([Firewall](../services/firewall.md#zones)).

Un'estremità **non assegnata** non ha niente di tutto questo. Il motore lascia passare il pacchetto da quell'estremità, salta le regole della porta, e scrive una nota nella risposta: `link Router-Core–FW-Edge has no port binding on FW-Edge: per-port rules skipped`, o, se è un router, che il gateway non è stato verificato. Su un firewall con regole, ciò che entra da un'estremità così viene bloccato, a meno che una regola lo permetta ([qui sotto](#firewall)). La finestra dice lo stesso sotto gli elenchi: «Stato della porta, zona di sicurezza e gateway vengono verificati solo sulle estremità assegnate a un'interfaccia.» Quando si apre un progetto, ogni estremità senza interfaccia riceve di nuovo la prima libera, con l'unica eccezione descritta qui sotto.

## Su un firewall con zone {#firewall}

Su un firewall le cui porte hanno zone di sicurezza, l'estremità non viene mai assegnata da sola. Scegliere una porta lì vorrebbe dire scegliere una politica: la porta decide la zona, e quando nessuna regola corrisponde è la zona a decidere che cosa il firewall lascia passare. Perciò un cavo verso un firewall di questo tipo nasce con quell'estremità non assegnata, e la porta si sceglie in «Modifica connessione», sotto "Interfaccia su" e il nome del firewall. Anche il terminale fa così: `connect` lascia l'estremità senza interfaccia e lo dice.

Finché la porta non è scelta il firewall non sa in quale zona sia il cavo, e la sua politica delle zone non può decidere per ciò che entra da quel cavo. Un firewall senza regole attive lo lascia passare, con una nota; FW-Edge ha delle regole, quindi ciò che nessuna regola permette si ferma lì, come su un router ([Firewall](../services/firewall.md#zones)). Nella rete dell'azienda, elimina il cavo da FW-Edge a Router-Core e disegnalo di nuovo: il `trace` dagli uffici alla DMZ si ferma al firewall:

```ncl sample=company
pixelcake> disconnect FW-Edge from Router-Core
disconnected FW-Edge ↔ Router-Core
pixelcake> connect FW-Edge to Router-Core
connected FW-Edge (unbound) ↔ Router-Core (port 4)
  FW-Edge has security zones, so the port of a new link is chosen by hand (right click on the link, Edit link, Interfaces): until then that end is not bound, per-port rules are skipped there, and what comes in by it is blocked unless a rule allows it
pixelcake> trace Portale-Clienti from PC-Vendite
Tracing route to Portale-Clienti (172.16.0.10) from PC-Vendite:
  1  ○ PC-Vendite (PC)
  2  ○ SW-Uffici (Switch)  — VLAN 10
  3  ○ SW-Core (Switch)  — VLAN 10
  4  ○ Router-Core (Router)  — routed: default route via 10.0.0.2 (port 4)
  5  ✗ FW-Edge (Firewall)  — firewall FW-Edge: no rule allows it, and the zone policy cannot decide: the link is not attached to a port
  note: link Router-Core–FW-Edge has no port binding on FW-Edge: per-port rules skipped
Trace failed (blocked): firewall FW-Edge: no rule allows it, and the zone policy cannot decide: the link is not attached to a port
```

Il motivo dice che cosa fare: assegnare l'estremità. Con il cavo sulla porta 1, la porta nella zona trust, lo stesso `trace` passa di nuovo, per la politica delle zone (`no rule matches, zone policy trust → dmz allowed`). I comandi sono in [Dispositivi e indirizzi](../terminal/devices-and-addresses.md#connect).

## Modificare una connessione {#edit}

La stessa finestra, «Modifica connessione», decide l'aspetto del cavo:

- «Tipo di connessione»: «Nessuno (predefinito)», oppure uno dei tipi in Impostazioni → Template, che all'inizio sono Access, Trunk, Uplink, Backbone e MPLS. Un tipo dà alla linea il colore, lo stile (continua, tratteggiata, punteggiata) e lo spessore. «Anteprima del colore» mostra il risultato.
- «Banda (es. 1 Gbps, 100 Mbps)»: un testo, scritto sul cavo.
- «Etichetta personalizzata»: un altro testo, scritto sotto. Le reti di esempio la usano per nomi come `VLAN 10` e `Trunk 10, 20`.
- «Colore personalizzato (facoltativo)»: sovrascrive il colore del tipo.

Premi «Salva» per tenere le modifiche. **Queste quattro cambiano ciò che è disegnato e nient'altro.** Il motore non legge il tipo, la banda, l'etichetta né il colore: un cavo con l'etichetta `VLAN 10` trasporta la VLAN 10 solo se le porte alle sue estremità sono nella VLAN 10. [Template](templates.md#built-in) spiega come creare un tipo di connessione tuo.

## Il tempo di un pacchetto {#delay}

Su un cavo un pacchetto impiega del tempo. Il gruppo «Cavo» della stessa finestra dice che cos'è il cavo e quanto è lungo, e mostra il tempo che un pacchetto ci impiega, in un verso:

- «Mezzo»: «Automatico», oppure che cos'è il cavo: «Rame (Ethernet)», «Fibra ottica», «Wi-Fi», o la linea di una sede verso il suo provider: «DSL verso il provider», «Fibra verso il provider (FTTH)», «Rete mobile 4G/5G», «Satellite (geostazionario)». «Automatico» è Wi-Fi quando un'estremità è un portatile, uno smartphone o un tablet e l'altra un access point, rame negli altri casi: i portatili delle reti di esempio sono in Wi-Fi senza che nessuno lo imposti.
- «Lunghezza», con la sua «Unità» (m o km): quanto è lungo il cavo. Se resta vuota, il cavo non ha lunghezza.
- «Ritardo (ms)»: un ritardo scritto a mano, in un verso, come la latenza che un operatore garantisce per una linea. Se resta vuoto, il ritardo si ricava dal mezzo e dalla lunghezza; scritto, prende il posto di tutti e due.
- «Ritardo in un verso» mostra il tempo mentre si scrive nei campi, e da che cosa viene: `3,0 ms: fibra, 600 km`, `1,5 ms: Wi-Fi (automatico)`, `7,0 ms: scritto a mano`.

Una lunghezza o un ritardo che non è un numero, o che è fuori misura (un cavo più lungo di 40.000 km, un ritardo oltre 10.000 ms), viene segnalato sotto il suo campo, e «Salva» non tiene nulla finché non è corretto.

Il tempo di un cavo è il tempo del suo mezzo, più 5 µs per ogni km di lunghezza, che è la velocità della luce nel rame e nella fibra:

| Mezzo | In un verso |
|---|---|
| Rame (Ethernet), fibra ottica | solo la lunghezza: 0,005 ms al km, 3 ms per 600 km |
| Wi-Fi | 1,5 ms |
| DSL verso il provider | 8 ms |
| Fibra verso il provider (FTTH) | 1,5 ms |
| Rete mobile 4G/5G | 15 ms |
| Satellite (geostazionario) | 280 ms |

Anche i dispositivi che il pacchetto attraversa impiegano il loro tempo, e così la rete che un simbolo Cloud rappresenta: [il tempo di un ping](../asking/how-the-engine-decides.md#time) spiega come si sommano. Il tipo di una connessione dice a che cosa serve, mai di che cosa è fatta: una connessione MPLS può essere in fibra o in DSL. Nel terminale `show connections` stampa il cavo di ogni connessione e il suo tempo, e `link` li imposta. La linea di riserva delle due sedi è una linea DSL di ogni sede verso l'operatore:

```ncl sample=two-sites
pixelcake> show connections of R-Riserva
CONNECTIONS of R-Riserva (2)
  R-Sede ↔ R-Riserva  (uplink, 100 Mbps)  [port 3 ↔ port 1]  dsl: 8.0ms
  R-Riserva ↔ R-Filiale  (uplink, 100 Mbps)  [port 2 ↔ port 3]  dsl: 8.0ms
pixelcake> link R-Sede to R-Filiale length 300 km
R-Sede ↔ R-Filiale: length 300 km
  one way: 1.5ms (fibre, 300 km)
pixelcake> ping PC-Filiale-1 from PC-Sede-1
Pinging PC-Filiale-1 (192.168.2.11) from PC-Sede-1...
Reply from 192.168.2.11: hops=7 time=3.7ms
```

I comandi sono in [Dispositivi e indirizzi](../terminal/devices-and-addresses.md#link).

## Limiti {#limits}

> [!LIMITS]
> - Un cavo ha un ritardo, non una velocità. La "Banda" è un'etichetta: un pacchetto impiega lo stesso tempo qualunque cosa porti e per quanti pacchetti attraversino il cavo, e un download grande dura quanto un ping. La banda e il collo di bottiglia di una strada non sono simulati.
> - Non ci sono code, congestione, variazioni del ritardo né perdite: ogni ping di un disegno impiega lo stesso tempo. I tempi dei mezzi sono valori tipici, non misurati.
> - Un cavo non ha guasti propri: si può interrompere solo nella modalità presentazione, come guasto simulato.
> - Nulla impedisce un cavo tra due dispositivi finali, o da un dispositivo a se stesso. Il motore segue ciò che è disegnato e poi dice perché un pacchetto non può attraversare un dispositivo finale.
> - Una porta può avere un cavo solo. Un dispositivo con più cavi che porte ha le estremità in più non assegnate.
