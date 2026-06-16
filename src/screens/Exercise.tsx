import { useCallback, useEffect, useRef, useState } from 'react';
import { CLASS, TONE, type ToneKey } from '../themes/constants';
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

// Max phrases worked through in a single session.
const SESSION_CAP = 10;
import { buildSession, gradePhrase, type Grade, type SessionResult } from '../data/srs';
import { BUILT_IN_PHRASES } from '../data/phrases';
import { completeQuest } from '../data/quests';
import styles from './Exercise.module.css';

type ExerciseItem = {
  kind: 'tiles';
  phraseId: string;
  prompt: string;
  answer: Syllable[];
  bank: Syllable[];
};

type SourcePhrase = {
  id: string;
  en: string;
  syllables: Syllable[];
};

function ToneGlyph({ tone }: { tone: ToneKey }) {
  return (
    <svg className={styles.toneGlyph} viewBox="0 0 48 40" aria-hidden="true">
      <path d={TONE[tone].d} />
    </svg>
  );
}

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

function buildItem(phrase: SourcePhrase): ExerciseItem {
  return {
    kind: 'tiles',
    phraseId: phrase.id,
    prompt: phrase.en,
    answer: phrase.syllables,
    bank: shuffle(phrase.syllables),
  };
}

type ExerciseProps = {
  onDone?: (result: SessionResult) => void;
};

const Exercise: React.FC<ExerciseProps> = ({ onDone }) => {
  const [item, setItem] = useState<ExerciseItem | null>(null);
  const [phase, setPhase] = useState<'intro' | 'tiles'>('intro');
  const [filled, setFilled] = useState<Syllable[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sessionProgress, setSessionProgress] = useState({ index: 0, total: 0 });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  // Queue of phrases to work through this session.
  const queueRef = useRef<SourcePhrase[]>([]);
  const correctCountRef = useRef(0);
  const reviewedRef = useRef(0);
  const masteredRef = useRef<Set<string>>(new Set());
  const reviewedStagesRef = useRef<Stage[]>([]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const prefetchIdRef = useRef(0);

  function releaseAudio() {
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
  }

  const prefetchAudio = useCallback((syllables: Syllable[]) => {
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
      } catch {
        // Silent — play button falls back to speechSynthesis.
      }
    })();
  }, []);

  const loadFromQueue = useCallback(
    (index: number) => {
      const phrase = queueRef.current[index];
      if (!phrase) {
        if (onDoneRef.current) {
          completeQuest('practice');
          onDoneRef.current({
            reviewed: reviewedRef.current,
            masteredPhraseIds: [...masteredRef.current],
            correctCount: correctCountRef.current,
            reviewedStages: [...reviewedStagesRef.current],
          });
          return;
        }
        completeQuest('practice');
        setDone(true);
        setItem(null);
        return;
      }
      releaseAudio();
      const next = buildItem(phrase);
      setItem(next);
      setPhase('intro');
      setFilled([]);
      setSubmitted(false);
      setCorrect(false);
      setSessionProgress({ index, total: queueRef.current.length });
      prefetchAudio(next.answer);
    },
    [prefetchAudio],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await buildSession();
      const [due, phrasebook] = await Promise.all([getDueNow(), getPhrasebook()]);
      if (cancelled) return;

      const byId = new Map<string, PhrasebookEntry>(phrasebook.map((p) => [p.id, p]));
      const queue: SourcePhrase[] = [];

      // Due SRS phrases first, resolved against the phrasebook.
      for (const record of due) {
        const entry = byId.get(record.phraseId);
        if (entry && entry.syllables.length > 0) {
          queue.push({ id: entry.id, en: entry.en, syllables: entry.syllables });
        }
      }

      // Fall back to a built-in phrase if nothing is due.
      if (queue.length === 0) {
        const pick = BUILT_IN_PHRASES[Math.floor(Math.random() * BUILT_IN_PHRASES.length)];
        queue.push({ id: pick.id, en: pick.en, syllables: pick.syllables });
      }

      // Cap the session so it feels finite — take at most SESSION_CAP phrases.
      queueRef.current = queue.slice(0, SESSION_CAP);
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
  }, []);

  function placeTile(bankIndex: number) {
    if (!item || submitted) return;
    const tile = item.bank[bankIndex];
    if (!tile) return;
    setItem({ ...item, bank: item.bank.filter((_, i) => i !== bankIndex) });
    setFilled((prev) => [...prev, tile]);
  }

  function removeTile(filledIndex: number) {
    if (!item || submitted) return;
    const tile = filled[filledIndex];
    if (!tile) return;
    setFilled((prev) => prev.filter((_, i) => i !== filledIndex));
    setItem({ ...item, bank: [...item.bank, tile] });
  }

  async function handleSubmit() {
    if (!item || filled.length !== item.answer.length || submitted) return;
    let matches = 0;
    for (let i = 0; i < item.answer.length; i++) {
      if (filled[i].th === item.answer[i].th) matches++;
    }
    const allCorrect = matches === item.answer.length;
    const grade: Grade = allCorrect ? 5 : matches >= item.answer.length / 2 ? 3 : 0;

    await initSRS(item.phraseId);
    const record =
      (await getSRSRecord(item.phraseId)) ??
      ({
        phraseId: item.phraseId,
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
    if (updatedRecord.repetitions >= 3) masteredRef.current.add(item.phraseId);

    setCorrect(allCorrect);
    setSubmitted(true);
  }

  function handleNext() {
    loadFromQueue(sessionProgress.index + 1);
  }

  async function handlePlay() {
    if (playing) {
      audioRef.current?.pause();
      audioRef.current = null;
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    if (!item) return;
    const phrase = item.answer.map((s) => s.th).join('');

    if (!audioReady || !audioUrlRef.current) {
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = 'th-TH';
      utterance.onend = () => setPlaying(false);
      setPlaying(true);
      window.speechSynthesis.speak(utterance);
      return;
    }
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
      await audio.play();
      setPlaying(true);
    } catch {
      audioRef.current = null;
      setPlaying(false);
    }
  }

  function renderTile(syll: Syllable, onClick: () => void, key: string, disabled = false) {
    return (
      <button
        key={key}
        type="button"
        className={styles.tile}
        style={{
          background: CLASS[syll.cls].base,
          color: CLASS[syll.cls].ink,
          borderColor: CLASS[syll.cls].base,
        }}
        onClick={onClick}
        disabled={disabled}
      >
        <ToneGlyph tone={syll.tone} />
        <span className={styles.tileThai} lang="th">
          {syll.th}
        </span>
        <span className={styles.tileRom}>{syll.rom}</span>
      </button>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Practice</span>
        <h1 className={styles.title}>
          Build the phrase <span className={styles.titleThai}>เรียง</span>
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
      ) : item && phase === 'intro' ? (
        <section className={styles.introCard} aria-label="Listen first">
          <span className={styles.introLabel}>Listen first</span>
          <p className={styles.introThai} lang="th">
            {item.answer.map((s) => s.th).join('')}
          </p>
          <p className={styles.introRom}>{item.answer.map((s) => s.rom).join(' ')}</p>
          <p className={styles.introGloss}>{item.prompt}</p>
          <button
            type="button"
            className={`${styles.playBtn} ${styles.introPlayBtn} ${playing ? styles.playBtnPlaying : ''}`}
            onClick={handlePlay}
            aria-label={playing ? 'Stop audio' : 'Play audio'}
          >
            <span className={styles.eq} aria-hidden="true" data-playing={playing || undefined}>
              <span />
              <span />
              <span />
              <span />
            </span>
            {playing ? 'Stop' : 'Listen'}
          </button>
          <button type="button" className={styles.readyBtn} onClick={() => setPhase('tiles')}>
            Ready
          </button>
        </section>
      ) : item ? (
        <>
          <section className={styles.promptCard}>
            <div className={styles.promptHead}>
              <span className={styles.promptLabel}>Say this in Thai</span>
              <button
                type="button"
                className={`${styles.playBtn} ${playing ? styles.playBtnPlaying : ''}`}
                onClick={handlePlay}
                aria-label={playing ? 'Stop audio' : 'Play audio'}
              >
                <span className={styles.eq} aria-hidden="true" data-playing={playing || undefined}>
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                {playing ? 'Stop' : 'Listen'}
              </button>
            </div>
            <p className={styles.prompt}>{item.prompt}</p>
          </section>

          <section className={styles.slots} aria-label="Answer slots">
            {item.answer.map((_, i) => {
              const placed = filled[i];
              return (
                <div
                  key={i}
                  className={`${styles.slot} ${placed ? styles.slotFilled : ''} ${
                    submitted ? (placed && placed.th === item.answer[i].th ? styles.slotRight : styles.slotWrong) : ''
                  }`}
                >
                  {placed
                    ? renderTile(placed, () => removeTile(i), `slot-${i}`, submitted)
                    : <span className={styles.slotIndex}>{i + 1}</span>}
                </div>
              );
            })}
          </section>

          <section className={styles.bank} aria-label="Syllable tiles">
            {item.bank.map((syll, i) => renderTile(syll, () => placeTile(i), `bank-${i}`))}
            {item.bank.length === 0 && !submitted && (
              <span className={styles.bankEmpty}>All tiles placed</span>
            )}
          </section>

          {submitted ? (
            <section
              className={`${styles.result} ${correct ? styles.resultCorrect : styles.resultWrong}`}
              role="status"
              aria-live="polite"
            >
              <p className={styles.resultText}>{correct ? 'Correct!' : 'Try again'}</p>
              {!correct && (
                <p className={styles.answerLine} lang="th">
                  {item.answer.map((s) => s.th).join('')}{' '}
                  <span className={styles.answerRom}>{item.answer.map((s) => s.rom).join(' ')}</span>
                </p>
              )}
              <button type="button" className={styles.nextBtn} onClick={handleNext}>
                {sessionProgress.index + 1 < sessionProgress.total ? 'Next' : 'Finish'}
              </button>
            </section>
          ) : (
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={filled.length !== item.answer.length}
            >
              Check
            </button>
          )}
        </>
      ) : null}
    </div>
  );
};

export default Exercise;
