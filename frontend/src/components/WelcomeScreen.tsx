/**
 * Welcome Screen
 * Shown inside the canvas while the project is empty: what the app is for,
 * and the ways to start (new project, open a file, the sample network).
 */

import { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { createCompanySample } from '@/utils/sampleCompany';
import { openProject, requestNewProject } from '@/utils/projectFileAccess';
import Logo from '@/components/ui/Logo';
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

  const handleNewProject = async () => {
    if (await requestNewProject()) {
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
      {/* The logo, and what the app is */}
      <div className="welcome-header">
        <Logo size={168} className="welcome-logo" />
        {/* (the logo carries the name: the heading is for who cannot see it) */}
        <h1 className="sr-only">{APP_NAME}</h1>
        <p>{APP_DESCRIPTOR}</p>
      </div>

      {/* What the app is for, in three steps */}
      <h3 className="welcome-motto">{APP_MOTTO}</h3>
      <ol className="welcome-steps">
        <li>
          <span className="welcome-step-number" aria-hidden="true">
            1
          </span>
          <strong>Disegna</strong>
          <span className="welcome-step-text">aggiungi i dispositivi e collegali</span>
        </li>
        <li>
          <span className="welcome-step-number" aria-hidden="true">
            2
          </span>
          <strong>Configura</strong>
          <span className="welcome-step-text">indirizzi, VLAN, rotte, regole del firewall</span>
        </li>
        <li>
          <span className="welcome-step-number" aria-hidden="true">
            3
          </span>
          <strong>Chiedi</strong>
          <span className="welcome-step-text">
            manda un pacchetto e guarda dove si ferma, e perché
          </span>
        </li>
      </ol>

      {/* The three ways to start: the first is the main one */}
      <div className="welcome-actions">
        <button onClick={handleNewProject} className="welcome-button primary">
          Nuovo Progetto
        </button>
        <button onClick={handleOpenProject} className="welcome-button">
          Apri Progetto
        </button>
        <button onClick={handleLoadSample} className="welcome-button">
          Carica la rete di esempio
        </button>
      </div>

      {/* Links */}
      <div className="welcome-links">
        <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
          Codice su GitHub
        </a>
        <a href="#" onClick={handleDocumentation}>
          Guida
        </a>
        <a href={GITHUB_ISSUES} target="_blank" rel="noopener noreferrer">
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