import { useCallback, useEffect, useRef, useState } from 'react';
import { CLASS } from '../themes/constants';
import { CONSONANTS, type Consonant, rungConsonants } from '../data/script';
import { tts } from '../worker/api';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import { getDefaultVoice, VOICE_NAME } from '../worker/voice';
import {
  initSRS,
  putSRSRecord,
  getSRSRecord,
  getStage,
  type SRSRecord,
} from '../data/store';
import { gradePhrase, type Grade, type SessionResult } from '../data/srs';
import { completeQuest } from '../data/quests';
import styles from './EchoTiles.module.css';

const ROUND_COUNT = 6;
const REVEAL_MS = 1500;

// Visually-similar glyph clusters — reused for adversarial distractors.
const CONFUSABLE_GROUPS: string[][] = [
  ['ก', 'ภ', 'ถ'],
  ['ข', 'ฃ', 'ช', 'ซ'],
  ['ค', 'ฅ', 'ด', 'ต'],
  ['ฆ', 'ฒ'],
  ['จ', 'เ', 'ง'],
  ['ฉ', 'ณ', 'ญ'],
  ['ฎ', 'ฏ'],
  ['ฑ', 'ท', 'ฬ', 'ฟ', 'ฝ'],
  ['น', 'ม', 'บ', 'ป', 'ษ'],
  ['พ', 'ฟ', 'ฬ', 'ฝ'],
  ['ผ', 'ฝ', 'ฒ'],
  ['ย', 'ผ', 'ฟ'],
  ['ร', 'ธ'],
  ['ล', 'ส'],
  ['ว', 'อ', 'ฉ'],
  ['ศ', 'ส', 'ล'],
  ['ห', 'ฬ'],
  ['ฮ', 'ฆ'],
  ['ใ', 'ไ', 'โ'],
];

const BY_GLYPH: Record<string, Consonant> = Object.fromEntries(
  CONSONANTS.map((c) => [c.glyph, c]),
);

function srsKey(c: Consonant): string {
  return `echo-${c.glyph}`;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickDistractors(answer: Consonant, pool: Consonant[], count: number): Consonant[] {
  const seen = new Set<string>([answer.id]);
  const result: Consonant[] = [];

  const confusable: Consonant[] = [];
  for (const group of CONFUSABLE_GROUPS) {
    if (!group.includes(answer.glyph)) continue;
    for (const g of group) {
      const c = BY_GLYPH[g];
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        confusable.push(c);
      }
    }
  }
  for (const c of shuffle(confusable)) {
    if (result.length >= count) break;
    result.push(c);
  }

  const fillers = shuffle([...pool, ...CONSONANTS]).filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  for (const c of fillers) {
    if (result.length >= count) break;
    result.push(c);
  }
  return result.slice(0, count);
}

type Round = {
  answer: Consonant;
  options: Consonant[];
};

function buildRounds(pool: Consonant[], optionCount: number): Round[] {
  const order = shuffle(pool);
  const picks: Consonant[] = [];
  let i = 0;
  while (picks.length < ROUND_COUNT && order.length > 0) {
    picks.push(order[i % order.length]);
    i += 1;
  }
  return picks.slice(0, ROUND_COUNT).map((answer) => ({
    answer,
    options: shuffle([answer, ...pickDistractors(answer, pool, optionCount - 1)]),
  }));
}

function decodeAudio(audioContent: string): string {
  const binary = atob(audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

type EchoTilesProps = {
  pool?: Consonant[]; // consonants to drill; defaults to r0–r1
  onDone?: (result: SessionResult & { drilledIds: string[] }) => void;
  kidMode?: boolean;
  rungTitle?: string;
};

const EchoTiles: React.FC<EchoTilesProps> = ({
  pool,
  onDone,
  kidMode = false,
  rungTitle,
}) => {
  // Kid mode: 4 tiles; standard: 6 tiles.
  const optionCount = kidMode ? 4 : 6;
  const effectivePool =
    pool && pool.length > 0
      ? pool
      : [...rungConsonants('r0'), ...rungConsonants('r1')];

  const [rounds, setRounds] = useState<Round[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [done, setDone] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const correctRef = useRef(0);
  const reviewedRef = useRef(0);
  const stagesRef = useRef<import('../data/store').Stage[]>([]);
  const drilledRef = useRef<Set<string>>(new Set());
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const playPrompt = useCallback((cons: Consonant) => {
    // Speak the acrophonic name (e.g. "ko kai") so the player hears the sound.
    const text = cons.glyph;
    const voice = VOICE_NAME[getDefaultVoice()];
    setAudioPlaying(true);
    (async () => {
      try {
        let audioContent = await getCachedAudio(text, voice);
        if (!audioContent) {
          audioContent = (await tts({ text, voice })).audioContent;
          await setCachedAudio(text, voice, audioContent);
        }
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        const url = decodeAudio(audioContent);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.addEventListener('ended', () => setAudioPlaying(false));
        audio.addEventListener('error', () => setAudioPlaying(false));
        audio.play().catch(() => setAudioPlaying(false));
      } catch {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'th-TH';
        u.onend = () => setAudioPlaying(false);
        window.speechSynthesis.speak(u);
      }
    })();
  }, []);

  const startGame = useCallback(() => {
    setRounds(buildRounds(effectivePool, optionCount));
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setDone(false);
    correctRef.current = 0;
    reviewedRef.current = 0;
    stagesRef.current = [];
    drilledRef.current = new Set();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionCount]);

  useEffect(() => {
    startGame();
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = rounds[index];

  // Auto-play the prompt for each fresh (unanswered) round.
  useEffect(() => {
    if (!current || done || picked !== null) return;
    playPrompt(current.answer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, rounds]);

  async function gradeCurrent(answer: Consonant, correct: boolean) {
    const key = srsKey(answer);
    await initSRS(key);
    const record =
      (await getSRSRecord(key)) ??
      ({
        phraseId: key,
        interval: 1,
        dueAt: new Date().toISOString(),
        easeFactor: 2.5,
        repetitions: 0,
        createdAt: new Date().toISOString(),
      } satisfies SRSRecord);
    const grade: Grade = correct ? 5 : 2;
    const updated = gradePhrase(record, grade);
    await putSRSRecord(updated);
    reviewedRef.current += 1;
    stagesRef.current.push(getStage(updated.repetitions));
    if (updated.repetitions >= 1) drilledRef.current.add(answer.id);
  }

  function handlePick(option: Consonant) {
    if (!current || picked !== null) return;
    const correct = option.id === current.answer.id;
    setPicked(option.id);
    if (correct) {
      correctRef.current += 1;
      setCorrectCount((c) => c + 1);
    }
    void gradeCurrent(current.answer, correct);
  }

  function finish() {
    completeQuest('arcade');
    if (onDoneRef.current) {
      onDoneRef.current({
        reviewed: reviewedRef.current,
        masteredPhraseIds: [],
        correctCount: correctRef.current,
        reviewedStages: stagesRef.current,
        drilledIds: Array.from(drilledRef.current),
      });
      return;
    }
    setDone(true);
  }

  function handleNext() {
    const nextIndex = index + 1;
    if (nextIndex >= rounds.length) {
      finish();
      return;
    }
    setIndex(nextIndex);
    setPicked(null);
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Arcade · Script</span>
        <h1 className={styles.title}>
          Echo Tiles <span className={styles.titleThai}>ฟังเสียง</span>
        </h1>
        {rungTitle && <p className={styles.rung}>{rungTitle}</p>}
        <div className={styles.progressDots} aria-label="Round progress">
          {rounds.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === index && !done ? styles.dotActive : ''}`}
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
              ? 'Perfect ear! Every glyph spotted.'
              : 'Nice work — the sounds are linking to shapes.'}
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
            onClick={() => playPrompt(current.answer)}
            aria-label="Hear the sound again"
          >
            <span className={styles.eq} aria-hidden="true" data-playing={audioPlaying || undefined}>
              <span />
              <span />
              <span />
              <span />
            </span>
            {picked !== null ? 'Hear again' : 'Listen'}
          </button>

          <p className={styles.prompt}>
            {kidMode ? 'Which letter did you hear?' : 'Which glyph makes this sound?'}
          </p>

          <section
            className={`${styles.options} ${kidMode ? styles.optionsKid : ''}`}
            aria-label="Glyph options"
          >
            {current.options.map((opt) => {
              const revealed = picked !== null;
              const isAnswer = opt.id === current.answer.id;
              const isPicked = opt.id === picked;
              let cls = `${styles.tile} ${kidMode ? styles.kidMode : ''}`;
              if (revealed && isAnswer) cls = `${cls} ${styles.tileCorrect}`;
              else if (revealed && isPicked) cls = `${cls} ${styles.tileWrong}`;
              const c = CLASS[opt.class];
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={cls}
                  onClick={() => handlePick(opt)}
                  disabled={revealed}
                  style={
                    {
                      '--tile-base': c.base,
                      '--tile-ink': c.ink,
                      '--tile-soft': c.soft,
                    } as React.CSSProperties
                  }
                >
                  <span className={styles.tileGlyph} lang="th">
                    {opt.glyph}
                  </span>
                </button>
              );
            })}
          </section>

          {picked !== null && (
            <RevealCard
              answer={current.answer}
              correct={picked === current.answer.id}
              kidMode={kidMode}
              isLast={index + 1 >= rounds.length}
              onNext={handleNext}
            />
          )}
        </>
      ) : null}
    </div>
  );
};

function RevealCard({
  answer,
  correct,
  kidMode,
  isLast,
  onNext,
}: {
  answer: Consonant;
  correct: boolean;
  kidMode: boolean;
  isLast: boolean;
  onNext: () => void;
}) {
  const [ready, setReady] = useState(correct);
  useEffect(() => {
    if (correct) return;
    const t = setTimeout(() => setReady(true), REVEAL_MS);
    return () => clearTimeout(t);
  }, [correct]);

  return (
    <section
      className={`${styles.revealCard} ${correct ? styles.revealCorrect : styles.revealWrong}`}
      role="status"
      aria-live="polite"
    >
      <p className={styles.revealVerdict}>{correct ? 'Snap! ✓' : 'The answer:'}</p>
      <p className={styles.revealGlyph} lang="th" style={{ color: CLASS[answer.class].ink }}>
        {answer.glyph}
      </p>
      <p className={styles.revealName}>{answer.name}</p>
      {!kidMode && (
        <p className={styles.revealMeta}>
          {CLASS[answer.class].name} class · initial /{answer.initial}/
        </p>
      )}
      <button
        type="button"
        className={styles.nextBtn}
        onClick={onNext}
        disabled={!ready}
      >
        {isLast ? 'Finish' : 'Next'}
      </button>
    </section>
  );
}

export default EchoTiles;
