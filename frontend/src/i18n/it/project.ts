/** Names the app gives to a project and to its boards */
export const project = {
  /** A project nobody named */
  defaultName: 'Progetto senza nome',

  /** A canvas nobody named: the first of a project, one added without a name, one of a file */
  canvasName: (number: number) => `Canvas ${number}`,

  /** A drawing found in the browser that no canvas of the project owns */
  recoveredCanvas: 'Canvas recuperato',

  /** In the name of a file, for a project whose name leaves nothing to write */
  fileName: 'progetto',
};
