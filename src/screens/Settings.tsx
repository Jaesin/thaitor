import { useState } from 'react';
import { useMember } from '../auth/useMember';
import styles from './Settings.module.css';

const APP_ORIGIN = 'https://thaitor.mulenex.org';

function inviteUrl(token: string): string {
  return `${APP_ORIGIN}/#/join?key=${token}`;
}

const Settings: React.FC = () => {
  const member = useMember();
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
