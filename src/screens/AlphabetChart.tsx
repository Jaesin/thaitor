import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLASS, type ClassKey } from '../themes/constants';
import {
  CONSONANTS,
  VOWELS,
  TONE_MARKS,
  consonantPictograph,
  consonantSpokenName,
  type Consonant,
} from '../data/script';
import { getKidMode } from '../data/profiles';
import { tts } from '../worker/api';
import { getCachedAudio, setCachedAudio } from '../data/audioCache';
import { getDefaultVoice, VOICE_NAME } from '../worker/voice';
import styles from './AlphabetChart.module.css';

// The two no-longer-written consonants. Kept in canonical sequence (every
// traditional chart does) but tagged so the learner knows not to expect them.
const OBSOLETE = new Set(['cons-kho-khuat', 'cons-kho-khon']);

const CLASS_ORDER: ClassKey[] = ['mid', 'high', 'low'];

function decodeAudio(audioContent: string): string {
  const binary = atob(audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

const AlphabetChart: React.FC = () => {
  const navigate = useNavigate();
  const [kidMode] = useState(() => getKidMode());
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Speak a piece of Thai text, preferring the cached/Azure voice and falling
  // back to the browser's Thai speech — the same path the arcade uses, so the
  // cache (and audio) is shared with Script Pop etc. `id` drives the tap glow.
  const speak = useCallback((text: string, id: string) => {
    setSpeakingId(id);
    const voice = VOICE_NAME[getDefaultVoice()];
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
        audio.addEventListener('ended', () =>
          setSpeakingId((cur) => (cur === id ? null : cur)),
        );
        await audio.play();
      } catch {
        // Fall back to the browser's Thai voice (also the non-member path).
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'th-TH';
        u.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
        window.speechSynthesis.speak(u);
      }
    })();
  }, []);

  useEffect(
    () => () => {
      if (audioRef.current) audioRef.current.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      window.speechSynthesis?.cancel();
    },
    [],
  );

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Reading track</span>
        <h1 className={styles.title}>
          Alphabet <span className={styles.titleThai}>อักษร</span>
        </h1>
        <p className={styles.sub}>
          The whole writing system in order — tap anything to hear it.
        </p>
      </header>

      {/* Class legend — doubles as the one-screen "why the colors" explainer. */}
      <section className={styles.legend} aria-label="Consonant classes">
        {CLASS_ORDER.map((k) => (
          <span key={k} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: CLASS[k].base }}
              aria-hidden="true"
            />
            <span className={styles.legendText}>
              {CLASS[k].name}
              {!kidMode && <span className={styles.legendThai} lang="th"> {CLASS[k].nameThai}</span>}
            </span>
          </span>
        ))}
      </section>
      {!kidMode && (
        <p className={styles.legendNote}>
          A consonant’s class decides the tone of its syllable — that’s why the colours follow it
          everywhere.
        </p>
      )}

      {/* ── Consonants ─────────────────────────────────────────── */}
      <h2 className={styles.sectionTitle}>
        Consonants <span className={styles.sectionThai} lang="th">พยัญชนะ</span>
        <span className={styles.sectionCount}>44</span>
      </h2>
      <ul className={`${styles.grid} ${kidMode ? styles.gridKid : ''}`}>
        {CONSONANTS.map((c) => (
          <ConsonantTile
            key={c.id}
            c={c}
            kidMode={kidMode}
            speaking={speakingId === c.id}
            onTap={() => speak(consonantSpokenName(c), c.id)}
          />
        ))}
      </ul>

      {/* ── Vowels ─────────────────────────────────────────────── */}
      <h2 className={styles.sectionTitle}>
        Vowels <span className={styles.sectionThai} lang="th">สระ</span>
        <span className={styles.sectionCount}>{VOWELS.length}</span>
      </h2>
      <ul className={`${styles.grid} ${kidMode ? styles.gridKid : ''}`}>
        {VOWELS.map((v) => {
          // Voice the vowel as a sample syllable on อ (o ang) — a lone vowel
          // form isn't pronounceable, e.g. ◌า → อา.
          const syllable = v.form.replace(/◌/g, 'อ');
          return (
            <li key={v.id}>
              <button
                type="button"
                className={`${styles.tile} ${speakingId === v.id ? styles.tileSpeaking : ''}`}
                onClick={() => speak(syllable, v.id)}
              >
                <span className={styles.vowelForm} lang="th">{v.form}</span>
                {!kidMode && <span className={styles.roman}>{v.phoneme}</span>}
                {!kidMode && (
                  <span className={styles.meta}>
                    {v.length} · {v.position}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* ── Tone marks ─────────────────────────────────────────── */}
      <h2 className={styles.sectionTitle}>
        Tone marks <span className={styles.sectionThai} lang="th">วรรณยุกต์</span>
        <span className={styles.sectionCount}>{TONE_MARKS.length}</span>
      </h2>
      <ul className={`${styles.grid} ${kidMode ? styles.gridKid : ''}`}>
        {TONE_MARKS.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className={`${styles.tile} ${speakingId === m.id ? styles.tileSpeaking : ''}`}
              onClick={() => speak(m.nameThai, m.id)}
            >
              <span className={styles.markGlyph} lang="th">{m.mark}</span>
              <span className={styles.markThai} lang="th">{m.nameThai}</span>
              {!kidMode && <span className={styles.roman}>{m.name}</span>}
            </button>
          </li>
        ))}
      </ul>

      <p className={styles.credit}>
        Pictographs by{' '}
        <a href="https://openmoji.org" target="_blank" rel="noreferrer">
          OpenMoji
        </a>{' '}
        · CC BY-SA 4.0
      </p>

      <button type="button" className={styles.backBtn} onClick={() => navigate('/play/script')}>
        Back to the Script Ladder
      </button>
    </div>
  );
};

function ConsonantTile({
  c,
  kidMode,
  speaking,
  onTap,
}: {
  c: Consonant;
  kidMode: boolean;
  speaking: boolean;
  onTap: () => void;
}) {
  const cls = CLASS[c.class];
  const pictograph = consonantPictograph(c.id);
  const obsolete = OBSOLETE.has(c.id);
  return (
    <li>
      <button
        type="button"
        className={`${styles.tile} ${styles.consTile} ${speaking ? styles.tileSpeaking : ''}`}
        onClick={onTap}
        style={
          {
            '--tile-base': cls.base,
            '--tile-ink': cls.ink,
            '--tile-soft': cls.soft,
          } as React.CSSProperties
        }
      >
        {pictograph ? (
          <img className={styles.picto} src={pictograph} alt="" aria-hidden="true" />
        ) : (
          <span className={styles.pictoSlot} aria-hidden="true" />
        )}
        <span className={styles.consGlyph} lang="th" style={{ color: cls.ink }}>
          {c.glyph}
        </span>
        {!kidMode && <span className={styles.consName}>{c.name}</span>}
        <span className={styles.consExample} lang="th">{c.example}</span>
        {obsolete && <span className={styles.obsolete}>obsolete</span>}
      </button>
    </li>
  );
}

export default AlphabetChart;
