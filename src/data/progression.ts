// Progression system — XP, streaks, rest tokens, and Temple Path ranks.
// All state persisted in localStorage, namespaced per active profile.

import { getActiveProfileId } from './profiles';
import { recordFamilyFlame } from './family';

const LOCAL_PROFILE_ID = 'local';

const xpKey = (pid: string) => `thaitor_total_xp_${pid}`;
const lastPracticeKey = (pid: string) => `thaitor_last_practice_${pid}`;
const streakKey = (pid: string) => `thaitor_streak_${pid}`;
const restTokensKey = (pid: string) => `thaitor_rest_tokens_${pid}`;
const totalReviewsKey = (pid: string) => `thaitor_total_reviews_${pid}`;

// Legacy (pre-multi-profile) global keys. Migrated once into the 'local'
// profile's namespaced keys on first access, then removed.
const LEGACY_KEYS: Record<string, (pid: string) => string> = {
  thaitor_total_xp: xpKey,
  thaitor_last_practice: lastPracticeKey,
  thaitor_streak: streakKey,
  thaitor_rest_tokens: restTokensKey,
  thaitor_total_reviews: totalReviewsKey,
};

let migrated = false;

// Copy any legacy global progression values into the 'local' profile namespace,
// then delete the originals. Runs at most once per page load.
function migrateLegacy(): void {
  if (migrated) return;
  migrated = true;
  try {
    for (const [oldKey, nsKey] of Object.entries(LEGACY_KEYS)) {
      const val = localStorage.getItem(oldKey);
      if (val == null) continue;
      const target = nsKey(LOCAL_PROFILE_ID);
      if (localStorage.getItem(target) == null) {
        localStorage.setItem(target, val);
      }
      localStorage.removeItem(oldKey);
    }
  } catch {
    /* ignore storage failures */
  }
}

export type Rank = {
  name: string; // English label
  thai: string; // Thai title
  minXP: number;
  nextXP: number | null; // XP needed to reach the next rank, or null at max
};

// Temple Path ranks in ascending XP order.
export const RANKS: { name: string; thai: string; minXP: number }[] = [
  { name: 'Traveller', thai: 'นักเดินทาง', minXP: 0 },
  { name: 'Language Learner', thai: 'ผู้เรียนภาษา', minXP: 100 },
  { name: 'Thai Speaker', thai: 'นักพูดภาษาไทย', minXP: 300 },
  { name: 'Culture Knower', thai: 'ผู้รู้วัฒนธรรม', minXP: 700 },
  { name: 'Temple Guardian', thai: 'ผู้พิทักษ์วัด', minXP: 1500 },
];

const REST_TOKEN_INTERVAL = 7; // earn 1 rest token every 7 streak days
const DAY_MS = 86400000;

// --- storage helpers ---

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

function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

function readDate(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeDate(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

// Local calendar day (YYYY-MM-DD) for the given Date.
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Whole-day difference between two day keys (b - a), based on local midnight.
function dayDiff(aKey: string, bKey: string): number {
  const a = new Date(`${aKey}T00:00:00`).getTime();
  const b = new Date(`${bKey}T00:00:00`).getTime();
  return Math.round((b - a) / DAY_MS);
}

// --- public API ---

export function getTotalXP(profileId: string = getActiveProfileId()): number {
  migrateLegacy();
  return readNumber(xpKey(profileId), 0);
}

// Cumulative count of reviewed items across all sessions.
export function getTotalReviews(profileId: string = getActiveProfileId()): number {
  migrateLegacy();
  return readNumber(totalReviewsKey(profileId), 0);
}

export function getStreak(
  profileId: string = getActiveProfileId(),
): { count: number; tokens: number } {
  migrateLegacy();
  return {
    count: readNumber(streakKey(profileId), 0),
    tokens: readNumber(restTokensKey(profileId), 0),
  };
}

// XP formula: 10 per reviewed phrase + 20 bonus if 100% correct.
export function sessionXP(correct: number, reviewed: number): number {
  if (reviewed <= 0) return 0;
  const base = reviewed * 10;
  const bonus = correct >= reviewed ? 20 : 0;
  return base + bonus;
}

export function getRank(xp: number): Rank {
  let current = RANKS[0];
  let next: { minXP: number } | null = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].minXP) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? null;
    } else {
      break;
    }
  }
  return {
    name: current.name,
    thai: current.thai,
    minXP: current.minXP,
    nextXP: next ? next.minXP : null,
  };
}

// Advance the streak given the last practice day key (or null) and today's key.
// Returns the new streak state without persisting.
function advanceStreak(
  lastKey: string | null,
  todayKey: string,
  prevCount: number,
  prevTokens: number,
): { count: number; tokens: number; changed: boolean } {
  // First ever session.
  if (!lastKey) {
    return { count: 1, tokens: 0, changed: true };
  }

  const gap = dayDiff(lastKey, todayKey);

  // Same day — idempotent, no change.
  if (gap <= 0) {
    return { count: prevCount, tokens: prevTokens, changed: false };
  }

  // Consecutive day.
  if (gap === 1) {
    const count = prevCount + 1;
    let tokens = prevTokens;
    if (count % REST_TOKEN_INTERVAL === 0) tokens += 1;
    return { count, tokens, changed: true };
  }

  // Missed a day (or more) but a rest token can absorb it.
  if (prevTokens > 0) {
    const count = prevCount + 1;
    let tokens = prevTokens - 1;
    if (count % REST_TOKEN_INTERVAL === 0) tokens += 1;
    return { count, tokens, changed: true };
  }

  // Streak broken — restart.
  return { count: 1, tokens: 0, changed: true };
}

// Record a completed session. Awards XP, updates the streak, and reports
// whether the user crossed into a new rank.
export function recordSession(
  correct: number,
  reviewed: number,
  profileId: string = getActiveProfileId(),
): {
  xpEarned: number;
  newTotal: number;
  streak: { count: number; tokens: number };
  rankUp: boolean;
  totalReviews: number;
} {
  migrateLegacy();

  const prevTotal = getTotalXP(profileId);
  const xpEarned = sessionXP(correct, reviewed);
  const newTotal = prevTotal + xpEarned;

  const totalReviews = getTotalReviews(profileId) + Math.max(0, reviewed);
  writeNumber(totalReviewsKey(profileId), totalReviews);

  const prevRank = getRank(prevTotal);
  const nextRank = getRank(newTotal);
  const rankUp = nextRank.minXP > prevRank.minXP;

  writeNumber(xpKey(profileId), newTotal);

  const todayKey = dayKey(new Date());
  const lastKey = readDate(lastPracticeKey(profileId));
  const { count, tokens, changed } = advanceStreak(
    lastKey,
    todayKey,
    readNumber(streakKey(profileId), 0),
    readNumber(restTokensKey(profileId), 0),
  );

  if (changed) {
    writeNumber(streakKey(profileId), count);
    writeNumber(restTokensKey(profileId), tokens);
  }
  writeDate(lastPracticeKey(profileId), todayKey);

  // Update the shared family flame now that this profile has practiced today.
  recordFamilyFlame();

  return {
    xpEarned,
    newTotal,
    streak: { count, tokens },
    rankUp,
    totalReviews,
  };
}
