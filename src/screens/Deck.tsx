import { useEffect, useMemo, useState } from 'react';
import { getPhrasebook, putPhrase, seedPhrasebook, type PhrasebookEntry } from '../data/store';
import styles from './Deck.module.css';

const ALL = 'All';

const Deck: React.FC = () => {
  const [phrases, setPhrases] = useState<PhrasebookEntry[]>([]);
  const [category, setCategory] = useState<string>(ALL);

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

  const speak = (entry: PhrasebookEntry) => {
    try {
      const text = entry.syllables.map((s) => s.th).join('');
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'th-TH';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* unavailable */
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

              <button type="button" className={styles.playBtn} onClick={() => speak(p)}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 4l13 8-13 8z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinejoin="round"
                  />
                </svg>
                Play
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Deck;
