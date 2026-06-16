import { useEffect, useMemo, useState } from 'react';
import type { SessionResult } from '../data/srs';
import { STAGE_EMOJI, getAllSRSRecords } from '../data/store';
import { recordSession, getRank } from '../data/progression';
import { checkAndAwardBadges, getLearningBadgeDef } from '../data/badges';
import { isRungCleared } from '../data/scriptProgress';
import MascotElephant from '../components/MascotElephant';
import mascotStyles from '../components/MascotElephant.module.css';
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
  const stages = result.reviewedStages ?? [];

  // Record the session once on mount: award XP, update streak, detect rank-up.
  const progress = useMemo(
    () => recordSession(result.correctCount, result.reviewed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const rank = getRank(progress.newTotal);

  // After XP is recorded, evaluate learning badges. SRS records load async, so
  // do this in an effect and surface any newly earned badges as chips.
  const [newBadges, setNewBadges] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      const srsRecords = await getAllSRSRecords();
      if (!active) return;
      const awarded = checkAndAwardBadges({
        totalXP: progress.newTotal,
        streak: progress.streak.count,
        totalReviews: progress.totalReviews,
        srsRecords,
        rungR0Cleared: isRungCleared('r0'),
      });
      if (active && awarded.length > 0) setNewBadges(awarded);
    })();
    return () => {
      active = false;
    };
    // progress is computed once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <MascotElephant
          size={80}
          mood="cheering"
          className={`${mascotStyles.mascot} ${mascotStyles.center}`}
        />
        <span className={styles.eyebrow}>Done</span>
        <h1 className={styles.title}>Session complete</h1>
      </header>

      <section className={styles.bigStat}>
        <span className={styles.bigNumber}>{result.reviewed}</span>
        <span className={styles.bigLabel}>reviewed</span>
      </section>

      {result.reviewed > 0 && (
        <p className={styles.encouragement}>
          Great session — {result.reviewed} {result.reviewed === 1 ? 'phrase' : 'phrases'} reviewed.
        </p>
      )}

      {stages.length > 0 && (
        <section className={styles.stages} aria-label="Phrase growth stages">
          <div className={styles.stageRow}>
            {stages.map((stage, i) => (
              <span key={i} className={styles.stageEmoji} title={stage} role="img" aria-label={stage}>
                {STAGE_EMOJI[stage]}
              </span>
            ))}
          </div>
          <p className={styles.stageLegend} aria-hidden="true">
            🌱 seed · 🌿 sprout · 🌸 blossom · 🪷 lotus
          </p>
        </section>
      )}

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

      <section className={styles.xp} aria-label="Experience earned">
        <p className={styles.xpEarned}>+{progress.xpEarned} XP</p>
        {progress.rankUp && (
          <p className={styles.rankUp}>Rank up!</p>
        )}
        <p className={styles.rank}>
          <span className={styles.rankThai}>{rank.thai}</span>
          <span className={styles.rankName}>{rank.name}</span>
        </p>
        {rank.nextXP != null && (
          <p className={styles.rankProgress}>
            {progress.newTotal} / {rank.nextXP} XP to next rank
          </p>
        )}
      </section>

      {newBadges.length > 0 && (
        <section className={styles.badges} aria-label="New badges">
          <p className={styles.badgesLabel}>New badge{newBadges.length > 1 ? 's' : ''}</p>
          <div className={styles.badgeChips}>
            {newBadges.map((id) => {
              const def = getLearningBadgeDef(id);
              if (!def) return null;
              return (
                <span key={id} className={styles.badgeChip}>
                  <span className={styles.badgeChipEmoji} aria-hidden="true">
                    {def.emoji}
                  </span>
                  {def.label}
                </span>
              );
            })}
          </div>
        </section>
      )}

      <button type="button" className={styles.doneBtn} onClick={onDone}>
        Done
      </button>
    </div>
  );
};

export default SessionSummary;
