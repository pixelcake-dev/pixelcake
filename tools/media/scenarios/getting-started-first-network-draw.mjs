// "Your first network", steps 1 to 3: a new project, a PC, a server and a firewall
// from the panel, put in a row and joined by two cables. Starts from the welcome screen.
import { VIEWPORT, WORDS, addThree, arrange, cable, createProject } from './getting-started-lib.mjs';

export default function scenario({ lang }) {
  const w = WORDS[lang];
  return {
    viewport: VIEWPORT,
    welcome: true,
    setup: [{ do: 'move', to: { x: 600, y: 120 }, ms: 100 }],
    steps: [
      ...createProject(w),
      { do: 'speed', factor: 2 },
      ...addThree(w),
      ...arrange(),
      { do: 'speed', factor: 1 },
      ...cable(),
      { do: 'hidePointer' },
      { do: 'wait', ms: 400 },
      { do: 'poster' },
      { do: 'wait', ms: 1800 },
    ],
  };
}
