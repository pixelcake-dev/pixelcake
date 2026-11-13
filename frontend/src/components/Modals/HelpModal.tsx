/**
 * Help Modal — the guide of the application, in three tabs:
 * how to use it, the terminal commands, and what the application is.
 *
 * The tab shown is in the UI store (`helpTab`), so that each entry of the
 * Help menu can open the guide where it should (`openHelp(tab)`).
 *
 * The command list is not written here: it is rendered from the table the
 * terminal's own `help` command prints (COMMAND_REFERENCE), so the two can
 * never disagree. Whoever changes a behaviour described in "Come si usa"
 * must change that text too: every sentence there states something the
 * application really does.
 */

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Icon } from '@iconify/react';
import { Modal } from '@/components/ui/Modal';
import Logo from '@/components/ui/Logo';
import { useUIStore, type HelpTab } from '@/store/uiStore';
import { COMMAND_REFERENCE } from '@/terminal/executor';
import { GITHUB_REPO } from '@/constants/links';
import { APP_MOTTO, APP_NAME } from '@/constants/brand';

const TABS: Array<{ id: HelpTab; label: string }> = [
  { id: 'guide', label: 'Come si usa' },
  { id: 'commands', label: 'Comandi del terminale' },
  { id: 'about', label: 'Informazioni' },
];

/* ── "Come si usa" ────────────────────────────────────────────────────── */

const Step = ({ title, children }: { title: string; children: ReactNode }) => (
  <li>
    <p className="font-semibold text-[var(--text-color)]">{title}</p>
    <p className="mt-1">{children}</p>
  </li>
);

/** Something to type, or the name of a file: shown in monospace */
const Mono = ({ children }: { children: ReactNode }) => (
  <code className="font-mono text-[0.9em] px-1 rounded bg-[var(--bg-canvas)]">{children}</code>
);

const GuideTab = () => (
  <div className="settings-panel text-sm leading-relaxed text-[var(--text-color-light)]">
    <p className="mb-4">
      PixelCake serve a disegnare una piccola rete, configurarla e verificare se un dispositivo ne
      raggiunge un altro.
    </p>

    <ol className="list-decimal pl-5 space-y-4">
      <Step title="Aggiungi i dispositivi">
        Nella barra a sinistra apri «Aggiungi Dispositivo» (il pulsante +) e scegli un tipo
        dall&apos;elenco: controlla il nome e conferma, l&apos;indirizzo IP viene proposto in
        automatico. Il dispositivo compare al centro della parte di canvas che stai guardando.
        «Aggiungi in Blocco» ne crea molti in una volta. Nella scheda
        «Topologie» dello stesso pannello ci sono quattro reti di esempio già pronte: quella di
        una piccola azienda (la stessa della schermata iniziale), una semplice, una con VLAN, DMZ
        e firewall, e una con due sedi e una linea di riserva. Caricarne una prende il posto di
        quanto è sul canvas.
      </Step>

      <Step title="Spostali e selezionali">
        Trascina un dispositivo per spostarlo. Con Ctrl + clic ne selezioni più di uno, trascinando
        su un&apos;area vuota disegni un riquadro di selezione. Trascinando con il tasto destro su
        un&apos;area vuota sposti la vista, con la rotellina fai lo zoom. Tutte le scorciatoie sono
        in Impostazioni → Avanzate.
      </Step>

      <Step title="Collegali">
        Ogni dispositivo ha quattro punti di connessione, uno per lato: compaiono quando ci passi
        sopra con il mouse o lo selezioni. Trascina da un punto fino a un punto di un altro
        dispositivo: a ciascun capo il collegamento viene assegnato a una porta
        o a una scheda di rete libera. Su un firewall con zone di sicurezza la porta va scelta a
        mano. Con un clic destro sul collegamento, «Modifica Connessione» permette di cambiare le
        interfacce, il tipo, la banda, l&apos;etichetta e il colore.
      </Step>

      <Step title="Configurali">
        Un doppio clic su un dispositivo ne apre la scheda (la stessa di clic destro → «Dettagli
        (Modifica)»): nome, indirizzo IP, subnet mask e gateway. Switch, router e firewall hanno
        anche la scheda «Porte», dove si configura ogni singola porta. Gli altri dispositivi hanno
        «Schede di rete», ed è lì che se ne cambia l&apos;indirizzo. Le modifiche valgono solo dopo
        aver premuto «Salva».
      </Step>

      <Step title="Instrada tra le reti">
        Ogni porta di un router o di un firewall può avere un indirizzo (scheda «Porte»): è il
        gateway dei dispositivi collegati lì, e la rete di quella porta è raggiunta senza altro. Le
        reti che stanno dietro un altro router si scrivono nella scheda «Rotte», con l&apos;indirizzo
        del prossimo salto; il gateway del router è la sua rotta predefinita. La stessa scheda mostra
        la tabella di instradamento che ne risulta. Serve una rotta anche per il ritorno. Una
        seconda rotta per la stessa rete è di riserva: subentra quando la linea della prima è giù.
      </Step>

      <Step title="Separa con le VLAN">
        Nella scheda «Porte» di uno switch ogni porta è di accesso, in una VLAN, oppure trunk, e
        trasporta più VLAN con l&apos;etichetta. Due porte in VLAN diverse non si parlano: per farle
        comunicare serve un router con una porta in ciascuna. Appena una porta ha una VLAN, quelle
        che non hai toccato sono nella VLAN 1.
      </Step>

      <Step title="Filtra con il firewall">
        Le porte di un firewall si mettono in una zona: trust, untrust o dmz. Senza regole decide
        la politica delle zone: verso una zona più fidata il traffico è negato, il resto passa.
        Nella scheda «Regole» si scrivono le eccezioni, lette dall&apos;alto in basso: decide la
        prima che corrisponde, per servizio (ping, web, email, DNS), origine e destinazione. La
        risposta a un flusso permesso passa sempre.
      </Step>

      <Step title="Esci su Internet con il NAT">
        Un simbolo Cloud chiamato «Internet» non trasporta gli indirizzi privati (10.x, 172.16-31.x,
        192.168.x): chi sta dentro non esce e chi sta fuori non entra, finché un router o un
        firewall non traduce gli indirizzi. Nella scheda «Porte» attiva «NAT Abilitato» sulla porta
        rivolta a Internet: ciò che esce prende l&apos;indirizzo di quella porta, e la risposta
        torna a chi aveva chiesto. Per raggiungere da fuori un server che sta dentro, nella scheda
        «NAT» premi «Aggiungi inoltro»: servizio, porta su cui arriva, indirizzo interno. Chi è
        fuori chiede all&apos;indirizzo della porta e la risposta gli torna da lì. Su un firewall
        serve anche la regola che lo permette, nella scheda «Regole». La rete di esempio della
        schermata iniziale è fatta così.
      </Step>

      <Step title="Dai gli indirizzi con il DHCP">
        Un dispositivo può prendere l&apos;indirizzo da solo: nella scheda «Schede di rete», alla
        voce «Indirizzo», scegli «Automatico (DHCP)» al posto di «Manuale». Glielo dà un server
        DHCP della stessa rete: una porta di router o di firewall, oppure la scheda di un server,
        con «Server DHCP Abilitato» e l&apos;intervallo da «Primo indirizzo» a «Ultimo indirizzo».
        Con l&apos;indirizzo arrivano la subnet mask e il gateway. Gli indirizzi si calcolano dal
        disegno, sempre allo stesso modo: i dispositivi vengono serviti nell&apos;ordine in cui
        compaiono e ciascuno prende il primo indirizzo libero, saltando quelli scritti a mano. La
        scheda «DHCP» del server elenca chi ha preso quale indirizzo, e sul disegno un indirizzo
        assegnato è seguito da «DHCP». Una scheda che non trova un server resta senza indirizzo,
        e la sua finestra dice perché. Un router non passa la richiesta a un&apos;altra rete: il
        relay non è simulato, e nemmeno le prenotazioni e le scadenze. Nella rete di esempio della
        schermata iniziale i due portatili prendono l&apos;indirizzo così, da Router-Core.
      </Step>

      <Step title="Chiama i dispositivi per nome con il DNS">
        Un server può fare da server DNS: nella sua scheda «DNS» premi «Aggiungi record» e scrivi
        un nome, per esempio <Mono>gestionale.azienda.example</Mono>, e l&apos;indirizzo a cui
        corrisponde. A chi chiedere lo decide ogni dispositivo: nella scheda «Schede di rete» il
        campo «Server DNS» contiene l&apos;indirizzo del server. Chi prende l&apos;indirizzo dal
        DHCP riceve anche quello, se nel server DHCP è compilato «Server DNS consegnato
        (opzionale)». Un nome si usa nel terminale al posto di un indirizzo:{' '}
        <Mono>ping gestionale.azienda.example from PC-Vendite</Mono> chiede prima l&apos;indirizzo
        al server DNS, con una domanda che attraversa la rete come ogni altro scambio e può
        fermarsi allo stesso modo, e poi fa il ping;{' '}
        <Mono>resolve gestionale.azienda.example from PC-Vendite</Mono> fa soltanto la domanda.
        Per un firewall la domanda è il servizio «DNS», che si sceglie nelle regole e negli
        inoltri. Nulla viene ricordato: il nome viene chiesto di nuovo ogni volta. Non sono
        simulati un secondo server DNS di riserva, l&apos;inoltro ad altri server e la ricerca
        inversa; la simulazione e la presentazione scelgono i dispositivi dai menu e non usano i
        nomi. Nella rete di esempio della schermata iniziale Srv-Auth conosce tre nomi, gli uffici
        e i portatili chiedono a lui, e Cliente-Remoto non ha nessuno a cui chiedere.
      </Step>

      <Step title="Chiedi se un dispositivo ne raggiunge un altro">
        Apri «Simulazione» (il pulsante con il fulmine), scegli «Partenza», «Destinazione» e il
        «Modello di Flusso» (ping, email, pagina web o download), poi premi «Avvia Simulazione». Il
        pacchetto percorre la rete sul disegno. Se non arriva, l&apos;animazione si ferma dove il
        traffico viene bloccato e un messaggio ne spiega il motivo: quale apparato, quale porta,
        quale rotta o quale regola.
      </Step>

      <Step title="Usa il terminale">
        «Console», nella barra a sinistra, apre il terminale. Con un clic destro su un dispositivo →
        «Console» si apre già posizionato su quel dispositivo. I comandi sono in inglese, per
        esempio, sulla rete di esempio della schermata iniziale,{' '}
        <Mono>ping Web-Gestionale from PC-Vendite</Mono>,{' '}
        <Mono>trace Web-Gestionale from Portatile-1 as web</Mono> oppure{' '}
        <Mono>show routes Router-Core</Mono>. Quelli che cambiano la rete, come{' '}
        <Mono>add route 192.168.40.0/24 via 10.0.0.2 on Router-Core</Mono>, modificano lo stesso
        disegno che vedi. L&apos;elenco è nella scheda «Comandi del terminale».
      </Step>

      <Step title="Presenta la rete">
        «Presenta», in alto a destra, mette via gli strumenti per disegnare: resta il disegno,
        adattato alla finestra e non più modificabile con il mouse, con un pannello accanto. Un
        clic su un dispositivo apre un piccolo menu: «Parti da qui» e «Arriva qui» scelgono i due
        capi della domanda, che si possono scegliere anche dai menu «Da» e «A» del pannello. Scelto
        il tipo di scambio (Ping, Web o Email) il pacchetto parte da solo e il pannello dice se
        arriva, per quali dispositivi passa e, se si ferma, dove e perché. Nella barra in alto si
        regola la velocità del pacchetto, si apre il terminale e si passa a schermo intero. Si esce
        con «Esci» o con il tasto Esc.
      </Step>

      <Step title="Chiedi cosa succede se qualcosa si rompe">
        In presentazione, un clic su un dispositivo o su un cavo e poi «Simula un guasto» lo
        considera rotto. Il disegno non cambia, e all&apos;uscita il guasto sparisce. La domanda
        sullo schermo viene rifatta subito: se c&apos;è un&apos;altra strada il pacchetto la prende,
        altrimenti si ferma e il pannello dice dove. Tra switch la strada è la più corta che
        funziona; un router passa alla rotta di riserva quando la linea della rotta principale è
        guasta. Sotto «Guasti simulati» c&apos;è l&apos;effetto sul resto della rete: quante
        comunicazioni tra i dispositivi finali si interrompono, quante passano da un&apos;altra
        strada, quante non cambiano. Un clic su una di esse la mostra. La rete di esempio «Due
        sedi: linea principale e di riserva» è fatta per provarlo. Lo spanning tree non è
        simulato.
      </Step>

      <Step title="Esporta il disegno come immagine">
        File → Esporta immagine… mostra l&apos;anteprima del disegno intero, senza selezioni né
        punti di connessione. Scegli il formato: PNG, per documenti, presentazioni e messaggi, in
        tre dimensioni, oppure SVG, vettoriale. Scegli il tema, chiaro o scuro qualunque sia quello
        dello schermo, e con «Nome del progetto in alto» e «Sfondo trasparente» cosa c&apos;è
        intorno al disegno. «Salva PNG…» chiede dove salvare il file; nei browser che non possono
        chiederlo il pulsante è «Scarica PNG». Dove il browser lo permette, «Copia negli appunti»
        lascia l&apos;immagine pronta da incollare. In presentazione la stessa finestra si apre dal
        pulsante «Esporta immagine» della barra in alto: l&apos;immagine mostra i guasti simulati e
        il percorso della risposta e, con «Domanda e risposta sotto il disegno», riporta la domanda
        e la sua risposta.
      </Step>

      <Step title="Dividi il progetto in canvas">
        Un progetto può avere più canvas. In «Explorer», il primo pulsante della barra a sinistra,
        ne aggiungi con «Nuovo Canvas», li rinomini, li elimini (ne resta sempre almeno uno) e passi
        dall&apos;uno all&apos;altro con un clic. Lì si cambiano anche il nome e la descrizione del
        progetto.
      </Step>

      <Step title="Salva su file">
        Il lavoro resta nel browser anche dopo aver ricaricato la pagina. Per conservarlo, o per
        portarlo su un altro computer, usa File → Salva (Ctrl + S): il progetto, con tutti i suoi
        canvas, viene scritto in un file <Mono>.pixelcake.json</Mono> che si riapre con File →
        Apri…. In Chrome e in Edge il file scelto viene aggiornato a ogni salvataggio, negli altri
        browser viene scaricato.
      </Step>

      <Step title="Importa ed esporta in YAML">
        «Import/Export», nella barra a sinistra, esporta in YAML la rete del canvas aperto, da
        copiare o da scaricare, e la ricarica da un file <Mono>.yaml</Mono> o <Mono>.yml</Mono>, al
        posto di quella presente oppure in aggiunta. L&apos;esportazione Terraform è soltanto una
        bozza e non si può applicare.
      </Step>
    </ol>

    <p className="modal-info-box mt-6">
      PixelCake è un prototipo: serve a ragionare su una piccola rete, non a validarne una reale.
    </p>
  </div>
);

/* ── "Comandi del terminale" ──────────────────────────────────────────── */

const CommandsTab = () => (
  <div className="settings-panel text-sm">
    <p className="mb-4 leading-relaxed text-[var(--text-color-light)]">
      Lo stesso elenco compare scrivendo <Mono>help</Mono> nel terminale. I nomi dei dispositivi non
      distinguono maiuscole e minuscole e possono essere di più parole. Dove un comando chiede una
      destinazione si può scrivere anche un nome come <Mono>www.azienda.example</Mono>: il
      dispositivo di partenza ne chiede prima l&apos;indirizzo al proprio server DNS.
    </p>

    <table className="w-full border-collapse">
      <thead>
        <tr className="text-left border-b border-[var(--border-color)]">
          <th scope="col" className="py-2 pr-4 font-semibold">
            Comando
          </th>
          <th scope="col" className="py-2 font-semibold">
            Cosa fa
          </th>
        </tr>
      </thead>
      <tbody>
        {COMMAND_REFERENCE.map(([syntax, description]) => (
          <tr key={syntax} className="border-b border-[var(--border-color)] align-top">
            <td className="py-2 pr-4 font-mono text-xs text-[var(--text-color)]">{syntax}</td>
            <td className="py-2 text-[var(--text-color-light)]">{description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ── "Informazioni" ───────────────────────────────────────────────────── */

const AboutRow = ({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) => (
  <div className="flex items-center gap-3">
    <Icon icon={icon} className="text-[var(--accent-color)] flex-shrink-0" width={24} />
    <div>
      <p className="font-semibold">{title}</p>
      <div className="text-sm text-[var(--text-color-light)]">{children}</div>
    </div>
  </div>
);

const AboutTab = () => (
  <div className="settings-panel">
    <div className="space-y-3">
      <AboutRow icon="mdi:application" title={APP_NAME}>
        Ambiente visuale per disegnare una piccola rete e verificarla
      </AboutRow>

      <AboutRow icon="mdi:tag" title="Versione">
        0.1.0 (Beta)
      </AboutRow>

      <AboutRow icon="mdi:license" title="Licenza">
        AGPL-3.0, open source
      </AboutRow>

      <AboutRow icon="mdi:github" title="Repository">
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent-color)] hover:underline"
        >
          {GITHUB_REPO.replace('https://', '')}
        </a>
      </AboutRow>

      <AboutRow icon="mdi:code-tags" title="Tecnologie">
        React 19, TypeScript, Vite, Zustand, React Flow, Tailwind CSS
      </AboutRow>
    </div>
  </div>
);

/* ── the modal ────────────────────────────────────────────────────────── */

const HelpModal = () => {
  const isOpen = useUIStore(state => state.modals.help);
  const activeTab = useUIStore(state => state.helpTab);
  const setHelpTab = useUIStore(state => state.setHelpTab);
  const closeModal = useUIStore(state => state.closeModal);

  const handleClose = () => {
    closeModal('help');
    // Back to the first tab, like the settings: whoever opens the guide
    // without asking for a tab starts from "Come si usa"
    setHelpTab('guide');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title=""
      size="md"
      variant="tabbed"
      autoHeight={true}
      minHeight={undefined}
      maxHeight="calc(90vh - 120px)"
      verticalAlign="start"
      fixedContent={
        <>
          {/* Header with Title and Close Button */}
          <div className="modal-header flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
            <h3 className="text-lg font-semibold">Guida</h3>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-[var(--bg-canvas)] rounded transition-colors"
              aria-label="Chiudi la guida"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Sezioni della guida"
            className="settings-tabs px-6 pt-2 pb-3 border-b border-[var(--border-color)]"
          >
            {TABS.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setHelpTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </>
      }
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <div className="flex items-center justify-center gap-2 w-full">
            <Logo size={24} />
            <p className="text-sm text-[var(--text-color-light)] italic">«{APP_MOTTO}»</p>
          </div>
        </div>
      }
    >
      {/* Tab Content */}
      <div className="settings-content" role="tabpanel">
        {activeTab === 'guide' && <GuideTab />}

        {activeTab === 'commands' && <CommandsTab />}

        {activeTab === 'about' && <AboutTab />}
      </div>
    </Modal>
  );
};

export default HelpModal;
