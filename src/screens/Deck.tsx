import { useEffect, useMemo, useState } from 'react';
import { getPhrasebook, putPhrase, seedPhrasebook, type PhrasebookEntry } from '../data/store';
import { tts } from '../worker/api';
import { VOICE_NAME, getDefaultVoice } from '../worker/voice';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import styles from './Deck.module.css';

const ALL = 'All';

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
  const [phrases, setPhrases] = useState<PhrasebookEntry[]>([]);
  const [category, setCategory] = useState<string>(ALL);
  const [playingId, setPlayingId] = useState<string | null>(null);

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

  const speak = async (entry: PhrasebookEntry) => {
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

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>Phrasebook</div>
        <h1 className={styles.title}>
          Phrases <span className={styles.titleThai}>วลี</span>
        </h1>
      </header>

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

      {visible.length === 0 ? (
        <div className={styles.empty}>No phrases yet.</div>
      ) : (
        <ul className={styles.list}>
          {visible.map((p) => (
            <li key={p.id} className={styles.card}>
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
              {p.rtgs && <div className={styles.roman}>{p.rtgs}</div>}
              <div className={styles.gloss}>{p.en}</div>

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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Deck;
