import { getCachedTranslation, setCachedTranslation } from '../data/translationCache';

export type Syllable = { th: string; rom: string; tone: 'mid'|'low'|'falling'|'high'|'rising'; cls: 'mid'|'high'|'low' };
export type TranslateResponse = { syllables: Syllable[]; en: string; rtgs: string; particle: 'khrap'|'kha'|'neutral' };
export type ThEnResponse = { th: string; syllables: Syllable[]; en: string; gloss: string };
export type TtsResponse = { audioContent: string }; // base64 MP3

export type Formality = 'polite' | 'casual';
export type Gender = 'male' | 'female';

export type TranslateArgs = { text: string; formality?: Formality; gender?: Gender };

// VITE_API_BASE lets e2e (and manual testing) point the dev server at the
// deployed Worker instead of the local one — used by the live test profile.
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV
    ? 'http://localhost:5001'
    : '');

async function authHeaders(): Promise<Record<string, string>> {
  const { auth, ensureSignedIn } = await import('../firebase');
  const user = auth.currentUser ?? (await ensureSignedIn());
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function translate({ text, formality, gender }: TranslateArgs): Promise<TranslateResponse> {
  const cached = getCachedTranslation(text);
  if (cached) return cached;
  const res = await fetch(`${API_BASE}/translate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ text, formality, gender }),
  });
  if (!res.ok) throw new Error(`translate: ${res.status}`);
  const result = (await res.json()) as TranslateResponse;
  setCachedTranslation(text, result);
  return result;
}

// Thai → English lookup. Skips the en-th translation cache (different shape)
// and sends explicit from/to language codes to the worker.
export async function translateThEn({ text }: { text: string }): Promise<ThEnResponse> {
  const res = await fetch(`${API_BASE}/translate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ text, from: 'th', to: 'en' }),
  });
  if (!res.ok) throw new Error(`translateThEn: ${res.status}`);
  return (await res.json()) as ThEnResponse;
}

export async function tts({ text, voice }: { text: string; voice?: string }): Promise<TtsResponse> {
  const res = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error(`tts: ${res.status}`);
  return res.json();
}
