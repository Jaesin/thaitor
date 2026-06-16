import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TONE, type ToneKey } from '../themes/constants';
import { translate, translateThEn, tts, type TranslateResponse, type ThEnResponse } from '../worker/api';
import { VOICE_NAME, getDefaultVoice, EN_VOICE_NAME, getDefaultEnVoice } from '../worker/voice';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import { getCachedTranslation } from '../data/translationCache';
import { putHistory, putPhrase, getHistory, historyId, type PhrasebookEntry, type HistoryEntry } from '../data/store';
import { BUILT_IN_PHRASES } from '../data/phrases';
import GearLink from '../components/GearLink';
import styles from './Translate.module.css';

type Particle = 'khrap' | 'kha' | 'neutral';
type AudioState = 'idle' | 'loading' | 'playing';
type Direction = 'en-th' | 'th-en';

// Web Speech recognition isn't in the standard DOM lib typings; declare the
// slice we use. The mic path is best-effort (spec 10 Addition 5).
interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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

const PARTICLE_ROMAN: Record<Particle, string> = {
  khrap: 'khráp',
  kha: 'khâ',
  neutral: '',
};

// Plain RTGS (no tone diacritics) for the show-card reference toggle.
const PARTICLE_PLAIN: Record<Particle, string> = {
  khrap: 'khrap',
  kha: 'kha',
  neutral: '',
};

const PARTICLE_TH_SET = new Set(['ครับ', 'คะ', 'ค่ะ', 'นะครับ', 'นะคะ']);

// Strip a trailing gendered-particle syllable so it isn't rendered twice
// (Gemini returns it both in syllables[] and as the top-level `particle`).
function stripParticleSyllable(syllables: TranslateResponse['syllables']) {
  return syllables.length > 1 && PARTICLE_TH_SET.has(syllables.at(-1)!.th)
    ? syllables.slice(0, -1)
    : syllables;
}

const PARTICLE_OPTIONS: { key: Particle; label: string; sub: string }[] = [
  { key: 'khrap', label: 'ครับ', sub: 'male' },
  { key: 'kha', label: 'คะ', sub: 'female' },
  { key: 'neutral', label: '—', sub: 'neutral' },
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
  const navigate = useNavigate();
  const { from, to } = useParams<{ from?: string; to?: string }>();
  // Direction is derived from the URL: /translate/th/en → TH→EN, anything else → EN→TH.
  const direction: Direction = from === 'th' && to === 'en' ? 'th-en' : 'en-th';
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [thEnResult, setThEnResult] = useState<ThEnResponse | null>(null);
  const [micSupported, setMicSupported] = useState(() => getSpeechRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [particle, setParticle] = useState<Particle>('neutral');
  const [starred, setStarred] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [audioReady, setAudioReady] = useState(false);
  const [phrasebookOpen, setPhrasebookOpen] = useState(false);
  const [showCardOpen, setShowCardOpen] = useState(false);
  const [showCardPlain, setShowCardPlain] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const [recentOpen, setRecentOpen] = useState(true);
  const [enSpeaking, setEnSpeaking] = useState(false);
  const [autoPlay, setAutoPlay] = useState<boolean>(() => {
    try {
      return localStorage.getItem('thaitor_autoplay') !== 'false';
    } catch {
      return true;
    }
  });

  const refreshRecent = useCallback(() => {
    void getHistory().then((entries) => setRecent(entries.slice(0, 5)));
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  function toggleAutoPlay() {
    setAutoPlay((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('thaitor_autoplay', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const prefetchIdRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  function stopEnAudio() {
    if (enAudioRef.current) {
      enAudioRef.current.pause();
      enAudioRef.current = null;
    }
  }

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

  useEffect(() => {
    return () => {
      releaseAudio();
      stopEnAudio();
      window.speechSynthesis.cancel();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  const prefetchAudio = useCallback((res: TranslateResponse, p: Particle, autoPlay = false) => {
    const sylls = stripParticleSyllable(res.syllables);
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

  // Reset transient state whenever the direction changes — whether the user
  // tapped the toggle or navigated directly to a /translate/* URL.
  useEffect(() => {
    recognitionRef.current?.stop();
    setListening(false);
    releaseAudio();
    stopEnAudio();
    setAudioState('idle');
    window.speechSynthesis.cancel();
    setEnSpeaking(false);
    setText('');
    setResult(null);
    setThEnResult(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  function flipDirection() {
    navigate(direction === 'en-th' ? '/translate/th/en' : '/translate');
  }

  function handleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setMicSupported(false);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'th-TH';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) setText(transcript);
    };
    recognition.onerror = (event) => {
      // Some browsers expose th-TH in the API but can't actually recognize it;
      // drop the mic for good rather than nagging the user (spec 10).
      if (event.error === 'language-not-supported') setMicSupported(false);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;
    }
  }

  async function handleThEnSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setThEnResult(null);
    stopEnAudio();
    window.speechSynthesis.cancel();
    setEnSpeaking(false);
    try {
      const res = await translateThEn({ text: trimmed });
      setThEnResult(res);
    } catch {
      setError("Couldn't reach the translator. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    if (direction === 'th-en') {
      void handleThEnSubmit(e);
      return;
    }
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
        id: historyId(res.en),
        en: res.en,
        syllables: res.syllables,
        rtgs: res.rtgs,
        particle: res.particle,
        starred: false,
        at: new Date().toISOString(),
      }).then(refreshRecent);
      prefetchAudio(res, res.particle, autoPlay);
    } catch {
      setError("Couldn't reach the translator. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setText('');
    setResult(null);
    setThEnResult(null);
    setError(null);
    releaseAudio();
    stopEnAudio();
    setAudioState('idle');
    window.speechSynthesis.cancel();
    setEnSpeaking(false);
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

  // English TTS for the TH→EN result card, spoken via Azure with the user's
  // selected English voice.
  async function handleSpeakEnglish() {
    if (!thEnResult) return;
    if (enSpeaking) {
      enAudioRef.current?.pause();
      enAudioRef.current = null;
      setEnSpeaking(false);
      return;
    }
    setEnSpeaking(true);
    try {
      const voice = EN_VOICE_NAME[getDefaultEnVoice()];
      const { audioContent } = await tts({ text: thEnResult.en, voice });
      const audio = new Audio('data:audio/mp3;base64,' + audioContent);
      enAudioRef.current = audio;
      audio.addEventListener('ended', () => {
        enAudioRef.current = null;
        setEnSpeaking(false);
      });
      audio.addEventListener('error', () => {
        enAudioRef.current = null;
        setEnSpeaking(false);
      });
      await audio.play();
    } catch {
      enAudioRef.current = null;
      setEnSpeaking(false);
    }
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

    const phrase = stripParticleSyllable(result.syllables).map((s) => s.th).join('') + PARTICLE_THAI[particle];

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

  function handleRecentTap(entry: HistoryEntry) {
    setText(entry.en);
    setResult({
      syllables: entry.syllables,
      en: entry.en,
      rtgs: entry.rtgs ?? '',
      particle: entry.particle,
    });
    setParticle(entry.particle);
    setStarred(false);
    releaseAudio();
    setAudioState('idle');
    prefetchAudio(
      { syllables: entry.syllables, en: entry.en, rtgs: entry.rtgs ?? '', particle: entry.particle },
      entry.particle,
      autoPlay,
    );
  }

  const displaySyllables = result ? stripParticleSyllable(result.syllables) : [];
  const romanLine = result
    ? [displaySyllables.map((s) => s.rom).join(' '), PARTICLE_ROMAN[particle]]
        .filter(Boolean)
        .join(' ')
    : '';

  const isThEn = direction === 'th-en';
  const trimmed = text.trim();
  const trimmedEmpty = trimmed.length === 0;
  // The TH→EN path has no offline cache; only gate the EN→TH path on it.
  const offlineUncached =
    !isThEn && !isOnline && trimmed.length > 0 && getCachedTranslation(trimmed) === null;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Travel companion</span>
        <h1 className={styles.title}>
          Translate <span className={styles.titleThai}>แปล</span>
        </h1>
        <GearLink />
      </header>

      <button
        type="button"
        className={styles.directionToggle}
        onClick={flipDirection}
        aria-label={isThEn ? 'Switch to English to Thai' : 'Switch to Thai to English'}
      >
        <span className={styles.directionIcon} aria-hidden="true">🔄</span>
        {isThEn ? 'TH → EN' : 'EN → TH'}
      </button>

      {isThEn ? (
        <section
          className={`${styles.resultCard} ${thEnResult ? '' : styles.resultCardEmpty}`}
          aria-label="Translation result"
        >
          {!thEnResult ? (
            <p className={styles.placeholder}>
              ความหมายจะปรากฏที่นี่{/* Thai: "Meaning will appear here" */}
              <br />
              <span>Meaning will appear here</span>
            </p>
          ) : (
            <>
              <div className={styles.resultHead}>
                <span className={styles.resultLabel}>English</span>
                <button
                  type="button"
                  className={`${styles.enSpeakBtn} ${enSpeaking ? styles.enSpeakBtnActive : ''}`}
                  onClick={handleSpeakEnglish}
                  aria-label={enSpeaking ? 'Stop English audio' : 'Play English audio'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    {enSpeaking ? (
                      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
                    ) : (
                      <path d="M8 5v14l11-7z" />
                    )}
                  </svg>
                  {enSpeaking ? 'Stop' : 'Listen'}
                </button>
              </div>
              <p className={styles.thEnEnglish}>{thEnResult.en}</p>
              {thEnResult.syllables && thEnResult.syllables.length > 0 && (
                <div className={styles.syllables}>
                  {thEnResult.syllables.map((syll, i) => (
                    <div className={styles.syllable} key={i}>
                      <ToneGlyph tone={syll.tone} />
                      <span className={styles.syllThai} lang="th">
                        {syll.th}
                      </span>
                      <span className={styles.syllRoman}>{syll.rom}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className={styles.thEnThai} lang="th">
                {thEnResult.th}
              </p>
              {thEnResult.gloss && <p className={styles.thEnGloss}>{thEnResult.gloss}</p>}
            </>
          )}
        </section>
      ) : (
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
              <span
                className={`${styles.savedToast} ${savedToast ? styles.savedToastShow : ''}`}
                role="status"
                aria-live="polite"
              >
                Saved to phrasebook
              </span>
              <button
                type="button"
                className={styles.showBtn}
                onClick={() => {
                  setShowCardPlain(false);
                  setShowCardOpen(true);
                }}
                aria-label="Show full screen"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                Show
              </button>
              <button
                type="button"
                className={`${styles.starBtn} ${starred ? styles.starBtnActive : ''}`}
                onClick={() => {
                  const next = !starred;
                  setStarred(next);
                  if (next && result) {
                    void putPhrase({
                      id: crypto.randomUUID(),
                      en: result.en,
                      syllables: result.syllables,
                      rtgs: result.rtgs,
                      particle,
                      category: 'saved',
                      starred: true,
                      builtIn: false,
                    });
                    setSavedToast(true);
                    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                    toastTimerRef.current = setTimeout(() => setSavedToast(false), 2000);
                  }
                }}
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
              {displaySyllables.map((syll, i) => (
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
                  <span className={styles.syllRoman}>{PARTICLE_ROMAN[particle]}</span>
                </div>
              )}
            </div>

            <p className={styles.rtgs}>{romanLine}</p>
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
      )}

      {!isThEn && (
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
      )}

      {!isOnline && (
        <div className={styles.offlineBanner} role="status">
          You're offline. Phrases you've translated before are still available.
        </div>
      )}

      <form className={styles.inputCard} onSubmit={handleSubmit}>
        <textarea
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isThEn ? 'Type or paste Thai…' : 'Type something to say…'}
          rows={3}
          lang={isThEn ? 'th' : undefined}
          aria-label={isThEn ? 'Thai text to look up' : 'English text to translate'}
        />
        <div className={styles.inputActions}>
          {isThEn ? (
            micSupported && (
              <button
                type="button"
                className={`${styles.micBtn} ${listening ? styles.micBtnActive : ''}`}
                onClick={handleMic}
                aria-pressed={listening}
                aria-label={listening ? 'Stop listening' : 'Speak Thai'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                {listening ? 'Listening…' : 'Speak'}
              </button>
            )
          ) : (
            <button
              type="button"
              className={`${styles.autoplayToggle} ${autoPlay ? styles.autoplayToggleActive : ''}`}
              onClick={toggleAutoPlay}
              role="switch"
              aria-checked={autoPlay}
              aria-label="Auto-play audio"
            >
              <span className={styles.autoplayDot} aria-hidden="true" />
              Auto-play
            </button>
          )}
          <span className={styles.inputActionsSpacer} />
          {text.length > 0 && (
            <button type="button" className={styles.clearBtn} onClick={handleClear}>
              Clear
            </button>
          )}
          <button type="submit" className={styles.submitBtn} disabled={loading || trimmedEmpty || offlineUncached}>
            {isThEn
              ? loading
                ? 'Looking up…'
                : 'Look up'
              : loading
                ? 'Translating…'
                : 'Translate'}
          </button>
        </div>
      </form>

      {loading && (
        <div className={styles.loading} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.loadingText}>{isThEn ? 'Reading the Thai…' : 'Asking for the Thai…'}</span>
        </div>
      )}

      {error && !loading && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {!isThEn && recent.length > 0 && (
        <section className={styles.recent} aria-label="Recent translations">
          <button
            type="button"
            className={styles.recentHeader}
            onClick={() => setRecentOpen((o) => !o)}
            aria-expanded={recentOpen}
          >
            <span className={styles.recentTitle}>Recent</span>
            <svg
              className={`${styles.recentChevron} ${recentOpen ? styles.recentChevronOpen : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {recentOpen && (
            <div className={styles.recentList}>
              {recent.map((entry) => (
                <div className={styles.recentRow} key={entry.id}>
                  <button
                    type="button"
                    className={styles.recentRowMain}
                    onClick={() => handleRecentTap(entry)}
                  >
                    <span className={styles.recentEn}>{entry.en}</span>
                    <span className={styles.recentThai} lang="th">
                      {stripParticleSyllable(entry.syllables).map((s) => s.th).join('') +
                        PARTICLE_THAI[entry.particle]}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.recentPlay}
                    onClick={() =>
                      speakFallback(
                        stripParticleSyllable(entry.syllables).map((s) => s.th).join('') +
                          PARTICLE_THAI[entry.particle],
                      )
                    }
                    aria-label={`Play ${entry.en}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {showCardOpen && result && (
        <div
          className={styles.showCardOverlay}
          onClick={() => setShowCardOpen(false)}
          role="dialog"
          aria-label="Show card"
        >
          <div className={styles.showCardBrightness} aria-hidden="true" />
          <div className={styles.showCardThai} lang="th">
            {displaySyllables.map((s) => s.th).join('') + PARTICLE_THAI[particle]}
          </div>
          <div className={styles.showCardRom}>
            {showCardPlain
              ? [result.rtgs, PARTICLE_PLAIN[particle]].filter(Boolean).join(' ')
              : romanLine}
          </div>
          <button
            type="button"
            className={styles.showCardToggle}
            onClick={(e) => {
              e.stopPropagation();
              setShowCardPlain((p) => !p);
            }}
          >
            {showCardPlain ? 'Show tone marks' : 'Show plain RTGS'}
          </button>
          <span className={styles.showCardHint}>Tap anywhere to close</span>
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
