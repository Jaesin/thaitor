import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getHistory,
  getPhrasebook,
  putPhrase,
  seedPhrasebook,
  type HistoryEntry,
  type PhrasebookEntry,
} from '../data/store';
import { tts } from '../worker/api';
import { VOICE_NAME, getDefaultVoice } from '../worker/voice';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import {
  FIELD_BADGES,
  CUSTOM_FIELD_BADGE_ID,
  getFieldBadges,
  awardFieldBadge,
  type FieldBadgeRecord,
} from '../data/badges';
import GearLink from '../components/GearLink';
import styles from './Deck.module.css';

const LONG_PRESS_MS = 500;

function formatEarnedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

const ALL = 'All';

type Tab = 'phrases' | 'recent' | 'saved';

const TABS: { id: Tab; label: string }[] = [
  { id: 'phrases', label: 'Phrases' },
  { id: 'recent', label: 'Recent' },
  { id: 'saved', label: 'Saved' },
];

type Particle = 'khrap' | 'kha' | 'neutral';

function voiceForParticle(particle: Particle): string {
  if (particle === 'khrap') return VOICE_NAME.male;
  if (particle === 'kha') return VOICE_NAME.female;
  return VOICE_NAME[getDefaultVoice()];
}

function decodeAudio(audioContent: string): string {
  const binary = atob(audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

const Deck: React.FC = () => {
  const [tab, setTab] = useState<Tab>('phrases');
  const [phrases, setPhrases] = useState<PhrasebookEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [category, setCategory] = useState<string>(ALL);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Field-badge ("I said it!") bottom sheet, opened by long-pressing a card.
  const [fieldSheetPhrase, setFieldSheetPhrase] = useState<PhrasebookEntry | null>(null);
  const [fieldBadges, setFieldBadges] = useState<Record<string, FieldBadgeRecord>>(() => getFieldBadges());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = (phrase: PhrasebookEntry) => {
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setFieldBadges(getFieldBadges());
      setFieldSheetPhrase(phrase);
    }, LONG_PRESS_MS);
  };

  const handleAwardField = (badgeId: string) => {
    awardFieldBadge(badgeId, { phraseId: fieldSheetPhrase?.id });
    setFieldBadges(getFieldBadges());
  };

  useEffect(() => {
    let active = true;
    (async () => {
      await seedPhrasebook();
      const all = await getPhrasebook();
      if (active) setPhrases(all);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Refresh history whenever the Recent tab becomes active.
  useEffect(() => {
    if (tab !== 'recent') return;
    let active = true;
    (async () => {
      const all = await getHistory();
      if (active) setHistory(all.slice(0, 10));
    })();
    return () => {
      active = false;
    };
  }, [tab]);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const p of phrases) if (!seen.includes(p.category)) seen.push(p.category);
    return [ALL, ...seen];
  }, [phrases]);

  const visible = useMemo(() => {
    const filtered = category === ALL ? phrases : phrases.filter((p) => p.category === category);
    return [...filtered].sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      return a.en.localeCompare(b.en);
    });
  }, [phrases, category]);

  const saved = useMemo(() => {
    return phrases
      .filter((p) => p.starred)
      .sort((a, b) => a.en.localeCompare(b.en));
  }, [phrases]);

  const toggleStar = async (entry: PhrasebookEntry) => {
    const next = { ...entry, starred: !entry.starred };
    setPhrases((prev) => prev.map((p) => (p.id === entry.id ? { ...p, starred: next.starred } : p)));
    await putPhrase(next);
  };

  const speakFallback = (text: string) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'th-TH';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* unavailable */
    }
  };

  const speak = async (entry: Pick<PhrasebookEntry, 'id' | 'syllables' | 'particle'>) => {
    const text = entry.syllables.map((s) => s.th).join('');
    const voice = voiceForParticle(entry.particle);
    setPlayingId(entry.id);
    try {
      let audioContent = await getCachedAudio(text, voice);
      if (!audioContent) {
        audioContent = (await tts({ text, voice })).audioContent;
        await setCachedAudio(text, voice, audioContent);
      }
      const url = decodeAudio(audioContent);
      const audio = new Audio(url);
      const cleanup = () => {
        URL.revokeObjectURL(url);
        setPlayingId((id) => (id === entry.id ? null : id));
      };
      audio.addEventListener('ended', cleanup);
      audio.addEventListener('error', cleanup);
      await audio.play();
    } catch {
      speakFallback(text);
      setPlayingId((id) => (id === entry.id ? null : id));
    }
  };

  useEffect(() => () => clearLongPress(), []);

  const renderPhraseCard = (p: PhrasebookEntry) => (
    <li
      key={p.id}
      className={styles.card}
      onPointerDown={() => startLongPress(p)}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onContextMenu={(e) => {
        // Suppress the native long-press context menu on touch devices.
        if (longPressFired.current) e.preventDefault();
      }}
    >
      <button
        type="button"
        className={`${styles.starBtn} ${p.starred ? styles.starBtnActive : ''}`}
        onClick={() => toggleStar(p)}
        aria-label={p.starred ? 'Unstar' : 'Star'}
        aria-pressed={p.starred}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z"
            fill={p.starred ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className={styles.thai}>{p.syllables.map((s) => s.th).join('')}</div>
      <div className={styles.roman}>{p.syllables.map((s) => s.rom).join(' ')}</div>
      <div className={styles.gloss}>{p.en}</div>

      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.playBtn}
          onClick={() => speak(p)}
          disabled={playingId === p.id}
          aria-busy={playingId === p.id}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 4l13 8-13 8z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
          {playingId === p.id ? 'Playing…' : 'Play'}
        </button>
        <a className={styles.practiceBtn} href="#/trace" aria-label="Practice tones">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12c3-6 6-6 9 0s6 6 9 0" />
          </svg>
          Practice
        </a>
      </div>
    </li>
  );

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>Your Thai</div>
        <h1 className={styles.title}>
          Your Thai <span className={styles.titleThai}>ภาษาไทยของคุณ</span>
        </h1>
        <GearLink />
      </header>

      <div className={styles.segment} role="tablist" aria-label="View">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.segmentBtn} ${tab === t.id ? styles.segmentBtnActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'phrases' && (
        <div className={styles.filters}>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.pill} ${c === category ? styles.pillActive : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {tab === 'phrases' &&
        (visible.length === 0 ? (
          <div className={styles.empty}>No phrases yet.</div>
        ) : (
          <ul className={styles.list}>{visible.map(renderPhraseCard)}</ul>
        ))}

      {tab === 'saved' &&
        (saved.length === 0 ? (
          <div className={styles.empty}>No saved phrases yet. Tap the star on a phrase to save it.</div>
        ) : (
          <ul className={styles.list}>{saved.map(renderPhraseCard)}</ul>
        ))}

      {tab === 'recent' &&
        (history.length === 0 ? (
          <div className={styles.empty}>No recent translations yet.</div>
        ) : (
          <ul className={styles.list}>
            {history.map((h) => {
              const thai = h.syllables.map((s) => s.th).join('');
              const roman = h.rtgs ?? h.syllables.map((s) => s.rom).join(' ');
              return (
                <li key={h.id} className={styles.recentRow}>
                  <div className={styles.recentText}>
                    <div className={styles.recentThai}>{thai}</div>
                    <div className={styles.recentRoman}>{roman}</div>
                    <div className={styles.recentEn}>{h.en}</div>
                  </div>
                  <button
                    type="button"
                    className={styles.recentPlayBtn}
                    onClick={() => speak(h)}
                    disabled={playingId === h.id}
                    aria-busy={playingId === h.id}
                    aria-label="Play"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M5 4l13 8-13 8z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        ))}

      {fieldSheetPhrase && (
        <div
          className={styles.sheetOverlay}
          onClick={() => setFieldSheetPhrase(null)}
          role="dialog"
          aria-label="Field badges"
        >
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHeader}>
              <div>
                <div className={styles.sheetTitle}>I said it in Thailand!</div>
                <div className={styles.sheetSub} lang="th">
                  {fieldSheetPhrase.syllables.map((s) => s.th).join('')}
                </div>
              </div>
              <button
                type="button"
                className={styles.sheetClose}
                onClick={() => setFieldSheetPhrase(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className={styles.badgeGrid}>
              {[...FIELD_BADGES, { id: CUSTOM_FIELD_BADGE_ID, label: 'Something else', emoji: '⭐' }].map(
                (badge) => {
                  const earned = fieldBadges[badge.id];
                  return (
                    <button
                      key={badge.id}
                      type="button"
                      className={`${styles.badgeBtn} ${earned ? styles.badgeBtnEarned : ''}`}
                      onClick={() => handleAwardField(badge.id)}
                    >
                      <span className={styles.badgeEmoji} aria-hidden="true">
                        {badge.emoji}
                      </span>
                      <span className={styles.badgeLabel}>{badge.label}</span>
                      {earned && (
                        <span className={styles.badgeEarned}>
                          ✓ {formatEarnedDate(earned.earnedAt)}
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deck;
