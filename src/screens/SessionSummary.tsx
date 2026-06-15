import type { SessionResult } from '../data/srs';
import styles from './SessionSummary.module.css';

type SessionSummaryProps = {
  result: SessionResult;
  onDone: () => void;
};

function Lotus() {
  return (
    <svg className={styles.lotus} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21c-4 0-7-2.4-7-5.6 0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9C19 18.6 16 21 12 21Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path d="M12 19c-2 0-3.6-2.3-3.6-5.2C8.4 11.4 10 9 12 9s3.6 2.4 3.6 4.8C15.6 16.7 14 19 12 19Z" fill="currentColor" />
      <path d="M12 18c-3 .2-5.8-1.6-6.6-4.2 1.9-1 4.3-.7 6.6 1 2.3-1.7 4.7-2 6.6-1C17.8 16.4 15 18.2 12 18Z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

const SessionSummary: React.FC<SessionSummaryProps> = ({ result, onDone }) => {
  const masteredCount = result.masteredPhraseIds.length;
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Done</span>
        <h1 className={styles.title}>Session complete</h1>
      </header>

      <section className={styles.bigStat}>
        <span className={styles.bigNumber}>{result.reviewed}</span>
        <span className={styles.bigLabel}>reviewed</span>
      </section>

      {masteredCount > 0 && (
        <section className={styles.bloom} aria-label="Phrases reached lotus">
          <div className={styles.lotusRow}>
            {result.masteredPhraseIds.map((id) => (
              <span key={id} className={styles.lotusWrap}>
                <Lotus />
              </span>
            ))}
          </div>
          <p className={styles.bloomText}>
            {masteredCount} reached lotus
          </p>
        </section>
      )}

      <p className={styles.correct}>
        {result.correctCount} / {result.reviewed} correct
      </p>

      <button type="button" className={styles.doneBtn} onClick={onDone}>
        Done
      </button>
    </div>
  );
};

export default SessionSummary;
