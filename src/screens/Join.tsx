import { useMemo, useState } from 'react';
import { useMember } from '../auth/useMember';
import styles from './Join.module.css';

/** Extract the `key` query param from a hash route like `#/join?key=TOKEN`. */
function readInviteToken(): string | null {
  const hash = window.location.hash; // e.g. "#/join?key=ABC123"
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return null;
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  const key = params.get('key');
  return key && key.length > 0 ? key : null;
}

const Join: React.FC = () => {
  const member = useMember();
  const token = useMemo(() => readInviteToken(), []);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name.');
      return;
    }
    setBusy(true);
    try {
      await member.join(trimmed, token);
      window.location.hash = '/';
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not join: ${err.message}`
          : 'Could not join. Check the invite link and try again.',
      );
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className={styles.screen}>
        <span className={styles.eyebrow}>Join</span>
        <h1 className={styles.title}>No invite token found</h1>
        <div className={styles.card}>
          <p className={styles.lede}>
            This page needs an invite link to join Thaitor. Ask a family member to share their
            invite, then open the link they give you. It will look like{' '}
            <code>#/join?key=…</code>.
          </p>
          <a className={styles.link} href="#/">
            Back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <span className={styles.eyebrow}>Join</span>
      <h1 className={styles.title}>Join Thaitor</h1>
      <form className={styles.card} onSubmit={onSubmit}>
        <p className={styles.lede}>You&apos;ve been invited. Pick a name to get started.</p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="join-name">
            Your name
          </label>
          <input
            id="join-name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jaesin"
            maxLength={40}
            autoFocus
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.button} type="submit" disabled={busy}>
          {busy ? 'Joining…' : 'Join Thaitor'}
        </button>
      </form>
    </div>
  );
};

export default Join;
