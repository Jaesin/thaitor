import { useCallback, useEffect, useRef, useState } from 'react';
import { CLASS, TONE, TONE_ORDER, type ToneKey } from '../themes/constants';
import { tts, type Syllable } from '../worker/api';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import { BUILT_IN_PHRASES } from '../data/phrases';
import { getDefaultVoice, VOICE_NAME } from '../worker/voice';
import type { SessionResult } from '../data/srs';
import { gradePhrase, type Grade } from '../data/srs';
import { initSRS, getSRSRecord, putSRSRecord, type SRSRecord } from '../data/store';
import { completeQuest } from '../data/quests';
import styles from './TonePop.module.css';

const ROUND_COUNT = 6;

type Round = { syllable: Syllable; phraseEn: string };

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

function buildRounds(): Round[] {
  const all: Round[] = [];
  for (const phrase of BUILT_IN_PHRASES) {
    for (const syllable of phrase.syllables) {
      all.push({ syllable, phraseEn: phrase.en });
    }
  }
  // Bucket by tone so we can prefer variety.
  const byTone = new Map<ToneKey, Round[]>();
  for (const r of all) {
    const list = byTone.get(r.syllable.tone) ?? [];
    list.push(r);
    byTone.set(r.syllable.tone, list);
  }
  const picked: Round[] = [];
  const seen = new Set<string>();
  // First pass: one syllable from each available tone for variety.
  for (const tone of shuffle(TONE_ORDER)) {
    const list = byTone.get(tone);
    if (!list || list.length === 0) continue;
    const choice = shuffle(list).find((r) => !seen.has(r.syllable.th));
    if (choice) {
      picked.push(choice);
      seen.add(choice.syllable.th);
    }
  }
  // Fill the rest from the full pool, avoiding duplicate Thai syllables.
  for (const r of shuffle(all)) {
    if (picked.length >= ROUND_COUNT) break;
    if (seen.has(r.syllable.th)) continue;
    picked.push(r);
    seen.add(r.syllable.th);
  }
  return shuffle(picked).slice(0, ROUND_COUNT);
}

export type TonePopMode = 'hear' | 'read';

type TonePopProps = {
  onDone?: (result: SessionResult) => void;
  kidMode?: boolean;
  // 'hear' (default): listen to a syllable, pick the tone.
  // 'read': see the written syllable (no auto audio), predict the tone from
  // its spelling, then reveal the answer + play the audio.
  mode?: TonePopMode;
};

const TonePop: React.FC<TonePopProps> = ({ onDone, kidMode = false, mode = 'hear' }) => {
  const isRead = mode === 'read';
  const [rounds, setRounds] = useState<Round[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<ToneKey | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [done, setDone] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchIdRef = useRef(0);
  const correctCountRef = useRef(0);
  // Per-tone grades collected during the round; persisted on finish so the
  // "all 5 tones cleared" badge can be earned (one SRS record per tone).
  const gradedRef = useRef<Array<{ tone: ToneKey; grade: Grade }>>([]);
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

  const prefetchAudio = useCallback((syllable: Syllable) => {
    const text = syllable.th;
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

  // Start a fresh game.
  const startGame = useCallback(() => {
    releaseAudio();
    const next = buildRounds();
    setRounds(next);
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    correctCountRef.current = 0;
    gradedRef.current = [];
    setDone(false);
    if (next[0]) prefetchAudio(next[0].syllable);
  }, [prefetchAudio, releaseAudio]);

  useEffect(() => {
    startGame();
    return () => {
      releaseAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playAudio = useCallback(
    (text: string) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      if (!audioUrl) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.onend = () => setAudioPlaying(false);
        setAudioPlaying(true);
        window.speechSynthesis.speak(utterance);
        return;
      }
      const audio = new Audio(audioUrl);
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
    [audioUrl],
  );

  const current = rounds[index];

  // Auto-play whenever audio becomes ready for the current (unanswered) round.
  // In 'read' mode the player predicts the tone from spelling first, so we do
  // not auto-play until they have answered.
  useEffect(() => {
    if (isRead) return;
    if (!current || done || picked !== null || !audioUrl) return;
    playAudio(current.syllable.th);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, index]);

  function handlePick(tone: ToneKey) {
    if (!current || picked !== null) return;
    setPicked(tone);
    const isCorrect = tone === current.syllable.tone;
    // Grade the *answered* tone so a correct identification clears that tone.
    gradedRef.current.push({
      tone: current.syllable.tone,
      grade: isCorrect ? 5 : 2,
    });
    if (isCorrect) {
      correctCountRef.current += 1;
      setCorrectCount((c) => c + 1);
    }
    // In 'read' mode the answer reveal is also the first time we play audio.
    if (isRead) playAudio(current.syllable.th);
  }

  // Persist one SRS record per graded tone so the "all 5 tones" badge can fire.
  async function persistToneGrades() {
    for (const { tone, grade } of gradedRef.current) {
      const phraseId = `tonepop-${tone}`;
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
  }

  function handleNext() {
    const nextIndex = index + 1;
    releaseAudio();
    if (nextIndex >= rounds.length) {
      completeQuest('arcade');
      void persistToneGrades();
      if (onDoneRef.current) {
        onDoneRef.current({
          reviewed: ROUND_COUNT,
          masteredPhraseIds: [],
          correctCount: correctCountRef.current,
        });
        return;
      }
      setDone(true);
      return;
    }
    setIndex(nextIndex);
    setPicked(null);
    const nextRound = rounds[nextIndex];
    if (nextRound) prefetchAudio(nextRound.syllable);
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Arcade</span>
        <h1 className={styles.title}>
          {isRead ? 'Read the Tone' : 'Tone Pop'}{' '}
          <span className={styles.titleThai}>วรรณยุกต์</span>
        </h1>
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
              ? 'Perfect ear! Every tone nailed.'
              : 'Nice work — listen again and your score will climb.'}
          </p>
          <button type="button" className={styles.nextBtn} onClick={startGame}>
            Play again
          </button>
        </section>
      ) : current ? (
        <>
          {isRead ? (
            <section className={styles.syllableCard} aria-label="Syllable to read">
              <span
                className={styles.syllableTh}
                lang="th"
                style={{ color: CLASS[current.syllable.cls].ink }}
              >
                {current.syllable.th}
              </span>
              <span
                className={styles.classTag}
                style={
                  {
                    '--class-base': CLASS[current.syllable.cls].base,
                    '--class-soft': CLASS[current.syllable.cls].soft,
                    '--class-ink': CLASS[current.syllable.cls].ink,
                  } as React.CSSProperties
                }
              >
                {CLASS[current.syllable.cls].name} class
              </span>
              {picked !== null && (
                <button
                  type="button"
                  className={`${styles.hearBtn} ${audioPlaying ? styles.hearBtnPlaying : ''}`}
                  onClick={() => playAudio(current.syllable.th)}
                  aria-label="Hear the syllable"
                >
                  <span
                    className={styles.eq}
                    aria-hidden="true"
                    data-playing={audioPlaying || undefined}
                  >
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  Hear it
                </button>
              )}
            </section>
          ) : (
            <button
              type="button"
              className={`${styles.hearBtn} ${audioPlaying ? styles.hearBtnPlaying : ''}`}
              onClick={() => playAudio(current.syllable.th)}
              aria-label="Hear the syllable"
            >
              <span className={styles.eq} aria-hidden="true" data-playing={audioPlaying || undefined}>
                <span />
                <span />
                <span />
                <span />
              </span>
              {picked !== null ? 'Hear again' : 'Listen'}
            </button>
          )}

          <p className={styles.prompt}>
            {isRead ? 'What tone does the spelling give?' : 'Which tone did you hear?'}
          </p>

          <section
            className={`${styles.options} ${kidMode ? styles.optionsKid : ''}`}
            aria-label="Tone options"
          >
            {TONE_ORDER.map((tone) => {
              const revealed = picked !== null;
              const isAnswer = tone === current.syllable.tone;
              const isPicked = tone === picked;
              let cls = `${styles.optionBtn} ${kidMode ? styles.kidMode : ''}`;
              if (revealed && isAnswer) cls = `${cls} ${styles.optionBtnCorrect}`;
              else if (revealed && isPicked) cls = `${cls} ${styles.optionBtnWrong}`;
              return (
                <button
                  key={tone}
                  type="button"
                  className={cls}
                  onClick={() => handlePick(tone)}
                  disabled={revealed}
                >
                  <ToneGlyph tone={tone} />
                  <span className={styles.toneLabel}>{TONE[tone].label}</span>
                </button>
              );
            })}
          </section>

          {picked !== null && (
            <section className={styles.revealCard} role="status" aria-live="polite">
              <p className={styles.revealThai} lang="th">
                {current.syllable.th}
              </p>
              <p className={styles.revealRom}>{current.syllable.rom}</p>
              <p className={styles.revealGloss}>
                from “{current.phraseEn}” · {TONE[current.syllable.tone].label} tone
              </p>
              <button type="button" className={styles.nextBtn} onClick={handleNext}>
                {index + 1 < rounds.length ? 'Next' : 'Finish'}
              </button>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
};

export default TonePop;
