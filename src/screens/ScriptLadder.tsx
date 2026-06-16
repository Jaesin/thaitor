import { useCallback, useEffect, useState } from 'react';
import { RUNGS, rungConsonants, type Rung } from '../data/script';
import { rungState, setRungCleared, type RungState } from '../data/scriptProgress';
import { getAllSRSRecords } from '../data/store';
import { getKidMode } from '../data/profiles';
import { CLASS } from '../themes/constants';
import ScriptPop from './ScriptPop';
import ScriptPairs from './ScriptPairs';
import EchoTiles from './EchoTiles';
import styles from './ScriptLadder.module.css';

// The three drills available once a consonant rung is selected.
type ScriptMode = 'pop' | 'echo' | 'pairs';

// Track which rung just bloomed (cleared) so we can play the stage animation.
type ActiveSession = { rung: Rung; mode: ScriptMode };

const STATE_LABEL: Record<RungState, string> = {
  locked: 'Locked',
  unlocked: 'Ready',
  cleared: 'Cleared',
};

function tone(rung: Rung): { ink: string; soft: string; base: string } {
  // Color consonant rungs by their class; others use the accent neutral.
  if (rung.id === 'r0') return CLASS.mid;
  if (rung.id === 'r1') return CLASS.high;
  if (rung.id === 'r2') return CLASS.low;
  return { ink: 'var(--ink)', soft: 'var(--surface)', base: 'var(--hair)' };
}

const ScriptLadder: React.FC = () => {
  const [kidMode] = useState(() => getKidMode());
  const [active, setActive] = useState<ActiveSession | null>(null);
  // A consonant rung whose mode chooser is open (before a drill is picked).
  const [choosing, setChoosing] = useState<Rung | null>(null);
  const [bloom, setBloom] = useState<string | null>(null);
  // Bump to recompute lock/clear states after a session.
  const [version, setVersion] = useState(0);

  const states = RUNGS.map((r) => ({ rung: r, state: rungState(r.id) }));

  const handleStart = useCallback((rung: Rung) => {
    if (rung.external) {
      // Tones live in the Tone Pop arcade; point the user there.
      window.location.hash = '#/play';
      return;
    }
    if (rungConsonants(rung.id).length === 0) {
      // Vowel / tone-rule rungs have no Script Pop drill yet — clear on visit
      // so progression can continue, and bloom.
      setRungCleared(rung.id);
      setBloom(rung.id);
      setVersion((v) => v + 1);
      return;
    }
    // Consonant rung — let the player pick which drill to play.
    setChoosing(rung);
  }, []);

  const handlePickMode = useCallback((rung: Rung, mode: ScriptMode) => {
    setChoosing(null);
    setActive({ rung, mode });
  }, []);

  const handleSessionDone = useCallback((rung: Rung) => {
    setActive(null);
    // Mark the rung cleared once every consonant in it has an SRS record
    // (graded at least once) — accumulated across as many sessions as it takes.
    // A 6-round session can't cover a 9- or 24-letter rung in one go, so we
    // check the persistent SRS store rather than just this run.
    void (async () => {
      const ids = rungConsonants(rung.id).map((c) => c.id);
      const graded = new Set((await getAllSRSRecords()).map((r) => r.phraseId));
      const allDrilled = ids.length > 0 && ids.every((id) => graded.has(id));
      if (allDrilled && rungState(rung.id) !== 'cleared') {
        setRungCleared(rung.id);
        setBloom(rung.id);
      }
      setVersion((v) => v + 1);
    })();
  }, []);

  // Clear the bloom highlight after the animation.
  useEffect(() => {
    if (!bloom) return;
    const t = setTimeout(() => setBloom(null), 1800);
    return () => clearTimeout(t);
  }, [bloom]);

  if (active) {
    const pool = rungConsonants(active.rung.id);
    if (active.mode === 'pairs') {
      return (
        <ScriptPairs
          pool={pool}
          kidMode={kidMode}
          rungTitle={active.rung.title}
          onDone={() => setActive(null)}
        />
      );
    }
    if (active.mode === 'echo') {
      return (
        <EchoTiles
          pool={pool}
          kidMode={kidMode}
          rungTitle={active.rung.title}
          onDone={() => handleSessionDone(active.rung)}
        />
      );
    }
    return (
      <ScriptPop
        pool={pool}
        kidMode={kidMode}
        rungTitle={active.rung.title}
        onDone={() => handleSessionDone(active.rung)}
      />
    );
  }

  if (choosing) {
    return (
      <div className={styles.screen}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Reading track</span>
          <h1 className={styles.title}>
            {choosing.title} <span className={styles.titleThai}>{choosing.titleThai}</span>
          </h1>
          <p className={styles.sub}>{choosing.subtitle}</p>
        </header>

        <div className={styles.modeList}>
          <button
            type="button"
            className={styles.modeCard}
            onClick={() => handlePickMode(choosing, 'pop')}
          >
            <span className={styles.modeName}>Script Pop</span>
            <span className={styles.modeHint}>See the glyph, name the letter</span>
          </button>
          <button
            type="button"
            className={styles.modeCard}
            onClick={() => handlePickMode(choosing, 'echo')}
          >
            <span className={styles.modeName}>Echo Tiles</span>
            <span className={styles.modeHint}>Hear the sound, pick the glyph</span>
          </button>
          <button
            type="button"
            className={styles.modeCard}
            onClick={() => handlePickMode(choosing, 'pairs')}
          >
            <span className={styles.modeName}>Play Pairs</span>
            <span className={styles.modeHint}>2-player glyph ↔ name match</span>
          </button>
        </div>

        <button type="button" className={styles.backBtn} onClick={() => setChoosing(null)}>
          Back to ladder
        </button>
      </div>
    );
  }

  return (
    <div className={styles.screen} key={version}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Reading track</span>
        <h1 className={styles.title}>
          Script Ladder <span className={styles.titleThai}>บันไดอักษร</span>
        </h1>
        <p className={styles.sub}>Climb the Thai writing system, one rung at a time.</p>
      </header>

      <ol className={styles.ladder}>
        {states.map(({ rung, state }, i) => {
          const t = tone(rung);
          const locked = state === 'locked';
          const isBloom = bloom === rung.id;
          return (
            <li key={rung.id} className={styles.rungItem}>
              {i < states.length - 1 && <span className={styles.connector} aria-hidden="true" />}
              <button
                type="button"
                className={`${styles.rungBtn} ${locked ? styles.locked : ''} ${
                  state === 'cleared' ? styles.cleared : ''
                } ${isBloom ? styles.bloom : ''}`}
                disabled={locked}
                onClick={() => handleStart(rung)}
                style={
                  {
                    '--rung-ink': t.ink,
                    '--rung-soft': t.soft,
                    '--rung-base': t.base,
                  } as React.CSSProperties
                }
              >
                <span className={styles.rungBadge} aria-hidden="true">
                  {state === 'cleared' ? '🪷' : locked ? '🔒' : rung.id.toUpperCase()}
                </span>
                <span className={styles.rungBody}>
                  <span className={styles.rungTitle}>
                    {rung.title} <span className={styles.rungThai}>{rung.titleThai}</span>
                  </span>
                  <span className={styles.rungSub}>{rung.subtitle}</span>
                </span>
                <span className={styles.rungState} data-state={state}>
                  {STATE_LABEL[state]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className={styles.note}>
        Clear a rung by naming every letter to unlock the next.
      </p>
    </div>
  );
};

export default ScriptLadder;
