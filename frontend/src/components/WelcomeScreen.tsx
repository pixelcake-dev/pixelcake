/**
 * Welcome Screen
 * Shown inside the canvas while the project is empty: what the app is for,
 * and the ways to start (new project, open a file, the sample network).
 */

import { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { createCompanySample } from '@/utils/sampleCompany';
import { loadSampleNetwork } from '@/utils/sampleActions';
import { openProject, requestNewProject } from '@/utils/projectFileAccess';
import Logo from '@/components/ui/Logo';
import { GITHUB_REPO, GITHUB_ISSUES, siteUrl } from '@/constants/links';
import { APP_DESCRIPTOR, APP_NAME } from '@/constants/brand';
import { useLanguage, useT } from '@/i18n';
import LanguageSwitch from '@/components/ui/LanguageSwitch';

const WelcomeScreen = () => {
  const t = useT();
  const language = useLanguage();
  const dismissWelcomeScreen = useUIStore((state) => state.dismissWelcomeScreen);
  const openHelp = useUIStore((state) => state.openHelp);
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  useEffect(() => {
    // Without the flag in localStorage the checkbox starts unticked
    const hideWelcome = localStorage.getItem('pixelcake-hide-welcome');
    if (!hideWelcome) {
      setNeverShowAgain(false);
    }
  }, []); // Once, when the screen is shown

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
    loadSampleNetwork(createCompanySample());
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
      <h3 className="welcome-motto">{t.common.brand.motto}</h3>
      <ol className="welcome-steps">
        <li>
          <span className="welcome-step-number" aria-hidden="true">
            1
          </span>
          <strong>{t.welcome.steps.draw.title}</strong>
          <span className="welcome-step-text">{t.welcome.steps.draw.text}</span>
        </li>
        <li>
          <span className="welcome-step-number" aria-hidden="true">
            2
          </span>
          <strong>{t.welcome.steps.configure.title}</strong>
          <span className="welcome-step-text">{t.welcome.steps.configure.text}</span>
        </li>
        <li>
          <span className="welcome-step-number" aria-hidden="true">
            3
          </span>
          <strong>{t.welcome.steps.ask.title}</strong>
          <span className="welcome-step-text">{t.welcome.steps.ask.text}</span>
        </li>
      </ol>

      {/* The three ways to start: the first is the main one */}
      <div className="welcome-actions">
        <button onClick={handleNewProject} className="welcome-button primary">
          {t.welcome.newProject}
        </button>
        <button onClick={handleOpenProject} className="welcome-button">
          {t.welcome.openProject}
        </button>
        <button onClick={handleLoadSample} className="welcome-button">
          {t.welcome.loadSample}
        </button>
      </div>

      {/* Links */}
      <div className="welcome-links">
        <a href={siteUrl(language)} target="_blank" rel="noopener noreferrer">
          {t.welcome.site}
        </a>
        <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
          {t.welcome.codeOnGitHub}
        </a>
        <a href="#" onClick={handleDocumentation}>
          {t.welcome.guide}
        </a>
        <a href={GITHUB_ISSUES} target="_blank" rel="noopener noreferrer">
          {t.welcome.reportProblem}
        </a>
      </div>

      {/* The tick that puts the screen away for good, and the language */}
      <div className="welcome-checkbox-container flex items-center justify-between gap-4">
        <label className="welcome-checkbox">
          <input
            type="checkbox"
            checked={neverShowAgain}
            onChange={(e) => setNeverShowAgain(e.target.checked)}
          />
          <span>{t.welcome.doNotShowAgain}</span>
        </label>
        <LanguageSwitch />
      </div>
    </div>
  );
};

export default WelcomeScreen;