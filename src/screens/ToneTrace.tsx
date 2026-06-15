import { useCallback, useEffect, useRef, useState } from 'react';
import { TONE, type ToneKey } from '../themes/constants';
import { tts, type Syllable } from '../worker/api';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import { BUILT_IN_PHRASES } from '../data/phrases';
import { getDefaultVoice, VOICE_NAME } from '../worker/voice';
import styles from './ToneTrace.module.css';

type RecordingState = 'idle' | 'recording' | 'done';
type TargetSyllable = Syllable & { phraseEn: string };

// Slightly rising placeholder contour (fallback when pitch detection fails).
const PLACEHOLDER_LIVE_PATH = 'M9 28 C15 26 22 25 30 24 C38 23 42 22 47 21';
const RECORD_MS = 3000;

function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  const MIN_FREQ = 80; // Hz
  const MAX_FREQ = 400; // Hz

  let bestCorr = 0;
  let bestOffset = -1;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null; // silence threshold

  const minOffset = Math.floor(sampleRate / MAX_FREQ);
  const maxOffset = Math.floor(sampleRate / MIN_FREQ);

  for (let offset = minOffset; offset <= Math.min(maxOffset, MAX_SAMPLES); offset++) {
    let corr = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) corr += Math.abs(buffer[i] - buffer[i + offset]);
    corr = 1 - corr / MAX_SAMPLES;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = offset;
    }
  }

  if (bestOffset === -1 || bestCorr < 0.9) return null;
  return sampleRate / bestOffset;
}

function freqToY(freq: number): number {
  const clamped = Math.max(80, Math.min(400, freq));
  return 35 - ((clamped - 80) / (400 - 80)) * 30;
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return PLACEHOLDER_LIVE_PATH;

  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C${cpx.toFixed(1)} ${prev.y.toFixed(1)} ${cpx.toFixed(1)} ${curr.y.toFixed(1)} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }

  return d;
}

const QUESTION: Record<ToneKey, string> = {
  mid: 'Did it stay level throughout?',
  low: 'Did it settle downward steadily?',
  falling: 'Did it rise then fall sharply?',
  high: 'Did it climb all the way to the top?',
  rising: 'Did it dip then soar up?',
};

const FEEDBACK: Record<ToneKey, string> = {
  mid: "A level tone — it shouldn't rise or fall. Think of a flat hum.",
  low: 'A gentle downward settle. It starts slightly above mid and eases down.',
  falling: 'This tone rises briefly before falling. The fall is the important part.',
  high: 'A climbing tone — it starts mid and rises steadily to the top.',
  rising: 'A rising tone that dips first. The final rise is what makes it distinct.',
};

function decodeAudio(audioContent: string): string {
  const binary = atob(audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

function pickRandomSyllable(): TargetSyllable {
  const all: TargetSyllable[] = [];
  for (const phrase of BUILT_IN_PHRASES) {
    for (const syllable of phrase.syllables) {
      all.push({ ...syllable, phraseEn: phrase.en });
    }
  }
  return all[Math.floor(Math.random() * all.length)];
}

function PitchTrace({
  refPath,
  livePath,
  refColor,
  liveColor,
  staffColor,
}: {
  refPath: string;
  livePath: string | null;
  refColor: string;
  liveColor: string;
  staffColor: string;
}) {
  // Source tone paths live in a 0 0 48 40 viewBox; scale up to fill 0 0 260 152.
  const transform = `scale(${260 / 48}, ${152 / 40})`;
  return (
    <svg viewBox="0 0 260 152" className={styles.pitchSvg} aria-hidden="true">
      {[38, 76, 114].map((y) => (
        <line key={y} x1="40" y1={y} x2="252" y2={y} stroke={staffColor} strokeWidth="1" />
      ))}
      <g transform={transform}>
        <path
          d={refPath}
          fill="none"
          stroke={refColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {livePath && (
          <path
            d={livePath}
            fill="none"
            stroke={liveColor}
            strokeWidth="2"
            strokeDasharray="4 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
    </svg>
  );
}

const ToneTrace: React.FC = () => {
  const [syllable, setSyllable] = useState<TargetSyllable | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [livePath, setLivePath] = useState<string | null>(null);
  const [selfAssess, setSelfAssess] = useState<'close' | 'not' | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchIdRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayedRef = useRef(false);

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

  const prefetchAudio = useCallback(
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
          setAudioUrl(url);
          // Auto-play the reference once when it first becomes ready.
          if (!autoPlayedRef.current) {
            autoPlayedRef.current = true;
            playAudio(text, url);
          }
        } catch {
          // Fall back to speechSynthesis on demand.
        }
      })();
    },
    [playAudio],
  );

  const loadSyllable = useCallback(
    (next: TargetSyllable) => {
      // Reset playback state.
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setAudioPlaying(false);
      autoPlayedRef.current = false;
      setSyllable(next);
      prefetchAudio(next.th);
    },
    [prefetchAudio],
  );

  useEffect(() => {
    loadSyllable(pickRandomSyllable());
    return () => {
      if (audioRef.current) audioRef.current.pause();
      window.speechSynthesis.cancel();
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishRecording = useCallback(async (stream: MediaStream, chunks: BlobPart[]) => {
    stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;

    let path = PLACEHOLDER_LIVE_PATH;

    try {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();

      const channelData = audioBuffer.getChannelData(0);
      const sr = audioBuffer.sampleRate;

      // Sample pitch at fixed steps across the recording.
      const windowSize = Math.floor(sr * 0.1); // 100ms window
      const stepMs = 150;
      const stepSamples = Math.floor((sr * stepMs) / 1000);
      const numSteps = 7;

      const points: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < numSteps; i++) {
        const start = Math.floor(i * stepSamples);
        if (start + windowSize > channelData.length) break;
        const window = channelData.slice(start, start + windowSize);
        const freq = detectPitch(window, sr);
        if (freq !== null) {
          const t = i / (numSteps - 1);
          const x = 9 + t * 30;
          const y = freqToY(freq);
          points.push({ x, y });
        }
      }

      if (points.length >= 2) {
        path = buildPath(points);
      }
    } catch {
      // Fall back to placeholder on any decode/analysis error.
    }

    setLivePath(path);
    setRecordingState('done');
  }, []);

  const handleRecord = useCallback(async () => {
    if (recordingState === 'recording') return;
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      });
      recorder.addEventListener('stop', () => {
        void finishRecording(stream, chunks);
      });
      recorder.start();
      setRecordingState('recording');
      recordTimerRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      }, RECORD_MS);
    } catch {
      setMicError('Microphone access is needed to record. Check your browser permissions.');
      setRecordingState('idle');
    }
  }, [recordingState, finishRecording]);

  const handleTryAgain = useCallback(() => {
    setRecordingState('idle');
    setLivePath(null);
    setSelfAssess(null);
  }, []);

  const handleNextPhrase = useCallback(() => {
    setRecordingState('idle');
    setLivePath(null);
    setSelfAssess(null);
    setMicError(null);
    loadSyllable(pickRandomSyllable());
  }, [loadSyllable]);

  if (!syllable) return null;

  const tone = syllable.tone;
  const refPath = TONE[tone].d;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Speaking lab</span>
        <p className={styles.thai} lang="th">
          {syllable.th}
        </p>
        <p className={styles.rom}>
          {syllable.rom} · {TONE[tone].label} tone
        </p>
      </header>

      <div className={styles.pitchStaff}>
        <div className={styles.staffLabels} aria-hidden="true">
          <span className={styles.staffLabel}>high</span>
          <span className={styles.staffLabel}>mid</span>
          <span className={styles.staffLabel}>low</span>
        </div>
        <PitchTrace
          refPath={refPath}
          livePath={livePath}
          refColor="var(--accent)"
          liveColor="var(--ink)"
          staffColor="var(--hair)"
        />
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.hearBtn} ${audioPlaying ? styles.hearBtnPlaying : ''}`}
          onClick={() => playAudio(syllable.th, audioUrl)}
        >
          Hear reference
        </button>
        <button
          type="button"
          className={`${styles.recordBtn} ${
            recordingState === 'recording' ? styles.recordBtnActive : ''
          }`}
          onClick={handleRecord}
          disabled={recordingState === 'recording'}
        >
          {recordingState === 'recording' ? 'Listening…' : 'Record'}
        </button>
      </div>

      {micError && (
        <p className={styles.error} role="alert">
          {micError}
        </p>
      )}

      {recordingState === 'done' && (
        <section className={styles.result} aria-live="polite">
          <p className={styles.question}>{QUESTION[tone]}</p>
          <p className={styles.feedback}>{FEEDBACK[tone]}</p>

          {selfAssess === null ? (
            <div className={styles.assessRow}>
              <button
                type="button"
                className={styles.assessClose}
                onClick={() => setSelfAssess('close')}
              >
                Felt close
              </button>
              <button
                type="button"
                className={styles.assessNot}
                onClick={() => setSelfAssess('not')}
              >
                Not quite
              </button>
            </div>
          ) : (
            <p className={styles.affirm}>
              {selfAssess === 'close'
                ? 'Keep listening and repeating. The ear trains the voice.'
                : "That's the work — hear it again and try to match the shape."}
            </p>
          )}

          <div className={styles.resultActions}>
            <button type="button" className={styles.tryAgainBtn} onClick={handleTryAgain}>
              Try again
            </button>
            <button type="button" className={styles.nextBtn} onClick={handleNextPhrase}>
              Next phrase
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default ToneTrace;
