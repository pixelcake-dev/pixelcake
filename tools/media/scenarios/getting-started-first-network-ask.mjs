// "Your first network", steps 4 and 5: the window of the PC (its address, and the
// cable to port 1 of the firewall), then the Simulation panel: a ping from the PC to
// the server arrives, and the server turns green. The drawing is made in `setup`.
import { FIREWALL, PC, SERVER, VIEWPORT, WORDS, drawing, openDetails, runSimulation } from './getting-started-lib.mjs';

export default function scenario({ lang }) {
  const w = WORDS[lang];
  return {
    viewport: VIEWPORT,
    welcome: true,
    setup: [...drawing(w), { do: 'move', to: { x: 600, y: 140 }, ms: 100 }],
    steps: [
      { do: 'wait', ms: 700 },
      ...openDetails(w, PC),
      { do: 'wait', ms: 2600 },
      { do: 'click', to: { css: 'button', text: w.cancel }, ms: 600 },
      { do: 'waitFor', until: `!document.querySelector('.base-modal')`, after: 400 },
      { do: 'click', to: `button[aria-label="${w.simulation}"]`, ms: 700 },
      { do: 'wait', ms: 1800 },
      ...runSimulation(w, { holdAfter: 400 }),
      { do: 'hidePointer' },
      // (a beat before the poster: the screen can be a moment behind the page on a busy machine)
      { do: 'wait', ms: 1500 },
      { do: 'poster' },
      { do: 'wait', ms: 2200 },
    ],
  };
}
void FIREWALL;
void SERVER;
