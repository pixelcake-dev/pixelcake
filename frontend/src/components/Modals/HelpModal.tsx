import { SimpleModal } from '@/components/ui/SimpleModal';
import { useUIStore } from '@/store/uiStore';
import Logo from '@/components/ui/Logo';

const HelpModal = () => {
  const isOpen = useUIStore((state) => state.modals.help);
  const closeModal = useUIStore((state) => state.closeModal);

  const handleClose = () => {
    closeModal('help');
  };

  if (!isOpen) return null;

  return (
    <SimpleModal isOpen={isOpen} onClose={handleClose} title="">
      <Logo size={190} className="block mx-auto mb-5" />

      <h3 className="text-xl font-semibold mb-4 text-center">
        PixelCake v0.1.0(Beta) - Release Notes n.1
      </h3>

      <p className="text-sm leading-relaxed text-[var(--text-color-light)] mb-4">
        <b>PixelCake Network Architect v0.1.0</b>
        <br />
        Ambiente visuale per disegnare una piccola rete, configurarla e verificare
        se un dispositivo ne raggiunge un altro.
      </p>

      <p className="text-sm leading-relaxed text-[var(--text-color-light)] mb-4">
        <b>Funzionalità principali:</b>
      </p>
      <ul className="list-disc list-inside text-sm text-[var(--text-color-light)] mb-4 space-y-1">
        <li>Canvas interattivo drag & drop per dispositivi di rete</li>
        <li>Sistema di connessione visuale tra dispositivi</li>
        <li>Simulazione pathfinding (BFS) con animazione pacchetti</li>
        <li>Configurazione IP automatica e manuale</li>
        <li>Supporto per PC, Switch e Router</li>
        <li>Modalità chiaro/scuro</li>
        <li>Topologia di esempio pre-caricata</li>
      </ul>

      <p className="text-sm leading-relaxed text-[var(--text-color-light)] mb-4">
        <b>Come usare:</b>
      </p>
      <ul className="list-disc list-inside text-sm text-[var(--text-color-light)] mb-4 space-y-1">
        <li>Aggiungi dispositivi dal menu o dal pannello Dispositivi</li>
        <li>Trascina dispositivi per posizionarli</li>
        <li>Hover su dispositivo e clicca pallino per connettere</li>
        <li>Click destro per modificare o eliminare</li>
        <li>Doppio click per ispezionare dispositivo</li>
        <li>Simulazione → Impostazioni per avviare simulazione</li>
      </ul>

      <p className="text-xs text-center text-[var(--text-color-light)] mt-6">
        Licenza: AGPLv3 | Sviluppato con React + TypeScript
      </p>

      <div className="mt-6 pt-4 border-t border-[var(--border-color)] flex items-center justify-center gap-2">
        <Logo size={24} />
        <p className="text-sm text-[var(--text-color-light)] italic">
          "Infrastructure, piece by piece."
        </p>
      </div>
    </SimpleModal>
  );
};

export default HelpModal;
