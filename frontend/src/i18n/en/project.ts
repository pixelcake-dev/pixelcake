import type { Dictionary } from '../dictionary';

/** Names the app gives to a project and to its boards */
export const project: Dictionary['project'] = {
  /** A project nobody named */
  defaultName: 'Untitled project',

  /** A board nobody named: the first of a project, one added without a name, one of a file */
  canvasName: (number: number) => `Board ${number}`,

  /** A drawing found in the browser that no board of the project owns */
  recoveredCanvas: 'Recovered board',

  /** In the name of a file, for a project whose name leaves nothing to write */
  fileName: 'project',
};
