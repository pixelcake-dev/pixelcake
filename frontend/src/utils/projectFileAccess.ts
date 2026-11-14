/**
 * Saving the project to a file and opening one.
 *
 * Where the browser has the File System Access API the file is written in
 * place and remembered for the session; elsewhere saving downloads the file
 * and opening goes through a file input. The API is looked up at every call,
 * never at import.
 *
 * This is the layer the menus, the explorer, the welcome screen and Ctrl+S
 * call: it talks to the user (pickers, confirmation, toasts) and leaves the
 * project itself to the stores.
 */

import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore, type NewProjectInput } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { askConfirm, type ConfirmQuestion } from '@/store/confirmStore';
import { parseProjectFile, projectFileName, serializeProject } from './projectFile';
import { getT } from '@/i18n';

// ---------- File System Access API: only what is used here ----------
// (showSaveFilePicker / showOpenFilePicker are not in TypeScript's DOM lib)

interface WritableFileStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface ProjectFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFileStream>;
}

interface FilePickerType {
  description: string;
  accept: Record<string, string[]>;
}

interface FilePickerHost {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: FilePickerType[];
  }) => Promise<ProjectFileHandle>;
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: FilePickerType[];
  }) => Promise<ProjectFileHandle[]>;
}

/** Read when a picker opens: its words are in the language of that moment */
function fileTypes(): FilePickerType[] {
  return [{ description: getT().files.fileType, accept: { 'application/json': ['.json'] } }];
}

function pickerHost(): Window & FilePickerHost {
  return window;
}

// ---------- module state (this session only, never persisted) ----------

/** The file the project was last saved to / opened from: "Salva" writes it in place */
let currentHandle: ProjectFileHandle | null = null;

/** A native picker is open: a second one would be refused by the browser */
let pickerOpen = false;

/** A file input waiting for the user's choice (fallback path) */
let pendingInput: { settle: (file: File | null) => void } | null = null;

export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled' | 'failed';
export type OpenOutcome = 'opened' | 'cancelled' | 'failed';

// ---------- helpers ----------

/** The user closed a picker without choosing: not an error */
function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

function reasonOf(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined;
}

/** The project as file text, with the edit position it corresponds to */
function snapshotProject(): { text: string; changeToken: number } {
  const changeToken = useNetworkStore.getState().getChangeToken();
  const text = serializeProject(useProjectStore.getState().buildProjectFile());
  return { text, changeToken };
}

function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(file);
  });
}

/** Fallback for browsers without showOpenFilePicker: a hidden file input */
function pickFileWithInput(): Promise<File | null> {
  // A chooser dismissed without any event (older browsers) is dropped here
  pendingInput?.settle(null);

  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';

    const pending = {
      settle: (file: File | null) => {
        if (pendingInput === pending) pendingInput = null;
        input.remove();
        resolve(file);
      },
    };
    input.addEventListener('change', () => pending.settle(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => pending.settle(null));

    pendingInput = pending;
    document.body.appendChild(input);
    input.click();
  });
}

/** Ask the user for a project file; null when they chose none */
async function pickFile(): Promise<{ file: File; handle: ProjectFileHandle | null } | null> {
  const host = pickerHost();
  if (typeof host.showOpenFilePicker !== 'function') {
    const file = await pickFileWithInput();
    return file ? { file, handle: null } : null;
  }

  if (pickerOpen) return null;
  pickerOpen = true;
  try {
    const [handle] = await host.showOpenFilePicker({ multiple: false, types: fileTypes() });
    return { file: await handle.getFile(), handle };
  } finally {
    pickerOpen = false;
  }
}

async function save(askWhere: boolean): Promise<SaveOutcome> {
  const host = pickerHost();
  const fileName = projectFileName(useProjectStore.getState().name);

  // No File System Access API: the file is downloaded
  if (typeof host.showSaveFilePicker !== 'function') {
    const { text, changeToken } = snapshotProject();
    downloadText(text, fileName);
    useNetworkStore.getState().markSaved(changeToken);
    toast.success(getT().files.downloaded(fileName));
    return 'downloaded';
  }

  let handle = askWhere ? null : currentHandle;
  if (!handle) {
    if (pickerOpen) return 'cancelled';
    pickerOpen = true;
    try {
      handle = await host.showSaveFilePicker({ suggestedName: fileName, types: fileTypes() });
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
      console.error('[ProjectFile] Save picker failed:', error);
      toast.error(getT().files.cannotChooseWhere, { description: reasonOf(error) });
      return 'failed';
    } finally {
      pickerOpen = false;
    }
  }

  // Taken once the picker is closed, so it holds the project as it is now
  const { text, changeToken } = snapshotProject();
  try {
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  } catch (error) {
    if (isAbort(error)) return 'cancelled';
    console.error('[ProjectFile] Write failed:', error);
    // Do not keep writing to a file that refuses: next time ask where to save
    if (handle === currentHandle) currentHandle = null;
    toast.error(getT().files.cannotSaveTo(handle.name), {
      description: getT().files.useSaveAs,
    });
    return 'failed';
  }

  currentHandle = handle;
  // An edit made while the file was being written is not in it: the token
  // keeps the project marked as changed in that case
  useNetworkStore.getState().markSaved(changeToken);
  toast.success(getT().files.saved, { description: handle.name });
  return 'saved';
}

// ---------- public API ----------

/** Asked before the open project is replaced while it has changes not saved to a file */
export function discardChangesQuestion(): ConfirmQuestion {
  const { discardChanges } = getT().files;
  return {
    title: discardChanges.title,
    detail: discardChanges.detail,
    confirmLabel: discardChanges.confirm,
    danger: true,
  };
}

/**
 * True when the open project can be replaced: it has no changes waiting to
 * be saved to a file, or the user accepts to lose them.
 */
export async function confirmDiscardChanges(): Promise<boolean> {
  if (!useNetworkStore.getState().hasUnsavedChanges) return true;
  return askConfirm(discardChangesQuestion());
}

/** File → Salva, Ctrl+S: write to the file of this session, or ask where */
export function saveProject(): Promise<SaveOutcome> {
  return save(false);
}

/** File → Salva con nome…: always ask where */
export function saveProjectAs(): Promise<SaveOutcome> {
  return save(true);
}

/**
 * File → Apri…: replace the open project with the one in a file.
 *
 * The picker opens first and the confirmation for unsaved changes comes once
 * a valid file has been chosen, right before anything is replaced: browsers
 * only show a file picker within a few seconds of the click, and a question
 * left open longer than that would make the picker fail.
 */
export async function openProject(): Promise<OpenOutcome> {
  let picked: { file: File; handle: ProjectFileHandle | null } | null;
  let text: string;
  try {
    picked = await pickFile();
    if (!picked) return 'cancelled';
    text = await readText(picked.file);
  } catch (error) {
    if (isAbort(error)) return 'cancelled';
    console.error('[ProjectFile] Open failed:', error);
    toast.error(getT().files.cannotRead, { description: reasonOf(error) });
    return 'failed';
  }

  const result = parseProjectFile(text);
  if (!result.ok) {
    toast.error(getT().files.cannotOpen(picked.file.name), { description: result.error });
    return 'failed';
  }

  if (!(await confirmDiscardChanges())) return 'cancelled';

  useProjectStore.getState().loadProject(result.project);
  currentHandle = picked.handle;
  useUIStore.getState().setShowWelcomeScreen(false);

  const { project, warnings } = result;
  if (warnings.length === 0) {
    toast.success(getT().files.opened(project.name));
  } else {
    toast.warning(getT().files.openedWithRepairs(project.name), {
      description: warnings.join('\n'),
      descriptionClassName: 'whitespace-pre-line',
      duration: 12000,
    });
  }
  return 'opened';
}

/**
 * File → Nuovo progetto…: ask before losing unsaved changes, then show the
 * form. False when the user chose to keep the open project.
 */
export async function requestNewProject(): Promise<boolean> {
  if (!(await confirmDiscardChanges())) return false;
  useUIStore.getState().openModal('newProject');
  return true;
}

/** Replace the open project with a new, empty one (the form of NewProjectModal) */
export function createNewProject(input: NewProjectInput): void {
  useProjectStore.getState().createProject(input);
  // The new project has no file yet: "Salva" must ask where
  currentHandle = null;
  useUIStore.getState().setShowWelcomeScreen(false);
  toast.success(getT().files.created(useProjectStore.getState().name));
}

/** Ctrl+S (Cmd+S) anywhere in the app saves the project; returns the cleanup */
export function registerSaveShortcut(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (event.key.toLowerCase() !== 's') return;
    // Never the browser's own "save page as"
    event.preventDefault();
    if (event.repeat) return;
    void saveProject();
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
