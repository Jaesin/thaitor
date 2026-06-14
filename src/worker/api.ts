export type Syllable = { th: string; rom: string; tone: 'mid'|'low'|'falling'|'high'|'rising'; cls: 'mid'|'high'|'low' };
export type TranslateResponse = { syllables: Syllable[]; en: string; rtgs: string; particle: 'khrap'|'kha'|'neutral' };
export type TtsResponse = { audioContent: string }; // base64 MP3

export type Formality = 'polite' | 'casual';
export type Gender = 'male' | 'female';

export type TranslateArgs = { text: string; formality?: Formality; gender?: Gender };

const API_BASE = import.meta.env.DEV
  ? 'http://localhost:5001'
  : 'https://thaitor-worker.jaesinner.workers.dev';

async function authHeaders(): Promise<Record<string, string>> {
  const { auth, ensureSignedIn } = await import('../firebase');
  const user = auth.currentUser ?? (await ensureSignedIn());
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function translate({ text, formality, gender }: TranslateArgs): Promise<TranslateResponse> {
  const res = await fetch(`${API_BASE}/translate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ text, formality, gender }),
  });
  if (!res.ok) throw new Error(`translate: ${res.status}`);
  return res.json();
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
