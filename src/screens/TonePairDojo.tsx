import { useCallback, useEffect, useRef, useState } from 'react';
import { tts } from '../worker/api';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import { getDefaultVoice, VOICE_NAME } from '../worker/voice';
import { TONE_PAIRS, type TonePair } from '../data/tonePairs';
import {
  initSRS,
  getSRSRecord,
  putSRSRecord,
  type SRSRecord,
} from '../data/store';
import { gradePhrase, type Grade, type SessionResult } from '../data/srs';
import { completeQuest } from '../data/quests';
import { awardBadge } from '../data/badges';
import styles from './TonePairDojo.module.css';

const ROUND_COUNT = 10;
const REVEAL_MS = 1500;

type Round = {
  pair: TonePair;
  targetIndex: number; // index within pair.words that is the correct answer
  options: number[]; // candidate indices into pair.words, shuffled
};

function decodeAudio(audioContent: string): string {
  const binary = atob(audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildRounds(): Round[] {
  const rounds: Round[] = [];
  // Cycle through the pairs (shuffled), building one round per pick until we
  // reach ROUND_COUNT. Pairs repeat if needed but with a fresh target each time.
  const order = shuffle(TONE_PAIRS);
  let i = 0;
  while (rounds.length < ROUND_COUNT) {
    const pair = order[i % order.length];
    i += 1;
    // For pairs with >3 words, present a window of up to 3 candidates that
    // always includes the target, so tiles stay readable.
    const indices = pair.words.map((_, idx) => idx);
    const targetIndex = indices[Math.floor(Math.random() * indices.length)];
    let candidates: number[];
    if (indices.length > 3) {
      const others = shuffle(indices.filter((idx) => idx !== targetIndex)).slice(0, 2);
      candidates = shuffle([targetIndex, ...others]);
    } else {
      candidates = shuffle(indices);
    }
    rounds.push({ pair, targetIndex, options: candidates });
  }
  return rounds;
}

type TonePairDojoProps = {
  onDone?: (result: SessionResult) => void;
  kidMode?: boolean;
};

const TonePairDojo: React.FC<TonePairDojoProps> = ({ onDone }) => {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [done, setDone] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchIdRef = useRef(0);
  const correctCountRef = useRef(0);
  const reviewedRef = useRef(0);
  // Track the best run of consecutive correct answers in this session for the
  // "Sharp Ears" (10-streak) learning badge.
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const gradedRef = useRef<Array<{ id: string; grade: Grade }>>([]);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAudioPlaying(false);
  }, []);

  const playAudio = useCallback(
    (text: string, url: string | null) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      if (!url) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.onend = () => setAudioPlaying(false);
        setAudioPlaying(true);
        window.speechSynthesis.speak(utterance);
        return;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener('ended', () => {
        audioRef.current = null;
        setAudioPlaying(false);
      });
      audio.addEventListener('error', () => {
        audioRef.current = null;
        setAudioPlaying(false);
      });
      audio
        .play()
        .then(() => setAudioPlaying(true))
        .catch(() => {
          audioRef.current = null;
          setAudioPlaying(false);
        });
    },
    [],
  );

  const prefetchAudio = useCallback((round: Round) => {
    const text = round.pair.words[round.targetIndex];
    const voice = VOICE_NAME[getDefaultVoice()];
    const id = ++prefetchIdRef.current;
    (async () => {
      try {
        let audioContent = await getCachedAudio(text, voice);
        if (!audioContent) {
          audioContent = (await tts({ text, voice })).audioContent;
          await setCachedAudio(text, voice, audioContent);
        }
        const url = decodeAudio(audioContent);
        if (prefetchIdRef.current !== id) {
          URL.revokeObjectURL(url);
          return;
        }
        setAudioUrl(url);
      } catch {
        // Silent — Hear again falls back to speechSynthesis.
      }
    })();
  }, []);

  const startGame = useCallback(() => {
    releaseAudio();
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    const next = buildRounds();
    setRounds(next);
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    correctCountRef.current = 0;
    reviewedRef.current = 0;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    gradedRef.current = [];
    setDone(false);
    if (next[0]) prefetchAudio(next[0]);
  }, [prefetchAudio, releaseAudio]);

  useEffect(() => {
    startGame();
    return () => {
      releaseAudio();
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = rounds[index];

  // Auto-play whenever audio becomes ready for the current (unanswered) round.
  useEffect(() => {
    if (!current || done || picked !== null || !audioUrl) return;
    playAudio(current.pair.words[current.targetIndex], audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, index]);

  const finishSession = useCallback(async () => {
    completeQuest('arcade');
    // Award the 10-streak badge directly — dojo streaks are session-local and
    // not reconstructable from SRS records later.
    if (bestStreakRef.current >= 10) awardBadge('dojo-streak-10');
    // Persist SRS grades. Each pair maps to a stable srs key so progress
    // accrues across sessions.
    for (const { id, grade } of gradedRef.current) {
      const phraseId = `tonepair-${id}`;
      await initSRS(phraseId);
      const record =
        (await getSRSRecord(phraseId)) ??
        ({
          phraseId,
          interval: 1,
          dueAt: new Date().toISOString(),
          easeFactor: 2.5,
          repetitions: 0,
          createdAt: new Date().toISOString(),
        } satisfies SRSRecord);
      await putSRSRecord(gradePhrase(record, grade));
    }
    if (onDoneRef.current) {
      onDoneRef.current({
        reviewed: reviewedRef.current,
        masteredPhraseIds: [],
        correctCount: correctCountRef.current,
      });
      return;
    }
    setDone(true);
  }, []);

  const goNext = useCallback(() => {
    const nextIndex = index + 1;
    releaseAudio();
    if (nextIndex >= rounds.length) {
      void finishSession();
      return;
    }
    setIndex(nextIndex);
    setPicked(null);
    const nextRound = rounds[nextIndex];
    if (nextRound) prefetchAudio(nextRound);
  }, [index, rounds, releaseAudio, prefetchAudio, finishSession]);

  function handlePick(optionIndex: number) {
    if (!current || picked !== null) return;
    setPicked(optionIndex);
    const isCorrect = optionIndex === current.targetIndex;
    const grade: Grade = isCorrect ? 5 : 2;
    gradedRef.current.push({ id: current.pair.id, grade });
    reviewedRef.current += 1;
    if (isCorrect) {
      correctCountRef.current += 1;
      setCorrectCount((c) => c + 1);
      streakRef.current += 1;
      if (streakRef.current > bestStreakRef.current) bestStreakRef.current = streakRef.current;
    } else {
      streakRef.current = 0;
    }
    // Wrong answers linger on the reveal so the learner can study the contrast.
    advanceTimerRef.current = setTimeout(goNext, isCorrect ? 900 : REVEAL_MS);
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Dojo</span>
        <h1 className={styles.title}>
          Tone Pair Dojo <span className={styles.titleThai}>คู่เสียง</span>
        </h1>
        <div className={styles.progressDots} aria-label="Round progress">
          {rounds.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === index && !done ? styles.dotActive : ''} ${
                i < index || (i === index && picked !== null) ? styles.dotDone : ''
              }`}
            />
          ))}
        </div>
      </header>

      {done ? (
        <section className={styles.doneCard}>
          <p className={styles.doneTitle}>
            {correctCount} / {rounds.length}
          </p>
          <p className={styles.doneSub}>
            {correctCount === rounds.length
              ? 'Sharp ears! Every pair distinguished.'
              : 'Good listening — replay the ones that tripped you up.'}
          </p>
          <button type="button" className={styles.nextBtn} onClick={startGame}>
            Play again
          </button>
        </section>
      ) : current ? (
        <>
          <button
            type="button"
            className={`${styles.hearBtn} ${audioPlaying ? styles.hearBtnPlaying : ''}`}
            onClick={() => playAudio(current.pair.words[current.targetIndex], audioUrl)}
            aria-label="Hear the word"
          >
            <span className={styles.eq} aria-hidden="true" data-playing={audioPlaying || undefined}>
              <span />
              <span />
              <span />
              <span />
            </span>
            {picked !== null ? 'Hear again' : 'Listen'}
          </button>

          <p className={styles.prompt}>Which word did you hear?</p>

          <section className={styles.options} aria-label="Word options">
            {current.options.map((optIdx) => {
              const revealed = picked !== null;
              const isAnswer = optIdx === current.targetIndex;
              const isPicked = optIdx === picked;
              let cls = styles.optionBtn;
              if (revealed && isAnswer) cls = `${cls} ${styles.optionBtnCorrect}`;
              else if (revealed && isPicked) cls = `${cls} ${styles.optionBtnWrong}`;
              else if (revealed) cls = `${cls} ${styles.optionBtnMuted}`;
              return (
                <button
                  key={optIdx}
                  type="button"
                  className={cls}
                  onClick={() => handlePick(optIdx)}
                  disabled={revealed}
                >
                  <span className={styles.optionThai} lang="th">
                    {current.pair.words[optIdx]}
                  </span>
                  {revealed && (
                    <span className={styles.optionGloss}>{current.pair.en[optIdx]}</span>
                  )}
                </button>
              );
            })}
          </section>

          {picked !== null && (
            <section
              className={`${styles.feedback} ${
                picked === current.targetIndex ? styles.feedbackCorrect : styles.feedbackWrong
              }`}
              role="status"
              aria-live="polite"
            >
              {picked === current.targetIndex ? (
                <p className={styles.feedbackText}>
                  Yes — “{current.pair.en[current.targetIndex]}”
                </p>
              ) : (
                <p className={styles.feedbackText}>
                  It was <span lang="th">{current.pair.words[current.targetIndex]}</span> ·{' '}
                  {current.pair.en[current.targetIndex]}
                </p>
              )}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
};

export default TonePairDojo;
