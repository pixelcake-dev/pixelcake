import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { askConfirm } from '@/store/confirmStore';
import type { LayoutDirection } from '@/utils/autoLayout';
import type { ConnectionSummary, LeftAloneReason } from '@/utils/autoConnect';
import type { NetworkDevice } from '@/types';
import { usePresentationStore } from '@/store/presentationStore';
import {
  openProject,
  requestNewProject,
  saveProject,
  saveProjectAs,
} from '@/utils/projectFileAccess';
import {
  Moon,
  Sun,
  ArrowDown,
  ArrowRight,
  Network,
  Presentation,
  Sparkles,
  SquareDashed,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import SymbolColour from '@/assets/pixelcake-simbolo-colore.svg';
import SymbolNegative from '@/assets/pixelcake-simbolo-negativo.svg';
import { APP_NAME } from '@/constants/brand';
import { useProjectStore } from '@/store/projectStore';
import { useLanguage, useT } from '@/i18n';
import LanguageSwitch from '@/components/ui/LanguageSwitch';
import { encloseDevices } from '@/utils/areaActions';
import { hasClipboard } from '@/utils/pasteDevices';
import { pasteAndTell } from '@/utils/pasteActions';
import { docsUrl, siteUrl } from '@/constants/links';
import { redo, undo, useHistoryStore } from '@/store/historyStore';
import { undoKeys } from '@/utils/undoActions';
import type { StepName } from '@/utils/historySteps';

type ConnectWords = ReturnType<typeof useT>['menu']['connectNotice'];
type StepWords = ReturnType<typeof useT>['menu']['edit']['steps'];

/** What a step of the history did, in the words of the menu («elimina «PC-3»») */
function stepText(step: StepName, words: StepWords): string {
  switch (step.kind) {
    case 'addDevices':
    case 'deleteDevices':
    case 'moveDevices':
    case 'addLinks':
      return words[step.kind](step.count);
    case 'addLink':
    case 'deleteLink':
    case 'editLink':
      return words[step.kind](step.source, step.target);
    default:
      return words[step.kind](step.name);
  }
}

/** Names written out for one reason: of a longer list, the first three and «e altri N» */
const NAMES_SHOWN = 4;

/** «PC-7, PC-8: nessuno switch nella stessa rete. Router-2: …»; undefined when no one was left alone */
function leftAloneText(summary: ConnectionSummary, devices: NetworkDevice[], words: ConnectWords): string | undefined {
  const names = new Map(devices.map((device) => [device.id, device.label]));
  const byReason = new Map<LeftAloneReason, string[]>();
  for (const { deviceId, reason } of summary.left) {
    byReason.set(reason, [...(byReason.get(reason) ?? []), names.get(deviceId) ?? deviceId]);
  }
  const parts = [...byReason].map(([reason, list]) => {
    const who =
      list.length > NAMES_SHOWN
        ? `${list.slice(0, NAMES_SHOWN - 1).join(', ')} ${words.more(list.length - (NAMES_SHOWN - 1))}`
        : list.join(', ');
    return `${who}: ${words.reasons[reason]}.`;
  });
  return parts.length > 0 ? parts.join(' ') : undefined;
}

const TopMenuBar = () => {
  const t = useT();
  const language = useLanguage();
  const darkMode = useUIStore((state) => state.darkMode);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);
  const openHelp = useUIStore((state) => state.openHelp);
  const openModal = useUIStore((state) => state.openModal);
  const requestWelcomeScreen = useUIStore((state) => state.requestWelcomeScreen);
  const magnifiedDeviceTypes = useUIStore((state) => state.magnifiedDeviceTypes);
  const magnifiedConnectionTypes = useUIStore((state) => state.magnifiedConnectionTypes);
  const toggleMagnifyDevice = useUIStore((state) => state.toggleMagnifyDevice);
  const toggleMagnifyConnection = useUIStore((state) => state.toggleMagnifyConnection);
  const resetMagnification = useUIStore((state) => state.resetMagnification);
  const particleAnimationEnabled = useUIStore((state) => state.particleAnimationEnabled);
  const toggleParticleAnimation = useUIStore((state) => state.toggleParticleAnimation);
  const areasShown = useUIStore((state) => state.areasShown);
  const setAreasShown = useUIStore((state) => state.setAreasShown);
  const applyAutoLayout = useNetworkStore((state) => state.applyAutoLayout);
  const autoConnectDevices = useNetworkStore((state) => state.autoConnectDevices);
  const triggerFitView = useNetworkStore((state) => state.triggerFitView);
  const selectedDeviceIds = useNetworkStore((state) => state.selectedDeviceIds);
  // (areas in the selection are copied with the devices, or alone)
  const nothingToCopy = useNetworkStore(
    (state) => state.selectedDeviceIds.length + state.selectedAreaIds.length === 0
  );
  const somethingToPaste = useNetworkStore((state) => hasClipboard(state.clipboard));
  const copySelection = useNetworkStore((state) => state.copySelection);
  // The history of the board on screen: what can be undone and redone, and its name
  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);
  const undoStep = useHistoryStore((state) => state.undoStep);
  const redoStep = useHistoryStore((state) => state.redoStep);
  const keys = undoKeys();
  const connectionTemplates = useTemplateStore((state) => state.connectionTemplates);
  const projectName = useProjectStore((state) => state.name);
  const canvases = useProjectStore((state) => state.canvases);
  const activeCanvasId = useProjectStore((state) => state.activeCanvasId);
  const hasUnsavedChanges = useNetworkStore((state) => state.hasUnsavedChanges);
  const setActiveSidebarPanel = useUIStore((state) => state.setActiveSidebarPanel);
  const activeCanvas = canvases.find((canvas) => canvas.id === activeCanvasId);

  // File menu. Each entry is a thin call into utils/projectFileAccess, which
  // asks before unsaved changes are lost and reports the outcome with a toast.
  // The pickers must be reached straight from the click: nothing is awaited
  // before them.
  const handleNewProject = () => void requestNewProject();
  const handleOpen = () => void openProject();
  const handleSave = () => void saveProject();
  const handleSaveAs = () => void saveProjectAs();

  // Every device is moved: asked first (one step, which Modifica → Annulla takes back)
  const handleAutoLayout = async (direction: LayoutDirection) => {
    const deviceCount = useNetworkStore.getState().devices.length;
    if (deviceCount === 0) {
      toast.info(t.menu.notices.nothingToArrange);
      return;
    }
    const words = t.menu.layoutQuestion;
    const yes = await askConfirm({ title: words.title, detail: words.detail, confirmLabel: words.confirm });
    if (!yes) return;
    // (the page first draws the question gone: a large drawing takes a moment)
    await new Promise((resolve) => setTimeout(resolve, 0));
    await applyAutoLayout(direction, useTemplateStore.getState().templates);
  };

  // A cable for each device that has none; then how many, and who was left alone and why
  const handleAutoConnect = () => {
    const { devices } = useNetworkStore.getState();
    if (devices.length < 2) {
      toast.info(t.menu.notices.needTwoToConnect);
      return;
    }
    const summary = autoConnectDevices();
    const words = t.menu.connectNotice;
    const description = leftAloneText(summary, devices, words);
    const shown = description ? { description, duration: 8000 } : undefined;
    if (summary.added > 0) toast.success(words.added(summary.added), shown);
    else if (description) toast.warning(words.noneAdded, shown);
    else toast.info(words.allCabled);
  };

  // Aiuto → Mostra la schermata di benvenuto. It only exists on an empty
  // canvas; asking to see it must never empty a drawing.
  const handleShowWelcome = () => {
    const { devices, areas } = useNetworkStore.getState();
    const hasDrawing = devices.length > 0 || areas.length > 0;
    if (hasDrawing) {
      toast.info(t.menu.notices.welcomeNeedsEmptyCanvas);
      return;
    }

    // Reset the "non mostrare più" preference, then show it: asked for, it
    // shows on this empty canvas also when the project has other canvases
    localStorage.removeItem('pixelcake-hide-welcome');
    requestWelcomeScreen();
  };

  // File → Esporta immagine…: a picture of the drawing needs a drawing
  const handleExportImage = () => {
    if (useNetworkStore.getState().devices.length === 0) {
      toast.info(t.menu.notices.nothingToExport);
      return;
    }
    openModal('exportImage');
  };

  // Presentation mode shows a drawing: there must be one
  const handlePresent = () => {
    if (!usePresentationStore.getState().enter()) {
      toast.info(t.menu.notices.nothingToPresent);
    }
  };

  const handleFitView = () => {
    const deviceCount = useNetworkStore.getState().devices.length;
    if (deviceCount === 0) {
      toast.info(t.menu.notices.nothingToFit);
      return;
    }
    triggerFitView();
  };

  const handleCopy = () => {
    if (nothingToCopy) {
      toast.info(t.menu.notices.selectBeforeCopy);
      return;
    }
    copySelection();
  };

  // (new names, new MAC addresses, end devices on DHCP: utils/pasteActions)
  const handlePaste = () => {
    if (!somethingToPaste) {
      toast.info(t.menu.notices.nothingToPaste);
      return;
    }
    pasteAndTell();
  };

  // Modifica → Racchiudi in un riquadro: an area around the devices that are selected
  const handleEnclose = () => {
    encloseDevices(useNetworkStore.getState().selectedDeviceIds);
  };

  return (
    <header className="top-menubar">
      {/* The logo: the way back to the site, in a new tab (the drawing stays) */}
      <a
        href={siteUrl(language)}
        target="_blank"
        rel="noopener noreferrer"
        title={t.ui.logo.toSite(APP_NAME)}
        aria-label={t.ui.logo.toSite(APP_NAME)}
        className="topbar-logo mr-4 flex-shrink-0"
      >
        <img
          src={darkMode ? SymbolNegative : SymbolColour}
          alt=""
          className="h-8"
          onError={(e) => {
            // Hide image if not found
            e.currentTarget.style.display = 'none';
          }}
        />
      </a>

      {/* File Menu */}
      <div className="menu-item">
        <span>{t.menu.file.title}</span>
        <div className="dropdown-content">
          <ul>
            <li onClick={handleNewProject}>{t.menu.file.newProject}</li>
            <li onClick={handleOpen}>{t.menu.file.open}</li>
            <hr />
            <li onClick={handleSave}>{t.menu.file.save}</li>
            <li onClick={handleSaveAs}>{t.menu.file.saveAs}</li>
            <hr />
            <li onClick={handleExportImage}>{t.menu.file.exportPicture}</li>
          </ul>
        </div>
      </div>

      {/* Modifica Menu: every entry is enabled only when it can do something */}
      <div className="menu-item">
        <span>{t.menu.edit.title}</span>
        <div className="dropdown-content">
          <ul>
            {/* The last step of the drawing taken back, or done again: named under the pointer */}
            <li
              onClick={canUndo ? () => undo() : undefined}
              className={canUndo ? 'menu-entry-keys' : 'menu-entry-keys disabled'}
              title={undoStep ? t.menu.edit.undoNamed(stepText(undoStep, t.menu.edit.steps)) : undefined}
            >
              <span className="menu-entry-label">{t.menu.edit.undo}</span>
              <span className="menu-entry-shortcut">{keys.undo}</span>
            </li>
            <li
              onClick={canRedo ? () => redo() : undefined}
              className={canRedo ? 'menu-entry-keys' : 'menu-entry-keys disabled'}
              title={redoStep ? t.menu.edit.redoNamed(stepText(redoStep, t.menu.edit.steps)) : undefined}
            >
              <span className="menu-entry-label">{t.menu.edit.redo}</span>
              <span className="menu-entry-shortcut">{keys.redo}</span>
            </li>
            <hr />
            <li
              onClick={nothingToCopy ? undefined : handleCopy}
              className={nothingToCopy ? 'disabled' : ''}
            >
              {t.menu.edit.copy}
            </li>
            <li
              onClick={somethingToPaste ? handlePaste : undefined}
              className={somethingToPaste ? '' : 'disabled'}
            >
              {t.menu.edit.paste}
            </li>
            <hr />
            <li
              onClick={selectedDeviceIds.length === 0 ? undefined : handleEnclose}
              className={selectedDeviceIds.length === 0 ? 'disabled' : ''}
            >
              {t.menu.edit.enclose}
            </li>
          </ul>
        </div>
      </div>

      {/* Vista Menu */}
      <div className="menu-item">
        <span>{t.menu.view.title}</span>
        <div className="dropdown-content">
          <ul>
            <li onClick={handleFitView}>{t.menu.view.fit}</li>
            <li onClick={handlePresent}>{t.menu.view.presentation}</li>
            <hr />
            {/* Auto-Layout Submenu */}
            <li className="has-submenu">
              {t.menu.view.autoLayout}
              <div className="nested-dropdown">
                <ul>
                  <li onClick={(e) => { e.stopPropagation(); handleAutoLayout('TB'); }}>
                    <Network size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    <ArrowDown size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    {t.menu.view.layouts.vertical}
                  </li>
                  <li onClick={(e) => { e.stopPropagation(); handleAutoLayout('LR'); }}>
                    <Network size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    <ArrowRight size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    {t.menu.view.layouts.horizontal}
                  </li>
                </ul>
              </div>
            </li>
            <li onClick={handleAutoConnect}>{t.menu.view.autoConnect}</li>
            <hr />
            {/* Magnifica Submenu */}
            <li className="has-submenu">
              {t.menu.view.magnify}
              <div className="nested-dropdown">
                <ul>
                  {/* Dispositivi Submenu */}
                  <li className="has-submenu">
                    {t.menu.view.magnifyDevices}
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
                    {t.menu.view.magnifyConnections}
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
                    {t.menu.view.resetMagnify}
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
              {t.menu.view.animation}
            </li>
            {/* The areas behind the devices, shown or hidden: a preference of this browser */}
            <li
              onClick={() => setAreasShown(!areasShown)}
              className="magnify-item"
              role="menuitemcheckbox"
              aria-checked={areasShown}
            >
              {areasShown && <Check size={14} style={{ display: 'inline', marginRight: '6px' }} />}
              {!areasShown && <span style={{ display: 'inline-block', width: '14px', marginRight: '6px' }}></span>}
              <SquareDashed size={14} style={{ display: 'inline', marginRight: '6px' }} />
              {t.menu.view.areas}
            </li>
          </ul>
        </div>
      </div>

      {/* Aiuto Menu */}
      <div className="menu-item">
        <span>{t.menu.help.title}</span>
        <div className="dropdown-content">
          <ul>
            <li onClick={() => openHelp('guide')}>{t.menu.help.guide}</li>
            {/* The documentation, in a new tab: the drawing stays where it is */}
            <li onClick={() => window.open(docsUrl(language), '_blank', 'noopener,noreferrer')}>
              {t.menu.help.docs}
            </li>
            <li onClick={() => openHelp('commands')}>{t.menu.help.commands}</li>
            <li onClick={handleShowWelcome}>{t.menu.help.welcome}</li>
            <li onClick={() => openHelp('about')}>{t.menu.help.about}</li>
            <li onClick={() => window.open(siteUrl(language), '_blank', 'noopener,noreferrer')}>
              {t.menu.help.site}
            </li>
          </ul>
        </div>
      </div>

      {/* Which project is open, and which of its canvases when it has more
          than one. A click opens the Explorer, where both are renamed and
          the canvas is changed */}
      <button
        type="button"
        className="topbar-project"
        onClick={() => setActiveSidebarPanel('explorer')}
        title={t.menu.project.hint}
      >
        {hasUnsavedChanges && (
          <span
            className="explorer-unsaved-dot"
            role="img"
            aria-label={t.menu.project.unsavedChanges}
            title={t.menu.project.unsavedChanges}
          />
        )}
        <span className="topbar-project-name">{projectName}</span>
        {canvases.length > 1 && activeCanvas && (
          <span className="topbar-project-canvas">{activeCanvas.name}</span>
        )}
      </button>

      {/* Presentation mode */}
      <button
        type="button"
        className="present-button"
        onClick={handlePresent}
        title={t.menu.presentHint}
        aria-label={t.menu.present}
      >
        {/* on a phone the drawing alone says it: the word gives its room to the language and the theme */}
        <Presentation size={16} aria-hidden="true" /> <span className="present-button-label">{t.menu.present}</span>
      </button>

      {/* The language of the interface, next to the theme */}
      <LanguageSwitch className="ml-3" />

      {/* Theme Toggle */}
      <button
        className="theme-button ml-2 px-2 py-1 hover:text-[var(--accent-color)] cursor-pointer border-none bg-transparent"
        onClick={toggleDarkMode}
        title={darkMode ? t.menu.lightTheme : t.menu.darkTheme}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
};

export default TopMenuBar;
