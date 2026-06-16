// Family flame — a shared streak across every profile on the device. The flame
// grows by one each calendar day on which *all* profiles have practiced, and
// resets to zero once a full day passes with someone still missing.
//
// Per-profile "practiced today" is derived from the `thaitor_last_practice_<id>`
// keys that progression.ts writes after each session. Flame bookkeeping lives in
// its own localStorage keys.

import { getProfiles } from './store';

const FLAME_DAYS_KEY = 'thaitor_family_flame_days';
const FLAME_LAST_DAY_KEY = 'thaitor_family_flame_last_day';

const lastPracticeKey = (pid: string) => `thaitor_last_practice_${pid}`;

// Local calendar day (YYYY-MM-DD).
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_MS = 86400000;

function dayDiff(aKey: string, bKey: string): number {
  const a = new Date(`${aKey}T00:00:00`).getTime();
  const b = new Date(`${bKey}T00:00:00`).getTime();
  return Math.round((b - a) / DAY_MS);
}

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

// Did this profile practice on the given day?
function practicedOn(profileId: string, todayKey: string): boolean {
  const last = readString(lastPracticeKey(profileId));
  return last === todayKey;
}

export type FamilyMember = {
  id: string;
  name: string;
  emoji: string;
  practicedToday: boolean;
};

export type FamilyFlameState = {
  flameDays: number;
  allPracticedToday: boolean;
  members: FamilyMember[];
};

// Internal: reconcile the stored flame day count against the calendar.
// If the last increment day is older than yesterday and not everyone has been
// practicing since, the flame has lapsed and resets to zero. We keep it simple:
// the flame only survives if it was incremented today or yesterday.
function reconcileFlame(todayKey: string): number {
  let days = readNumber(FLAME_DAYS_KEY, 0);
  const lastDay = readString(FLAME_LAST_DAY_KEY);
  if (days > 0 && lastDay) {
    const gap = dayDiff(lastDay, todayKey);
    // gap 0 = incremented today, gap 1 = yesterday (still alive, today pending).
    if (gap > 1) {
      days = 0;
      writeNumber(FLAME_DAYS_KEY, 0);
    }
  }
  return days;
}

// Snapshot of the family flame for display. Reads all profiles from IDB and
// checks each one's practice date against today.
export async function getFamilyFlameState(): Promise<FamilyFlameState> {
  const todayKey = dayKey(new Date());
  // getProfiles() swallows IDB errors and returns [] on failure.
  const profiles = await getProfiles();

  const members: FamilyMember[] = profiles.map((p) => ({
    id: p.id,
    name: p.name ?? 'Me',
    emoji: p.emoji ?? '🧑',
    practicedToday: practicedOn(p.id, todayKey),
  }));

  const allPracticedToday =
    members.length > 0 && members.every((m) => m.practicedToday);

  const flameDays = reconcileFlame(todayKey);

  return { flameDays, allPracticedToday, members };
}

// Called from recordSession after a profile finishes practicing. If every
// profile has now practiced today and the flame hasn't already been incremented
// today, bump it. Synchronous-friendly: profiles come from IDB so this returns a
// promise, but callers may fire-and-forget.
export async function recordFamilyFlame(): Promise<void> {
  const todayKey = dayKey(new Date());

  // getProfiles() swallows IDB errors and returns [] on failure.
  const profiles = await getProfiles();

  // A flame only makes sense with at least two members.
  if (profiles.length < 2) return;

  // Bring the stored count up to date with the calendar first.
  reconcileFlame(todayKey);

  // Already counted today — nothing to do.
  if (readString(FLAME_LAST_DAY_KEY) === todayKey) return;

  const allPracticed = profiles.every((p) => practicedOn(p.id, todayKey));
  if (!allPracticed) return;

  writeNumber(FLAME_DAYS_KEY, readNumber(FLAME_DAYS_KEY, 0) + 1);
  writeString(FLAME_LAST_DAY_KEY, todayKey);
}
