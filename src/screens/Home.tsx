import { useRef, useState } from 'react';
import { TONE, type ToneKey } from '../themes/constants';
import { THEMES, type ThemeKey } from '../themes/tokens';
import { useTheme } from '../themes/ThemeContext';
import { tts } from '../worker/api';
import styles from './Home.module.css';

interface Syllable {
  thai: string;
  roman: string;
  tone: ToneKey;
}

interface Phrase {
  syllables: Syllable[];
  meaning: string;
  literal: string;
}

// Featured phrase of the day — hard-coded for now.
const PHRASE_OF_THE_DAY: Phrase = {
  syllables: [
    { thai: 'สวัส', roman: 'sà-wàt', tone: 'low' },
    { thai: 'ดี', roman: 'dii', tone: 'mid' },
    { thai: 'ครับ', roman: 'khráp', tone: 'high' },
  ],
  meaning: 'Hello',
  literal: 'A polite greeting — said by men.',
};

const THEME_ORDER: ThemeKey[] = ['paper', 'temple', 'market'];
const THEME_LABEL: Record<ThemeKey, string> = {
  paper: 'Paper',
  temple: 'Temple Gold',
  market: 'Night Market',
};

function ToneGlyph({ tone }: { tone: ToneKey }) {
  return (
    <svg className={styles.toneGlyph} viewBox="0 0 48 40" aria-hidden="true">
      <path d={TONE[tone].d} />
    </svg>
  );
}

const PHRASE_THAI = PHRASE_OF_THE_DAY.syllables.map((s) => s.thai).join('');

const Home: React.FC = () => {
  const { themeKey, setTheme } = useTheme();
  const [speakState, setSpeakState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const reviewsDone = 7;
  const reviewsTotal = 12;
  const pct = reviewsDone / reviewsTotal;
  const r = 22;
  const circ = 2 * Math.PI * r;

  async function handleListen() {
    if (speakState === 'loading') return;

    // If already playing, stop it.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setSpeakState('idle');
      return;
    }

    setSpeakState('loading');
    try {
      const { audioContent } = await tts({ text: PHRASE_THAI });
      const binary = atob(audioContent);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      setSpeakState('playing');

      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setSpeakState('idle');
      });
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setSpeakState('idle');
      });

      await audio.play();
    } catch {
      audioRef.current = null;
      setSpeakState('idle');
    }
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.greeting}>
          <span className={styles.eyebrow}>Sawatdee, family</span>
          <h1 className={styles.title}>
            Today <span className={styles.titleThai}>วันนี้</span>
          </h1>
        </div>
        <div className={styles.themeSwitch} role="group" aria-label="Theme">
          {THEME_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.themeDot} ${key === themeKey ? styles.themeDotActive : ''}`}
              style={{ background: THEMES[key].accent }}
              aria-label={THEME_LABEL[key]}
              aria-pressed={key === themeKey}
              onClick={() => setTheme(key)}
            />
          ))}
        </div>
      </header>

      <section className={styles.phraseCard} aria-label="Phrase of the day">
        <div className={styles.phraseGlow} />
        <div className={styles.phraseHead}>
          <span className={styles.phraseLabel}>Phrase of the day</span>
          <button
            type="button"
            className={`${styles.speakBtn} ${speakState === 'playing' ? styles.speakBtnPlaying : ''}`}
            onClick={handleListen}
            disabled={speakState === 'loading'}
            aria-label={speakState === 'playing' ? 'Stop' : 'Listen to phrase'}
          >
            <span
              className={styles.eq}
              aria-hidden="true"
              data-playing={speakState === 'playing' || undefined}
            >
              <span />
              <span />
              <span />
              <span />
            </span>
            {speakState === 'loading' ? 'Loading…' : speakState === 'playing' ? 'Stop' : 'Listen'}
          </button>
        </div>

        <div className={styles.syllables}>
          {PHRASE_OF_THE_DAY.syllables.map((syll, i) => (
            <div className={styles.syllable} key={i}>
              <ToneGlyph tone={syll.tone} />
              <span className={styles.syllThai} lang="th">
                {syll.thai}
              </span>
              <span className={styles.syllRoman}>{syll.roman}</span>
            </div>
          ))}
        </div>

        <p className={styles.phraseMeaning}>{PHRASE_OF_THE_DAY.meaning}</p>
        <p className={styles.phraseSub}>{PHRASE_OF_THE_DAY.literal}</p>
      </section>

      <p className={styles.sectionLabel}>Two ways in</p>
      <nav className={styles.modes} aria-label="Modes">
        <a className={`${styles.mode} ${styles.modeTravel}`} href="#/translate">
          <Arrow className={styles.modeArrow} />
          <span className={styles.modeIcon} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8h7M5 8a3 3 0 0 0 6 0M8 5V3M8 8c0 4-1.5 7-3 9" />
              <path d="M13 19l4-9 4 9M14.5 16h5" />
            </svg>
          </span>
          <span className={styles.modeName}>Travel</span>
          <span className={styles.modeDesc}>Translate out loud and flash show-cards at the market.</span>
        </a>

        <a className={`${styles.mode} ${styles.modeLearn}`} href="#/play">
          <Arrow className={styles.modeArrow} />
          <span className={styles.modeIcon} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span className={styles.modeName}>Learn</span>
          <span className={styles.modeDesc}>Script, tones and phrases that stick, one card at a time.</span>
        </a>
      </nav>

      <section className={styles.progress} aria-label="Today's reviews">
        <svg className={styles.ring} width="56" height="56" viewBox="0 0 56 56">
          <circle className={styles.ringTrack} cx="28" cy="28" r={r} fill="none" strokeWidth="5" />
          <circle
            className={styles.ringFill}
            cx="28"
            cy="28"
            r={r}
            fill="none"
            strokeWidth="5"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
          />
          <text className={styles.ringLabel} x="28" y="28" textAnchor="middle" dominantBaseline="central">
            {reviewsDone}/{reviewsTotal}
          </text>
        </svg>
        <div className={styles.progressText}>
          <span className={styles.progressTitle}>Daily phrases</span>
          <span className={styles.progressSub}>
            {reviewsTotal - reviewsDone} cards left in today&rsquo;s deck.
          </span>
        </div>
        <a className={styles.reviewBtn} href="#/deck">
          Review
        </a>
      </section>
    </div>
  );
};

function Arrow({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export default Home;
