/**
 * Help Modal — the guide of the application, in three tabs:
 * how to use it, the terminal commands, and what the application is.
 *
 * The tab shown is in the UI store (`helpTab`), so that each entry of the
 * Help menu can open the guide where it should (`openHelp(tab)`).
 *
 * The words of the guide are in the dictionaries (`i18n/it/help.ts`,
 * `i18n/en/help.ts`): its steps are drawn here in the order that file gives
 * them. The command list is not written anywhere: it is rendered from the
 * table the terminal's own `help` command prints (COMMAND_REFERENCE), so the
 * two can never disagree, and it is English in both languages, as the
 * terminal is.
 */

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Icon } from '@iconify/react';
import { Modal } from '@/components/ui/Modal';
import Logo from '@/components/ui/Logo';
import { useUIStore, type HelpTab } from '@/store/uiStore';
import { COMMAND_REFERENCE } from '@/terminal/executor';
import { GITHUB_REPO } from '@/constants/links';
import { APP_NAME } from '@/constants/brand';
import { useT } from '@/i18n';
import { Rich } from '@/i18n/Rich';

const TABS: HelpTab[] = ['guide', 'commands', 'about'];

/* ── how to use it ────────────────────────────────────────────────────── */

/** Something to type, or the name of a file: shown in monospace */
const Mono = ({ children }: { children: ReactNode }) => (
  <code className="font-mono text-[0.9em] px-1 rounded bg-[var(--bg-canvas)]">{children}</code>
);

const mono = (words: string) => <Mono>{words}</Mono>;

const Step = ({ title, text }: { title: string; text: string }) => (
  <li>
    <p className="font-semibold text-[var(--text-color)]">{title}</p>
    <p className="mt-1">
      <Rich text={text} code={mono} />
    </p>
  </li>
);

const GuideTab = () => {
  const t = useT();
  return (
    <div className="settings-panel text-sm leading-relaxed text-[var(--text-color-light)]">
      <p className="mb-4">{t.help.intro}</p>

      <ol className="list-decimal pl-5 space-y-4">
        {Object.entries(t.help.steps).map(([key, step]) => (
          <Step key={key} title={step.title} text={step.text} />
        ))}
      </ol>

      <p className="modal-info-box mt-6">{t.help.prototype}</p>
    </div>
  );
};

/* ── the terminal commands ────────────────────────────────────────────── */

const CommandsTab = () => {
  const t = useT();
  return (
    <div className="settings-panel text-sm">
      <p className="mb-4 leading-relaxed text-[var(--text-color-light)]">
        <Rich text={t.help.commands.intro} code={mono} />
      </p>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b border-[var(--border-color)]">
            <th scope="col" className="py-2 pr-4 font-semibold">
              {t.help.commands.command}
            </th>
            <th scope="col" className="py-2 font-semibold">
              {t.help.commands.does}
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
};

/* ── what the application is ──────────────────────────────────────────── */

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
    <Icon icon={icon} className="text-[var(--text-color-light)] flex-shrink-0" width={24} />
    <div>
      <p className="font-semibold">{title}</p>
      <div className="text-sm text-[var(--text-color-light)]">{children}</div>
    </div>
  </div>
);

const AboutTab = () => {
  const t = useT();
  return (
    <div className="settings-panel">
      <div className="space-y-3">
        <AboutRow icon="mdi:application" title={APP_NAME}>
          {t.help.about.description}
        </AboutRow>

        <AboutRow icon="mdi:tag" title={t.help.about.version}>
          0.1.0 (Beta)
        </AboutRow>

        <AboutRow icon="mdi:license" title={t.help.about.licence}>
          {t.help.about.licenceText}
        </AboutRow>

        <AboutRow icon="mdi:github" title={t.help.about.repository}>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-text)] underline"
          >
            {GITHUB_REPO.replace('https://', '')}
          </a>
        </AboutRow>

        <AboutRow icon="mdi:code-tags" title={t.help.about.technologies}>
          React 19, TypeScript, Vite, Zustand, React Flow, Tailwind CSS
        </AboutRow>
      </div>
    </div>
  );
};

/* ── the modal ────────────────────────────────────────────────────────── */

const HelpModal = () => {
  const t = useT();
  const isOpen = useUIStore(state => state.modals.help);
  const activeTab = useUIStore(state => state.helpTab);
  const setHelpTab = useUIStore(state => state.setHelpTab);
  const closeModal = useUIStore(state => state.closeModal);

  const handleClose = () => {
    closeModal('help');
    // Back to the first tab, like the settings: whoever opens the guide
    // without asking for a tab starts from how to use the app
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
          <div className="modal-header flex items-center justify-between mx-6 pt-5 pb-3 flex-shrink-0">
            <h3 className="text-base font-semibold tracking-tight">{t.help.title}</h3>
            <button
              onClick={handleClose}
              className="p-1 text-[var(--text-color-light)] hover:text-[var(--text-color)] hover:bg-[var(--bg-hover)] rounded transition-colors"
              aria-label={t.help.close}
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label={t.help.sections}
            className="settings-tabs px-6 pt-1 border-b border-[var(--border-color)]"
          >
            {TABS.map(tab => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setHelpTab(tab)}
              >
                {t.help.tabs[tab]}
              </button>
            ))}
          </div>
        </>
      }
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <div className="flex items-center justify-center gap-2 w-full">
            <Logo symbol size={18} />
            <p className="text-sm text-[var(--text-color-light)] italic">
              {t.common.quote(t.common.brand.motto)}
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
