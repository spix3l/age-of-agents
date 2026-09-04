import { parseSave, type SavedGame } from './SaveGame';

/**
 * The single save slot, kept in the browser's local storage.
 *
 * One slot, overwritten each time: this is a "put it down and come back to it" save, not a
 * campaign of branching files. Every access is wrapped, because storage is denied outright in a
 * private window and full on a busy one, and neither is a reason for the game to stop.
 */

const SAVE_KEY = 'age-of-agents:save';

function storage(): Storage | null {
  try {
    const local = globalThis.localStorage;
    return local ?? null;
  } catch {
    return null;
  }
}

export function writeSave(save: SavedGame): boolean {
  const local = storage();
  if (!local) return false;
  try {
    local.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function readSave(): SavedGame | null {
  const local = storage();
  if (!local) return null;
  try {
    const raw = local.getItem(SAVE_KEY);
    return raw === null ? null : parseSave(JSON.parse(raw));
  } catch {
    // A corrupt or half-written slot is worth exactly as much as an empty one.
    return null;
  }
}

export function clearSave(): void {
  try { storage()?.removeItem(SAVE_KEY); } catch { /* nothing to clean up */ }
}
