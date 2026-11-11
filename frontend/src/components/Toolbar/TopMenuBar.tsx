import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { useTemplateStore } from '@/store/templateStore';
import { Moon, Sun, ArrowDown, ArrowRight, Network, Building2, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import PixelCakeIcon from '@/assets/PixelCakeIcon.svg';

const TopMenuBar = () => {
  const darkMode = useUIStore((state) => state.darkMode);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);
  const openModal = useUIStore((state) => state.openModal);
  const setShowWelcomeScreen = useUIStore((state) => state.setShowWelcomeScreen);
  const magnifiedDeviceTypes = useUIStore((state) => state.magnifiedDeviceTypes);
  const magnifiedConnectionTypes = useUIStore((state) => state.magnifiedConnectionTypes);
  const toggleMagnifyDevice = useUIStore((state) => state.toggleMagnifyDevice);
  const toggleMagnifyConnection = useUIStore((state) => state.toggleMagnifyConnection);
  const resetMagnification = useUIStore((state) => state.resetMagnification);
  const particleAnimationEnabled = useUIStore((state) => state.particleAnimationEnabled);
  const toggleParticleAnimation = useUIStore((state) => state.toggleParticleAnimation);
  const clearAllDevices = useNetworkStore((state) => state.clearAllDevices);
  const applyAutoLayout = useNetworkStore((state) => state.applyAutoLayout);
  const autoConnectDevices = useNetworkStore((state) => state.autoConnectDevices);
  const triggerFitView = useNetworkStore((state) => state.triggerFitView);
  const selectedDeviceIds = useNetworkStore((state) => state.selectedDeviceIds);
  const clipboard = useNetworkStore((state) => state.clipboard);
  const copySelection = useNetworkStore((state) => state.copySelection);
  const paste = useNetworkStore((state) => state.paste);
  const saveToBackend = useNetworkStore((state) => state.saveToBackend);
  const connectionTemplates = useTemplateStore((state) => state.connectionTemplates);

  const currentProject = useProjectStore((state) => state.currentProject);

  const handleNuovoProgetto = () => {
    openModal('newProject');
  };

  const handleApriProgetto = () => {
    openModal('openProject');
  };

  const handleSalva = async () => {
    if (!currentProject) {
      alert('Nessun progetto aperto');
      return;
    }
    try {
      await saveToBackend();
      console.log('[Menu] Progetto salvato');
    } catch (error) {
      console.error('[Menu] Errore durante il salvataggio:', error);
      alert('Errore durante il salvataggio');
    }
  };

  const handleSalvaConNome = () => {
    if (!currentProject) {
      alert('Nessun progetto aperto');
      return;
    }
    openModal('saveAsProject');
  };

  // File → Nuovo: start an empty, local drawing
  const handleNewProject = async () => {
    const network = useNetworkStore.getState();

    if (currentProject) {
      // The board on screen belongs to a saved project. Emptying it here
      // would autosave the empty board over the saved one, so the project
      // is closed first and left intact.
      const question =
        `Chiudere il progetto "${currentProject.name}" e iniziare un disegno vuoto?\n` +
        'Il progetto resta salvato.';
      if (!confirm(question)) return;

      const saved = await network.saveBeforeSwitch();
      if (!saved) return; // the failed save has already been reported

      network.clearCurrentCanvas();
      useProjectStore.getState().closeProject();
      clearAllDevices();
      return;
    }

    if (network.devices.length === 0) return;
    if (confirm('Svuotare la tela?\nIl disegno non è salvato in un progetto e andrà perso.')) {
      clearAllDevices();
    }
  };

  const handleAutoLayout = (algorithm: 'hierarchical' | 'subnet-grouped', direction: 'TB' | 'LR') => {
    const deviceCount = useNetworkStore.getState().devices.length;
    if (deviceCount === 0) {
      alert('Nessun dispositivo presente. Aggiungi dispositivi prima di applicare l\'auto-layout.');
      return;
    }
    applyAutoLayout(algorithm, direction);
  };

  const handleAutoConnect = () => {
    const deviceCount = useNetworkStore.getState().devices.length;
    if (deviceCount < 2) {
      alert('Servono almeno 2 dispositivi per creare connessioni automatiche.');
      return;
    }
    autoConnectDevices();
  };

  // Help → Mostra Welcome Screen. The welcome screen only exists on an empty
  // canvas with no project open; asking to see it must never empty a drawing.
  const handleShowWelcome = () => {
    const hasDrawing = useNetworkStore.getState().devices.length > 0;
    if (hasDrawing || currentProject) {
      toast.info(
        'La schermata di benvenuto compare solo su una tela vuota, senza progetto aperto. ' +
          'Il disegno non è stato toccato. Per rivederla usa File → Nuovo.'
      );
      return;
    }

    // Reset the "non mostrare più" preference, then show it
    localStorage.removeItem('pixelcake-hide-welcome');
    setShowWelcomeScreen(true);
  };

  const handleDocumentation = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    window.open(`${apiUrl}/docs`, '_blank');
  };

  const handleFitView = () => {
    const deviceCount = useNetworkStore.getState().devices.length;
    if (deviceCount === 0) {
      alert('Nessun dispositivo presente. Impossibile adattare la vista.');
      return;
    }
    triggerFitView();
  };

  const handleCopy = () => {
    if (selectedDeviceIds.length === 0) {
      alert('Seleziona almeno un dispositivo (Ctrl+Click) prima di copiare.');
      return;
    }
    copySelection();
  };

  const handlePaste = () => {
    if (!clipboard || clipboard.devices.length === 0) {
      alert('Nessun elemento negli appunti. Copia prima alcuni dispositivi.');
      return;
    }
    paste();
  };

  return (
    <header className="top-menubar">
      {/* Logo */}
      <img
        src={PixelCakeIcon}
        alt="Pixelcake Icon"
        className="h-10 mr-4 ml-[-2px]"
        onError={(e) => {
          // Hide image if not found
          e.currentTarget.style.display = 'none';
        }}
      />

      {/* File Menu */}
      <div className="menu-item">
        <span>File</span>
        <div className="dropdown-content">
          <ul>
            <li onClick={handleNuovoProgetto}>Nuovo Progetto</li>
            <li onClick={handleApriProgetto}>Apri Progetto...</li>
            <hr />
            <li onClick={handleNewProject}>Nuovo</li>
            <li className="disabled">Apri...</li>
            <hr />
            <li onClick={handleSalva}>Salva</li>
            <li onClick={handleSalvaConNome}>Salva con nome...</li>
            <hr />
            <li className="disabled">Esporta come PNG</li>
          </ul>
        </div>
      </div>

      {/* Modifica Menu */}
      <div className="menu-item">
        <span>Modifica</span>
        <div className="dropdown-content">
          <ul>
            <li className="disabled">Annulla</li>
            <li className="disabled">Ripristina</li>
            <hr />
            <li className="disabled">Taglia</li>
            <li
              onClick={selectedDeviceIds.length === 0 ? undefined : handleCopy}
              className={selectedDeviceIds.length === 0 ? 'disabled' : ''}
            >
              Copia
            </li>
            <li
              onClick={!clipboard || clipboard.devices.length === 0 ? undefined : handlePaste}
              className={!clipboard || clipboard.devices.length === 0 ? 'disabled' : ''}
            >
              Incolla
            </li>
          </ul>
        </div>
      </div>

      {/* Vista Menu */}
      <div className="menu-item">
        <span>Vista</span>
        <div className="dropdown-content">
          <ul>
            <li onClick={handleFitView}>Adatta alla finestra</li>
            <hr />
            {/* Auto-Layout Submenu */}
            <li className="has-submenu">
              Auto-Layout Rete
              <div className="nested-dropdown">
                <ul>
                  <li onClick={(e) => { e.stopPropagation(); handleAutoLayout('hierarchical', 'TB'); }}>
                    <Network size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    <ArrowDown size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    Hierarchical Verticale
                  </li>
                  <li onClick={(e) => { e.stopPropagation(); handleAutoLayout('hierarchical', 'LR'); }}>
                    <Network size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    <ArrowRight size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    Hierarchical Orizzontale
                  </li>
                  <hr />
                  <li onClick={(e) => { e.stopPropagation(); handleAutoLayout('subnet-grouped', 'TB'); }}>
                    <Building2 size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    <ArrowDown size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    Subnet-Grouped Verticale
                  </li>
                  <li onClick={(e) => { e.stopPropagation(); handleAutoLayout('subnet-grouped', 'LR'); }}>
                    <Building2 size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    <ArrowRight size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    Subnet-Grouped Orizzontale
                  </li>
                </ul>
              </div>
            </li>
            <li onClick={handleAutoConnect}>Auto-Connect Rete</li>
            <hr />
            {/* Magnifica Submenu */}
            <li className="has-submenu">
              Magnifica
              <div className="nested-dropdown">
                <ul>
                  {/* Dispositivi Submenu */}
                  <li className="has-submenu">
                    Dispositivi
                    <div className="nested-dropdown">
                      <ul>
                        <li
                          className={`magnify-item ${magnifiedDeviceTypes.includes('PC') ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleMagnifyDevice('PC'); }}
                        >
                          PC
                        </li>
                        <li
                          className={`magnify-item ${magnifiedDeviceTypes.includes('Switch') ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleMagnifyDevice('Switch'); }}
                        >
                          Switch
                        </li>
                        <li
                          className={`magnify-item ${magnifiedDeviceTypes.includes('Router') ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleMagnifyDevice('Router'); }}
                        >
                          Router
                        </li>
                        <li
                          className={`magnify-item ${magnifiedDeviceTypes.includes('Server') ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleMagnifyDevice('Server'); }}
                        >
                          Server
                        </li>
                        <li
                          className={`magnify-item ${magnifiedDeviceTypes.includes('Firewall') ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleMagnifyDevice('Firewall'); }}
                        >
                          Firewall
                        </li>
                        <li
                          className={`magnify-item ${magnifiedDeviceTypes.includes('AccessPoint') ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleMagnifyDevice('AccessPoint'); }}
                        >
                          Access Point
                        </li>
                        <li
                          className={`magnify-item ${magnifiedDeviceTypes.includes('LoadBalancer') ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleMagnifyDevice('LoadBalancer'); }}
                        >
                          Load Balancer
                        </li>
                        <li
                          className={`magnify-item ${magnifiedDeviceTypes.includes('Database') ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleMagnifyDevice('Database'); }}
                        >
                          Database
                        </li>
                        <li
                          className={`magnify-item ${magnifiedDeviceTypes.includes('Cloud') ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleMagnifyDevice('Cloud'); }}
                        >
                          Cloud
                        </li>
                      </ul>
                    </div>
                  </li>

                  {/* Connessioni Submenu */}
                  <li className="has-submenu">
                    Connessioni
                    <div className="nested-dropdown">
                      <ul>
                        {connectionTemplates.map((template) => (
                          <li
                            key={template.id}
                            className={`magnify-item ${magnifiedConnectionTypes.includes(template.type) ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); toggleMagnifyConnection(template.type); }}
                          >
                            {template.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>

                  <hr />

                  {/* Reset Magnification */}
                  <li onClick={(e) => { e.stopPropagation(); resetMagnification(); }}>
                    Reset Magnifica
                  </li>
                </ul>
              </div>
            </li>
            <hr />
            {/* Particle Animation Toggle */}
            <li onClick={toggleParticleAnimation} className="magnify-item">
              {particleAnimationEnabled && <Check size={14} style={{ display: 'inline', marginRight: '6px' }} />}
              {!particleAnimationEnabled && <span style={{ display: 'inline-block', width: '14px', marginRight: '6px' }}></span>}
              <Sparkles size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Animazione Rete
            </li>
          </ul>
        </div>
      </div>

      {/* Help Menu */}
      <div className="menu-item">
        <span>Help</span>
        <div className="dropdown-content">
          <ul>
            <li onClick={handleShowWelcome}>Mostra Welcome Screen</li>
            <li onClick={() => openModal('help')}>Note Programma</li>
            <li onClick={handleDocumentation}>Documentazione API</li>
          </ul>
        </div>
      </div>

      {/* Theme Toggle */}
      <button
        className="ml-auto px-2 py-1 hover:text-[var(--accent-color)] cursor-pointer border-none bg-transparent"
        onClick={toggleDarkMode}
        title={darkMode ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
};

export default TopMenuBar;
