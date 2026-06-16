import { useEffect, useRef, useState } from 'react';
import { useMember } from '../auth/useMember';
import { getProfile, putProfile, type ProfileEntry, type SpeakerGender } from '../data/store';
import {
  getActiveProfileId,
  setActiveProfileId,
  listProfiles,
  createProfile,
  saveProfile,
  deleteProfile,
  setKidModeMirror,
  PROFILE_EMOJIS,
} from '../data/profiles';
import {
  getDefaultVoice,
  setDefaultVoice,
  type DefaultVoice,
  getDefaultEnVoice,
  setDefaultEnVoice,
  type DefaultEnVoice,
} from '../worker/voice';
import { THEMES, type ThemeKey } from '../themes/tokens';
import { useTheme } from '../themes/ThemeContext';
import {
  LEARNING_BADGES,
  FIELD_BADGES,
  CUSTOM_FIELD_BADGE_ID,
  getBadges,
  getFieldBadges,
} from '../data/badges';
import styles from './Settings.module.css';

function formatBadgeDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

const THEME_ORDER: ThemeKey[] = ['paper', 'temple', 'market'];
const THEME_LABEL: Record<ThemeKey, string> = {
  paper: 'Paper',
  temple: 'Temple Gold',
  market: 'Night Market',
};

const VOICE_OPTIONS: { key: DefaultVoice; label: string; sub: string }[] = [
  { key: 'female', label: 'Female', sub: 'Premwadee' },
  { key: 'female2', label: 'Female 2', sub: 'Achara' },
  { key: 'male', label: 'Male', sub: 'Niwat' },
];

const EN_VOICE_OPTIONS: { key: DefaultEnVoice; label: string; sub: string }[] = [
  { key: 'female', label: 'Female', sub: 'Luna (US)' },
  { key: 'female2', label: 'Female 2', sub: 'Olivia (GB)' },
  { key: 'male', label: 'Male', sub: 'Ryan (GB)' },
  { key: 'male2', label: 'Male 2', sub: 'Kai (US)' },
  { key: 'kid', label: 'Kid', sub: 'Maisie (GB)' },
];

const APP_ORIGIN = 'https://thaitor.mulenex.org';

function inviteUrl(token: string): string {
  return `${APP_ORIGIN}/#/join?key=${token}`;
}

type Rate = 'slow' | 'normal' | 'fast';

const RATE_OPTIONS: { key: Rate; label: string }[] = [
  { key: 'slow', label: 'Slow' },
  { key: 'normal', label: 'Normal' },
  { key: 'fast', label: 'Fast' },
];

const GOAL_OPTIONS = [5, 10, 20];
const NEW_CARD_OPTIONS = [3, 5, 10];

const Settings: React.FC = () => {
  const member = useMember();
  const { themeKey, setTheme } = useTheme();
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState<DefaultVoice>(getDefaultVoice);
  const [enVoice, setEnVoice] = useState<DefaultEnVoice>(getDefaultEnVoice);

  // --- Multi-profile state ---
  const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
  const [activeId, setActiveId] = useState<string>(() => getActiveProfileId());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState<string>(PROFILE_EMOJIS[0]);
  const [newGender, setNewGender] = useState<SpeakerGender>('neutral');
  const [newKidMode, setNewKidMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localName, setLocalName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [autoplay, setAutoplay] = useState(
    () => localStorage.getItem('thaitor_autoplay') !== 'off',
  );
  const [rate, setRate] = useState<Rate>(
    () => (localStorage.getItem('thaitor_rate') as Rate) || 'normal',
  );
  const [dailyGoal, setDailyGoal] = useState(
    () => Number(localStorage.getItem('thaitor_daily_goal')) || 10,
  );
  const [newCardsCap, setNewCardsCap] = useState(
    () => Number(localStorage.getItem('thaitor_new_cards_cap')) || 5,
  );
  // Kid Mode is now stored per-profile; the active profile is loaded in an
  // effect below. Falls back to the legacy global key until then.
  const [kidMode, setKidMode] = useState(
    () => localStorage.getItem('thaitor_kid_mode') === 'on',
  );
  const [tripDeparture, setTripDeparture] = useState(
    () => localStorage.getItem('thaitor_trip_departure') ?? '',
  );
  const [tripReturn, setTripReturn] = useState(
    () => localStorage.getItem('thaitor_trip_return') ?? '',
  );

  useEffect(() => {
    let active = true;
    getProfile().then((profile) => {
      if (active) setLocalName(profile?.name ?? member.displayName ?? '');
    });
    return () => {
      active = false;
    };
  }, [member.displayName]);

  // Load the profile list and the active profile's per-profile prefs (Kid Mode
  // + voices). Voices fall back to the global localStorage default when unset.
  useEffect(() => {
    let active = true;
    (async () => {
      const list = await listProfiles();
      if (!active) return;
      setProfiles(list);
      const id = getActiveProfileId();
      setActiveId(id);
      const current = list.find((p) => p.id === id) ?? list[0];
      if (current) {
        setKidMode(current.kidMode ?? false);
        if (current.defaultVoice) setVoice(current.defaultVoice as DefaultVoice);
        if (current.defaultEnVoice) setEnVoice(current.defaultEnVoice as DefaultEnVoice);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

  // Patch the active profile record and refresh local state.
  async function patchActiveProfile(patch: Partial<Omit<ProfileEntry, 'id' | 'updatedAt'>>) {
    if (!activeProfile) return;
    const saved = await saveProfile({ ...activeProfile, ...patch });
    setProfiles((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
  }

  async function switchProfile(id: string) {
    if (id === activeId) return;
    setActiveProfileId(id);
    window.location.reload();
  }

  async function onAddProfile() {
    const name = newName.trim();
    if (!name) return;
    const entry = await createProfile(name, newEmoji, {
      kidMode: newKidMode,
      speakerGender: newGender,
    });
    setActiveProfileId(entry.id);
    window.location.reload();
  }

  async function onConfirmDelete(id: string) {
    try {
      await deleteProfile(id);
    } catch {
      /* last profile — ignore */
    }
    setPendingDelete(null);
    if (id === activeId) {
      window.location.reload();
    } else {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    }
  }

  function startLongPress(id: string) {
    if (id === activeId) return; // can't delete the active profile via long-press
    clearLongPress();
    longPressTimer.current = setTimeout(() => setPendingDelete(id), 500);
  }

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function selectVoice(next: DefaultVoice) {
    setVoice(next);
    setDefaultVoice(next); // keep the global default in sync as a fallback
    void patchActiveProfile({ defaultVoice: next });
  }

  function selectEnVoice(next: DefaultEnVoice) {
    setEnVoice(next);
    setDefaultEnVoice(next); // keep the global default in sync as a fallback
    void patchActiveProfile({ defaultEnVoice: next });
  }

  function toggleAutoplay(next: boolean) {
    setAutoplay(next);
    localStorage.setItem('thaitor_autoplay', next ? 'on' : 'off');
  }

  function selectRate(next: Rate) {
    setRate(next);
    localStorage.setItem('thaitor_rate', next);
  }

  function selectDailyGoal(next: number) {
    setDailyGoal(next);
    localStorage.setItem('thaitor_daily_goal', String(next));
  }

  function selectNewCardsCap(next: number) {
    setNewCardsCap(next);
    localStorage.setItem('thaitor_new_cards_cap', String(next));
  }

  function toggleKidMode(next: boolean) {
    setKidMode(next);
    // Mirror for synchronous reads, persist to the active profile record, and
    // keep the legacy global key in sync as a fallback.
    setKidModeMirror(activeId, next);
    localStorage.setItem('thaitor_kid_mode', next ? 'on' : 'off');
    void patchActiveProfile({ kidMode: next });
  }

  function selectTripDeparture(next: string) {
    setTripDeparture(next);
    if (next) localStorage.setItem('thaitor_trip_departure', next);
    else localStorage.removeItem('thaitor_trip_departure');
  }

  function selectTripReturn(next: string) {
    setTripReturn(next);
    if (next) localStorage.setItem('thaitor_trip_return', next);
    else localStorage.removeItem('thaitor_trip_return');
  }

  async function onSaveName() {
    await putProfile({ id: 'local', name: localName });
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      const token = await member.createInvite();
      setInvite(inviteUrl(token));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not generate invite: ${err.message}`
          : 'Could not generate invite.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (member.status !== 'member') {
    return (
      <div className={styles.screen}>
        <span className={styles.eyebrow}>Settings</span>
        <h1 className={styles.title}>Settings</h1>
        <div className={styles.card}>
          <p className={styles.lede}>
            You&apos;re not a member yet. Use an invite link to join.
          </p>
          <a className={styles.link} href="#/">
            Back to home
          </a>
        </div>
      </div>
    );
  }

  const shortUid = member.uid ? `${member.uid.slice(0, 8)}…${member.uid.slice(-4)}` : '—';

  // Earned badges (read once per render; localStorage-backed).
  const earnedLearning = getBadges();
  const earnedLearningList = LEARNING_BADGES.filter((b) => earnedLearning[b.id]);
  const earnedField = getFieldBadges();
  const fieldDefs = [
    ...FIELD_BADGES,
    { id: CUSTOM_FIELD_BADGE_ID, label: 'Something else', emoji: '⭐' },
  ];
  const earnedFieldList = fieldDefs.filter((b) => earnedField[b.id]);
  const hasBadges = earnedLearningList.length > 0 || earnedFieldList.length > 0;

  return (
    <div className={styles.screen}>
      <span className={styles.eyebrow}>Settings</span>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.card}>
        <span className={styles.sectionLabel}>Profiles</span>
        <p className={styles.lede}>
          Each person on this device keeps their own progress. Tap to switch;
          long-press a profile to remove it.
        </p>
        <div className={styles.profileGrid}>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.profileChip} ${
                p.id === activeId ? styles.profileChipActive : ''
              }`}
              onClick={() => switchProfile(p.id)}
              onPointerDown={() => startLongPress(p.id)}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
              aria-pressed={p.id === activeId}
            >
              <span className={styles.profileEmoji} aria-hidden="true">
                {p.emoji ?? '🧑'}
              </span>
              <span className={styles.profileName}>{p.name ?? 'Me'}</span>
            </button>
          ))}
          {!adding && (
            <button
              type="button"
              className={styles.profileAdd}
              onClick={() => setAdding(true)}
            >
              <span className={styles.profileEmoji} aria-hidden="true">
                ＋
              </span>
              <span className={styles.profileName}>Add</span>
            </button>
          )}
        </div>

        {adding && (
          <div className={styles.profileForm}>
            <input
              className={styles.nameInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              autoFocus
            />
            <div className={styles.emojiPicker} role="group" aria-label="Profile emoji">
              {PROFILE_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className={`${styles.emojiBtn} ${
                    newEmoji === em ? styles.emojiBtnActive : ''
                  }`}
                  onClick={() => setNewEmoji(em)}
                  aria-pressed={newEmoji === em}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Voice gender</span>
              <div className={styles.choiceRow} role="group" aria-label="Voice gender">
                {(['female', 'male', 'neutral'] as SpeakerGender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`${styles.choiceBtn} ${
                      newGender === g ? styles.choiceBtnActive : ''
                    }`}
                    onClick={() => setNewGender(g)}
                    aria-pressed={newGender === g}
                  >
                    {g === 'female' ? 'Female' : g === 'male' ? 'Male' : 'Neutral'}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Kid Mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={newKidMode}
                className={`${styles.switch} ${newKidMode ? styles.switchOn : ''}`}
                onClick={() => setNewKidMode((v) => !v)}
              >
                <span className={styles.switchKnob} />
              </button>
            </div>
            <div className={styles.nameRow}>
              <button
                className={styles.button}
                type="button"
                onClick={onAddProfile}
                disabled={!newName.trim()}
              >
                Create &amp; switch
              </button>
              <button
                className={styles.linkBtn}
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewName('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {pendingDelete && (
          <div className={styles.deleteConfirm} role="alertdialog">
            <span className={styles.deleteText}>
              Delete{' '}
              <strong>
                {profiles.find((p) => p.id === pendingDelete)?.name ?? 'this profile'}
              </strong>
              ? Their progress will be lost.
            </span>
            <div className={styles.nameRow}>
              <button
                className={styles.dangerBtn}
                type="button"
                onClick={() => onConfirmDelete(pendingDelete)}
              >
                Delete
              </button>
              <button
                className={styles.linkBtn}
                type="button"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Display name</span>
          <div className={styles.nameRow}>
            <input
              className={styles.nameInput}
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="Your name"
            />
            <button className={styles.button} type="button" onClick={onSaveName}>
              Save
            </button>
            {nameSaved && <span className={styles.savedHint}>Saved ✓</span>}
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Device ID</span>
          <span className={styles.uid}>{shortUid}</span>
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.sectionLabel}>Default voice</span>
        <p className={styles.lede}>
          Used for audio when no politeness particle is selected.
        </p>
        <div className={styles.voiceRow} role="group" aria-label="Default voice">
          {VOICE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`${styles.voiceBtn} ${voice === opt.key ? styles.voiceBtnActive : ''}`}
              onClick={() => selectVoice(opt.key)}
              aria-pressed={voice === opt.key}
            >
              <span className={styles.voiceLabel}>{opt.label}</span>
              <span className={styles.voiceSub}>{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.sectionLabel}>English voice</span>
        <p className={styles.lede}>Used when playing back English text.</p>
        <div className={styles.voiceRow} role="group" aria-label="English voice">
          {EN_VOICE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`${styles.voiceBtn} ${enVoice === opt.key ? styles.voiceBtnActive : ''}`}
              onClick={() => selectEnVoice(opt.key)}
              aria-pressed={enVoice === opt.key}
            >
              <span className={styles.voiceLabel}>{opt.label}</span>
              <span className={styles.voiceSub}>{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.sectionLabel}>Theme</span>
        <p className={styles.lede}>Pick the look of the app.</p>
        <div className={styles.themeRow} role="group" aria-label="Theme">
          {THEME_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.themeBtn} ${key === themeKey ? styles.themeBtnActive : ''}`}
              onClick={() => setTheme(key)}
              aria-pressed={key === themeKey}
            >
              <span
                className={styles.themeSwatch}
                style={{ background: THEMES[key].accent }}
                aria-hidden="true"
              />
              <span className={styles.themeName}>{THEME_LABEL[key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.sectionLabel}>Playback</span>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Auto-play audio after translation</span>
          <button
            type="button"
            role="switch"
            aria-checked={autoplay}
            className={`${styles.switch} ${autoplay ? styles.switchOn : ''}`}
            onClick={() => toggleAutoplay(!autoplay)}
          >
            <span className={styles.switchKnob} />
          </button>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Speech rate</span>
          <div className={styles.choiceRow} role="group" aria-label="Speech rate">
            {RATE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`${styles.choiceBtn} ${rate === opt.key ? styles.choiceBtnActive : ''}`}
                onClick={() => selectRate(opt.key)}
                aria-pressed={rate === opt.key}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <span className={styles.sectionLabel}>Learning</span>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Daily goal</span>
          <div className={styles.choiceRow} role="group" aria-label="Daily goal">
            {GOAL_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.choiceBtn} ${dailyGoal === n ? styles.choiceBtnActive : ''}`}
                onClick={() => selectDailyGoal(n)}
                aria-pressed={dailyGoal === n}
              >
                {n} phrases
              </button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>New cards per day</span>
          <div className={styles.choiceRow} role="group" aria-label="New cards per day">
            {NEW_CARD_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.choiceBtn} ${newCardsCap === n ? styles.choiceBtnActive : ''}`}
                onClick={() => selectNewCardsCap(n)}
                aria-pressed={newCardsCap === n}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Kid Mode</span>
          <button
            type="button"
            role="switch"
            aria-checked={kidMode}
            className={`${styles.switch} ${kidMode ? styles.switchOn : ''}`}
            onClick={() => toggleKidMode(!kidMode)}
          >
            <span className={styles.switchKnob} />
          </button>
        </div>
        {kidMode && (
          <p className={styles.lede}>
            Tap-only mode, larger targets, no reading required.
          </p>
        )}
      </div>

      <div className={styles.card}>
        <span className={styles.sectionLabel}>Invite</span>
        <p className={styles.lede}>
          Generate an invite link to share with a family member. They open it to join.
        </p>
        <button className={styles.button} type="button" onClick={onGenerate} disabled={busy}>
          {busy ? 'Generating…' : 'Generate invite'}
        </button>
        {error && <p className={styles.error}>{error}</p>}
        {invite && (
          <div className={styles.inviteOut}>
            <span className={styles.rowLabel}>Share this link</span>
            <input
              className={styles.inviteUrl}
              value={invite}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}
      </div>

      <div className={styles.card}>
        <span className={styles.sectionLabel}>Trip dates</span>
        <p className={styles.lede}>
          Set when you&apos;re heading to Thailand. The Today screen counts down to your trip.
        </p>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Departure</span>
          <input
            className={styles.dateInput}
            type="date"
            value={tripDeparture}
            max={tripReturn || undefined}
            onChange={(e) => selectTripDeparture(e.target.value)}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Return</span>
          <input
            className={styles.dateInput}
            type="date"
            value={tripReturn}
            min={tripDeparture || undefined}
            onChange={(e) => selectTripReturn(e.target.value)}
          />
        </div>
      </div>

      {hasBadges && (
        <div className={styles.card}>
          <span className={styles.sectionLabel}>Badges</span>
          {earnedLearningList.length > 0 && (
            <ul className={styles.badgeList}>
              {earnedLearningList.map((b) => (
                <li key={b.id} className={styles.badgeItem}>
                  <span className={styles.badgeItemEmoji} aria-hidden="true">
                    {b.emoji}
                  </span>
                  <span className={styles.badgeItemText}>
                    <span className={styles.badgeItemLabel}>{b.label}</span>
                    <span className={styles.badgeItemSub}>{b.description}</span>
                  </span>
                  <span className={styles.badgeItemDate}>
                    {formatBadgeDate(earnedLearning[b.id])}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {earnedFieldList.length > 0 && (
            <>
              <p className={styles.lede}>I said it in Thailand!</p>
              <ul className={styles.badgeList}>
                {earnedFieldList.map((b) => (
                  <li key={b.id} className={styles.badgeItem}>
                    <span className={styles.badgeItemEmoji} aria-hidden="true">
                      {b.emoji}
                    </span>
                    <span className={styles.badgeItemText}>
                      <span className={styles.badgeItemLabel}>{b.label}</span>
                      {earnedField[b.id]?.note && (
                        <span className={styles.badgeItemSub}>{earnedField[b.id].note}</span>
                      )}
                    </span>
                    <span className={styles.badgeItemDate}>
                      {formatBadgeDate(earnedField[b.id].earnedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Settings;
