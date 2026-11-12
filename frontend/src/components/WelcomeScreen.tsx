/**
 * Welcome Screen
 * Excalidraw-style welcome screen integrata nel canvas
 * Mostra le fasi del progetto "infrastructure piece by piece"
 */

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import { openProject, requestNewProject } from '@/utils/projectFileAccess';
import PixelCakeLogo from '@/assets/PixelCakeLogo.svg';
import { GITHUB_REPO, GITHUB_ISSUES } from '@/constants/links';

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

    // Carica effettivamente la sample topology
    const topology = createSampleTopology();
    const networkStore = useNetworkStore.getState();
    networkStore.loadTopology(topology.devices, topology.connections);
  };

  const handleDocumentation = (e: React.MouseEvent) => {
    e.preventDefault();
    openHelp('guide');
  };

  return (
    <div className="welcome-screen-container">
      {/* Header con logo e titolo */}
      <div className="welcome-header">
        <img src={PixelCakeLogo} alt="PixelCake Logo" className="welcome-logo" />
        <h1>PixelCake</h1>
        <p>Visual Network Designer</p>
      </div>

      {/* Sezione "Build piece by piece" */}
      <div className="welcome-process">
        <h3>
          <Icon icon="lucide:package" width={20} className="inline-block mr-2" />
          Build your infrastructure piece by piece
        </h3>
        <div className="process-steps">
          <div className="process-step">
            <span className="step-number">1.</span>
            <strong>Design</strong> → Drag & drop network devices
          </div>
          <div className="process-step">
            <span className="step-number">2.</span>
            <strong>Connect</strong> → Create network topology
          </div>
          <div className="process-step">
            <span className="step-number">3.</span>
            <strong>Test</strong> → Send a packet, see where it stops
          </div>
        </div>
      </div>

      {/* Quick Start Actions */}
      <div className="welcome-actions">
        <h4>Quick Start:</h4>
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
          Carica Sample Topology
        </button>
      </div>

      {/* External Links */}
      <div className="welcome-links">
        <h4>Links:</h4>
        <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="welcome-link">
          <Icon icon="lucide:github" width={16} />
          GitHub Repository
        </a>
        <a href="#" onClick={handleDocumentation} className="welcome-link">
          <Icon icon="lucide:book-open" width={16} />
          Documentation
        </a>
        <a href={GITHUB_ISSUES} target="_blank" rel="noopener noreferrer" className="welcome-link">
          <Icon icon="lucide:bug" width={16} />
          Report an Issue
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