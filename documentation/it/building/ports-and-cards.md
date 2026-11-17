---
title: "Porte e schede di rete"
description: "Switch, router e firewall hanno porte numerate; ogni altro dispositivo ha schede di rete. Che cosa contengono, e come si modificano."
order: 2
---

Un cavo si collega a qualcosa. Su uno switch, un router o un firewall è una **porta** numerata; su ogni altro dispositivo è una **scheda di rete**, chiamata con il suo nome, `eth0`. Il motore legge le impostazioni di una porta o di una scheda una per una: se è accesa, in quale VLAN sta, che indirizzo ha. Entrambe si modificano nella finestra del dispositivo ([Dispositivi](devices.md#window)), nella scheda «Porte» o nella scheda «Schede di rete», e non si salva nulla finché non premi «Salva».

## Porte {#ports}

Uno switch ha 5, 8, 16, 24 o 48 porte; un router o un firewall ne ha 2, 4, 8 o 16. Il numero si sceglie quando si aggiunge il dispositivo, e si può cambiare dopo: «Numero di porte» nella scheda «Porte». Le porte nuove si aggiungono in fondo. Riducendo il numero si tolgono le ultime, a meno che una di esse non abbia un cavo: allora PixelCake dice di quale porta si tratta, e il cavo va scollegato prima.

La scheda mostra le porte come una fila di caselle. Ognuna ha il suo numero, il suo nome se ce l'ha, una lettera per la sua modalità (`A` access, `T` trunk, `W` WAN, `L` LAN, `D` DMZ), un piccolo segno di collegamento quando c'è un cavo, e un fulmine quando il PoE è attivo; una porta disabilitata è grigia. Fermando il puntatore su una porta si leggono il suo nome, la sua VLAN e a che cosa è collegata. Un clic su una casella apre le impostazioni della porta sotto la fila, e la riga «Collegata a» dice a quale dispositivo e a quale porta va il cavo, oppure che non c'è nessun cavo.

| Impostazione | Su | Che cosa fa |
|---|---|---|
| «Porta attiva» | tutte | Una porta spenta non trasporta nulla. Un pacchetto che ha un'altra strada la prende; gli altri si fermano, e il motivo nomina la porta |
| «Nome della porta (facoltativo)» | tutte | Un nome per te, mostrato negli elenchi e quando il puntatore si ferma sulla porta. Lo legge anche [Collegare ciò che non ha un cavo](layout-and-connection.md#connect): una porta che ha il nome di un dispositivo viene riservata a quel dispositivo |
| «Modalità della porta» | switch | «Access (dispositivo finale)» o «Trunk (tra switch)». Decide come si legge la VLAN della porta: vedi [VLAN](vlans.md#access-and-trunk) |
| «VLAN (singola)» o «VLAN (separate da virgola)» | switch | La VLAN di una porta di accesso, le VLAN che un trunk trasporta: vedi [VLAN](vlans.md) |
| «Indirizzo IP», «Subnet mask» | router, firewall | L'indirizzo della porta. È il gateway dei dispositivi collegati lì, e la sua rete si raggiunge senza una rotta. Senza subnet mask vale `255.255.255.0`. Vedi [Indirizzi e gateway](addresses.md#router-ports) |
| «Zona di sicurezza» | firewall | Trust, untrust, DMZ o nessuna. Il firewall legge prima le sue regole; quando nessuna corrisponde, è la politica delle zone a decidere che cosa passa ([Firewall](../services/firewall.md#policy)) |
| «NAT attivo» | router, firewall | Ciò che il dispositivo inoltra da questa porta esce con l'indirizzo della porta |
| «Server DHCP attivo» | router, firewall | La porta assegna indirizzi alle schede della sua rete che sono in DHCP |
| «Velocità», «PoE attivo (Power over Ethernet)», «IPS/IDS attivo (Intrusion Prevention/Detection)» | velocità su tutte, PoE su uno switch, IPS su un firewall | Niente: restano con il disegno, e il motore non li legge |
| «Modalità della porta» | router, firewall | Niente: WAN, LAN o DMZ qui descrive soltanto la porta. Su un firewall conta la zona di sicurezza |
| «Note / descrizione» | tutte | Testo libero |

Dove un dispositivo ha porte, la scheda «Generale» le riassume. Uno switch dice quante sono collegate e disabilitate, quali porte stanno in quale VLAN e che cosa trasporta ogni trunk. Un router o un firewall elenca le sue porte in uso, con indirizzo, zona, a che cosa è collegata ciascuna e che cosa fa (NAT, server DHCP); un clic sul nome di una porta la apre nella scheda «Porte».

Le zone di sicurezza di un firewall, il NAT e il server DHCP di una porta hanno pagine proprie: [Firewall](../services/firewall.md#zones), [NAT e inoltri](../services/nat.md#source-nat) e [DHCP](../services/dhcp.md#servers).

## Schede di rete {#cards}

Ogni dispositivo che non è uno switch, un router o un firewall ha almeno una scheda di rete, e un dispositivo nuovo ne ha una: `eth0`. La scheda «Schede di rete» le elenca, una riga ciascuna, con nome, indirizzo, MAC, velocità e a che cosa è collegata; un clic su una riga ne apre le impostazioni. Se il dispositivo ha una scheda sola, le sue impostazioni sono già aperte.

| Impostazione | Che cosa fa |
|---|---|
| «Scheda attiva» | Una scheda spenta non trasporta nulla, come una porta spenta |
| «Nome dell'interfaccia» | `eth0`, `eth1`, `ens192`. È il nome con cui il terminale chiama la scheda (`interface eth0 down on PC-1`). Due schede di un dispositivo non possono avere lo stesso nome |
| «Velocità» | Niente: il motore non la legge |
| «Indirizzo MAC» | Scritto sulla scheda e tenuto con il disegno. Il pulsante «Genera un MAC», sotto il campo, ne crea uno della forma `02:XX:XX:XX:XX:XX`. Nessuno lo legge: il motore segue indirizzi e cavi, non i MAC |
| «Indirizzo» | «Manuale», con «Indirizzo IP», «Subnet mask» e «Gateway» scritti qui, oppure «Automatico (DHCP)», dove l'indirizzo arriva da un server DHCP della rete ([DHCP](../services/dhcp.md#clients)) |
| «Server DNS» | L'indirizzo del server a cui la scheda chiede a quale indirizzo corrisponde un nome ([DNS](../services/dns.md#who-asks)) |
| «Note / descrizione» | Testo libero |

«Aggiungi scheda» aggiunge una scheda, `eth1` e così via, con un MAC suo, nessun indirizzo, e la subnet mask e il gateway del dispositivo; «Elimina scheda» ne elimina una, tranne l'ultima: un dispositivo non può restare senza schede. Ogni cavo è collegato a una scheda ([Cavi e connessioni](cables.md#ends)). Un dispositivo con due schede su due reti ha un indirizzo in entrambe, e ogni scheda ha il gateway della sua rete: il «Gateway» della scheda è il prossimo salto di ciò che esce da quella scheda.

Un server può assegnare indirizzi da una scheda, come fa un router da una porta: la scheda ha la stessa impostazione «Server DHCP attivo». Un dispositivo finale no.

## La prima scheda {#first-card}

Un dispositivo con schede è identificato dalla sua prima scheda: il suo nome vale l'indirizzo di quella scheda, nel disegno sotto il nome e nel terminale (`ping PC-1`). Quell'indirizzo, la subnet mask e il gateway compaiono anche nella scheda «Generale» della finestra, sotto il titolo `Rete · eth0`: appartengono alla scheda di rete, e nei due posti c'è lo stesso campo. Scrivere l'indirizzo lì, o nella riga della scheda, cambia lo stesso valore. L'indirizzo di un router o di un firewall è diverso: quello in «Generale» è l'indirizzo con cui il dispositivo viene nominato, e le reti a cui è collegato vengono dagli indirizzi delle sue porte.

Sotto l'indirizzo, «Generale» dice a che cosa è collegata la prima scheda e, per un dispositivo con più schede, che è la prima e dove sono le altre. La riga sotto il nome nel disegno è l'indirizzo di questa scheda, seguito da «DHCP» quando è assegnato.

## Quando un valore non va {#problems}

Un valore che non può essere salvato viene segnalato in rosso sotto il suo campo, mentre lo scrivi:

- un indirizzo che non è fatto di quattro numeri da 0 a 255: `"300.1.1.1" non è un indirizzo IPv4 valido`;
- una subnet mask che non è una maschera, o una maschera senza indirizzo: «Inserisci un indirizzo IP oppure svuota la subnet mask»;
- una VLAN che non è un numero da 1 a 4094, o più VLAN su una porta di accesso;
- una scheda senza nome, o due schede con lo stesso nome;
- un intervallo DHCP fuori dalla rete della sua porta o scheda, o senza indirizzi da assegnare;
- un server DNS che non è un indirizzo.

Finché ne resta uno, «Salva» non chiude la finestra, e un avviso dice di quale porta o scheda si tratta: `Porta 1: "300.1.1.1" non è un indirizzo IPv4 valido`, `Scheda eth0: …`. Correggilo, oppure premi «Annulla» per lasciare il dispositivo com'era.

L'app non controlla, invece, se i valori stanno bene insieme. Una porta con un indirizzo fuori dalla rete a cui arriva il suo cavo, o due porte sulla stessa rete, vengono salvate. Che cosa ne fa il motore si vede alla prima domanda: un pacchetto che non trova la sua strada si ferma con un motivo ([Indirizzi e gateway](addresses.md#gateway)).

## Limiti {#limits}

> [!LIMITS]
> - Velocità e PoE non sono simulati: una porta da 10 Mbps è veloce come una da 10 Gbps, e uno switch non resta mai senza energia.
> - Lo spanning tree e le altre impostazioni di una porta che servono solo a descriverla (la modalità di una porta di router, IPS/IDS) restano con il disegno e non le legge nessuno.
> - Una porta appartiene a un cavo solo. Un dispositivo con più cavi che porte lascia i cavi in più senza porta, e su quei cavi il motore salta le regole che riguardano le porte, con una nota.
> - Un indirizzo MAC è solo un'etichetta: nulla viene appreso o filtrato in base a esso.
