/**
 * Welcome Screen
 * Shown inside the canvas while the project is empty: what the app is for,
 * and the ways to start (new project, open a file, the sample network).
 */

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { createCompanySample } from '@/utils/sampleCompany';
import { openProject, requestNewProject } from '@/utils/projectFileAccess';
import PixelCakeLogo from '@/assets/PixelCakeLogo.svg';
import { GITHUB_REPO, GITHUB_ISSUES } from '@/constants/links';
import { APP_DESCRIPTOR, APP_MOTTO, APP_NAME } from '@/constants/brand';

const WelcomeScreen = () => {
  const dismissWelcomeScreen = useUIStore((state) => state.dismissWelcomeScreen);
  const openHelp = useUIStore((state) => state.openHelp);
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  useEffect(() => {
    // Se localStorage non ha il flag, resetta il checkbox
    const hideWelcome = localStorage.getItem('pixelcake-hide-welcome');
    if (!hideWelcome) {
      setNeverShowAgain(false);
    }
  }, []); // Esegui al mount del componente

  const handleNewProject = () => {
    if (requestNewProject()) {
      dismissWelcomeScreen(neverShowAgain);
    }
  };

  const handleOpenProject = async () => {
    // The file picker opens straight from the click. The welcome screen goes
    // away only once a project has really been opened: cancelling the picker
    // leaves everything as it was
    const outcome = await openProject();
    if (outcome === 'opened') {
      dismissWelcomeScreen(neverShowAgain);
    }
  };

  const handleLoadSample = () => {
    dismissWelcomeScreen(neverShowAgain);

    // The network of a small company, whole in the window whatever part of
    // the board was on screen before
    const topology = createCompanySample();
    const networkStore = useNetworkStore.getState();
    networkStore.loadTopology(topology.devices, topology.connections);
    networkStore.triggerFitView();
  };

  const handleDocumentation = (e: React.MouseEvent) => {
    e.preventDefault();
    openHelp('guide');
  };

  return (
    <div className="welcome-screen-container">
      {/* Header con logo e titolo */}
      <div className="welcome-header">
        <img src={PixelCakeLogo} alt={`${APP_NAME} Logo`} className="welcome-logo" />
        <h1>{APP_NAME}</h1>
        <p>{APP_DESCRIPTOR}</p>
      </div>

      {/* What the app is for, in three steps */}
      <div className="welcome-process">
        <h3>
          <Icon icon="lucide:package" width={20} className="inline-block mr-2" />
          {APP_MOTTO}
        </h3>
        <div className="process-steps">
          <div className="process-step">
            <span className="step-number">1.</span>
            <strong>Disegna</strong> → aggiungi i dispositivi e collegali
          </div>
          <div className="process-step">
            <span className="step-number">2.</span>
            <strong>Configura</strong> → indirizzi, VLAN, rotte, regole del firewall
          </div>
          <div className="process-step">
            <span className="step-number">3.</span>
            <strong>Chiedi</strong> → manda un pacchetto e guarda dove si ferma, e perché
          </div>
        </div>
      </div>

      {/* Quick Start Actions */}
      <div className="welcome-actions">
        <h4>Per cominciare:</h4>
        <button onClick={handleNewProject} className="welcome-link">
          <Icon icon="lucide:plus" width={16} />
          Nuovo Progetto
        </button>
        <button onClick={handleOpenProject} className="welcome-link">
          <Icon icon="lucide:folder-open" width={16} />
          Apri Progetto
        </button>
        <button onClick={handleLoadSample} className="welcome-link">
          <Icon icon="lucide:layout-template" width={16} />
          Carica la rete di esempio
        </button>
      </div>

      {/* External Links */}
      <div className="welcome-links">
        <h4>Collegamenti:</h4>
        <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="welcome-link">
          <Icon icon="lucide:github" width={16} />
          Codice su GitHub
        </a>
        <a href="#" onClick={handleDocumentation} className="welcome-link">
          <Icon icon="lucide:book-open" width={16} />
          Guida
        </a>
        <a href={GITHUB_ISSUES} target="_blank" rel="noopener noreferrer" className="welcome-link">
          <Icon icon="lucide:bug" width={16} />
          Segnala un problema
        </a>
      </div>

      {/* Checkbox "Non mostrare più" */}
      <div className="welcome-checkbox-container">
        <label className="welcome-checkbox">
          <input
            type="checkbox"
            checked={neverShowAgain}
            onChange={(e) => setNeverShowAgain(e.target.checked)}
          />
          <span>Non mostrare più questa schermata</span>
        </label>
      </div>
    </div>
  );
};

export default WelcomeScreen;