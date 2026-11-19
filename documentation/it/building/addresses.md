---
title: "Indirizzi e gateway"
description: "L'indirizzo di un dispositivo finale, gli indirizzi delle porte di un router, il gateway, e la rete da cui partono i dispositivi nuovi."
order: 4
---

Un indirizzo dice a un dispositivo dove si trova; una subnet mask gli dice quali altri indirizzi sono nella stessa rete; un gateway gli dice dove mandare ciò che va altrove. Il motore legge tutti e tre dalle interfacce di ogni dispositivo sul percorso di un pacchetto. Un dispositivo manda direttamente agli indirizzi della sua rete, e al gateway tutto il resto. Il gateway deve essere un router, o un firewall, che ha un indirizzo in quella rete.

## L'indirizzo di un dispositivo finale {#end-devices}

Un dispositivo finale ha un indirizzo sulla sua prima scheda di rete, `eth0`: un «Indirizzo IP», una «Subnet mask» e un «Gateway», e facoltativamente un «Server DNS». Si impostano in due posti che sono in realtà lo stesso campo: la scheda «Generale» della finestra del dispositivo, sotto il titolo `Rete · eth0`, e la riga di `eth0` nella scheda «Schede di rete» ([Porte e schede di rete](ports-and-cards.md#first-card)).

Una scheda può invece prendere l'indirizzo da un server DHCP: imposta «Indirizzo» su «Automatico (DHCP)», e al posto dei campi compare l'indirizzo assegnato alla scheda ([DHCP](../services/dhcp.md#clients)). Una scheda in DHCP che non riceve un indirizzo fa diventare giallo il suo dispositivo, e sotto il nome compare «DHCP: nessun indirizzo».

Nel terminale, `show ip` mostra gli indirizzi di un dispositivo:

```ncl sample=office
pixelcake> show ip PC-1
PC-1 — addressing
  ip:       192.168.10.11
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1
pixelcake> show ip Router-1
Router-1 — addressing
  ip:       192.168.10.1
  subnet:   255.255.255.0
  gateway:  -
  port 1: 192.168.10.1 / 255.255.255.0
  port 2: 192.168.20.1 / 255.255.255.0
```

Il dispositivo ha `ip`, `subnet` e `gateway` suoi, che sono quelli della prima scheda, e una riga per ogni scheda o porta con indirizzo. Il terminale li imposta con `set ip`, `set gateway`, `set subnet` e `interface <nome> ip` ([Dispositivi e indirizzi](../terminal/devices-and-addresses.md#set)).

## Le porte di un router {#router-ports}

Le porte di uno switch non hanno indirizzo: uno switch ne ha uno suo, per essere gestito, e inoltra per VLAN. Le porte di un **router** e di un **firewall** hanno ciascuna un «Indirizzo IP» e una «Subnet mask» ([Porte e schede di rete](ports-and-cards.md#ports)). L'indirizzo di una porta fa due cose:

- è il **gateway dei dispositivi collegati lì**: lo scrivono nel loro «Gateway»;
- la sua rete è **collegata** al router: un pacchetto diretto lì viene consegnato senza bisogno di una rotta.

Router-1, nella rete di esempio dell'ufficio, ha due porte, una in ciascuna rete. Una porta senza indirizzo non sta in nessuna rete; un router le cui porte non ne hanno lascia comunque passare il traffico, con una nota che dice che gateway e instradamento non sono stati verificati, così i disegni fatti senza indirizzi continuano a funzionare. Più VLAN su uno switch sono più reti, e un router ha bisogno di una porta in ciascuna ([VLAN](vlans.md#between-vlans)). Una rete dietro un altro router si raggiunge con una rotta ([Rotte](../services/routes.md#static)).

## Il gateway {#gateway}

Quando un dispositivo manda qualcosa fuori dalla sua rete, lo manda al gateway. Il motore controlla che il gateway ci sia. Ognuno di questi casi ferma il pacchetto, con un motivo che dice quale:

```ncl sample=office
pixelcake> set gateway of PC-1 to 192.168.10.5
PC-1: gateway set to 192.168.10.5
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.5, but Router-1 port 1 on its network is 192.168.10.1
  dropped at: PC-1
pixelcake> interface eth0 gateway none on PC-1
interface eth0 on PC-1 has no gateway now
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: no default gateway configured on PC-1
  dropped at: PC-1
pixelcake> interface eth0 gateway 192.168.10.1 on PC-1
interface eth0 on PC-1: gateway 192.168.10.1
```

Un gateway che non è l'indirizzo di nessuno: il motivo nomina il gateway che il dispositivo usa e l'indirizzo della porta del router che ha raggiunto. Nessun gateway: il dispositivo non può uscire dalla sua rete. Un gateway che è una porta senza indirizzo:

```ncl continue
pixelcake> interface 1 ip none on Router-1
port 1 on Router-1 has no address now
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.1, but Router-1 port 1 on its link has no IP address
  dropped at: PC-1
pixelcake> interface 1 ip 192.168.10.1 on Router-1
port 1 on Router-1: 192.168.10.1 / 255.255.255.0
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms
```

Poi una subnet mask troppo larga, che a chi manda fa sembrare due reti una sola: il PC manda direttamente al server invece che al gateway, e il router in mezzo non inoltra traffico dentro una stessa rete:

```ncl sample=office
pixelcake> interface eth0 ip 192.168.10.11/16 on PC-1
interface eth0 on PC-1: 192.168.10.11 / 255.255.0.0
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: Web-01 (192.168.20.10) is addressed inside the network of PC-1 but sits behind Router-1: a router does not pass traffic within one network
  dropped at: Router-1
```

Il contrario è un indirizzo nella rete sbagliata: il pacchetto arriva al router, che non trova nessuno che risponda:

```ncl sample=office
pixelcake> set ip of PC-2 to 192.168.20.77
PC-2: ip set to 192.168.20.77
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.20.77) from PC-1...
Ping failed (blocked): request: PC-2 (192.168.20.77) does not answer on the network of Router-1
  dropped at: Router-1
```

Nessuno di questi valori viene rifiutato quando lo scrivi. La finestra controlla che un indirizzo sia fatto di quattro numeri da 0 a 255, che una subnet mask sia una maschera, e che una maschera abbia un indirizzo ([Porte e schede di rete](ports-and-cards.md#problems)); non controlla che un gateway sia nella rete della scheda, o che un indirizzo appartenga alla rete del cavo a cui è collegato. A questo serve interrogare la rete: un `ping`, o un `trace`, dice dove si è fermato il pacchetto e perché. Non viene rifiutato nemmeno un indirizzo che ha già un altro dispositivo, ma viene segnalato subito ([più sotto](#conflicts)).

## Due dispositivi con lo stesso indirizzo {#conflicts}

Un indirizzo scritto su due dispositivi è in conflitto, come in una rete vera quando si clona una macchina con il suo indirizzo: a chi lo cerca può rispondere l'uno o l'altro, e quindi nessuna risposta che lo riguarda è affidabile. Succede soprattutto dopo un incolla: la copia di un server, di un router, di un firewall o di uno switch tiene gli indirizzi dell'originale ([Dispositivi](devices.md#copy-delete)). Finché uno dei due non ha un altro indirizzo:

- **sul canvas** i due dispositivi sono gialli, e la riga sotto il nome mostra l'indirizzo seguito da `· in conflitto`;
- **nella finestra del dispositivo** un riquadro sopra le schede nomina l'altro dispositivo che ha l'indirizzo, e segue quello che scrivi; il salvataggio non viene rifiutato;
- **nelle risposte** una domanda verso quell'indirizzo, o che parte da lì, si ferma prima di cominciare, con un motivo che nomina l'indirizzo e i dispositivi. Un dispositivo che fa ping a sé stesso riceve comunque risposta, e una domanda fra altri due dispositivi non cambia;
- **nel terminale** `show ip` e `show interfaces` finiscono con una riga per ogni indirizzo in conflitto.

```ncl sample=office
pixelcake> set ip of Mail-01 to 192.168.20.10
Mail-01: ip set to 192.168.20.10
  warning: 192.168.20.10 is also the address of Web-01
pixelcake> show ip Mail-01
Mail-01 — addressing
  ip:       192.168.20.10
  subnet:   255.255.255.0
  gateway:  192.168.20.1
  eth0: 192.168.20.10 / 255.255.255.0 gw 192.168.20.1
  ✗ address conflict: 192.168.20.10 is also on Web-01
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (error): request: address conflict: 192.168.20.10 is on both Web-01 and Mail-01, so the answer cannot be trusted
pixelcake> set ip of Mail-01 to 192.168.20.11
Mail-01: ip set to 192.168.20.11
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms
```

Il ping non esce da PC-1: quale dei due server risponderebbe non si può dire, e una rete vera risponderebbe ora dall'uno, ora dall'altro.

Che cosa conta:

- **Un indirizzo scritto a mano**: su una scheda di rete, su una porta di un router o di un firewall, o sul dispositivo stesso (l'indirizzo di uno switch). Un'interfaccia disattivata non risponde a nessuno e non conta. `0.0.0.0` e gli indirizzi di loopback (`127.x.x.x`) non contano mai.
- **Non un indirizzo assegnato dal DHCP.** Un server DHCP assegna solo indirizzi che nessuno ha, scritti a mano o assegnati ([DHCP](../services/dhcp.md#which-address)), quindi un indirizzo assegnato non è mai in conflitto, nemmeno con uno scritto a mano dentro il suo intervallo.
- **Un indirizzo pubblico** è in conflitto ovunque siano i due dispositivi: su Internet è unico.
- **Un indirizzo privato** (10.x, 172.16–31.x, 192.168.x) non è in conflitto quando fra i due dispositivi c'è Internet, cioè quando sono collegati l'uno all'altro solo attraverso un simbolo Internet. Internet non porta gli indirizzi privati ([NAT](../services/nat.md#private)), e quindi ognuno sta in una rete sua: due uffici, ciascuno dietro il suo router verso Internet, possono avere tutti e due `192.168.1.10`, come succede davvero. Qualsiasi altra strada fra loro, un cavo, uno switch, un router, un simbolo Cloud che non è Internet come una rete MPLS, li mette nella stessa rete.
- **Due dispositivi che non sono collegati in nessun modo** si considerano nella stessa rete: una copia appena incollata, non ancora collegata, è pensata per stare accanto all'originale.

## La rete del progetto {#project-network}

Un dispositivo nuovo riceve un indirizzo, una subnet mask e un gateway, presi dal progetto. In Impostazioni → Rete, sotto «Nuovi dispositivi»:

| Campo | Che cos'è |
|---|---|
| «Rete» | Un indirizzo di rete, `192.168.1.0`. A un dispositivo nuovo viene proposto il primo indirizzo libero, da `.2`, saltando quelli che i dispositivi hanno già, scritti a mano o assegnati |
| «Subnet mask predefinita» | La subnet mask delle schede nuove |
| «Gateway predefinito» | Il gateway delle schede nuove. Un router o un firewall nasce senza: per loro il gateway è la rotta predefinita, scelta nella loro finestra |
| «Server DNS predefinito» | Facoltativo. Viene scritto sulla scheda di rete dei nuovi PC, server e altri dispositivi finali; non su un access point, un load balancer o un Cloud, che portano solo il traffico degli altri |

Premi «Salva le impostazioni di rete». Un campo lasciato vuoto (il server DNS può esserlo) o che non è un indirizzo viene rifiutato, e un avviso lo dice («Tutti i campi sono obbligatori»). Le impostazioni sono quelle del progetto e viaggiano con esso nel file. **Cambiarle non tocca i dispositivi che sono già sul canvas**: hanno gli indirizzi che hanno ricevuto. L'unica eccezione è il server DNS: una volta salvato, la stessa scheda dice quanti dispositivi finali del canvas non hanno un server DNS e propone un pulsante, per esempio "Assegna 192.168.30.10", che dopo una conferma lo assegna a loro. Chi indica già un server lo tiene.

Ogni rete di esempio porta con sé le sue impostazioni: quella dell'azienda, per esempio, fa partire i dispositivi nuovi dalla rete `192.168.10.0` con gateway `192.168.10.1`. Caricarne una sostituisce le impostazioni del progetto, e la domanda di conferma lo dice ([Reti di esempio](../reference/samples.md)). File → «Nuovo progetto…» chiede gli stessi valori.

## Limiti {#limits}

> [!LIMITS]
> - Solo IPv4. Non c'è l'IPv6.
> - Una porta o una scheda ha un solo indirizzo. Un secondo indirizzo sulla stessa interfaccia, una sottointerfaccia e un indirizzo che si sposta tra dispositivi (VRRP, HSRP) non sono modellati.
> - Non c'è l'ARP. Un conflitto si trova nel disegno, non nel traffico: quale dei due dispositivi risponderebbe non viene calcolato, e un gateway in conflitto non viene notato dai pacchetti che ci passano soltanto attraverso. Due interfacce dello stesso dispositivo con lo stesso indirizzo non sono considerate un conflitto.
> - Un gateway viene controllato solo quando un pacchetto ne ha bisogno: il canvas ne accetta uno lontano dalla rete della sua scheda.
