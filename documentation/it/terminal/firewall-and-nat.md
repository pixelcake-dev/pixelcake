---
title: "Firewall e NAT"
description: "I comandi per le zone di sicurezza e le regole di un firewall, per il NAT in uscita e per gli inoltri."
order: 5
---

Un firewall mette ogni sua porta in una zona di sicurezza e filtra ciò che passa da una zona all'altra con un elenco ordinato di regole. Anche un router può avere delle regole, la sua lista di accesso, senza zone. Un router o un firewall può anche tradurre gli indirizzi: il NAT in uscita su una porta, e gli inoltri, che rendono raggiungibile da fuori un servizio interno. Questi comandi scrivono le stesse impostazioni delle schede «Porte», «Regole» e «NAT» della finestra del dispositivo. Che cosa significano, e che cosa ne fa il motore, è spiegato in [Zone e regole del firewall](../services/firewall.md) e in [NAT e inoltri](../services/nat.md); le pagine di questa sezione elencano i comandi. `show rules` e `show nat` rileggono il risultato ([Comandi show](show.md#show-rules)).

Nella sintassi qui sotto `<n>` è il numero di una porta, `<firewall>` un firewall e `<device>` un router o un firewall; `on <device>` si può tralasciare dentro `use <device>`. La notazione è spiegata nella [panoramica](index.md#conventions). I comandi sono in inglese, come tutto il terminale.

## interface … zone {#zone}

```text
interface <n> zone trust|untrust|dmz|none [on] <firewall>
```

Mette una porta di un firewall in una zona di sicurezza. `trust` è l'interno, `untrust` l'esterno, `dmz` la zona dei server pubblicati verso l'esterno. `none` toglie la porta da ogni zona.

| Parametro | Che cos'è |
|---|---|
| `<n>` | Il numero di una porta del firewall |
| `trust`, `untrust`, `dmz`, `none` | La zona della porta, oppure nessuna zona |

Solo le porte di un firewall hanno una zona. Come viene giudicato un flusso da una zona all'altra è spiegato in [Zone e regole del firewall](../services/firewall.md#zones).

```ncl sample=company
pixelcake> show ports FW-Edge
PORT   STATE      MODE     VLAN       ZONE     IP               LINK
1      up         lan      -          trust    10.0.0.2         Router-Core (port 4)
2      up         dmz      -          dmz      172.16.0.1       SW-DMZ (port 8)
3      up         wan      -          untrust  203.0.113.1      Internet (eth0)
4      up         lan      -          -        -                -
pixelcake> interface 4 zone dmz on FW-Edge
port 4 on FW-Edge is now in zone dmz
pixelcake> interface 4 zone none on FW-Edge
port 4 on FW-Edge is in no security zone now
pixelcake> interface 4 zone moon on FW-Edge
unknown command: "interface 4 zone moon on FW-Edge"
  unknown zone "moon" — try: interface <n> zone trust|untrust|dmz|none [on] <device>
  type "help" for the command list
pixelcake> interface 1 zone trust on Router-Core
security zones are set on the ports of a firewall: Router-Core is a Router
```

## add rule {#add-rule}

```text
add rule [<position>] allow|deny [<service>|any] from <source> to <destination> [on] <device>
  allow may be written permit, deny block
```

Aggiunge una regola all'elenco di un router o di un firewall. Le regole si leggono dall'alto, e la prima che corrisponde per servizio, partenza e destinazione decide; quando nessuna corrisponde, su un firewall decide la politica delle zone ([regole](../services/firewall.md#rules)), e un router blocca il pacchetto: la sua lista finisce con un divieto implicito ([regole su un router](../services/firewall.md#router)). La prima regola di un router lo dice in una riga sua, e togliere l'ultima dice che il router torna a lasciar passare tutto.

| Parametro | Che cos'è |
|---|---|
| `<position>` | Dove va la regola nell'elenco, da 1. Senza, la regola va in fondo. Al massimo una in più del numero delle regole |
| `allow`, `deny` | Che cosa fa la regola. `permit` e `block` sono uguali |
| `<service>` | Uno dei [servizi](#services), oppure `any`. Senza, la regola vale per ogni servizio |
| `<source>`, `<destination>` | `any`, una zona (`trust`, `untrust`, `dmz`), un indirizzo, una rete (`192.168.30.0/24`) o un dispositivo |
| `<device>` | Il router o il firewall su cui va la regola. Dentro `use <device>` si tralascia |

Un dispositivo indicato come partenza o destinazione viene scritto nella regola con il suo indirizzo, e la risposta dice quale (`Srv-Auth → 192.168.30.10`): la regola tiene quell'indirizzo anche se poi il dispositivo lo cambia. Se l'indirizzo gli è stato assegnato dal DHCP, la risposta dice anche questo. Un dispositivo senza indirizzo viene rifiutato. Se una regola nomina una zona in cui non sta nessuna porta del firewall, la regola viene aggiunta e la risposta lo dice; su un router, che non ha zone, la risposta dice che la regola non corrisponde mai.

Un dispositivo finale o uno switch non accettano regole: la risposta dice che le regole vanno sui router e sui firewall.

```ncl sample=company
pixelcake> add rule 1 deny web from 203.0.113.50 to Portale-Clienti on FW-Edge
FW-Edge: rule 1 added — deny web from 203.0.113.50 to 172.16.0.10
  Portale-Clienti → 172.16.0.10
pixelcake> browse Portale-Clienti from Cliente-Remoto
Browsing Portale-Clienti (203.0.113.1) from Cliente-Remoto...
  ✗ HTTP request: Cliente-Remoto → Portale-Clienti
Browse failed (blocked): HTTP request: firewall FW-Edge: denied by rule 1 (deny web from 203.0.113.50 to 172.16.0.10)
  dropped at: FW-Edge
  note: HTTP request: Portale-Clienti is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: HTTP request: Internet is not simulated: traffic assumed to pass
pixelcake> remove rule 1 from FW-Edge
FW-Edge: rule 1 removed — deny web from 203.0.113.50 to 172.16.0.10
```

Posizioni, sinonimi, e una regola per un servizio solo:

```ncl sample=company
pixelcake> add rule allow dns from untrust to Srv-Auth on FW-Edge
FW-Edge: rule 4 added — allow dns from untrust to 192.168.30.10
  Srv-Auth → 192.168.30.10
pixelcake> add rule 1 deny ping from any to 192.168.30.0/24 on FW-Edge
FW-Edge: rule 1 added — deny ping from any to 192.168.30.0/24
pixelcake> add rule block from dmz to trust on FW-Edge
FW-Edge: rule 6 added — deny any from dmz to trust
pixelcake> add rule permit icmp from 203.0.113.50 to dmz on FW-Edge
FW-Edge: rule 7 added — allow ping from 203.0.113.50 to dmz
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  deny  ping   from any                to 192.168.30.0/24
   2  allow web    from untrust            to 172.16.0.10
   3  allow email  from untrust            to 192.168.30.40
   4  allow web    from 172.16.0.10        to 192.168.30.20
   5  allow dns    from untrust            to 192.168.30.10
   6  deny  any    from dmz                to trust
   7  allow ping   from 203.0.113.50       to dmz
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  the reply to a flow it allowed passes
```

## remove rule {#remove-rule}

```text
remove rule <n> [from] <device>
delete rule <n> [from] <device>
```

Toglie dall'elenco la regola numero `<n>`, con il numero che le dà `show rules`; le regole successive salgono di un posto. `delete` è uguale a `remove`, e dopo il numero si può scrivere `on` al posto di `from`.

| Parametro | Che cos'è |
|---|---|
| `<n>` | Il numero di una regola, da 1 |
| `<device>` | Il router o il firewall di cui è la regola |

```ncl sample=company
pixelcake> remove rule 2 from FW-Edge
FW-Edge: rule 2 removed — allow email from untrust to 192.168.30.40
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from untrust            to 172.16.0.10
   2  allow web    from 172.16.0.10        to 192.168.30.20
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  the reply to a flow it allowed passes
pixelcake> delete rule 1 on FW-Edge
FW-Edge: rule 1 removed — allow web from untrust to 172.16.0.10
pixelcake> remove rule 5 from FW-Edge
FW-Edge has no rule 5 (it has 1)
```

## Servizi {#services}

```text
ping   (also icmp)
web    (also http, https)
email  (also mail, smtp)
dns
any
```

I servizi che una regola o un inoltro possono nominare, e le parole con cui si scrive ciascuno. Maiuscole e minuscole non contano. `any` sta per tutti e quattro ed è ciò che significa una regola o un inoltro senza servizio; `all` è la stessa parola. `trace … as <service>` accetta i quattro servizi ma non `any` ([Interrogare](asking.md#trace)). Qualunque altra cosa, come `ssh` o il numero di una porta, viene rifiutata: il motore conosce questi quattro servizi, e nessun numero di porta.

```ncl sample=company
pixelcake> add rule allow gopher from any to any on FW-Edge
unknown command: "add rule allow gopher from any to any on FW-Edge"
  unknown service "gopher" (ping, web, email, dns or any) — try: add rule [<position>] allow|deny <service>|any from <source> to <destination> [on <device>]
  type "help" for the command list
pixelcake> add rule allow all from trust to untrust on FW-Edge
FW-Edge: rule 4 added — allow any from trust to untrust
```

## interface … nat {#nat}

```text
interface <n> nat [on] <device>
interface <n> nat off [on] <device>
```

Accende il NAT in uscita su una porta di un router o di un firewall: ciò che il dispositivo inoltra da quella porta esce con l'indirizzo della porta, e le risposte tornano al vero mittente. `nat off` lo spegne; `nat none` è uguale. Se la porta è già come richiesto, nessuno dei due fa nulla, e la risposta lo dice.

| Parametro | Che cos'è |
|---|---|
| `<n>` | Il numero di una porta di un router o di un firewall |

Una porta senza indirizzo viene accettata, e la risposta dice che non si traduce nulla finché non ne ha uno. Nel `trace`, la riga di quel dispositivo dice che cosa è stato tradotto (`NAT: source 192.168.10.12 → 203.0.113.1`, [NAT in uscita](../services/nat.md#source-nat)).

```ncl sample=company
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  web    from interface 3   (203.0.113.1) to 172.16.0.10
   2  email  from interface 3   (203.0.113.1) to 192.168.30.40
pixelcake> ping Cliente-Remoto from PC-Vendite
Pinging Cliente-Remoto (203.0.113.50) from PC-Vendite...
Reply from 203.0.113.50: hops=7 time=11ms
  note: request: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed
  note: request: Internet is not simulated: traffic assumed to pass
  note: reply: Internet is not simulated: traffic assumed to pass
  note: reply: firewall FW-Edge: no rule matches, zone policy untrust → trust allowed (reply to an allowed flow)
pixelcake> interface 3 nat off on FW-Edge
port 3 on FW-Edge no longer does NAT: what leaves by it keeps its own address
pixelcake> ping Cliente-Remoto from PC-Vendite
Pinging Cliente-Remoto (203.0.113.50) from PC-Vendite...
Ping failed (blocked): request: Internet does not carry private addresses: 192.168.10.12 has to be translated before it goes out, and NAT is off on port 3 on FW-Edge
  dropped at: Internet
  note: request: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed
pixelcake> interface 3 nat on FW-Edge
port 3 on FW-Edge now does NAT: what leaves by it takes the address 203.0.113.1
pixelcake> interface 3 nat on FW-Edge
port 3 on FW-Edge already does NAT
pixelcake> interface 4 nat on FW-Edge
port 4 on FW-Edge now does NAT
  it has no address yet: nothing is translated until it has one (interface 4 ip <address>)
pixelcake> interface 1 nat on SW-Core
NAT is set on the ports of a router or a firewall: SW-Core is a Switch
```

## add forward {#add-forward}

```text
add forward [<service>|any] from [interface] <n> to <address> [on] <device>
```

Pubblica all'esterno un servizio di un dispositivo interno: ciò che arriva all'indirizzo della porta `<n>`, per quel servizio, viene mandato all'indirizzo interno. Gli inoltri si leggono dall'alto e vale il primo che corrisponde ([inoltri](../services/nat.md#forwards)).

| Parametro | Che cos'è |
|---|---|
| `<service>` | Uno dei [servizi](#services), oppure `any`. Senza, l'inoltro vale per ogni servizio |
| `<n>` | Il numero della porta su cui arriva il traffico, che deve avere un indirizzo. Prima del numero si può scrivere `interface` o `port`, oppure niente |
| `<address>` | L'indirizzo interno, oppure un dispositivo: il comando scrive allora il suo indirizzo e dice quale |
| `<device>` | Il router o il firewall. Dentro `use <device>` si tralascia |

La risposta dà il numero dell'inoltro, l'indirizzo a cui il servizio si raggiunge da fuori e, quando serve, un avviso se un inoltro precedente prende già lo stesso traffico, e un promemoria: su un firewall serve anche una regola che lasci entrare il traffico ([con le regole di un firewall](../services/nat.md#with-rules)). Se il dispositivo ha già lo stesso inoltro, il comando lo dice e non aggiunge nulla.

```ncl sample=company
pixelcake> add forward ping from interface 3 to Portale-Clienti on FW-Edge
FW-Edge: forward 3 added — forward ping from interface 3 to 172.16.0.10
  Portale-Clienti → 172.16.0.10
  from outside it is reached at 203.0.113.1
pixelcake> ping Portale-Clienti from Cliente-Remoto
Pinging Portale-Clienti (203.0.113.1) from Cliente-Remoto...
Ping failed (blocked): request: firewall FW-Edge: no rule matches, zone policy untrust → dmz denied
  dropped at: FW-Edge
  note: request: Portale-Clienti is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 3)
  note: request: Internet is not simulated: traffic assumed to pass
pixelcake> add rule allow ping from untrust to Portale-Clienti on FW-Edge
FW-Edge: rule 4 added — allow ping from untrust to 172.16.0.10
  Portale-Clienti → 172.16.0.10
pixelcake> ping Portale-Clienti from Cliente-Remoto
Pinging Portale-Clienti (203.0.113.1) from Cliente-Remoto...
Reply from 203.0.113.1: hops=5 time=7ms
  note: request: Portale-Clienti is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 3)
  note: request: Internet is not simulated: traffic assumed to pass
  note: request: firewall FW-Edge: allowed by rule 4 (allow ping from untrust to 172.16.0.10)
  note: reply: firewall FW-Edge: no rule matches, zone policy dmz → untrust allowed
  note: reply: Internet is not simulated: traffic assumed to pass
pixelcake> add forward ping from port 3 to 172.16.0.10 on FW-Edge
FW-Edge already has it: forward 3
pixelcake> add forward web from 3 to Portale-Clienti on FW-Edge
FW-Edge already has it: forward 1
```

## remove forward {#remove-forward}

```text
remove forward <n> [from] <device>
delete forward <n> [from] <device>
```

Toglie dall'elenco l'inoltro numero `<n>`, con il numero che gli dà `show nat`. `delete` è uguale a `remove`, e `on` si può scrivere al posto di `from`.

| Parametro | Che cos'è |
|---|---|
| `<n>` | Il numero di un inoltro, da 1 |
| `<device>` | Il router o il firewall |

```ncl sample=company
pixelcake> remove forward 1 from FW-Edge
FW-Edge: forward 1 removed — forward web from interface 3 to 172.16.0.10
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  email  from interface 3   (203.0.113.1) to 192.168.30.40
pixelcake> remove forward 5 from FW-Edge
FW-Edge has no forward 5 (it has 1)
pixelcake> browse Portale-Clienti from Cliente-Remoto
Browsing Portale-Clienti (172.16.0.10) from Cliente-Remoto...
  ✗ HTTP request: Cliente-Remoto → Portale-Clienti
Browse failed (blocked): HTTP request: Internet does not carry private addresses: 172.16.0.10 is not reachable from outside: no port forward publishes it for web
  dropped at: Internet
```

## Quando un comando viene rifiutato {#refusals}

Un comando che non si può eseguire non cambia nulla, e dice perché, o che forma avrebbe dovuto avere:

```ncl sample=company
pixelcake> add rule 9 allow web from any to any on FW-Edge
FW-Edge has 3 rules: the position must be 1-4
pixelcake> add rule 0 allow web from any to any on FW-Edge
unknown command: "add rule 0 allow web from any to any on FW-Edge"
  rule positions start at 1 — try: add rule [<position>] allow|deny <service>|any from <source> to <destination> [on <device>]
  type "help" for the command list
pixelcake> add rule allow web from moon to any on FW-Edge
"moon" is not any, a zone (trust, untrust, dmz), an address, a network or a device
pixelcake> add rule allow web from any to Internet on FW-Edge
Internet has no address to write in a rule
pixelcake> add rule allow web from any to any on PC-Vendite
PC-Vendite is a PC: rules belong on routers and firewalls
pixelcake> remove rule 12 from FW-Edge
FW-Edge has no rule 12 (it has 3)
pixelcake> add forward web from interface 9 to 172.16.0.10 on FW-Edge
FW-Edge has no interface "9" (it has: ports 1-4)
pixelcake> add forward web from interface 4 to 172.16.0.10 on FW-Edge
interface 4 on FW-Edge has no address to publish
pixelcake> add forward web from interface 3 to Nessuno on FW-Edge
"Nessuno" is not an address or a device
pixelcake> add forward web from interface three to 172.16.0.10 on FW-Edge
unknown command: "add forward web from interface three to 172.16.0.10 on FW-Edge"
  a forward is published from a port: "three" is not a port number — try: add forward <service>|any from interface <n> to <address> [on <device>]
  type "help" for the command list
pixelcake> add forward web from interface 3 to 172.16.0.10 on PC-Vendite
PC-Vendite is a PC: forwards belong on routers and firewalls
pixelcake> remove forward 0 from FW-Edge
unknown command: "remove forward 0 from FW-Edge"
  forward number must be a number, got "0" — try: remove forward <n> [from <device>]
  type "help" for the command list
pixelcake> remove forward 1 from Router-Core
Router-Core has no forwards
```

## Vedi anche {#see-also}

- [Zone e regole del firewall](../services/firewall.md), [NAT e inoltri](../services/nat.md): le zone, la politica delle zone, le regole, la traduzione, e ciò che non è simulato.
- [Comandi show](show.md#show-rules): `show rules`, `show nat`, e `show ports` per le zone.
- [Interrogare](asking.md#trace): `trace … as <service>`, per vedere quale regola decide.
- [Interfacce e VLAN](interfaces-and-vlans.md#ip): l'indirizzo di una porta, che serve al NAT e agli inoltri.
