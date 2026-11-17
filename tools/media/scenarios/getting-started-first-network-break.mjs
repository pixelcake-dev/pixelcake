// "Your first network", step 6: a rule that denies ping from the PC to the server is
// written in the Rules tab of the firewall, and the same question stops at the firewall,
// with the reason. The drawing is made in `setup`, with the Simulation panel open.
import { FIREWALL, PC, VIEWPORT, WORDS, chooseNext, drawing, fillField, openDetails, runSimulation } from './getting-started-lib.mjs';

export default function scenario({ lang }) {
  const w = WORDS[lang];
  return {
    viewport: VIEWPORT,
    welcome: true,
    setup: [
      ...drawing(w),
      { do: 'click', to: `button[aria-label="${w.simulation}"]`, ms: 200 },
      { do: 'move', to: { x: 600, y: 140 }, ms: 100 },
    ],
    steps: [
      { do: 'wait', ms: 700 },
      ...openDetails(w, FIREWALL),
      { do: 'click', to: { css: '.base-modal button', text: w.rulesTab }, ms: 600 },
      { do: 'wait', ms: 700 },
      { do: 'click', to: { css: 'button', text: w.addRule }, ms: 600 },
      { do: 'wait', ms: 600 },
      { do: 'speed', factor: 1.5 },
      ...chooseNext(w.action),
      ...chooseNext(w.service),
      ...fillField(w.source, 'any', '192.168.1.2'),
      ...fillField(w.destination, 'any', '192.168.1.3'),
      { do: 'speed', factor: 1 },
      { do: 'wait', ms: 1800 },
      { do: 'click', to: { css: '.modal-actions button', text: w.save }, ms: 600 },
      { do: 'waitFor', until: `!document.querySelector('.base-modal')`, after: 500 },
      ...runSimulation(w, { holdAfter: 600 }),
      { do: 'hidePointer' },
      { do: 'poster' },
      { do: 'wait', ms: 3200 },
    ],
  };
}
void PC;
