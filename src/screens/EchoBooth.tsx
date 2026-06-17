import { useCallback, useEffect, useRef, useState } from 'react';
import { TONE, type ToneKey } from '../themes/constants';
import { tts, type Syllable } from '../worker/api';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import { BUILT_IN_PHRASES } from '../data/phrases';
import { getDefaultVoice, VOICE_NAME } from '../worker/voice';
import {
  initSRS,
  getSRSRecord,
  putSRSRecord,
  type SRSRecord,
} from '../data/store';
import { gradePhrase, type Grade } from '../data/srs';
import styles from './EchoBooth.module.css';

const RECORD_MAX_MS = 10000;

type Phrase = {
  id: string;
  en: string;
  th: string;
  syllables: Syllable[];
};

// Per-tone coaching prompt — what to focus the voice on for that contour.
const TONE_FOCUS: Record<ToneKey, string> = {
  mid: 'Hold it level — no rise, no fall.',
  low: 'Let it settle gently downward.',
  falling: 'Lift, then let it fall hard.',
  high: 'Climb steadily to the top.',
  rising: 'Dip first, then rise like a question.',
};

function decodeAudio(audioContent: string): string {
  const binary = atob(audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

function ToneGlyph({ tone }: { tone: ToneKey }) {
  return (
    <svg className={styles.toneGlyph} viewBox="0 0 48 40" aria-hidden="true">
      <path d={TONE[tone].d} />
    </svg>
  );
}

function pickRandomPhrase(): Phrase {
  const withSyllables = BUILT_IN_PHRASES.filter((p) => p.syllables.length > 0);
  const p = withSyllables[Math.floor(Math.random() * withSyllables.length)];
  return {
    id: p.id,
    en: p.en,
    th: p.syllables.map((s) => s.th).join(''),
    syllables: p.syllables,
  };
}

const EchoBooth: React.FC = () => {
  const [phrase, setPhrase] = useState<Phrase | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [playingWhich, setPlayingWhich] = useState<'ref' | 'rec' | null>(null);
  const [graded, setGraded] = useState<'got' | 'not' | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const refUrlRef = useRef<string | null>(null);
  const recordingUrlRef = useRef<string | null>(null);
  const prefetchIdRef = useRef(0);
  const autoPlayedRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setPlayingWhich(null);
  }, []);

  // Plays a sequence of {url, text, which} clips back-to-back.
  const playSequence = useCallback(
    (clips: Array<{ url: string | null; text: string; which: 'ref' | 'rec' }>) => {
      stopPlayback();
      let i = 0;
      const playNext = () => {
        if (i >= clips.length) {
          setPlayingWhich(null);
          return;
        }
        const clip = clips[i];
        i += 1;
        setPlayingWhich(clip.which);
        if (!clip.url) {
          const utterance = new SpeechSynthesisUtterance(clip.text);
          utterance.lang = 'th-TH';
          utterance.onend = playNext;
          window.speechSynthesis.speak(utterance);
          return;
        }
        const audio = new Audio(clip.url);
        audioRef.current = audio;
        audio.addEventListener('ended', () => {
          audioRef.current = null;
          playNext();
        });
        audio.addEventListener('error', () => {
          audioRef.current = null;
          playNext();
        });
        audio.play().catch(() => {
          audioRef.current = null;
          playNext();
        });
      };
      playNext();
    },
    [stopPlayback],
  );

  const playRef = useCallback(() => {
    if (!phrase) return;
    playSequence([{ url: refUrlRef.current, text: phrase.th, which: 'ref' }]);
  }, [phrase, playSequence]);

  const playRecording = useCallback(() => {
    if (!recordingUrlRef.current) return;
    playSequence([{ url: recordingUrlRef.current, text: '', which: 'rec' }]);
  }, [playSequence]);

  const prefetchRef = useCallback(
    (text: string) => {
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
          if (refUrlRef.current) URL.revokeObjectURL(refUrlRef.current);
          refUrlRef.current = url;
          if (!autoPlayedRef.current) {
            autoPlayedRef.current = true;
            playSequence([{ url, text, which: 'ref' }]);
          }
        } catch {
          // Fall back to speechSynthesis on demand.
        }
      })();
    },
    [playSequence],
  );

  const clearRecording = useCallback(() => {
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
      recordingUrlRef.current = null;
    }
    setRecordingUrl(null);
  }, []);

  const loadPhrase = useCallback(
    (next: Phrase) => {
      stopPlayback();
      clearRecording();
      if (refUrlRef.current) {
        URL.revokeObjectURL(refUrlRef.current);
        refUrlRef.current = null;
      }
      autoPlayedRef.current = false;
      setGraded(null);
      setMicError(null);
      setPhrase(next);
      prefetchRef(next.th);
    },
    [stopPlayback, clearRecording, prefetchRef],
  );

  useEffect(() => {
    loadPhrase(pickRandomPhrase());
    return () => {
      stopPlayback();
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (refUrlRef.current) URL.revokeObjectURL(refUrlRef.current);
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = useCallback(async () => {
    if (recording) return;
    setMicError(null);
    clearRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      });
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        if (recordTimerRef.current) {
          clearTimeout(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
        recordingUrlRef.current = url;
        setRecordingUrl(url);
        // Auto A/B: reference then learner recording in sequence.
        playSequence([
          { url: refUrlRef.current, text: phrase?.th ?? '', which: 'ref' },
          { url, text: '', which: 'rec' },
        ]);
      });
      recorder.start();
      setRecording(true);
      recordTimerRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      }, RECORD_MAX_MS);
    } catch {
      setMicError('Microphone access is needed to record. Check your browser permissions.');
      setRecording(false);
    }
  }, [recording, clearRecording, playSequence, phrase]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const handleGrade = useCallback(
    async (verdict: 'got' | 'not') => {
      setGraded(verdict);
      if (!phrase) return;
      const grade: Grade = verdict === 'got' ? 5 : 2;
      await initSRS(phrase.id);
      const record =
        (await getSRSRecord(phrase.id)) ??
        ({
          phraseId: phrase.id,
          interval: 1,
          dueAt: new Date().toISOString(),
          easeFactor: 2.5,
          repetitions: 0,
          createdAt: new Date().toISOString(),
        } satisfies SRSRecord);
      await putSRSRecord(gradePhrase(record, grade));
    },
    [phrase],
  );

  const handleNext = useCallback(() => {
    loadPhrase(pickRandomPhrase());
  }, [loadPhrase]);

  if (!phrase) return null;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Echo Booth · hear it, say it</span>
        <p className={styles.thai} lang="th">
          {phrase.th}
        </p>
        <p className={styles.en}>{phrase.en}</p>
      </header>

      <section className={styles.syllables} aria-label="Syllable tones">
        {phrase.syllables.map((s, i) => (
          <div key={i} className={styles.syllable}>
            <ToneGlyph tone={s.tone} />
            <span className={styles.sylThai} lang="th">
              {s.th}
            </span>
            <span className={styles.sylRom}>{s.rom}</span>
          </div>
        ))}
      </section>

      <p className={styles.focus}>
        {phrase.syllables.length === 1
          ? TONE_FOCUS[phrase.syllables[0].tone]
          : `Listen for the ${TONE[phrase.syllables[0].tone].label.toLowerCase()} start. ${
              TONE_FOCUS[phrase.syllables[phrase.syllables.length - 1].tone]
            }`}
      </p>

      <button
        type="button"
        className={`${styles.recordBtn} ${recording ? styles.recordBtnActive : ''}`}
        onPointerDown={(e) => {
          e.preventDefault();
          void startRecording();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          stopRecording();
        }}
        onPointerLeave={() => {
          if (recording) stopRecording();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {recording ? 'Recording… release to stop' : 'Hold to record'}
      </button>

      {micError && (
        <p className={styles.error} role="alert">
          {micError}
        </p>
      )}

      <section className={styles.abRow} aria-label="A/B compare">
        <button
          type="button"
          className={`${styles.abBtn} ${playingWhich === 'ref' ? styles.abBtnPlaying : ''}`}
          onClick={playRef}
        >
          <span className={styles.abLabel}>Reference</span>
          <span className={styles.abHint}>Native audio</span>
        </button>
        <button
          type="button"
          className={`${styles.abBtn} ${playingWhich === 'rec' ? styles.abBtnPlaying : ''}`}
          onClick={playRecording}
          disabled={!recordingUrl}
        >
          <span className={styles.abLabel}>You</span>
          <span className={styles.abHint}>{recordingUrl ? 'Your take' : 'Record first'}</span>
        </button>
      </section>

      {recordingUrl && (
        <section className={styles.gradeCard} aria-live="polite">
          {graded === null ? (
            <>
              <p className={styles.gradeQ}>How close was it?</p>
              <div className={styles.gradeRow}>
                <button
                  type="button"
                  className={styles.gradeGot}
                  onClick={() => void handleGrade('got')}
                >
                  Got it
                </button>
                <button
                  type="button"
                  className={styles.gradeNot}
                  onClick={() => void handleGrade('not')}
                >
                  Not yet
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.affirm}>
                {graded === 'got'
                  ? 'Nice — your ear and voice are syncing up.'
                  : 'Keep going. Replay both, then try once more.'}
              </p>
              <button type="button" className={styles.nextBtn} onClick={handleNext}>
                Next phrase
              </button>
            </>
          )}
        </section>
      )}

      {!recordingUrl && (
        <button type="button" className={styles.skipBtn} onClick={handleNext}>
          Skip to next phrase
        </button>
      )}
    </div>
  );
};

export default EchoBooth;
