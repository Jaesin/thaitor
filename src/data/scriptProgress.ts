/*
 * Script Ladder rung progression — persisted in localStorage.
 * A rung is "cleared" once all of its items have been SRS-graduated at least
 * once (handled by ScriptPop reporting). Unlock state derives from clears.
 */

import { RUNG_ORDER } from './script';

function clearedKey(rungId: string): string {
  return `thaitor_rung_${rungId}_cleared`;
}

export function isRungCleared(rungId: string): boolean {
  try {
    return localStorage.getItem(clearedKey(rungId)) === '1';
  } catch {
    return false;
  }
}

export function setRungCleared(rungId: string): void {
  try {
    localStorage.setItem(clearedKey(rungId), '1');
  } catch {
    // ignore storage failures
  }
}

// A rung is unlocked when it is the first rung or the previous rung is cleared.
export function isRungUnlocked(rungId: string): boolean {
  const idx = RUNG_ORDER.indexOf(rungId);
  if (idx <= 0) return true;
  return isRungCleared(RUNG_ORDER[idx - 1]);
}

export type RungState = 'locked' | 'unlocked' | 'cleared';

export function rungState(rungId: string): RungState {
  if (isRungCleared(rungId)) return 'cleared';
  return isRungUnlocked(rungId) ? 'unlocked' : 'locked';
}
