import type { SessionMakeup } from '../data/srs';
import styles from './SessionStart.module.css';

type SessionStartProps = {
  makeup: SessionMakeup;
  onStart: (mode: 'build' | 'tonepop') => void;
};

const SessionStart: React.FC<SessionStartProps> = ({ makeup, onStart }) => {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
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
        <button
          type="button"
          className={`${styles.modeBtn} ${styles.modeBtnAlt}`}
          onClick={() => onStart('tonepop')}
        >
          <span className={styles.modeName}>Tone Pop</span>
          <span className={styles.modeHint}>Arcade ear training</span>
        </button>
      </section>

      <p className={styles.note}>No timer. No streak pressure.</p>
    </div>
  );
};

export default SessionStart;
