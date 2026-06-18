import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
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
const SCRIPT_MODES: ScriptMode[] = ['pop', 'echo', 'pairs'];

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
  const navigate = useNavigate();
  const location = useLocation();
  // The route is the source of truth for which view shows: the ladder list at
  // `/play/script`, a rung's drill chooser at `/play/script/:rungId`, and an
  // active drill at `/play/script/:rungId/:mode`.
  const { rungId, mode } = useParams<{ rungId: string; mode: string }>();

  // The just-cleared rung whose stage animation should play. It can't live in
  // the URL (it's a one-shot flourish), so a finishing drill passes it back
  // through navigation state when it returns to the ladder.
  const [bloom, setBloom] = useState<string | null>(
    () => (location.state as { bloom?: string } | null)?.bloom ?? null,
  );

  const states = RUNGS.map((r) => ({ rung: r, state: rungState(r.id) }));

  const handleStart = useCallback(
    (rung: Rung) => {
      if (rung.external) {
        // Tones live in the Tone Pop arcade; point the user there.
        navigate('/play');
        return;
      }
      if (rungConsonants(rung.id).length === 0) {
        // Vowel / tone-rule rungs have no Script Pop drill yet — clear on visit
        // so progression can continue, and bloom.
        setRungCleared(rung.id);
        setBloom(rung.id);
        return;
      }
      // Consonant rung — let the player pick which drill to play.
      navigate(`/play/script/${rung.id}`);
    },
    [navigate],
  );

  const handlePickMode = useCallback(
    (rung: Rung, picked: ScriptMode) => {
      navigate(`/play/script/${rung.id}/${picked}`);
    },
    [navigate],
  );

  const handleSessionDone = useCallback(
    (rung: Rung) => {
      // Mark the rung cleared once every consonant in it has an SRS record
      // (graded at least once) — accumulated across as many sessions as it takes.
      // A 6-round session can't cover a 9- or 24-letter rung in one go, so we
      // check the persistent SRS store rather than just this run.
      void (async () => {
        const ids = rungConsonants(rung.id).map((c) => c.id);
        const graded = new Set((await getAllSRSRecords()).map((r) => r.phraseId));
        const allDrilled = ids.length > 0 && ids.every((id) => graded.has(id));
        const cleared = allDrilled && rungState(rung.id) !== 'cleared';
        if (cleared) setRungCleared(rung.id);
        // Return to the ladder; hand the bloom back so it animates on arrival.
        navigate('/play/script', cleared ? { state: { bloom: rung.id } } : undefined);
      })();
    },
    [navigate],
  );

  // Clear the bloom highlight after the animation.
  useEffect(() => {
    if (!bloom) return;
    const t = setTimeout(() => setBloom(null), 1800);
    return () => clearTimeout(t);
  }, [bloom]);

  // Resolve the rung named in the URL (if any). An unknown id is a stale/bad
  // link — fall back to the ladder.
  const routedRung = rungId ? RUNGS.find((r) => r.id === rungId) ?? null : null;
  if (rungId && !routedRung) return <Navigate to="/play/script" replace />;

  // Active drill: `/play/script/:rungId/:mode`.
  if (routedRung && mode) {
    if (!SCRIPT_MODES.includes(mode as ScriptMode)) {
      return <Navigate to={`/play/script/${routedRung.id}`} replace />;
    }
    const pool = rungConsonants(routedRung.id);
    if (mode === 'pairs') {
      return (
        <ScriptPairs
          pool={pool}
          kidMode={kidMode}
          rungTitle={routedRung.title}
          onDone={() => navigate('/play/script')}
        />
      );
    }
    if (mode === 'echo') {
      return (
        <EchoTiles
          pool={pool}
          kidMode={kidMode}
          rungTitle={routedRung.title}
          onDone={() => handleSessionDone(routedRung)}
        />
      );
    }
    return (
      <ScriptPop
        pool={pool}
        kidMode={kidMode}
        rungTitle={routedRung.title}
        onDone={() => handleSessionDone(routedRung)}
      />
    );
  }

  // Drill chooser: `/play/script/:rungId`.
  if (routedRung) {
    const choosing = routedRung;
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

        <button type="button" className={styles.backBtn} onClick={() => navigate('/play/script')}>
          Back to ladder
        </button>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
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
