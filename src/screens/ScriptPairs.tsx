import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CLASS } from '../themes/constants';
import { CONSONANTS, type Consonant, rungConsonants } from '../data/script';
import styles from './ScriptPairs.module.css';

const FLIP_BACK_MS = 1000;

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A card is either the Thai glyph face or the consonant-name face of a pair.
type CardFace = 'glyph' | 'name';
type Card = {
  key: string; // unique per card
  consonantId: string; // shared between the two cards of a pair
  face: CardFace;
  cons: Consonant;
};

function buildDeck(pool: Consonant[], pairCount: number): Card[] {
  const picks = shuffle(pool).slice(0, pairCount);
  const cards: Card[] = [];
  for (const cons of picks) {
    cards.push({ key: `${cons.id}-glyph`, consonantId: cons.id, face: 'glyph', cons });
    cards.push({ key: `${cons.id}-name`, consonantId: cons.id, face: 'name', cons });
  }
  return shuffle(cards);
}

type ScriptPairsProps = {
  pool?: Consonant[]; // consonants to draw pairs from; defaults to mid (r0)
  kidMode?: boolean;
  rungTitle?: string;
  onDone?: () => void;
};

const ScriptPairs: React.FC<ScriptPairsProps> = ({
  pool,
  kidMode = false,
  rungTitle,
  onDone,
}) => {
  // Kid mode: 6 pairs (3×4); standard: 8 pairs (4×4).
  const pairCount = kidMode ? 6 : 8;
  const effectivePool = useMemo(() => {
    const base = pool && pool.length > 0 ? pool : rungConsonants('r0');
    // Guarantee enough distinct consonants to fill the board.
    return base.length >= pairCount ? base : CONSONANTS;
  }, [pool, pairCount]);

  const [deck, setDeck] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]); // card keys currently face-up (unmatched)
  const [matched, setMatched] = useState<Set<string>>(new Set()); // consonantIds matched
  const [turn, setTurn] = useState<0 | 1>(0); // active player index
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [locked, setLocked] = useState(false); // input lock during mismatch flip-back
  const timerRef = useRef<number | null>(null);

  const startGame = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setDeck(buildDeck(effectivePool, pairCount));
    setFlipped([]);
    setMatched(new Set());
    setTurn(0);
    setScores([0, 0]);
    setLocked(false);
  }, [effectivePool, pairCount]);

  useEffect(() => {
    startGame();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [startGame]);

  const allMatched = deck.length > 0 && matched.size === deck.length / 2;

  const handleFlip = useCallback(
    (card: Card) => {
      if (locked) return;
      if (matched.has(card.consonantId)) return;
      if (flipped.includes(card.key)) return;
      if (flipped.length >= 2) return;

      const next = [...flipped, card.key];
      setFlipped(next);
      if (next.length < 2) return;

      // Two cards up — resolve the pair.
      const [aKey, bKey] = next;
      const a = deck.find((c) => c.key === aKey)!;
      const b = deck.find((c) => c.key === bKey)!;
      const isMatch = a.consonantId === b.consonantId && a.face !== b.face;

      if (isMatch) {
        setMatched((prev) => new Set(prev).add(a.consonantId));
        setScores((prev) => {
          const copy: [number, number] = [prev[0], prev[1]];
          copy[turn] += 1;
          return copy;
        });
        setFlipped([]);
        // Matcher keeps their turn.
      } else {
        setLocked(true);
        timerRef.current = window.setTimeout(() => {
          setFlipped([]);
          setLocked(false);
          setTurn((t) => (t === 0 ? 1 : 0));
        }, FLIP_BACK_MS);
      }
    },
    [locked, matched, flipped, deck, turn],
  );

  const winner: 'p1' | 'p2' | 'tie' | null = allMatched
    ? scores[0] > scores[1]
      ? 'p1'
      : scores[1] > scores[0]
        ? 'p2'
        : 'tie'
    : null;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Arcade · Script · 2-player</span>
        <h1 className={styles.title}>
          Script Pairs <span className={styles.titleThai}>จับคู่</span>
        </h1>
        {rungTitle && <p className={styles.rung}>{rungTitle}</p>}
      </header>

      <section className={styles.scoreboard} aria-label="Scores">
        <div
          className={`${styles.player} ${turn === 0 && !allMatched ? styles.playerActive : ''}`}
        >
          <span className={styles.playerName}>Player 1</span>
          <span className={styles.playerScore}>{scores[0]}</span>
        </div>
        <div className={styles.turnPill}>
          {allMatched ? 'Done' : `P${turn + 1}'s turn`}
        </div>
        <div
          className={`${styles.player} ${turn === 1 && !allMatched ? styles.playerActive : ''}`}
        >
          <span className={styles.playerName}>Player 2</span>
          <span className={styles.playerScore}>{scores[1]}</span>
        </div>
      </section>

      {allMatched ? (
        <section className={styles.doneCard}>
          <p className={styles.doneTitle}>
            {winner === 'tie'
              ? "It's a tie!"
              : `Player ${winner === 'p1' ? '1' : '2'} wins!`}
          </p>
          <p className={styles.doneSub}>
            {scores[0]} – {scores[1]}
          </p>
          <div className={styles.doneActions}>
            <button type="button" className={styles.nextBtn} onClick={startGame}>
              Play again
            </button>
            {onDone && (
              <button type="button" className={styles.ghostBtn} onClick={onDone}>
                Back to ladder
              </button>
            )}
          </div>
        </section>
      ) : (
        <section
          className={`${styles.grid} ${kidMode ? styles.gridKid : ''}`}
          aria-label="Card grid"
        >
          {deck.map((card) => {
            const isMatched = matched.has(card.consonantId);
            const isUp = isMatched || flipped.includes(card.key);
            const c = CLASS[card.cons.class];
            return (
              <button
                key={card.key}
                type="button"
                className={`${styles.card} ${isUp ? styles.cardUp : ''} ${
                  isMatched ? styles.cardMatched : ''
                }`}
                onClick={() => handleFlip(card)}
                disabled={isUp || locked}
                aria-label={isUp ? `${card.cons.name}` : 'Face-down card'}
                style={
                  {
                    '--card-base': c.base,
                    '--card-ink': c.ink,
                    '--card-soft': c.soft,
                  } as React.CSSProperties
                }
              >
                {isUp ? (
                  card.face === 'glyph' ? (
                    <span className={styles.cardGlyph} lang="th">
                      {card.cons.glyph}
                    </span>
                  ) : (
                    <span className={styles.cardName}>{card.cons.name}</span>
                  )
                ) : (
                  <span className={styles.cardBack} aria-hidden="true">
                    ก
                  </span>
                )}
              </button>
            );
          })}
        </section>
      )}

      <p className={styles.note}>
        Match each Thai letter to its name. A match keeps your turn; a miss
        passes the board.
      </p>
    </div>
  );
};

export default ScriptPairs;
