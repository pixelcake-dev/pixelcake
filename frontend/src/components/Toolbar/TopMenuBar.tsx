import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import {
  openProject,
  requestNewProject,
  saveProject,
  saveProjectAs,
} from '@/utils/projectFileAccess';
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
  const applyAutoLayout = useNetworkStore((state) => state.applyAutoLayout);
  const autoConnectDevices = useNetworkStore((state) => state.autoConnectDevices);
  const triggerFitView = useNetworkStore((state) => state.triggerFitView);
  const selectedDeviceIds = useNetworkStore((state) => state.selectedDeviceIds);
  const clipboard = useNetworkStore((state) => state.clipboard);
  const copySelection = useNetworkStore((state) => state.copySelection);
  const paste = useNetworkStore((state) => state.paste);
  const connectionTemplates = useTemplateStore((state) => state.connectionTemplates);

  // File menu. Each entry is a thin call into utils/projectFileAccess, which
  // asks before unsaved changes are lost and reports the outcome with a toast.
  // The pickers must be reached straight from the click: nothing is awaited
  // before them.
  const handleNewProject = () => requestNewProject();
  const handleOpen = () => void openProject();
  const handleSave = () => void saveProject();
  const handleSaveAs = () => void saveProjectAs();

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
  // canvas; asking to see it must never empty a drawing.
  const handleShowWelcome = () => {
    const hasDrawing = useNetworkStore.getState().devices.length > 0;
    if (hasDrawing) {
      toast.info(
        'La schermata di benvenuto compare solo su un canvas vuoto. ' +
          'Il disegno non è stato toccato. Per rivederla passa a un canvas vuoto o creane uno nuovo.'
      );
      return;
    }

    // Reset the "non mostrare più" preference, then show it
    localStorage.removeItem('pixelcake-hide-welcome');
    setShowWelcomeScreen(true);
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
            <li onClick={handleNewProject}>Nuovo progetto…</li>
            <li onClick={handleOpen}>Apri…</li>
            <hr />
            <li onClick={handleSave}>Salva</li>
            <li onClick={handleSaveAs}>Salva con nome…</li>
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
