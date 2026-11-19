---
title: "Importare ed esportare in YAML"
description: "La rete di un canvas in YAML, da copiare, scaricare e ricaricare; e la bozza Terraform."
order: 2
---

I dispositivi e le connessioni del canvas aperto si possono scrivere come testo YAML, copiare o scaricare, e rileggere da un file `.yaml` o `.yml`. È un modo per guardare una rete come testo, per tenerla in un repository, o per costruirne una con uno script. Non è il modo di salvare un progetto: lo YAML contiene la rete, il punto in cui è disegnato ogni dispositivo e i riquadri, e non le impostazioni, i template o gli altri canvas; [il file del progetto](project-file.md) contiene tutto. La stessa finestra offre anche un'esportazione Terraform, che è soltanto una bozza ([più sotto](#limits)).

## Esportare {#export}

«Import/Export», nella barra a sinistra, apre la finestra; la prima scheda è l'esportazione. «Formato:» sceglie tra YAML e «Terraform HCL (bozza)». Il testo è mostrato come verrà scritto, con il numero di righe e il numero di dispositivi e di connessioni del canvas. «Copia negli appunti» lo copia; il secondo pulsante lo scarica come `<nome del progetto>-topology.yaml`, con il nome in minuscolo e ogni carattere che non sia una lettera, una cifra, un trattino o un trattino basso trasformato in un trattino. Un canvas senza dispositivi non ha nulla da esportare, e i due pulsanti sono disattivati.

Si esporta solo il canvas aperto. Un progetto con più canvas si esporta un canvas alla volta, cambiando canvas e riaprendo la finestra.

I riquadri del canvas sono scritti anch'essi, insieme alla posizione di ogni dispositivo, così un riquadro resta intorno ai suoi dispositivi quando il file viene ricaricato. I riquadri sono scritti anche se sono nascosti (Vista → «Mostra i riquadri»).

## Importare {#import}

La seconda scheda serve a caricare un file: lo si trascina nella zona indicata, oppure ci si fa clic per sceglierlo. Si accettano solo `.yaml` e `.yml`; per qualunque altro file compare l'avviso `Formato non supportato. Usa un file .yaml o .yml.` Non cambia ancora nulla: la finestra mostra il nome del file, quanti dispositivi e quante connessioni contiene, l'elenco «Dispositivi trovati» con il tipo e l'indirizzo di ciascuno e, se il file ha dei problemi, l'elenco «Avvisi».

«Modalità:» dice dove vanno i dispositivi:

- «Sostituisci topologia» svuota prima il canvas, dispositivi, connessioni e riquadri, e carica il file al suo posto. Se sul canvas c'è qualcosa, prima arriva una domanda: «Sostituire la topologia?», che dice quanti dispositivi, connessioni e riquadri verranno tolti. «Sostituisci» prosegue, «Annulla» o Esc lasciano il canvas com'è. Modifica → «Annulla», o Ctrl + Z, rimette il canvas com'era, in un passo solo. Le impostazioni di rete del progetto e i nomi delle sue VLAN non vengono toccati.
- «Aggiungi alla topologia» lascia ciò che c'è sul canvas e aggiunge i dispositivi, le connessioni e i riquadri del file, con ID nuovi. Il gruppo nuovo va a destra del disegno che c'è già, allineato in alto con esso e a 120 unità di distanza, quindi non finisce mai sopra ciò che hai disegnato; la disposizione dentro il gruppo, e i riquadri intorno ai suoi dispositivi, restano quelle del file. Un dispositivo il cui nome è già sul canvas riceve il primo nome libero (`PC-1` diventa `PC-1-1`), e un avviso dice quali.

«Importa» esegue l'importazione, e un avviso dice quanti dispositivi e quante connessioni sono stati aggiunti. Il pulsante resta disattivato se il file non contiene nessun dispositivo.

Un file scritto dall'app dice dove è disegnato ogni dispositivo (`position`). Un file che non lo dice, per esempio uno scritto a mano o da uno script, ha i dispositivi disposti su una griglia: tante colonne quanto la radice quadrata del numero, arrotondata per eccesso, a 250 unità l'una dall'altra in orizzontale e 200 in verticale, a partire da 100, 100, nell'ordine del file. Vista → Disposizione automatica rimette in ordine il disegno (chiede prima, e Ctrl + Z la annulla).

L'importazione accetta il file come lo scrive l'app, con tutto sotto una chiave `pixelcake:`, e anche le stesse liste all'inizio del file senza `pixelcake:` intorno. Ciò che manca prende un valore predefinito: un dispositivo senza nome si chiama `Device-1`, `Device-2`…, uno senza tipo è un `PC`, un'interfaccia senza stato è accesa. Ciò che non va viene detto negli avvisi:

| Avviso | Quando |
|---|---|
| `Errore di lettura del file YAML: …` | Il testo non è YAML; segue il motivo del lettore, con la riga. |
| `Il file YAML non contiene dati validi` | Il file è vuoto, oppure è un valore solo. |
| `Struttura YAML non riconosciuta` | La chiave `pixelcake:` contiene qualcosa che non è un insieme di campi. |
| `Nessun dispositivo trovato nel file` | Non c'è la lista `devices`, o è vuota. |
| `Dispositivo 3: formato non valido, ignorato` | Una voce di `devices` non è un insieme di campi. |
| `Router-1: IP "abc" non valido` | L'indirizzo di un dispositivo o di una porta non è fatto di quattro gruppi di al massimo tre cifre. Si controlla solo la forma: `300.1.1.1` passa. |
| `Porta 1: VLAN 5000 fuori intervallo (1–4094), non importata` | Una VLAN di una porta, di un dispositivo (`SW-1: VLAN …`) o di una connessione (`Connessione 3: VLAN …`) è fuori dall'intervallo. Non viene importata; le altre dell'elenco sì. |
| `Nomi usati più volte, …` | Due dispositivi hanno lo stesso nome, confrontato come lo confronta il terminale: senza badare alle maiuscole né agli spazi intorno. Il primo tiene il nome, ognuno dei successivi riceve il primo nome libero, `PC-1-1`, `PC-1-2`…, e l'avviso elenca ogni "vecchio" → "nuovo". Le connessioni che citano quel nome vanno al primo dispositivo. |
| `Riquadro 2: senza posizione o dimensioni, ignorato` | Una voce di `areas` non ha `position` e `size`, o ne ha di non disegnabili. |
| `FW-Edge: regola 2 incompleta o non valida, ignorata` | Una regola ha bisogno di `allow` o `deny`, di un servizio e di entrambe le estremità. Per rotte, inoltri e record DNS l'avviso è dello stesso tipo (`rotta 1 senza destinazione o prossimo salto`, `inoltro 1 incompleto o non valido`, `record DNS 1 senza nome o indirizzo`). Gli altri tengono il loro ordine. |
| `Porta 2: server DHCP senza primo o ultimo indirizzo, ignorato` | Un intervallo DHCP senza `start` o senza `end`. |
| `Connessione 4: dispositivo di partenza «PC-9» non trovato` | Una connessione nomina un dispositivo che il file non ha (così anche per la destinazione). La connessione viene lasciata fuori. |
| `Connessione 2: porta 3 non trovata su «A», estremità non assegnata` | La porta, o la scheda, nominata da una connessione non è su quel dispositivo. La connessione resta, e all'estremità viene assegnata un'interfaccia libera quando il file viene caricato. |
| `Connessione 2: porta 1 di «B» già usata da un'altra connessione, estremità non assegnata` | Due connessioni nominano la stessa interfaccia. La prima la tiene. |

Un file con degli avvisi si può importare lo stesso: ciò che non va viene lasciato fuori e il resto viene letto.

## I campi {#fields}

L'inizio del file in cui viene esportata la rete di esempio «Ufficio: due reti e un router»:

```yaml
# PixelCake Topology Export
# Generated: 2026-11-17
# Devices: 7 | Connections: 6

pixelcake:
  version: "1.0"
  project: Progetto senza nome
  exported: 2026-11-17

  devices:
    - name: Router-1
      type: Router
      template_id: tpl-router
      ip: 192.168.10.1
      subnet: 255.255.255.0
      location: Sala server
      ports:
        - id: 1
          name: LAN Uffici
          enabled: true
          ip: 192.168.10.1
          subnet: 255.255.255.0
          speed: auto
          mode: lan
        …
  connections:
    - source: PC-1
      target: SW-Office
      source_nic: eth0
      target_port: 1
      type: access
      bandwidth: 1 Gbps
    …
```

Le righe di commento in alto e `version`, `project` e `exported` servono a chi legge il file: l'importazione non li usa. Una connessione nomina i suoi due dispositivi per nome, e la porta o la scheda a ciascuna estremità: `source_port: 8` per una porta, `source_nic: eth0` per una scheda (con il suo nome).

Che cosa contiene un dispositivo, quando ce l'ha: `type`, `template_id` (che tipo di server o di storage è), `ip`, `subnet`, `gateway`, `vendor`, `location`, `notes`, `vlan` (l'elenco del dispositivo), `stp`, `position` (dove è disegnato, come `{x: 100, y: 50}`, scritta per ultima), e poi le liste. Una porta ha `id`, `name`, `enabled`, `ip`, `subnet`, `speed`, `mode`, `vlan` (un numero per una porta di accesso, una lista per un trunk), `poe`, `nat`, `dhcp_server`, `security_zone`, `description`. Una scheda ha `name`, `enabled`, `ip`, `subnet`, `gateway`, `dns`, `speed`, `mac`, `description`, e `dhcp: true` al posto degli indirizzi quando prende i suoi da un server. Le liste sono `routes` (`destination`, `via`), `firewall_rules`, `port_forwards` e `dns_records`.

Regole e inoltri sono scritti nell'ordine in cui vengono letti, che è l'ordine che conta:

```yaml
      routes:
        - destination: 192.168.0.0/16
          via: 10.0.0.1
          description: reti interne
      firewall_rules:
        - action: allow
          service: web
          from: untrust
          to: 172.16.0.10
          description: portale clienti
        - action: allow
          service: email
          from: untrust
          to: 192.168.30.40
          description: posta in arrivo
      port_forwards:
        - service: web
          interface: 3
          to: 172.16.0.10
          description: portale clienti
```

È una parte di FW-Edge nella rete dell'azienda. L'indirizzo che una scheda riceve dal DHCP non si scrive mai, e nemmeno l'indirizzo che corrisponde a un nome: si ricavano dal disegno.

I riquadri vengono dopo le connessioni, uno per voce, con l'etichetta, il colore (`slate`, `green`, `amber`, `red`, `violet` o `teal`), l'angolo in alto a sinistra e le dimensioni, nelle stesse unità delle posizioni dei dispositivi:

```yaml
  areas:
    - label: Core
      color: violet
      position: {x: 80, y: 20}
      size: {width: 300, height: 200}
```

## Limiti {#limits}

> [!LIMITS]
> - **Lo YAML non è il progetto.** Lascia fuori le impostazioni di rete del progetto, i nomi delle VLAN, i template personalizzati, il colore di una connessione e gli altri canvas. Per conservare un progetto si salva il file del progetto.
> - **I nomi sono le chiavi.** Una connessione trova i suoi dispositivi per nome, quindi due dispositivi con lo stesso nome non si distinguono: chi legge rinomina i successivi e lo dice, e una connessione che cita il nome in comune va al primo. Un nome che lo YAML leggerebbe come numero o come booleano, come `10`, `1.50` o `true`, viene tenuto come il testo con cui è stato scritto, e l'app lo scrive tra virgolette.
> - **Si controlla solo la forma.** Una maschera, un gateway, una zona, un servizio o un tipo che l'app non conosce viene letto così com'è: un dispositivo di tipo `Banana` viene importato. La simulazione lo tratta poi come può.
> - **L'esportazione Terraform è una bozza.** Scrive tipi di risorsa segnaposto (`network_switch`, `compute_instance`…) e non nomina nessun provider, quindi `terraform apply` non ha nulla a cui applicarla. Contiene indirizzi, VLAN, porte, schede, record DNS e connessioni, e lascia fuori rotte, regole del firewall, inoltri e note. Due dispositivi i cui nomi differiscono solo per la punteggiatura (`PC 1` e `PC-1`) ricevono lo stesso nome di risorsa, e le virgolette in un nome non vengono protette. Serve a mostrare dove va il progetto, non a essere usata.
> - **Non c'è l'importazione di Terraform.** Leggere un file `.tfstate`, o un qualsiasi file Terraform, non è previsto: si importa solo YAML.
