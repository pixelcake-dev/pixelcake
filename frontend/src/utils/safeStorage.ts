/**
 * localStorage wrapper for the persisted stores.
 *
 * A failed write (quota exceeded, storage disabled) must not throw into the
 * action that changed the state: the change stays in memory and the user is
 * told, once, to save the project to a file.
 */

import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { toast } from 'sonner';
import { getT } from '@/i18n';

/** Keys whose last write failed; one toast per run of failures, not per write */
const failingKeys = new Set<string>();

const safeLocalStorage: StateStorage = {
  getItem: name => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      failingKeys.delete(name);
    } catch (error) {
      if (failingKeys.size === 0) {
        console.warn(`[Storage] Could not write "${name}":`, error);
        toast.error(getT().files.storageFull, { id: 'storage-full', duration: 15000 });
      }
      failingKeys.add(name);
    }
  },
  removeItem: name => localStorage.removeItem(name),
};

/** `storage` option for zustand `persist`: same format as the default one */
export function safeJSONStorage<S>() {
  return createJSONStorage<S>(() => safeLocalStorage);
}
