import { getPhrasebook, getDueNow, getAllSRSRecords, type SRSRecord } from './store';

// Grade: 0-5 scale (Anki-style). 0-2 = fail, 3-5 = pass
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

export function gradePhrase(record: SRSRecord, grade: Grade): SRSRecord {
  const now = Date.now();
  let { interval, easeFactor, repetitions } = record;

  if (grade < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    repetitions += 1;
  }

  return {
    ...record,
    interval,
    easeFactor,
    repetitions,
    dueAt: new Date(now + interval * 86400000).toISOString(),
    lastReviewedAt: new Date().toISOString(),
  };
}

export type SessionResult = {
  reviewed: number;
  masteredPhraseIds: string[]; // phraseIds where SRS repetitions >= 3 after this session
  correctCount: number;
};

export type SessionMakeup = {
  tripDeck: number;    // starred phrases in phrasebook
  due: number;         // SRS records with dueAt <= now
  newSounds: number;   // phrasebook phrases with no SRS record yet
  etaMin: number;      // estimated minutes
  forms: ('Listen' | 'Tiles' | 'Speak' | 'Blank')[];
};

export async function buildSession(): Promise<SessionMakeup> {
  const [phrasebook, dueRecords] = await Promise.all([getPhrasebook(), getDueNow()]);
  const allSRS = await getAllSRSRecords();
  const haveSRS = new Set(allSRS.map((r) => r.phraseId));

  const tripDeck = phrasebook.filter((p) => p.starred).length;
  const due = dueRecords.length;
  const newSounds = phrasebook.filter((p) => !haveSRS.has(p.id)).length;
  const etaMin = Math.ceil((tripDeck + due + Math.min(newSounds, 5)) * 0.5);

  return {
    tripDeck,
    due,
    newSounds,
    etaMin,
    forms: ['Listen', 'Tiles'],
  };
}
