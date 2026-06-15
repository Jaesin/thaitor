export type QuestId = 'listen' | 'practice' | 'arcade';

export interface Quest {
  id: QuestId;
  label: string;
  desc: string;
  icon: string; // emoji
}

export const QUESTS: Quest[] = [
  { id: 'listen', label: 'Morning listen', desc: 'Play the phrase of the day', icon: '🔊' },
  { id: 'practice', label: 'Phrase trainer', desc: 'Complete a tile exercise', icon: '🧩' },
  { id: 'arcade', label: 'Tone arcade', desc: 'Finish a TonePop round', icon: '🎯' },
];

const KEY = 'thaitor_quests'; // localStorage key

interface QuestState {
  date: string; // YYYY-MM-DD
  done: QuestId[]; // completed quest ids for today
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): QuestState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s: QuestState = JSON.parse(raw);
      if (s.date === today()) return s;
    }
  } catch {}
  return { date: today(), done: [] };
}

export function getDailyProgress(): { quest: Quest; done: boolean }[] {
  const state = load();
  return QUESTS.map((q) => ({ quest: q, done: state.done.includes(q.id) }));
}

export function completeQuest(id: QuestId): void {
  const state = load();
  if (!state.done.includes(id)) {
    state.done.push(id);
    localStorage.setItem(KEY, JSON.stringify(state));
  }
}
