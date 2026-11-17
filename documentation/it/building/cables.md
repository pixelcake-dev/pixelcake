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

Il cavo c'è subito. Un clic lo seleziona, e il tasto Canc (Delete) lo elimina all'istante. Il clic destro apre un menu con «Modifica connessione» ed «Elimina connessione»; la seconda chiede conferma. Due dispositivi possono essere uniti da più di un cavo, come i due cavi tra Router-Core e SW-Core nella rete dell'azienda, e ciascuno ha le sue interfacce. Nella modalità presentazione non si può disegnare né modificare nulla.

## Le due estremità {#ends}

Quando disegni un cavo, ogni estremità prende la prima interfaccia libera del suo dispositivo: la porta di numero più basso che sia libera e accesa, altrimenti la prima scheda libera e accesa; se tutte quelle libere sono spente, la prima di esse. Un PC prende `eth0`, uno switch la sua porta 1, poi la porta 2. I cavi incollati tengono le interfacce dei cavi da cui sono stati copiati.

Per vedere o cambiare un'estremità, fai clic destro sul cavo e scegli «Modifica connessione». La finestra ha come titolo i due dispositivi, e sotto «Interfacce» ha un elenco per ogni estremità, intitolato "Interfaccia su" e il nome del dispositivo ("Interfaccia su PC-1"). Una scheda o una porta che un altro cavo usa già è nell'elenco ma non si può scegliere; una spenta è indicata come disabilitata. Un'estremità senza interfaccia dice «Non assegnata»: succede su un dispositivo senza porte o schede libere, o del tutto senza.

L'interfaccia a cui è assegnata un'estremità decide che cosa il motore può verificare lì:

- una porta spenta, o una scheda spenta, ferma il pacchetto, e il motivo la nomina;
- la VLAN di una porta di uno switch è la VLAN in cui il pacchetto si trova su quel cavo ([VLAN](vlans.md));
- l'indirizzo di una porta di router, e il gateway che gli corrisponde, vengono confrontati con ciò che usa chi manda il pacchetto ([Indirizzi e gateway](addresses.md#gateway));
- la zona di sicurezza di una porta di firewall decide quale politica si applica ([Firewall](../services/firewall.md#zones)).

Un'estremità **non assegnata** non ha niente di tutto questo. Il motore lascia passare il pacchetto da quell'estremità, salta le regole della porta, e scrive una nota nella risposta: `link Router-Core–FW-Edge has no port binding on FW-Edge: per-port rules skipped`, o, se è un router, che il gateway non è stato verificato. La finestra dice lo stesso sotto gli elenchi: «Stato della porta, zona di sicurezza e gateway vengono verificati solo sulle estremità assegnate a un'interfaccia.» Quando si apre un progetto, ogni estremità senza interfaccia riceve di nuovo la prima libera, con l'unica eccezione descritta qui sotto.

## Su un firewall con zone {#firewall}

Su un firewall le cui porte hanno zone di sicurezza, l'estremità non viene mai assegnata da sola. Scegliere una porta lì vorrebbe dire scegliere una politica: la porta decide la zona, e quando nessuna regola corrisponde è la zona a decidere che cosa il firewall lascia passare. Perciò un cavo verso un firewall di questo tipo nasce con quell'estremità non assegnata, e la porta si sceglie in «Modifica connessione», sotto "Interfaccia su" e il nome del firewall. Anche il terminale fa così: `connect` lascia l'estremità senza interfaccia e lo dice.

Finché la porta non è scelta il firewall non sa in quale zona sia il cavo. Nella rete dell'azienda, elimina il cavo da FW-Edge a Router-Core e disegnalo di nuovo: nel `trace` attraverso il firewall, al posto della politica delle zone compare una nota:

```ncl sample=company
pixelcake> disconnect FW-Edge from Router-Core
disconnected FW-Edge ↔ Router-Core
pixelcake> connect FW-Edge to Router-Core
connected FW-Edge (unbound) ↔ Router-Core (port 4)
  FW-Edge has security zones, so the port of a new link is chosen by hand (right click on the link, Edit link, Interfaces): until then that end is not bound, per-port rules are skipped there
pixelcake> trace Portale-Clienti from PC-Vendite
Tracing route to Portale-Clienti (172.16.0.10) from PC-Vendite:
  1  ○ PC-Vendite (PC)
  2  ○ SW-Uffici (Switch)  — VLAN 10
  3  ○ SW-Core (Switch)  — VLAN 10
  4  ○ Router-Core (Router)  — routed: default route via 10.0.0.2 (port 4)
  5  ○ FW-Edge (Firewall)  — routed: 172.16.0.0/24 is on port 2; firewall FW-Edge: no rule matches and no zone binding: allowed
  6  ○ SW-DMZ (Switch)
  7  ● Portale-Clienti (Server)
  note: link Router-Core–FW-Edge has no port binding on FW-Edge: per-port rules skipped
  note: firewall FW-Edge: no rule matches and no zone binding: allowed
Trace complete: destination reached.
```

Prima, lo stesso `trace` diceva `no rule matches, zone policy trust → dmz allowed`. I comandi sono in [Dispositivi e indirizzi](../terminal/devices-and-addresses.md#connect).

## Modificare una connessione {#edit}

La stessa finestra, «Modifica connessione», decide l'aspetto del cavo:

- «Tipo di connessione»: «Nessuno (predefinito)», oppure uno dei tipi in Impostazioni → Template, che all'inizio sono Access, Trunk, Uplink, Backbone e MPLS. Un tipo dà alla linea il colore, lo stile (continua, tratteggiata, punteggiata) e lo spessore. «Anteprima del colore» mostra il risultato.
- «Banda (es. 1 Gbps, 100 Mbps)»: un testo, scritto sul cavo.
- «Etichetta personalizzata»: un altro testo, scritto sotto. Le reti di esempio la usano per nomi come `VLAN 10` e `Trunk 10, 20`.
- «Colore personalizzato (facoltativo)»: sovrascrive il colore del tipo.

Premi «Salva» per tenere le modifiche. **Queste quattro cambiano ciò che è disegnato e nient'altro.** Il motore non legge il tipo, la banda, l'etichetta né il colore: un cavo con l'etichetta `VLAN 10` trasporta la VLAN 10 solo se le porte alle sue estremità sono nella VLAN 10. [Template](templates.md#built-in) spiega come creare un tipo di connessione tuo.

## Limiti {#limits}

> [!LIMITS]
> - Un cavo non ha lunghezza, velocità né guasti propri. La "Banda" è un'etichetta, e un pacchetto impiega lo stesso tempo su ogni cavo. Un cavo si può interrompere solo nella modalità presentazione, come guasto simulato.
> - Nulla impedisce un cavo tra due dispositivi finali, o da un dispositivo a se stesso. Il motore segue ciò che è disegnato e poi dice perché un pacchetto non può attraversare un dispositivo finale.
> - Una porta può avere un cavo solo. Un dispositivo con più cavi che porte ha le estremità in più non assegnate.
