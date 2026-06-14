import { useEffect, useRef, useState } from 'react';
import { TONE, type ToneKey } from '../themes/constants';
import { translate, tts, type TranslateResponse } from '../worker/api';
import styles from './Translate.module.css';

type Particle = 'khrap' | 'kha' | 'neutral';
type AudioState = 'idle' | 'loading' | 'playing';

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  function releaseAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  useEffect(() => releaseAudio, []);

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
    // Invalidate cached audio so the next play fetches the updated phrase.
    releaseAudio();
    setAudioState('idle');
  }

  async function handlePlay() {
    if (!result) return;

    if (audioState === 'playing') {
      audioRef.current?.pause();
      audioRef.current = null;
      setAudioState('idle');
      return;
    }
    if (audioState === 'loading') return;

    const phrase = result.syllables.map((s) => s.th).join('') + PARTICLE_THAI[particle];

    setAudioState('loading');
    try {
      if (!audioUrlRef.current) {
        const { audioContent } = await tts({ text: phrase });
        audioUrlRef.current = decodeAudio(audioContent);
      }
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
      releaseAudio();
      setAudioState('idle');
      setError('Audio playback failed. Try again.');
    }
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

      {result && !loading && (
        <section className={styles.resultCard} aria-label="Translation result">
          <div className={styles.resultHead}>
            <span className={styles.resultLabel}>Thai</span>
            <button
              type="button"
              className={`${styles.starBtn} ${starred ? styles.starBtnActive : ''}`}
              onClick={() => setStarred((s) => !s)}
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
            className={`${styles.playBtn} ${audioState === 'playing' ? styles.playBtnPlaying : ''}`}
            onClick={handlePlay}
            disabled={audioState === 'loading'}
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
        </section>
      )}
    </div>
  );
};

export default Translate;
