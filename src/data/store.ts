import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Syllable } from '../worker/api';
import { BUILT_IN_PHRASES } from './phrases';
import { syncHistory, syncPhrase, syncProfile, syncSRS } from './sync';

type Particle = 'khrap' | 'kha' | 'neutral';

export type HistoryEntry = {
  id: string;
  en: string;
  syllables: Syllable[];
  rtgs?: string;
  particle: Particle;
  starred: boolean;
  at: string;
  updatedAt: string;
};

export type PhrasebookEntry = {
  id: string;
  en: string;
  syllables: Syllable[];
  rtgs?: string;
  particle: Particle;
  category: string;
  starred: boolean;
  builtIn: boolean;
  updatedAt: string;
};

export type SpeakerGender = 'male' | 'female' | 'neutral';

export type ProfileEntry = {
  id: string;
  name?: string;
  emoji?: string;
  kidMode?: boolean;
  speakerGender?: SpeakerGender;
  defaultVoice?: string;
  defaultEnVoice?: string;
  updatedAt: string;
};

export type Stage = 'seed' | 'sprout' | 'blossom' | 'lotus';

// Derive a growth stage from the SM-2 repetition count.
// 0 → seed (new), 1 → sprout, 2 → blossom, >=3 → lotus (mastered).
export function getStage(repetitions: number): Stage {
  if (repetitions <= 0) return 'seed';
  if (repetitions === 1) return 'sprout';
  if (repetitions === 2) return 'blossom';
  return 'lotus';
}

export const STAGE_EMOJI: Record<Stage, string> = {
  seed: '🌱',
  sprout: '🌿',
  blossom: '🌸',
  lotus: '🪷',
};

export type SRSRecord = {
  phraseId: string;       // key; matches phrasebook entry id
  interval: number;       // days until next review
  dueAt: string;          // ISO timestamp — review when dueAt <= now
  easeFactor: number;     // SM-2 ease factor, starts at 2.5
  repetitions: number;    // count of successful reviews
  stage?: Stage;          // growth stage derived from repetitions
  createdAt: string;
  lastReviewedAt?: string;
};

interface ThaitorDB extends DBSchema {
  history: { key: string; value: HistoryEntry };
  phrasebook: { key: string; value: PhrasebookEntry };
  profile: { key: string; value: ProfileEntry };
  profiles: { key: string; value: ProfileEntry };
  srs: { key: string; value: SRSRecord };
}

const DB_NAME = 'thaitor';
const DB_VERSION = 3;

export const LOCAL_PROFILE_ID = 'local';

let dbPromise: Promise<IDBPDatabase<ThaitorDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ThaitorDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ThaitorDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('phrasebook')) db.createObjectStore('phrasebook', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('srs')) db.createObjectStore('srs', { keyPath: 'phraseId' });

        // v3: multi-profile support.
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('profiles')) {
            db.createObjectStore('profiles', { keyPath: 'id' });
          }

          // Seed the 'profiles' store with a 'local' entry, reusing any existing
          // single-profile name if present.
          const profilesStore = tx.objectStore('profiles');
          const existingLocal = await profilesStore.get(LOCAL_PROFILE_ID);
          if (!existingLocal) {
            let name: string | undefined;
            try {
              const legacy = await tx.objectStore('profile').get(LOCAL_PROFILE_ID);
              name = legacy?.name;
            } catch {
              /* no legacy profile */
            }
            const kidMode =
              (typeof localStorage !== 'undefined' &&
                localStorage.getItem('thaitor_kid_mode') === 'on') ||
              false;
            await profilesStore.put({
              id: LOCAL_PROFILE_ID,
              name: name ?? 'Me',
              emoji: '🧑',
              kidMode,
              speakerGender: 'neutral',
              updatedAt: new Date().toISOString(),
            });
          }

          // Migrate existing SRS records: re-key from `phraseId` to
          // `local:phraseId` so existing progress belongs to the local profile.
          const srsStore = tx.objectStore('srs');
          const all = await srsStore.getAll();
          for (const rec of all) {
            if (rec.phraseId.includes(':')) continue; // already namespaced
            const original = rec.phraseId;
            await srsStore.delete(original);
            await srsStore.put({ ...rec, phraseId: `${LOCAL_PROFILE_ID}:${original}` });
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const all = await (await getDB()).getAll('history');
    return all.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  } catch {
    return [];
  }
}

// Deterministic id for a history row derived from the English phrase, so the
// same phrase reuses (overwrites) its row instead of creating duplicates.
export function historyId(en: string): string {
  return `en:${en.trim().toLowerCase()}`;
}

export async function putHistory(entry: Omit<HistoryEntry, 'updatedAt'>): Promise<void> {
  try {
    const record: HistoryEntry = { ...entry, updatedAt: new Date().toISOString() };
    await (await getDB()).put('history', record);
    syncHistory(record).catch(() => {});
  } catch {
    /* unavailable */
  }
}

export async function getPhrasebook(): Promise<PhrasebookEntry[]> {
  try {
    return await (await getDB()).getAll('phrasebook');
  } catch {
    return [];
  }
}

export async function putPhrase(entry: Omit<PhrasebookEntry, 'updatedAt'>): Promise<void> {
  try {
    const record: PhrasebookEntry = { ...entry, updatedAt: new Date().toISOString() };
    await (await getDB()).put('phrasebook', record);
    syncPhrase(record).catch(() => {});
  } catch {
    /* unavailable */
  }
}

export async function getProfile(): Promise<ProfileEntry | null> {
  try {
    return (await (await getDB()).get('profile', 'local')) ?? null;
  } catch {
    return null;
  }
}

export async function putProfile(entry: Omit<ProfileEntry, 'updatedAt'>): Promise<void> {
  try {
    const record: ProfileEntry = { ...entry, updatedAt: new Date().toISOString() };
    await (await getDB()).put('profile', record);
    syncProfile(record).catch(() => {});
  } catch {
    /* unavailable */
  }
}

// --- per-profile SRS key namespacing -----------------------------------------
//
// SRS records are stored under a profile-prefixed key (`${profileId}:${phraseId}`)
// so each family member keeps separate spaced-repetition progress. Callers keep
// passing/receiving bare phraseIds — the prefix is added on write and stripped
// on read. The active profile id is read straight from localStorage to avoid an
// import cycle with profiles.ts.
const ACTIVE_PROFILE_KEY = 'thaitor_active_profile';

function activeProfileId(): string {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || LOCAL_PROFILE_ID;
  } catch {
    return LOCAL_PROFILE_ID;
  }
}

function srsKey(phraseId: string): string {
  return `${activeProfileId()}:${phraseId}`;
}

// Strip the active-profile prefix from a stored record's key before returning.
function stripPrefix(record: SRSRecord): SRSRecord {
  const prefix = `${activeProfileId()}:`;
  if (record.phraseId.startsWith(prefix)) {
    return { ...record, phraseId: record.phraseId.slice(prefix.length) };
  }
  return record;
}

// --- multi-profile store -----------------------------------------------------

export async function getProfiles(): Promise<ProfileEntry[]> {
  try {
    return await (await getDB()).getAll('profiles');
  } catch {
    return [];
  }
}

export async function getProfileById(id: string): Promise<ProfileEntry | null> {
  try {
    return (await (await getDB()).get('profiles', id)) ?? null;
  } catch {
    return null;
  }
}

export async function putProfileEntry(entry: Omit<ProfileEntry, 'updatedAt'>): Promise<ProfileEntry> {
  const record: ProfileEntry = { ...entry, updatedAt: new Date().toISOString() };
  try {
    await (await getDB()).put('profiles', record);
  } catch {
    /* unavailable */
  }
  return record;
}

export async function deleteProfileEntry(id: string): Promise<void> {
  try {
    await (await getDB()).delete('profiles', id);
  } catch {
    /* unavailable */
  }
}

export async function getSRSRecord(phraseId: string): Promise<SRSRecord | null> {
  try {
    const rec = (await (await getDB()).get('srs', srsKey(phraseId))) ?? null;
    return rec ? stripPrefix(rec) : null;
  } catch {
    return null;
  }
}

export async function putSRSRecord(record: SRSRecord): Promise<void> {
  try {
    const stored: SRSRecord = { ...record, phraseId: srsKey(record.phraseId) };
    await (await getDB()).put('srs', stored);
    syncSRS(stored).catch(() => {});
  } catch {
    /* unavailable */
  }
}

export async function getAllSRSRecords(): Promise<SRSRecord[]> {
  try {
    const prefix = `${activeProfileId()}:`;
    const all = await (await getDB()).getAll('srs');
    return all
      .filter((r) => r.phraseId.startsWith(prefix))
      .map((r) => ({ ...r, phraseId: r.phraseId.slice(prefix.length) }));
  } catch {
    return [];
  }
}

export async function getDueNow(): Promise<SRSRecord[]> {
  try {
    const now = new Date().toISOString();
    const prefix = `${activeProfileId()}:`;
    const all = await (await getDB()).getAll('srs');
    return all
      .filter((r) => r.phraseId.startsWith(prefix) && r.dueAt <= now)
      .map((r) => ({ ...r, phraseId: r.phraseId.slice(prefix.length) }));
  } catch {
    return [];
  }
}

export async function initSRS(phraseId: string): Promise<void> {
  try {
    const existing = await getSRSRecord(phraseId);
    if (existing) return;
    const now = new Date().toISOString();
    await putSRSRecord({
      phraseId,
      interval: 1,
      dueAt: now,
      easeFactor: 2.5,
      repetitions: 0,
      stage: getStage(0),
      createdAt: now,
    });
  } catch {
    /* unavailable */
  }
}

// Raw put functions — used by pull sync only; do NOT call back to Firestore
export async function putHistoryRaw(entry: HistoryEntry): Promise<void> {
  try {
    const db_ = await getDB();
    const existing = await db_.get('history', entry.id);
    if (!existing || entry.updatedAt > existing.updatedAt) {
      await db_.put('history', entry);
    }
  } catch {}
}

export async function putPhraseRaw(entry: PhrasebookEntry): Promise<void> {
  try {
    const db_ = await getDB();
    const existing = await db_.get('phrasebook', entry.id);
    if (!existing || entry.updatedAt > existing.updatedAt) {
      await db_.put('phrasebook', entry);
    }
  } catch {}
}

export async function putProfileRaw(entry: ProfileEntry): Promise<void> {
  try {
    const db_ = await getDB();
    const existing = await db_.get('profile', 'local');
    if (!existing || entry.updatedAt > existing.updatedAt) {
      await db_.put('profile', entry);
    }
  } catch {}
}

export async function putSRSRaw(record: SRSRecord): Promise<void> {
  try {
    const db_ = await getDB();
    const existing = await db_.get('srs', record.phraseId);
    if (!existing) {
      await db_.put('srs', record);
      return;
    }
    const remoteTs = record.lastReviewedAt ?? record.createdAt;
    const existingTs = existing.lastReviewedAt ?? existing.createdAt;
    if (remoteTs > existingTs) {
      await db_.put('srs', record);
    }
  } catch {}
}

export async function seedPhrasebook(): Promise<void> {
  try {
    const existing = await getPhrasebook();
    const have = new Set(existing.map((e) => e.id));
    const missing = BUILT_IN_PHRASES.filter((p) => !have.has(p.id));
    for (const phrase of missing) await putPhrase(phrase);
  } catch {
    /* unavailable */
  }
}
