import { useCallback, useEffect, useRef, useState } from 'react';
import { tts, type Syllable } from '../worker/api';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import {
  getDueNow,
  getPhrasebook,
  initSRS,
  putSRSRecord,
  getSRSRecord,
  getStage,
  type PhrasebookEntry,
  type SRSRecord,
  type Stage,
} from '../data/store';
import { buildSession, gradePhrase, type Grade, type SessionResult } from '../data/srs';
import { BUILT_IN_PHRASES } from '../data/phrases';
import { completeQuest } from '../data/quests';
import styles from './AudioPick.module.css';

// Max phrases worked through in a single Audio Pick session.
const SESSION_CAP = 8;
const OPTION_COUNT = 4;

type SourcePhrase = {
  id: string;
  en: string;
  syllables: Syllable[];
};

type Round = {
  phrase: SourcePhrase;
  options: string[]; // English options, randomized
  answer: string; // correct English
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

function buildRound(phrase: SourcePhrase, pool: SourcePhrase[]): Round {
  const distractors = shuffle(pool.filter((p) => p.id !== phrase.id && p.en !== phrase.en))
    .slice(0, OPTION_COUNT - 1)
    .map((p) => p.en);
  const options = shuffle([phrase.en, ...distractors]);
  return { phrase, options, answer: phrase.en };
}

type AudioPickProps = {
  onDone?: (result: SessionResult) => void;
};

const AudioPick: React.FC<AudioPickProps> = ({ onDone }) => {
  const [round, setRound] = useState<Round | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sessionProgress, setSessionProgress] = useState({ index: 0, total: 0 });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const queueRef = useRef<Round[]>([]);
  const correctCountRef = useRef(0);
  const reviewedRef = useRef(0);
  const masteredRef = useRef<Set<string>>(new Set());
  const reviewedStagesRef = useRef<Stage[]>([]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const prefetchIdRef = useRef(0);

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioReady(false);
    setPlaying(false);
  }, []);

  const playPhrase = useCallback((phrase: string) => {
    if (audioUrlRef.current) {
      try {
        const audio = new Audio(audioUrlRef.current);
        audioRef.current = audio;
        audio.addEventListener('ended', () => {
          audioRef.current = null;
          setPlaying(false);
        });
        audio.addEventListener('error', () => {
          audioRef.current = null;
          setPlaying(false);
        });
        setPlaying(true);
        void audio.play().catch(() => {
          audioRef.current = null;
          setPlaying(false);
        });
        return;
      } catch {
        // fall through to speechSynthesis
      }
    }
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = 'th-TH';
    utterance.onend = () => setPlaying(false);
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  const prefetchAudio = useCallback(
    (syllables: Syllable[], autoPlay: boolean) => {
      const phrase = syllables.map((s) => s.th).join('');
      const voice = 'th-TH-Standard-A';
      const id = ++prefetchIdRef.current;
      (async () => {
        try {
          let audioContent = await getCachedAudio(phrase, voice);
          if (!audioContent) {
            audioContent = (await tts({ text: phrase, voice })).audioContent;
            await setCachedAudio(phrase, voice, audioContent);
          }
          const url = decodeAudio(audioContent);
          if (prefetchIdRef.current !== id) {
            URL.revokeObjectURL(url);
            return;
          }
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = url;
          setAudioReady(true);
          if (autoPlay) playPhrase(phrase);
        } catch {
          // Silent — auto-play falls back to speechSynthesis.
          if (prefetchIdRef.current === id && autoPlay) playPhrase(phrase);
        }
      })();
    },
    [playPhrase],
  );

  const loadFromQueue = useCallback(
    (index: number) => {
      const next = queueRef.current[index];
      if (!next) {
        completeQuest('practice');
        if (onDoneRef.current) {
          onDoneRef.current({
            reviewed: reviewedRef.current,
            masteredPhraseIds: [...masteredRef.current],
            correctCount: correctCountRef.current,
            reviewedStages: [...reviewedStagesRef.current],
          });
          return;
        }
        setDone(true);
        setRound(null);
        return;
      }
      releaseAudio();
      setRound(next);
      setPicked(null);
      setSessionProgress({ index, total: queueRef.current.length });
      prefetchAudio(next.phrase.syllables, true);
    },
    [prefetchAudio, releaseAudio],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await buildSession();
      const [due, phrasebook] = await Promise.all([getDueNow(), getPhrasebook()]);
      if (cancelled) return;

      const byId = new Map<string, PhrasebookEntry>(phrasebook.map((p) => [p.id, p]));
      const pool: SourcePhrase[] = phrasebook
        .filter((p) => p.syllables.length > 0)
        .map((p) => ({ id: p.id, en: p.en, syllables: p.syllables }));

      const queuePhrases: SourcePhrase[] = [];
      const seen = new Set<string>();

      // Due SRS phrases first, resolved against the phrasebook.
      for (const record of due) {
        const entry = byId.get(record.phraseId);
        if (entry && entry.syllables.length > 0 && !seen.has(entry.id)) {
          queuePhrases.push({ id: entry.id, en: entry.en, syllables: entry.syllables });
          seen.add(entry.id);
        }
      }

      // Fall back to random phrasebook phrases if nothing is due.
      if (queuePhrases.length === 0) {
        for (const p of shuffle(pool)) {
          if (!seen.has(p.id)) {
            queuePhrases.push(p);
            seen.add(p.id);
          }
        }
      }

      // Distractor pool: phrasebook, backfilled with built-ins so we always
      // have enough wrong answers for 4 options.
      const distractorPool: SourcePhrase[] = [...pool];
      for (const p of BUILT_IN_PHRASES) {
        if (!seen.has(p.id) && p.syllables.length > 0) {
          distractorPool.push({ id: p.id, en: p.en, syllables: p.syllables });
        }
      }

      const capped = queuePhrases.slice(0, SESSION_CAP);
      queueRef.current = capped.map((phrase) => buildRound(phrase, distractorPool));
      if (cancelled) return;
      setLoading(false);
      loadFromQueue(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFromQueue]);

  useEffect(() => {
    return () => {
      releaseAudio();
    };
  }, [releaseAudio]);

  function handleReplay() {
    if (!round) return;
    if (playing) {
      audioRef.current?.pause();
      audioRef.current = null;
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    playPhrase(round.phrase.syllables.map((s) => s.th).join(''));
  }

  async function handlePick(option: string) {
    if (!round || picked) return;
    setPicked(option);
    const allCorrect = option === round.answer;
    const grade: Grade = allCorrect ? 5 : 2;

    await initSRS(round.phrase.id);
    const record =
      (await getSRSRecord(round.phrase.id)) ??
      ({
        phraseId: round.phrase.id,
        interval: 1,
        dueAt: new Date().toISOString(),
        easeFactor: 2.5,
        repetitions: 0,
        createdAt: new Date().toISOString(),
      } satisfies SRSRecord);
    const updatedRecord = gradePhrase(record, grade);
    await putSRSRecord(updatedRecord);

    reviewedRef.current += 1;
    if (allCorrect) correctCountRef.current += 1;
    reviewedStagesRef.current.push(getStage(updatedRecord.repetitions));
    if (updatedRecord.repetitions >= 3) masteredRef.current.add(round.phrase.id);
  }

  function handleNext() {
    loadFromQueue(sessionProgress.index + 1);
  }

  const isLast = sessionProgress.index + 1 >= sessionProgress.total;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Practice</span>
        <h1 className={styles.title}>
          Audio Pick <span className={styles.titleThai}>ฟัง</span>
        </h1>
        {sessionProgress.total > 0 && (
          <div className={styles.progress} aria-label="Session progress">
            {sessionProgress.index + 1} / {sessionProgress.total}
          </div>
        )}
      </header>

      {loading ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Loading your session…</span>
        </div>
      ) : done ? (
        <section className={styles.doneCard}>
          <p className={styles.doneTitle}>Session complete</p>
          <p className={styles.doneSub}>You worked through every phrase. Come back later for more.</p>
        </section>
      ) : round ? (
        <>
          <section className={styles.promptCard} aria-label="Listen and choose">
            <span className={styles.promptLabel}>Listen</span>
            <p className={styles.promptThai} lang="th">
              {round.phrase.syllables.map((s) => s.th).join('')}
            </p>
            <button
              type="button"
              className={`${styles.playBtn} ${playing ? styles.playBtnPlaying : ''}`}
              onClick={handleReplay}
              aria-label={playing ? 'Stop audio' : 'Replay audio'}
            >
              <span className={styles.eq} aria-hidden="true" data-playing={playing || undefined}>
                <span />
                <span />
                <span />
                <span />
              </span>
              {playing ? 'Stop' : audioReady ? 'Replay' : 'Listen'}
            </button>
          </section>

          <section className={styles.options} aria-label="Choose the meaning">
            {round.options.map((option) => {
              const isCorrect = option === round.answer;
              const isPicked = option === picked;
              const reveal = picked != null;
              const cls = [
                styles.option,
                reveal && isCorrect ? styles.optionCorrect : '',
                reveal && isPicked && !isCorrect ? styles.optionWrong : '',
                reveal && !isCorrect && !isPicked ? styles.optionMuted : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={option}
                  type="button"
                  className={cls}
                  onClick={() => handlePick(option)}
                  disabled={reveal}
                >
                  {option}
                </button>
              );
            })}
          </section>

          {picked != null && (
            <section
              className={`${styles.result} ${picked === round.answer ? styles.resultCorrect : styles.resultWrong}`}
              role="status"
              aria-live="polite"
            >
              <p className={styles.resultText}>
                {picked === round.answer ? 'Correct!' : 'Not quite'}
              </p>
              {picked !== round.answer && (
                <p className={styles.answerLine}>
                  It means: <strong>{round.answer}</strong>
                </p>
              )}
              <button type="button" className={styles.nextBtn} onClick={handleNext}>
                {isLast ? 'Finish' : 'Next'}
              </button>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
};

export default AudioPick;
