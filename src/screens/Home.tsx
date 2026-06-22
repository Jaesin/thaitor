import { useEffect, useMemo, useRef, useState } from 'react';
import { TONE, type ToneKey } from '../themes/constants';
import { tts } from '../worker/api';
import { getDailyProgress, completeQuest } from '../data/quests';
import { getDueNow, getAllSRSRecords } from '../data/store';
import { BUILT_IN_PHRASES } from '../data/phrases';
import { getStreak, getTotalXP, getRank } from '../data/progression';
import { getKidMode } from '../data/profiles';
import { getFamilyFlameState, type FamilyFlameState } from '../data/family';
import MascotElephant from '../components/MascotElephant';
import mascotStyles from '../components/MascotElephant.module.css';
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

function getPhraseOfTheDay(): Phrase {
  // Pick a random phrase on each call so it changes every page load.
  const entry = BUILT_IN_PHRASES[Math.floor(Math.random() * BUILT_IN_PHRASES.length)];
  return {
    syllables: entry.syllables.map((s) => ({ thai: s.th, roman: s.rom, tone: s.tone })),
    meaning: entry.en,
    literal: entry.rtgs ?? entry.syllables.map((s) => s.rom).join('-'),
  };
}

function ToneGlyph({ tone }: { tone: ToneKey }) {
  return (
    <svg className={styles.toneGlyph} viewBox="0 0 48 40" aria-hidden="true">
      <path d={TONE[tone].d} />
    </svg>
  );
}

type TripStatus =
  | { kind: 'none' }
  | { kind: 'before'; days: number }
  | { kind: 'during' }
  | { kind: 'after' };

// Whole days between two local calendar days (b - a).
function daysBetween(a: Date, b: Date): number {
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((bMid - aMid) / 86400000);
}

function getTripStatus(): TripStatus {
  let departure: string | null = null;
  let ret: string | null = null;
  try {
    departure = localStorage.getItem('thaitor_trip_departure');
    ret = localStorage.getItem('thaitor_trip_return');
  } catch {
    // ignore storage failures
  }

  if (!departure) return { kind: 'none' };

  const today = new Date();
  const dep = new Date(`${departure}T00:00:00`);
  if (Number.isNaN(dep.getTime())) return { kind: 'none' };

  const toDep = daysBetween(today, dep);
  if (toDep > 0) return { kind: 'before', days: toDep };

  // Departure is today or in the past. Check return.
  if (ret) {
    const rt = new Date(`${ret}T00:00:00`);
    if (!Number.isNaN(rt.getTime())) {
      const toRet = daysBetween(today, rt);
      if (toRet < 0) return { kind: 'after' };
    }
  }
  return { kind: 'during' };
}

const Home: React.FC = () => {
  // Selected once per mount so each page load shows a fresh random phrase.
  const phraseOfTheDay = useMemo(() => getPhraseOfTheDay(), []);
  const phraseThai = useMemo(
    () => phraseOfTheDay.syllables.map((s) => s.thai).join(''),
    [phraseOfTheDay],
  );
  const [speakState, setSpeakState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [audioReady, setAudioReady] = useState(false);
  const [quests, setQuests] = useState(() => getDailyProgress());
  const [tripStatus] = useState<TripStatus>(() => getTripStatus());
  const [streak] = useState(() => getStreak());
  const [rank] = useState(() => getRank(getTotalXP()));
  const [kidMode] = useState(() => getKidMode());
  const [family, setFamily] = useState<FamilyFlameState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cachedAudioUrl = useRef<string | null>(null);
  const usingSpeechRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { audioContent } = await tts({ text: phraseThai });
        const binary = atob(audioContent);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        cachedAudioUrl.current = url;
        setAudioReady(true);
      } catch {
        // Silent — falls back to speechSynthesis on click.
      }
    })();
    return () => {
      cancelled = true;
      if (cachedAudioUrl.current) {
        URL.revokeObjectURL(cachedAudioUrl.current);
        cachedAudioUrl.current = null;
      }
    };
  }, []);

  const [reviewsDone, setReviewsDone] = useState(0);
  const [reviewsTotal, setReviewsTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const [due, all] = await Promise.all([getDueNow(), getAllSRSRecords()]);
      setReviewsTotal(all.length);
      // "done" = records that are NOT due (already reviewed today or future intervals)
      setReviewsDone(all.length - due.length);
    })();
  }, []);

  useEffect(() => {
    let active = true;
    getFamilyFlameState().then((state) => {
      if (active) setFamily(state);
    });
    return () => {
      active = false;
    };
  }, []);

  const pct = reviewsTotal === 0 ? 0 : reviewsDone / reviewsTotal;
  const r = 22;
  const circ = 2 * Math.PI * r;

  function stopPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (usingSpeechRef.current) {
      window.speechSynthesis?.cancel();
      usingSpeechRef.current = false;
    }
    setSpeakState('idle');
  }

  // Browser speech synthesis — the always-available baseline. Used when the
  // higher-quality TTS audio never loads (e.g. a non-member whose TTS request
  // the Worker blocks) or fails to play.
  function playViaSpeech() {
    const utterance = new SpeechSynthesisUtterance(phraseThai);
    // Thai lang is required: without it Firefox/Safari pick a non-Thai default
    // voice and produce no audible output for Thai script (silently, no error).
    utterance.lang = 'th-TH';
    utterance.onend = () => {
      usingSpeechRef.current = false;
      setSpeakState('idle');
    };
    usingSpeechRef.current = true;
    setSpeakState('playing');
    // Clear any stuck/queued utterance first (Safari can wedge otherwise).
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function handleListen() {
    if (speakState === 'loading') return;

    // Tapping while playing stops the current playback (audio or speech).
    if (speakState === 'playing') {
      stopPlayback();
      return;
    }

    completeQuest('listen');
    setQuests(getDailyProgress());

    // Prefer the cached TTS audio once it's ready; otherwise speak now.
    if (audioReady && cachedAudioUrl.current) {
      const audio = new Audio(cachedAudioUrl.current);
      audioRef.current = audio;
      setSpeakState('playing');

      audio.addEventListener('ended', () => {
        audioRef.current = null;
        setSpeakState('idle');
      });
      audio.addEventListener('error', () => {
        // Cached audio failed to play — fall back to speech rather than go silent.
        audioRef.current = null;
        playViaSpeech();
      });

      try {
        await audio.play();
      } catch {
        audioRef.current = null;
        playViaSpeech();
      }
      return;
    }

    playViaSpeech();
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.greeting}>
          <span className={styles.eyebrow}>Sawatdee, family</span>
          <h1 className={styles.title}>
            Today <span className={styles.titleThai}>วันนี้</span>
          </h1>
          <div className={styles.statusLine}>
            <span className={styles.statusItem}>
              {streak.count > 0 ? (
                <>
                  🔥 <strong>{streak.count}</strong> day streak
                </>
              ) : (
                '🔥 Start your streak!'
              )}
            </span>
            <span className={styles.statusDot} aria-hidden="true">
              ·
            </span>
            <span className={styles.statusItem} lang="th">
              {rank.thai}
            </span>
          </div>
        </div>
        <MascotElephant
          size={200}
          mood="happy"
          landscape
          className={`${mascotStyles.mascot} ${styles.headerMascot}`}
        />
      </header>

      {family && family.members.length >= 2 && (
        <section
          className={`${styles.familyFlame} ${
            family.allPracticedToday ? styles.familyFlameLit : ''
          }`}
          aria-label="Family flame"
        >
          <span className={styles.familyFlameIcon} aria-hidden="true">
            🔥
          </span>
          <span className={styles.familyChips}>
            {family.members.map((m) => (
              <span
                key={m.id}
                className={`${styles.familyChip} ${
                  m.practicedToday ? styles.familyChipOn : styles.familyChipOff
                }`}
                title={`${m.name} ${m.practicedToday ? '✓' : '…'}`}
              >
                {m.emoji}
              </span>
            ))}
          </span>
          <span className={styles.familyLabel}>
            {family.allPracticedToday
              ? 'All in today! 🔥'
              : `Family flame · day ${family.flameDays}`}
          </span>
        </section>
      )}

      {tripStatus.kind === 'before' && (
        <a className={styles.tripBanner} href="#/translate">
          <span className={styles.tripText}>
            <strong>{tripStatus.days}</strong>{' '}
            {tripStatus.days === 1 ? 'day' : 'days'} until Thailand 🇹🇭
          </span>
        </a>
      )}
      {tripStatus.kind === 'during' && (
        <div className={styles.tripHint}>Welcome to Thailand</div>
      )}
      {tripStatus.kind === 'after' && (
        <div className={`${styles.tripBanner} ${styles.tripBannerSubtle}`}>
          <span className={styles.tripText}>Welcome home from Thailand 🏠</span>
        </div>
      )}
      {tripStatus.kind === 'none' && (
        <a className={styles.tripHint} href="#/settings">
          Set your trip dates →
        </a>
      )}

      <section className={styles.phraseCard} aria-label="Phrase of the day">
        <div className={styles.phraseGlow} />
        <div className={styles.phraseHead}>
          <span className={styles.phraseLabel}>Phrase of the day</span>
          <button
            type="button"
            className={`${styles.speakBtn} ${speakState === 'playing' ? styles.speakBtnPlaying : ''} ${
              !audioReady && speakState === 'idle' ? styles.speakBtnPending : ''
            }`}
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
          {phraseOfTheDay.syllables.map((syll, i) => (
            <div className={styles.syllable} key={i}>
              <ToneGlyph tone={syll.tone} />
              <span className={styles.syllThai} lang="th">
                {syll.thai}
              </span>
              <span className={styles.syllRoman}>{syll.roman}</span>
            </div>
          ))}
        </div>

        <p className={styles.phraseMeaning}>{phraseOfTheDay.meaning}</p>
        <p className={styles.phraseSub}>{phraseOfTheDay.literal}</p>
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

      {kidMode && (
        <a className={styles.kidCard} href="#/play" aria-label="Kid Play — tap to practice tones">
          <span className={styles.kidEmoji} aria-hidden="true">🐘</span>
          <span className={styles.kidText}>
            <span className={styles.kidTitle}>Kid Play</span>
            <span className={styles.kidSub}>Tap to practice tones!</span>
          </span>
        </a>
      )}

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
            {reviewsTotal === 0
              ? 'New to the script? Browse the alphabet first.'
              : `${reviewsTotal - reviewsDone} cards left in today’s deck.`}
          </span>
        </div>
        <a className={styles.reviewBtn} href={reviewsTotal === 0 ? '#/play/alphabet' : '#/deck'}>
          {reviewsTotal === 0 ? 'Alphabet' : 'Review'}
        </a>
      </section>

      <section className={styles.quests} aria-label="Daily quests">
        <p className={styles.sectionLabel}>Daily quests</p>
        <ul className={styles.questList}>
          {quests.map(({ quest, done }) => (
            <li
              key={quest.id}
              className={`${styles.questItem} ${done ? styles.questDone : ''}`}
            >
              <span className={styles.questIcon} aria-hidden="true">
                {quest.icon}
              </span>
              <span className={styles.questText}>
                <span className={styles.questLabel}>{quest.label}</span>
                <span className={styles.questDesc}>{quest.desc}</span>
              </span>
              {done && (
                <span className={styles.questCheck} aria-label="Completed">
                  ✓
                </span>
              )}
            </li>
          ))}
        </ul>
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
