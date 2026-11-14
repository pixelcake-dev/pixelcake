import type { Dictionary } from '../dictionary';

/** The welcome screen */
export const welcome: Dictionary['welcome'] = {
  steps: {
    draw: { title: 'Draw', text: 'add devices and connect them' },
    configure: { title: 'Configure', text: 'addresses, VLANs, routes, firewall rules' },
    ask: { title: 'Ask', text: 'send a packet and see where it stops, and why' },
  },
  newProject: 'New project',
  openProject: 'Open project',
  loadSample: 'Load the sample network',
  codeOnGitHub: 'Code on GitHub',
  guide: 'Guide',
  reportProblem: 'Report a problem',
  doNotShowAgain: 'Do not show this screen again',
};
