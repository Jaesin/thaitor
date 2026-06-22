import type { SessionMakeup } from '../data/srs';
import { isRungUnlocked } from '../data/scriptProgress';
import MascotElephant from '../components/MascotElephant';
import mascotStyles from '../components/MascotElephant.module.css';
import styles from './SessionStart.module.css';

export type SessionMode =
  | 'listen'
  | 'build'
  | 'tonepop'
  | 'readtone'
  | 'dojo'
  | 'echo'
  | 'script';

type SessionStartProps = {
  makeup: SessionMakeup;
  onStart: (mode: SessionMode) => void;
  kidMode?: boolean;
};

const SessionStart: React.FC<SessionStartProps> = ({ makeup, onStart, kidMode = false }) => {
  // "Read the Tone" relies on tone-spelling rules, so it only appears once the
  // tone-rules rung (r4) has been unlocked.
  const readToneUnlocked = isRungUnlocked('r4');

  if (kidMode) {
    return (
      <div className={`${styles.screen} ${styles.kidScreen}`}>
        <header className={styles.header}>
          <MascotElephant
            size={96}
            mood="happy"
            className={`${mascotStyles.mascot} ${mascotStyles.center}`}
          />
          <h1 className={styles.title}>Ready to play?</h1>
        </header>

        <button
          type="button"
          className={styles.kidPlayBtn}
          onClick={() => onStart('tonepop')}
        >
          Play! 🎵
        </button>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <MascotElephant
          size={72}
          mood="happy"
          className={`${mascotStyles.mascot} ${mascotStyles.center}`}
        />
        <span className={styles.eyebrow}>Session</span>
        <h1 className={styles.title}>Ready to practice?</h1>
        <p className={styles.eta}>~{makeup.etaMin} min</p>
      </header>

      <section className={styles.stats} aria-label="Session makeup">
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Trip deck</span>
          <span className={styles.statValue}>{makeup.tripDeck}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Due for review</span>
          <span className={styles.statValue}>{makeup.due}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>New sounds</span>
          <span className={styles.statValue}>{makeup.newSounds}</span>
        </div>
      </section>

      <section className={styles.modes}>
        <button type="button" className={styles.modeBtn} onClick={() => onStart('build')}>
          <span className={styles.modeName}>Build phrases</span>
          <span className={styles.modeHint}>Arrange the tiles</span>
        </button>
        <button type="button" className={styles.modeBtn} onClick={() => onStart('listen')}>
          <span className={styles.modeName}>Audio Pick</span>
          <span className={styles.modeHint}>Hear it, choose the meaning.</span>
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${styles.modeBtnAlt}`}
          onClick={() => onStart('tonepop')}
        >
          <span className={styles.modeName}>Tone Pop</span>
          <span className={styles.modeHint}>Arcade ear training</span>
        </button>
        {readToneUnlocked && (
          <button
            type="button"
            className={`${styles.modeBtn} ${styles.modeBtnAlt}`}
            onClick={() => onStart('readtone')}
          >
            <span className={styles.modeName}>Read the Tone</span>
            <span className={styles.modeHint}>Predict tone from spelling</span>
          </button>
        )}
        <button
          type="button"
          className={`${styles.modeBtn} ${styles.modeBtnAlt}`}
          onClick={() => onStart('dojo')}
        >
          <span className={styles.modeName}>Tone Pair Dojo</span>
          <span className={styles.modeHint}>Tell minimal pairs apart</span>
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${styles.modeBtnAlt}`}
          onClick={() => onStart('echo')}
        >
          <span className={styles.modeName}>Echo Booth</span>
          <span className={styles.modeHint}>Record and compare yourself</span>
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${styles.modeBtnAlt}`}
          onClick={() => onStart('script')}
        >
          <span className={styles.modeName}>Script Ladder</span>
          <span className={styles.modeHint}>Learn to read Thai letters</span>
        </button>
        <a className={`${styles.modeBtn} ${styles.modeBtnAlt}`} href="#/trace">
          <span className={styles.modeName}>Tone Trace</span>
          <span className={styles.modeHint}>Mirror your pitch contour</span>
        </a>
        <a className={`${styles.modeBtn} ${styles.modeBtnAlt}`} href="#/play/alphabet">
          <span className={styles.modeName}>Thai Alphabet</span>
          <span className={styles.modeHint}>Read the script in ก→ฮ order</span>
        </a>
      </section>

      <p className={styles.note}>No timer. No streak pressure.</p>
    </div>
  );
};

export default SessionStart;
