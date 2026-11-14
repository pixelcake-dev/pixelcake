/**
 * The switch between the languages of the interface: two letters each, the
 * one in use marked as the chosen entry of a `.segmented` control. Each
 * language is named in itself (`title`, read aloud in that language), so
 * that whoever cannot read the interface as it is can still find their own.
 */

import { LANGUAGES, LANGUAGE_NAMES, setLanguage, useLanguage, useT } from '@/i18n';

interface LanguageSwitchProps {
  className?: string;
}

const LanguageSwitch = ({ className = '' }: LanguageSwitchProps) => {
  const t = useT();
  const current = useLanguage();

  return (
    <div
      role="group"
      aria-label={t.common.language.label}
      className={`segmented compact language-switch flex-shrink-0 ${className}`}
    >
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          title={LANGUAGE_NAMES[language]}
          aria-label={LANGUAGE_NAMES[language]}
          aria-pressed={language === current}
          className={`uppercase tracking-wider ${language === current ? 'active' : ''}`}
          onClick={() => setLanguage(language)}
        >
          {language}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitch;
