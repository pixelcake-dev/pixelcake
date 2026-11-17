---
title: "Che cos'è PixelCake"
description: "Un ambiente per progettare piccole reti, nel browser: disegni, configuri e chiedi se un dispositivo ne raggiunge un altro."
order: 1
---

PixelCake è un ambiente per progettare piccole reti, e funziona nel browser. Disegni la rete, la configuri, poi le fai una domanda: questo PC raggiunge quel server? Se non lo raggiunge, la risposta dice dove si ferma il pacchetto e perché.

Serve a ragionare su una rete, non a farla funzionare. Il disegno è un modello: dispositivi, cavi, indirizzi, VLAN, rotte, regole del firewall. La domanda trova risposta seguendo un pacchetto in quel modello, un dispositivo alla volta, e a ogni dispositivo la risposta dice che cosa ha deciso.

## Disegnare, configurare, chiedere, scrivere, presentare {#what-it-does}

Il lavoro ha cinque parti. Si possono fare in qualunque ordine, e ci si può tornare.

- **Disegnare.** Scegli i dispositivi da un pannello (un PC, uno switch, un router, un firewall, un server, un access point e altri, ognuno con il suo disegno) e li unisci con i cavi, trascinando da un dispositivo al successivo. I riquadri, rettangoli colorati con un nome, raggruppano ciò che sta insieme. Vedi [Dispositivi](../building/devices.md) e [Cavi](../building/cables.md).
- **Configurare.** Dai gli indirizzi ai dispositivi, dividi le porte di uno switch in VLAN, scrivi le rotte, metti zone e regole su un firewall, traduci gli indirizzi con il NAT, distribuisci indirizzi con il DHCP e nomi con il DNS. Ognuna di queste cose è una scheda della finestra del dispositivo o un comando del terminale. Vedi [Indirizzi](../building/addresses.md), [VLAN](../building/vlans.md) e la sezione su [servizi e sicurezza](../services/routes.md).
- **Chiedere.** Nel pannello «Simulazione» scegli una partenza, una destinazione e un tipo di traffico, e premi il pulsante. Il pacchetto percorre il disegno. Se arriva, la destinazione diventa verde. Se non arriva, l'animazione si ferma sul dispositivo che l'ha scartato, che diventa rosso, e un messaggio dice il motivo: la porta, la rotta o la regola. Vedi [Il pannello Simulazione](../asking/simulation-panel.md).
- **Scrivere.** Il terminale ha un piccolo linguaggio di comandi, uguale per ogni dispositivo: `ping`, `trace`, `show routes`, `add rule`, `interface 3 access 10`. I comandi che cambiano la rete modificano lo stesso disegno che vedi. Vedi il [riferimento del terminale](../terminal/index.md).
- **Presentare.** La modalità presentazione mette via gli strumenti per disegnare. Clicchi due dispositivi per fare una domanda, poi rompi un dispositivo o un cavo e vedi subito quali comunicazioni si interrompono e quali passano da un'altra strada. Il disegno non cambia. Vedi [La modalità presentazione](../asking/presentation.md).

Ecco una domanda e la sua risposta sulla rete di esempio di una piccola azienda, prima quando il PC ha il gateway giusto, poi quando il suo gateway è un indirizzo che non ha nessuno:

```ncl sample=company
pixelcake> ping Web-Gestionale from PC-Vendite
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> set gateway of PC-Vendite to 192.168.10.254
PC-Vendite: gateway set to 192.168.10.254
pixelcake> ping Web-Gestionale from PC-Vendite
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Ping failed (blocked): request: PC-Vendite uses gateway 192.168.10.254, but Router-Core port 1 on its network is 192.168.10.1
  dropped at: PC-Vendite
```

Il terminale parla inglese anche nell'interfaccia in italiano. La risposta dice su quale dispositivo si è fermato il pacchetto e perché, quindi c'è qualcosa da correggere.

![La rete di esempio di una piccola azienda: Internet, l'Edge con un firewall e una DMZ, il Core con un router e due switch, gli Uffici con un PC, una stampante e un access point con due portatili, e i Server. PC-Vendite, negli Uffici, ha il bordo rosso: è dove si è fermato l'ultimo ping.](../../media/getting-started/company-sample.it.png "La rete di esempio dell'azienda dopo il secondo ping: PC-Vendite è rosso, dove si è fermato il pacchetto.")

## Per chi è {#who-it-is-for}

Per chi progetta o spiega una piccola rete:

- studenti che imparano come stanno insieme indirizzi, VLAN, rotte e firewall, e possono cambiare una cosa e vedere che cosa succede;
- insegnanti che vogliono un disegno che risponde, da mostrare su uno schermo o da mandare come immagine;
- tecnici che vogliono ragionare su una modifica prima di farla, per esempio che cosa fanno al resto della rete una regola nuova o un cavo tagliato.

La misura per cui è fatto è una rete di qualche decina di dispositivi. La rete di esempio della multinazionale, con 181 dispositivi su dieci sedi, mostra che regge anche un disegno grande.

## Che cosa non è {#what-it-is-not}

PixelCake non è un simulatore a livello di pacchetto: non ha ARP, né apprendimento dei MAC, né instradamento dinamico, e il tempo di un ping è calcolato dal numero di salti. Non è uno strumento per validare una rete vera: una risposta positiva qui vuol dire che il modello che hai disegnato lascia passare il pacchetto, non che lo farà la tua apparecchiatura. Quello che non simula è elencato in [Limiti e domande](../reference/limits-and-faq.md#not-simulated), e ogni pagina lo dice dove serve.

## Dove funziona {#where-it-runs}

Nel browser, senza account e senza server. Quello che disegni non esce dal tuo computer. Il lavoro resta nel browser mentre disegni, e si salva per sempre in un file che scegli tu: [Salvare, aprire, i file](saving-and-files.md) spiega come, e che cosa succede a ciò che non è stato salvato quando si cancellano i dati del browser.

## Open source {#open-source}

PixelCake è rilasciato con la GNU Affero General Public License v3.0, e la documentazione sta nello stesso repository. Il codice è su [github.com/pixelcake-dev/pixelcake](https://github.com/pixelcake-dev/pixelcake). Per segnalare un problema, [apri una segnalazione](https://github.com/pixelcake-dev/pixelcake/issues); [Limiti e domande](../reference/limits-and-faq.md#report) dice che cosa scriverci. Le licenze di ciò che l'applicazione include sono in [Licenze](../reference/licences.md).

## Dove andare dopo {#next}

Disegna [la tua prima rete](first-network.md): bastano cinque minuti, e finisce con una domanda che trova risposta e una che viene rifiutata. Poi guarda [l'interfaccia](interface.md).
