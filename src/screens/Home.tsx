import { useEffect, useRef, useState } from 'react';
import { TONE, type ToneKey } from '../themes/constants';
import { tts } from '../worker/api';
import { getDailyProgress, completeQuest } from '../data/quests';
import { getDueNow, getAllSRSRecords } from '../data/store';
import { BUILT_IN_PHRASES } from '../data/phrases';
import { getKidMode, getActiveProfile } from '../data/profiles';
import { getFamilyFlameState, type FamilyFlameState } from '../data/family';
import GearLink from '../components/GearLink';
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
  // Use day-of-year so it changes daily but is stable within a day
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const entry = BUILT_IN_PHRASES[dayOfYear % BUILT_IN_PHRASES.length];
  return {
    syllables: entry.syllables.map((s) => ({ thai: s.th, roman: s.rom, tone: s.tone })),
    meaning: entry.en,
    literal: entry.rtgs ?? entry.syllables.map((s) => s.rom).join('-'),
  };
}

const PHRASE_OF_THE_DAY = getPhraseOfTheDay();
const PHRASE_THAI = PHRASE_OF_THE_DAY.syllables.map((s) => s.thai).join('');
const PHRASE_ROMAN = PHRASE_OF_THE_DAY.syllables.map((s) => s.roman).join(' ');

function ToneGlyph({ tone }: { tone: ToneKey }) {
  return (
    <svg className={styles.toneGlyph} viewBox="0 0 48 40" aria-hidden="true">
      <path d={TONE[tone].d} />
    </svg>
  );
}

/** Quiet, near-monochrome growth motif — a teal lotus on warm paper. */
function Lotus({ stage, size = 26, dim = false }: { stage: 0 | 1 | 2; size?: number; dim?: boolean }) {
  const leaf = 'var(--faint)';
  const petal = 'var(--accent)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', opacity: dim ? 0.4 : 1 }}
    >
      {stage === 0 && (
        <>
          <ellipse cx="24" cy="30" rx="6" ry="8" fill={leaf} opacity="0.55" />
          <ellipse cx="24" cy="28" rx="3" ry="5" fill={leaf} />
        </>
      )}
      {stage === 1 && (
        <>
          <path d="M24 40 V24" stroke={leaf} strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="18" cy="26" rx="6" ry="3.4" fill={leaf} transform="rotate(-28 18 26)" />
          <ellipse cx="30" cy="26" rx="6" ry="3.4" fill={leaf} transform="rotate(28 30 26)" />
        </>
      )}
      {stage === 2 && (
        <>
          <ellipse cx="18" cy="34" rx="6" ry="3.4" fill={leaf} transform="rotate(-24 18 34)" />
          <ellipse cx="30" cy="34" rx="6" ry="3.4" fill={leaf} transform="rotate(24 30 34)" />
          <ellipse cx="24" cy="24" rx="6.5" ry="11" fill={petal} />
          <ellipse cx="24" cy="24" rx="2.6" ry="8" fill="#fff" opacity="0.28" />
        </>
      )}
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" />
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

function timeOfDay(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'Morning';
  if (h >= 11 && h < 16) return 'Afternoon';
  if (h >= 16 && h < 20) return 'Evening';
  return 'Evening';
}

// Phase-line meta + warm one-line metaphor, both derived from the trip.
function tripCopy(trip: TripStatus): { meta: string; metaphor: string; metaHref?: string } {
  switch (trip.kind) {
    case 'before':
      return {
        meta: `${trip.days} ${trip.days === 1 ? 'day' : 'days'} · Thailand`,
        metaphor: `Thailand is ${trip.days} ${trip.days === 1 ? 'day' : 'days'} away.`,
      };
    case 'during':
      return { meta: 'In Thailand', metaphor: "You're there now — say it out loud." };
    case 'after':
      return { meta: 'Home again', metaphor: 'Home again. Keep the words warm.' };
    default:
      return { meta: 'Plan your trip', metaphor: '', metaHref: '#/settings' };
  }
}

// Node position (0–1) along the journey hairline.
function tripProgress(trip: TripStatus): number | null {
  switch (trip.kind) {
    case 'before': {
      // No fixed horizon to anchor against — fewer days reads as further along.
      const f = 1 - trip.days / 60;
      return Math.min(0.92, Math.max(0.08, f));
    }
    case 'during':
      return 1;
    case 'after':
      return 1;
    default:
      return null;
  }
}

const AVATAR_INK = ['var(--ink)', 'var(--muted)', 'var(--faint)'];

const Home: React.FC = () => {
  const [speakState, setSpeakState] = useState<'idle' | 'playing'>('idle');
  const [audioReady, setAudioReady] = useState(false);
  const [quests, setQuests] = useState(() => getDailyProgress());
  const [trip] = useState<TripStatus>(() => getTripStatus());
  const [kidMode] = useState(() => getKidMode());
  const [name, setName] = useState('');
  const [family, setFamily] = useState<FamilyFlameState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cachedAudioUrl = useRef<string | null>(null);
  const usingSpeechRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { audioContent } = await tts({ text: PHRASE_THAI });
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

  const [due, setDue] = useState(0);

  useEffect(() => {
    (async () => {
      const [dueNow] = await Promise.all([getDueNow(), getAllSRSRecords()]);
      setDue(dueNow.length);
    })();
  }, []);

  useEffect(() => {
    let active = true;
    getActiveProfile().then((p) => {
      if (active && p?.name) setName(p.name);
    });
    getFamilyFlameState().then((state) => {
      if (active) setFamily(state);
    });
    return () => {
      active = false;
    };
  }, []);

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

  // Browser speech synthesis — the always-available baseline. Used until the
  // higher-quality TTS audio has loaded, and permanently if it never loads
  // (e.g. a non-member whose TTS request the Worker blocks).
  function playViaSpeech() {
    const utterance = new SpeechSynthesisUtterance(PHRASE_THAI);
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

  const copy = tripCopy(trip);
  const progress = tripProgress(trip);
  const questsDone = quests.filter((q) => q.done).length;
  const reviewMinutes = Math.max(1, Math.round(due * 0.35));

  return (
    <div className={styles.screen}>
      <div className={`${styles.band} ${styles.gearRow}`}>
        <GearLink />
      </div>

      {/* phase line */}
      <div className={`${styles.band} ${styles.phaseLine}`}>
        <span className={styles.kick}>Today</span>
        {copy.metaHref ? (
          <a className={styles.phaseMeta} href={copy.metaHref}>
            {copy.meta} →
          </a>
        ) : (
          <span className={styles.phaseMeta}>{copy.meta}</span>
        )}
      </div>

      {/* greeting + phrase of the day — Thai is the hero */}
      <div className={`${styles.band} ${styles.greeting}`}>
        <div className={styles.hero}>
          {PHRASE_OF_THE_DAY.syllables.map((syll, i) => (
            <span className={styles.syll} key={i}>
              <ToneGlyph tone={syll.tone} />
              <span className={styles.syllThai} lang="th">
                {syll.thai}
              </span>
            </span>
          ))}
        </div>

        <p className={styles.gloss}>
          {PHRASE_ROMAN} · “{PHRASE_OF_THE_DAY.meaning}”
        </p>

        <p className={styles.personal}>
          <strong>
            {timeOfDay()}
            {name ? `, ${name}` : ''}.
          </strong>
          {copy.metaphor ? ` ${copy.metaphor}` : ''}
        </p>

        <button
          type="button"
          className={`${styles.listen} ${
            !audioReady && speakState === 'idle' ? styles.listenPending : ''
          }`}
          onClick={handleListen}
          aria-label={speakState === 'playing' ? 'Stop' : 'Listen to the phrase'}
        >
          {speakState === 'playing' ? (
            <span className={styles.eq} aria-hidden="true" data-playing>
              <span />
              <span />
              <span />
              <span />
            </span>
          ) : (
            <svg className={styles.listenIcon} width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4z" />
            </svg>
          )}
          {speakState === 'playing' ? 'Stop' : 'Listen'}
        </button>

        {progress !== null && (
          <svg className={styles.walk} viewBox="0 0 280 16" preserveAspectRatio="none" aria-hidden="true">
            <line x1="2" y1="8" x2="278" y2="8" stroke="var(--hair)" strokeWidth="1.5" strokeDasharray="1 6" strokeLinecap="round" />
            <line x1="2" y1="8" x2={2 + progress * 276} y2="8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx={2 + progress * 276} cy="8" r="4" fill="var(--accent)" />
            <circle cx="278" cy="8" r="3" fill="none" stroke="var(--muted)" strokeWidth="1.5" />
          </svg>
        )}
      </div>

      <div className={styles.hair} />

      {/* ready to review — typographic, no card */}
      <div className={styles.band}>
        <span className={styles.kick}>{due > 0 ? 'Ready to review' : 'All caught up'}</span>
        <div className={styles.reviewHead}>
          <span className={styles.reviewNum}>{due}</span>
          <div className={styles.lotuses}>
            <Lotus stage={0} size={22} dim />
            <Lotus stage={1} size={26} />
            <Lotus stage={2} size={30} />
          </div>
        </div>
        <p className={styles.reviewSub}>
          {due > 0
            ? `phrases · about ${reviewMinutes} ${reviewMinutes === 1 ? 'minute' : 'minutes'}, together`
            : 'Nothing due right now — browse your deck.'}
        </p>
        <a className={styles.beginLink} href={due > 0 ? '#/play' : '#/deck'}>
          {due > 0 ? 'Begin review' : 'Browse phrases'}
          <Arrow />
        </a>
      </div>

      <div className={styles.hair} />

      {/* quests */}
      <div className={styles.band}>
        <div className={styles.questHead}>
          <span className={styles.kick}>Today, together</span>
          <span className={styles.questCount}>
            {questsDone}/{quests.length}
          </span>
        </div>
        <ul className={styles.questList}>
          {quests.map(({ quest, done }) => (
            <li
              key={quest.id}
              className={`${styles.questItem} ${done ? styles.questItemDone : ''}`}
            >
              <span className={`${styles.questDot} ${done ? styles.questDotDone : ''}`} />
              <span className={styles.questText}>{quest.desc}</span>
            </li>
          ))}
        </ul>

        {kidMode && (
          <a className={styles.kidLink} href="#/play">
            Kid Play
            <Arrow />
          </a>
        )}
      </div>

      <div className={styles.spacer} />

      {/* family flame — minimal */}
      {family && family.members.length >= 2 && (
        <div
          className={`${styles.band} ${styles.family} ${
            family.allPracticedToday ? styles.familyLit : ''
          }`}
        >
          <svg className={styles.flameIcon} width="16" height="20" viewBox="0 0 22 26" fill="currentColor" aria-hidden="true">
            <path d="M11 2 C13 8 19 9 17 16 C16 21 13 24 11 24 C9 24 6 21 5 16 C3.5 10 9 9 11 2Z" />
          </svg>
          <span className={styles.familyLabel}>
            {family.allPracticedToday
              ? 'Family flame · all in today'
              : `Family flame · lit ${family.flameDays} ${family.flameDays === 1 ? 'day' : 'days'}`}
          </span>
          <div className={styles.avatars}>
            {family.members.slice(0, 4).map((m, i) => (
              <span
                key={m.id}
                className={`${styles.avatar} ${m.practicedToday ? '' : styles.avatarOff}`}
                style={{ background: AVATAR_INK[i % AVATAR_INK.length] }}
                title={`${m.name} ${m.practicedToday ? '✓' : '…'}`}
              >
                {m.name.charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
