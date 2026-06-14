import { useCallback, useEffect, useRef, useState } from 'react';
import { TONE, type ToneKey } from '../themes/constants';
import { translate, tts, type TranslateResponse } from '../worker/api';
import { VOICE_NAME, getDefaultVoice } from '../worker/voice';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import { putHistory, type PhrasebookEntry } from '../data/store';
import { BUILT_IN_PHRASES } from '../data/phrases';
import styles from './Translate.module.css';

type Particle = 'khrap' | 'kha' | 'neutral';
type AudioState = 'idle' | 'loading' | 'playing';

function voiceForParticle(particle: Particle): string {
  if (particle === 'khrap') return VOICE_NAME.male;
  if (particle === 'kha') return VOICE_NAME.female;
  return VOICE_NAME[getDefaultVoice()];
}

const PARTICLE_THAI: Record<Particle, string> = {
  khrap: 'ครับ',
  kha: 'คะ',
  neutral: '',
};

const PARTICLE_OPTIONS: { key: Particle; label: string; sub: string }[] = [
  { key: 'khrap', label: 'ครับ', sub: 'male' },
  { key: 'kha', label: 'คะ', sub: 'female' },
  { key: 'neutral', label: 'เฉย ๆ', sub: 'neutral' },
];

function ToneGlyph({ tone }: { tone: ToneKey }) {
  return (
    <svg className={styles.toneGlyph} viewBox="0 0 48 40" aria-hidden="true">
      <path d={TONE[tone].d} />
    </svg>
  );
}

function decodeAudio(audioContent: string): string {
  const binary = atob(audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

const Translate: React.FC = () => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [particle, setParticle] = useState<Particle>('neutral');
  const [starred, setStarred] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [audioReady, setAudioReady] = useState(false);
  const [phrasebookOpen, setPhrasebookOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const prefetchIdRef = useRef(0);

  function releaseAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioReady(false);
  }

  useEffect(() => releaseAudio, []);

  const prefetchAudio = useCallback((res: TranslateResponse, p: Particle, autoPlay = false) => {
    const PARTICLE_TH = new Set(['ครับ', 'คะ', 'ค่ะ', 'นะครับ', 'นะคะ']);
    const sylls = res.syllables.length > 1 && PARTICLE_TH.has(res.syllables.at(-1)!.th)
      ? res.syllables.slice(0, -1)
      : res.syllables;
    const phrase = sylls.map((s) => s.th).join('') + PARTICLE_THAI[p];
    const voice = voiceForParticle(p);
    const id = ++prefetchIdRef.current;
    (async () => {
      try {
        let audioContent = await getCachedAudio(phrase, voice);
        if (!audioContent) {
          audioContent = (await tts({ text: phrase, voice })).audioContent;
          await setCachedAudio(phrase, voice, audioContent);
        }
        const url = decodeAudio(audioContent);
        if (prefetchIdRef.current !== id) {
          URL.revokeObjectURL(url);
          return;
        }
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = url;
        setAudioReady(true);
        if (autoPlay) {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.addEventListener('ended', () => { audioRef.current = null; setAudioState('idle'); });
          audio.addEventListener('error', () => { audioRef.current = null; setAudioState('idle'); });
          await audio.play();
          setAudioState('playing');
        }
      } catch {
        // Silent — falls back to speechSynthesis on click.
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    releaseAudio();
    setAudioState('idle');
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await translate({ text: trimmed });
      setResult(res);
      setParticle(res.particle);
      setStarred(false);
      void putHistory({
        id: crypto.randomUUID(),
        en: res.en,
        syllables: res.syllables,
        rtgs: res.rtgs,
        particle: res.particle,
        starred: false,
        at: new Date().toISOString(),
      });
      prefetchAudio(res, res.particle, true);
    } catch {
      setError("Couldn't reach the translator. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setText('');
    setResult(null);
    setError(null);
    releaseAudio();
    setAudioState('idle');
  }

  function selectParticle(next: Particle) {
    if (next === particle) return;
    setParticle(next);
    // Invalidate cached audio and prefetch the updated phrase with the right voice.
    releaseAudio();
    setAudioState('idle');
    if (result) prefetchAudio(result, next);
  }

  function speakFallback(phrase: string) {
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = 'th-TH';
    utterance.onend = () => setAudioState('idle');
    setAudioState('playing');
    window.speechSynthesis.speak(utterance);
  }

  async function handlePlay() {
    if (!result) return;

    if (audioState === 'playing') {
      audioRef.current?.pause();
      audioRef.current = null;
      window.speechSynthesis.cancel();
      setAudioState('idle');
      return;
    }
    if (audioState === 'loading') return;

    const phrase = result.syllables.map((s) => s.th).join('') + PARTICLE_THAI[particle];

    if (!audioReady || !audioUrlRef.current) {
      speakFallback(phrase);
      return;
    }

    try {
      const audio = new Audio(audioUrlRef.current);
      audioRef.current = audio;
      audio.addEventListener('ended', () => {
        audioRef.current = null;
        setAudioState('idle');
      });
      audio.addEventListener('error', () => {
        audioRef.current = null;
        setAudioState('idle');
      });
      await audio.play();
      setAudioState('playing');
    } catch {
      audioRef.current = null;
      setAudioState('idle');
      setError('Audio playback failed. Try again.');
    }
  }

  function handlePhrasebookTap(phrase: Omit<PhrasebookEntry, 'updatedAt'>) {
    setPhrasebookOpen(false);
    setText(phrase.en);
    setResult({
      syllables: phrase.syllables,
      en: phrase.en,
      rtgs: phrase.rtgs ?? '',
      particle: phrase.particle,
    });
    setParticle(phrase.particle);
    setStarred(false);
    releaseAudio();
    setAudioState('idle');
    // Prefetch TTS for this phrase
    prefetchAudio(
      { syllables: phrase.syllables, en: phrase.en, rtgs: phrase.rtgs ?? '', particle: phrase.particle },
      phrase.particle,
      true,
    );
  }

  const trimmedEmpty = text.trim().length === 0;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Travel companion</span>
        <h1 className={styles.title}>
          Translate <span className={styles.titleThai}>แปล</span>
        </h1>
      </header>

      <section
        className={`${styles.resultCard} ${result ? '' : styles.resultCardEmpty}`}
        aria-label="Translation result"
      >
        {!result ? (
          <p className={styles.placeholder}>
            การแปลจะปรากฏที่นี่{/* Thai: "Translation will appear here" */}
            <br />
            <span>Translation will appear here</span>
          </p>
        ) : (
          <>
            <div className={styles.resultHead}>
              <span className={styles.resultLabel}>Thai</span>
              <button
                type="button"
                className={`${styles.starBtn} ${starred ? styles.starBtnActive : ''}`}
                onClick={() => setStarred((s) => !s)}
                disabled={!result}
                aria-pressed={starred}
                aria-label={starred ? 'Remove from saved' : 'Save phrase'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L12 16.77 6.8 19.52l.99-5.8-4.21-4.1 5.82-.85z"
                    fill={starred ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
                {starred ? 'Saved' : 'Save'}
              </button>
            </div>

            <div className={styles.syllables}>
              {result.syllables.map((syll, i) => (
                <div className={styles.syllable} key={i}>
                  <ToneGlyph tone={syll.tone} />
                  <span className={styles.syllThai} lang="th">
                    {syll.th}
                  </span>
                  <span className={styles.syllRoman}>{syll.rom}</span>
                </div>
              ))}
              {PARTICLE_THAI[particle] && (
                <div className={`${styles.syllable} ${styles.syllableParticle}`}>
                  <span className={styles.toneGlyph} aria-hidden="true" />
                  <span className={styles.syllThai} lang="th">
                    {PARTICLE_THAI[particle]}
                  </span>
                  <span className={styles.syllRoman}>particle</span>
                </div>
              )}
            </div>

            <p className={styles.rtgs}>{result.rtgs}</p>
            <p className={styles.gloss}>{result.en}</p>

            <div className={styles.particleRow} role="group" aria-label="Politeness particle">
              {PARTICLE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`${styles.particleBtn} ${particle === opt.key ? styles.particleBtnActive : ''}`}
                  onClick={() => selectParticle(opt.key)}
                  disabled={!result}
                  aria-pressed={particle === opt.key}
                >
                  <span className={styles.particleThai} lang="th">
                    {opt.label}
                  </span>
                  <span className={styles.particleSub}>{opt.sub}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`${styles.playBtn} ${audioState === 'playing' ? styles.playBtnPlaying : ''} ${
                !audioReady && audioState === 'idle' ? styles.playBtnLoading : ''
              }`}
              onClick={handlePlay}
              disabled={!result || audioState === 'loading'}
              aria-label={audioState === 'playing' ? 'Stop audio' : 'Play audio'}
            >
              <span className={styles.eq} aria-hidden="true" data-playing={audioState === 'playing' || undefined}>
                <span />
                <span />
                <span />
                <span />
              </span>
              {audioState === 'loading' ? 'Loading…' : audioState === 'playing' ? 'Stop' : 'Play audio'}
            </button>
          </>
        )}
      </section>

      <button
        type="button"
        className={styles.phrasebookChip}
        onClick={() => setPhrasebookOpen(true)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 4.5v15" />
        </svg>
        Common phrases
      </button>

      <form className={styles.inputCard} onSubmit={handleSubmit}>
        <textarea
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something to say…"
          rows={3}
          aria-label="English text to translate"
        />
        <div className={styles.inputActions}>
          {text.length > 0 && (
            <button type="button" className={styles.clearBtn} onClick={handleClear}>
              Clear
            </button>
          )}
          <button type="submit" className={styles.submitBtn} disabled={loading || trimmedEmpty}>
            {loading ? 'Translating…' : 'Translate'}
          </button>
        </div>
      </form>

      {loading && (
        <div className={styles.loading} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.loadingText}>Asking for the Thai…</span>
        </div>
      )}

      {error && !loading && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {phrasebookOpen && (
        <div className={styles.phrasebookOverlay} onClick={() => setPhrasebookOpen(false)}>
          <div className={styles.phrasebookModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.phrasebookHeader}>
              <span className={styles.phrasebookTitle}>Common phrases</span>
              <button type="button" className={styles.phrasebookClose} onClick={() => setPhrasebookOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className={styles.phrasebookList}>
              {BUILT_IN_PHRASES.map((phrase) => (
                <button
                  key={phrase.id}
                  type="button"
                  className={styles.phrasebookRow}
                  onClick={() => handlePhrasebookTap(phrase)}
                >
                  <span className={styles.phrasebookThai} lang="th">
                    {phrase.syllables.map((s) => s.th).join('')}
                  </span>
                  <span className={styles.phrasebookEn}>{phrase.en}</span>
                  <span className={styles.phrasebookRom}>{phrase.syllables.map((s) => s.rom).join(' ')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Translate;
