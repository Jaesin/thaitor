import { useState } from 'react';
import { useMember } from '../auth/useMember';
import { getDefaultVoice, setDefaultVoice, type DefaultVoice } from '../worker/voice';
import styles from './Settings.module.css';

const VOICE_OPTIONS: { key: DefaultVoice; label: string; sub: string }[] = [
  { key: 'female', label: 'Female', sub: 'Premwadee' },
  { key: 'female2', label: 'Female 2', sub: 'Achara' },
  { key: 'male', label: 'Male', sub: 'Niwat' },
];

const APP_ORIGIN = 'https://thaitor.mulenex.org';

function inviteUrl(token: string): string {
  return `${APP_ORIGIN}/#/join?key=${token}`;
}

const Settings: React.FC = () => {
  const member = useMember();
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState<DefaultVoice>(getDefaultVoice);

  function selectVoice(next: DefaultVoice) {
    setVoice(next);
    setDefaultVoice(next);
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

  return (
    <div className={styles.screen}>
      <span className={styles.eyebrow}>Settings</span>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.card}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Display name</span>
          <span className={styles.rowValue}>{member.displayName ?? '—'}</span>
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
    </div>
  );
};

export default Settings;
