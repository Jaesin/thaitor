import { getCachedTranslation, setCachedTranslation } from '../data/translationCache';
import { t10n } from '../data/t10n';
import type { TonalSyllable, TranslateResponse as T10nTranslateResponse } from '@jaesin/t10n-client';

export type Syllable = { th: string; rom: string; tone: 'mid'|'low'|'falling'|'high'|'rising'; cls: 'mid'|'high'|'low' };
export type TranslateResponse = { syllables: Syllable[]; en: string; rtgs: string; particle: 'khrap'|'kha'|'neutral' };
export type ThEnResponse = { th: string; syllables: Syllable[]; en: string; gloss: string };
export type TtsResponse = { audioContent: string }; // base64 MP3

export type Formality = 'polite' | 'casual';
export type Gender = 'male' | 'female';

export type TranslateArgs = { text: string; formality?: Formality; gender?: Gender };

const TONES = new Set<Syllable['tone']>(['mid', 'low', 'falling', 'high', 'rising']);
const CLASSES = new Set<Syllable['cls']>(['mid', 'high', 'low']);

// Map a t10n TonalSyllable onto Thaitor's Syllable. The worker already normalizes
// `tone` to the five-value set and drops an out-of-range `class`, so the guards
// here are belt-and-suspenders (and pin the literal union types).
function toSyllable(s: TonalSyllable): Syllable {
  const tone = TONES.has(s.tone as Syllable['tone']) ? (s.tone as Syllable['tone']) : 'mid';
  const cls = s.class && CLASSES.has(s.class as Syllable['cls']) ? (s.class as Syllable['cls']) : 'mid';
  return { th: s.text, rom: s.romanization, tone, cls };
}

function toSyllables(res: T10nTranslateResponse): Syllable[] {
  return (res.syllables ?? []).map(toSyllable);
}

export async function translate({ text, formality }: TranslateArgs): Promise<TranslateResponse> {
  const cached = getCachedTranslation(text);
  if (cached) return cached;
  const res = await t10n.translate({
    from: 'en',
    to: 'th',
    text,
    register: formality === 'casual' ? 'casual' : 'polite',
  });
  const result: TranslateResponse = {
    syllables: toSyllables(res),
    en: res.source,
    rtgs: res.rtgs ?? res.romanization ?? '',
    particle: res.particle ?? 'neutral',
  };
  setCachedTranslation(text, result);
  return result;
}

// Thai → English lookup. The worker annotates the Thai *source* (the `syllables`
// array describes the source for th→en), so we still get the tone breakdown.
export async function translateThEn({ text }: { text: string }): Promise<ThEnResponse> {
  const res = await t10n.translate({ from: 'th', to: 'en', text });
  return {
    th: res.source,
    en: res.text,
    syllables: toSyllables(res),
    gloss: res.segments.map((s) => s.gloss).filter(Boolean).join(', '),
  };
}

export async function tts({ text, voice }: { text: string; voice?: string }): Promise<TtsResponse> {
  const res = await t10n.fetchSpeech({ text, voice });
  return { audioContent: res.audio.base64 };
}
