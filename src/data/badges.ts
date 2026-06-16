// Badge system — Learning badges (auto-triggered milestones) and Field badges
// (user-initiated "I said it in Thailand!" moments).
// All state persisted in localStorage.

import { TONE_ORDER, type ToneKey } from '../themes/constants';
import type { SRSRecord } from './store';
import { getActiveProfileId } from './profiles';

const LOCAL_PROFILE_ID = 'local';

const learningKey = (pid: string) => `thaitor_badges_${pid}`;
const fieldKey = (pid: string) => `thaitor_field_badges_${pid}`;

// Legacy (pre-multi-profile) global keys. Migrated once into the 'local'
// profile namespace on first access, then removed.
const LEGACY_BADGE_KEYS: Record<string, (pid: string) => string> = {
  thaitor_badges: learningKey,
  thaitor_field_badges: fieldKey,
};

let badgesMigrated = false;

function migrateLegacyBadges(): void {
  if (badgesMigrated) return;
  badgesMigrated = true;
  try {
    for (const [oldKey, nsKey] of Object.entries(LEGACY_BADGE_KEYS)) {
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

// --- Learning badges ---------------------------------------------------------

export type LearningBadge = {
  id: string;
  label: string;
  emoji: string;
  description: string;
};

export const LEARNING_BADGES: LearningBadge[] = [
  {
    id: 'first-lotus',
    label: 'First Bloom',
    emoji: '🪷',
    description: 'Brought your first phrase to mastery.',
  },
  {
    id: 'streak-7',
    label: 'Seven Days',
    emoji: '🔥',
    description: 'Practiced 7 days in a row.',
  },
  {
    id: 'reviews-100',
    label: 'Centurion',
    emoji: '💯',
    description: 'Completed 100 reviews.',
  },
  {
    id: 'all-tones',
    label: 'Five Tones',
    emoji: '🎵',
    description: 'Cleared all 5 tones in Tone Pop.',
  },
  {
    id: 'ladder-r0',
    label: 'First Rung',
    emoji: '🪜',
    description: 'Cleared the first rung of the Consonant Ladder.',
  },
  {
    id: 'dojo-streak-10',
    label: 'Sharp Ears',
    emoji: '🥋',
    description: 'Hit a 10-in-a-row streak in the Tone Pair Dojo.',
  },
  {
    id: 'first-field',
    label: 'Out in the Wild',
    emoji: '🌏',
    description: 'Earned your first field badge in Thailand.',
  },
];

const LEARNING_BY_ID = new Map(LEARNING_BADGES.map((b) => [b.id, b]));

export function getLearningBadgeDef(id: string): LearningBadge | undefined {
  return LEARNING_BY_ID.get(id);
}

// Storage shape: { [badgeId]: isoTimestamp }
export function getBadges(profileId: string = getActiveProfileId()): Record<string, string> {
  migrateLegacyBadges();
  try {
    const raw = localStorage.getItem(learningKey(profileId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeBadges(badges: Record<string, string>, profileId: string): void {
  try {
    localStorage.setItem(learningKey(profileId), JSON.stringify(badges));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

// Award a learning badge. Returns true if newly awarded, false if already held.
export function awardBadge(id: string, profileId: string = getActiveProfileId()): boolean {
  const badges = getBadges(profileId);
  if (badges[id]) return false;
  badges[id] = new Date().toISOString();
  writeBadges(badges, profileId);
  return true;
}

// --- Learning badge evaluation -----------------------------------------------

export type BadgeContext = {
  totalXP?: number;
  streak?: number;
  totalReviews?: number;
  // SRS records — pass when cheaply available so we can evaluate mastery and
  // per-tone clears without forcing a fresh IndexedDB read.
  srsRecords?: SRSRecord[];
  rungR0Cleared?: boolean;
  // Best in-session streak from a Tone Pair Dojo round, if just finished.
  dojoStreak?: number;
};

// Tone Pop persists per-tone progress under these srs keys (see TonePop).
function tonePopKey(tone: ToneKey): string {
  return `tonepop-${tone}`;
}

// Evaluate all learning-badge conditions, award any newly met, and return the
// ids that were newly awarded.
export function checkAndAwardBadges(context: BadgeContext): string[] {
  const awarded: string[] = [];
  const records = context.srsRecords ?? [];

  // First phrase at mastery — any SRS record with repetitions >= 5.
  if (records.some((r) => r.repetitions >= 5)) {
    if (awardBadge('first-lotus')) awarded.push('first-lotus');
  }

  // 7-day streak.
  if ((context.streak ?? 0) >= 7) {
    if (awardBadge('streak-7')) awarded.push('streak-7');
  }

  // 100 total reviews.
  if ((context.totalReviews ?? 0) >= 100) {
    if (awardBadge('reviews-100')) awarded.push('reviews-100');
  }

  // All 5 tones cleared in Tone Pop — one graded SRS record per tone.
  if (records.length > 0) {
    const graded = new Set(records.map((r) => r.phraseId));
    const allTones = TONE_ORDER.every((tone) => graded.has(tonePopKey(tone)));
    if (allTones) {
      if (awardBadge('all-tones')) awarded.push('all-tones');
    }
  }

  // Consonant Ladder r0 cleared.
  if (context.rungR0Cleared) {
    if (awardBadge('ladder-r0')) awarded.push('ladder-r0');
  }

  // Tone Pair Dojo 10-item streak in a single session.
  if ((context.dojoStreak ?? 0) >= 10) {
    if (awardBadge('dojo-streak-10')) awarded.push('dojo-streak-10');
  }

  // Meta-badge: first field badge earned.
  if (Object.keys(getFieldBadges()).length > 0) {
    if (awardBadge('first-field')) awarded.push('first-field');
  }

  return awarded;
}

// --- Field badges ------------------------------------------------------------

export type FieldBadge = {
  id: string;
  label: string;
  emoji: string;
};

export const FIELD_BADGES: FieldBadge[] = [
  { id: 'ordered-food', label: 'Ordered food', emoji: '🍜' },
  { id: 'asked-directions', label: 'Asked directions', emoji: '🧭' },
  { id: 'haggled-market', label: 'Haggled at the market', emoji: '🏷️' },
  { id: 'said-thank-you', label: 'Said thank you', emoji: '🙏' },
  { id: 'gave-wai', label: 'Gave a wai', emoji: '🧎' },
  { id: 'read-sign', label: 'Read a sign', emoji: '🪧' },
  { id: 'ordered-coffee', label: 'Ordered coffee', emoji: '☕' },
  { id: 'said-goodbye', label: 'Said goodbye', emoji: '👋' },
  { id: 'used-particle', label: 'Used a particle', emoji: '💬' },
  { id: 'said-numbers', label: 'Said numbers', emoji: '🔢' },
  { id: 'negotiated-taxi', label: 'Negotiated a taxi', emoji: '🚕' },
  { id: 'asked-price', label: 'Asked the price', emoji: '💵' },
];

// Reserved id for the per-profile custom field badge slot.
export const CUSTOM_FIELD_BADGE_ID = 'custom';

export type FieldBadgeRecord = {
  earnedAt: string;
  phraseId?: string;
  note?: string;
};

// Storage shape: { [badgeId]: { earnedAt, phraseId?, note? } }
export function getFieldBadges(
  profileId: string = getActiveProfileId(),
): Record<string, FieldBadgeRecord> {
  migrateLegacyBadges();
  try {
    const raw = localStorage.getItem(fieldKey(profileId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, FieldBadgeRecord>)
      : {};
  } catch {
    return {};
  }
}

function writeFieldBadges(
  badges: Record<string, FieldBadgeRecord>,
  profileId: string,
): void {
  try {
    localStorage.setItem(fieldKey(profileId), JSON.stringify(badges));
  } catch {
    // ignore storage failures
  }
}

// Award a field badge. Overwrites any prior record for the same id (re-earning
// updates the linked phrase / note / timestamp). Returns the stored record.
export function awardFieldBadge(
  id: string,
  opts?: { phraseId?: string; note?: string },
  profileId: string = getActiveProfileId(),
): FieldBadgeRecord {
  const badges = getFieldBadges(profileId);
  const record: FieldBadgeRecord = {
    earnedAt: new Date().toISOString(),
    ...(opts?.phraseId ? { phraseId: opts.phraseId } : {}),
    ...(opts?.note ? { note: opts.note } : {}),
  };
  badges[id] = record;
  writeFieldBadges(badges, profileId);
  return record;
}
