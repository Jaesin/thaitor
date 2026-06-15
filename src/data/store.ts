import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Syllable } from '../worker/api';
import { BUILT_IN_PHRASES } from './phrases';

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

export type ProfileEntry = {
  id: 'local';
  name?: string;
  defaultVoice?: string;
  updatedAt: string;
};

export type SRSRecord = {
  phraseId: string;       // key; matches phrasebook entry id
  interval: number;       // days until next review
  dueAt: string;          // ISO timestamp — review when dueAt <= now
  easeFactor: number;     // SM-2 ease factor, starts at 2.5
  repetitions: number;    // count of successful reviews
  createdAt: string;
  lastReviewedAt?: string;
};

interface ThaitorDB extends DBSchema {
  history: { key: string; value: HistoryEntry };
  phrasebook: { key: string; value: PhrasebookEntry };
  profile: { key: string; value: ProfileEntry };
  srs: { key: string; value: SRSRecord };
}

const DB_NAME = 'thaitor';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ThaitorDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ThaitorDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ThaitorDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('phrasebook')) db.createObjectStore('phrasebook', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('srs')) db.createObjectStore('srs', { keyPath: 'phraseId' });
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

export async function putHistory(entry: Omit<HistoryEntry, 'updatedAt'>): Promise<void> {
  try {
    await (await getDB()).put('history', { ...entry, updatedAt: new Date().toISOString() });
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
    await (await getDB()).put('phrasebook', { ...entry, updatedAt: new Date().toISOString() });
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
    await (await getDB()).put('profile', { ...entry, updatedAt: new Date().toISOString() });
  } catch {
    /* unavailable */
  }
}

export async function getSRSRecord(phraseId: string): Promise<SRSRecord | null> {
  try {
    return (await (await getDB()).get('srs', phraseId)) ?? null;
  } catch {
    return null;
  }
}

export async function putSRSRecord(record: SRSRecord): Promise<void> {
  try {
    await (await getDB()).put('srs', record);
  } catch {
    /* unavailable */
  }
}

export async function getAllSRSRecords(): Promise<SRSRecord[]> {
  try {
    return await (await getDB()).getAll('srs');
  } catch {
    return [];
  }
}

export async function getDueNow(): Promise<SRSRecord[]> {
  try {
    const now = new Date().toISOString();
    const all = await (await getDB()).getAll('srs');
    return all.filter((r) => r.dueAt <= now);
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
      createdAt: now,
    });
  } catch {
    /* unavailable */
  }
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
