/**
 * The first question a sample suggests, once in a browser, over the top of
 * the board: «PC-Vendite raggiunge Web-Gestionale?», the command that asks
 * it, and a button that opens the terminal and runs it there, the packet
 * going over the board. Put away with its cross, or by using it.
 */

import { Fragment, useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { useGuideStore } from '@/store/guideStore';
import { useUIStore } from '@/store/uiStore';
import { firstTryCommand, type FirstTry } from '@/utils/firstSteps';
import { useT } from '@/i18n';

const FirstTryHint = ({ question }: { question: FirstTry }) => {
  const t = useT();
  const titleId = useId();
  const firstTryShown = useGuideStore(state => state.firstTryShown);
  const dismiss = useGuideStore(state => state.dismissFirstTry);
  const runInTerminal = useUIStore(state => state.runInTerminal);
  const command = firstTryCommand(question);

  // On screen: it is not suggested again in this browser
  useEffect(() => {
    firstTryShown();
  }, [firstTryShown]);

  const tryIt = () => {
    dismiss();
    runInTerminal(command);
  };

  return (
    <section className="first-try" aria-labelledby={titleId}>
      <div className="first-try-head">
        <h2 id={titleId} className="first-try-title">
          {t.guide.firstTry.title}
        </h2>
        <button
          type="button"
          className="first-try-close"
          onClick={dismiss}
          aria-label={t.guide.firstTry.close}
          title={t.guide.firstTry.close}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <p className="first-try-question">{t.guide.firstTry.question(question.from, question.to)}</p>
      <div className="first-try-row">
        {/* (a narrow window breaks the command between its words, never inside a name) */}
        <code className="first-try-command">
          {command.split(' ').map((word, index) => (
            <Fragment key={index}>
              {index > 0 && ' '}
              <span className="first-try-word">{word}</span>
            </Fragment>
          ))}
        </code>
        <button type="button" className="first-try-run" onClick={tryIt}>
          {t.guide.firstTry.run}
        </button>
      </div>
    </section>
  );
};

export default FirstTryHint;
