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
        automatico. Il dispositivo finisce in un punto a caso del canvas: se non lo vedi, usa Vista
        → Adatta alla finestra. «Aggiungi in Blocco» ne crea molti in una volta. Nella scheda
        «Topologie» dello stesso pannello c&apos;è una rete di esempio già pronta, che prende il
        posto di quanto è sul canvas.
      </Step>

      <Step title="Spostali e selezionali">
        Trascina un dispositivo per spostarlo. Con Ctrl + clic ne selezioni più di uno, trascinando
        su un&apos;area vuota disegni un riquadro di selezione. Trascinando con il tasto destro su
        un&apos;area vuota sposti la vista, con la rotellina fai lo zoom. Tutte le scorciatoie sono
        in Impostazioni → Avanzate.
      </Step>

      <Step title="Collegali">
        Ogni dispositivo ha quattro punti di connessione, uno per lato. Trascina da un punto fino a
        un punto di un altro dispositivo: a ciascun capo il collegamento viene assegnato a una porta
        o a una scheda di rete libera. Su un firewall con zone di sicurezza la porta va scelta a
        mano. Con un clic destro sul collegamento, «Modifica Connessione» permette di cambiare le
        interfacce, il tipo, la banda, l&apos;etichetta e il colore.
      </Step>

      <Step title="Configurali">
        Un doppio clic su un dispositivo ne apre la scheda (la stessa di clic destro → «Dettagli
        (Modifica)»): nome, indirizzo IP, subnet mask, gateway e, per switch, router e firewall, le
        VLAN. Switch, router e firewall hanno anche la scheda «Ports», dove si configura ogni
        singola porta. Gli altri dispositivi hanno «Network Interfaces» con le loro schede di rete,
        ed è lì che se ne cambia l&apos;indirizzo. Le modifiche valgono solo dopo aver premuto
        «Salva».
      </Step>

      <Step title="Chiedi se un dispositivo ne raggiunge un altro">
        Apri «Simulazione» (il pulsante con il fulmine), scegli «Partenza», «Destinazione» e il
        «Modello di Flusso» (ping, email, pagina web o download), poi premi «Avvia Simulazione». Il
        pacchetto percorre la rete sul disegno. Se non arriva, l&apos;animazione si ferma dove il
        traffico viene bloccato e un messaggio ne spiega il motivo.
      </Step>

      <Step title="Usa il terminale">
        «Console», nella barra a sinistra, apre il terminale. Con un clic destro su un dispositivo →
        «Console» si apre già posizionato su quel dispositivo. I comandi sono in inglese, per
        esempio <Mono>ping Web-01 from PC-1</Mono> oppure <Mono>show interfaces Router-1</Mono>.
        Quelli che cambiano la rete modificano lo stesso disegno che vedi. L&apos;elenco è nella
        scheda «Comandi del terminale».
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
      distinguono maiuscole e minuscole e possono essere di più parole.
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
      <AboutRow icon="mdi:application" title="PixelCake">
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
            <p className="text-sm text-[var(--text-color-light)] italic">
              "Infrastructure, piece by piece."
            </p>
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
