import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, ensureSignedIn } from '../firebase';
import { pullFromFirestore } from '../data/sync';

export type MemberStatus = 'loading' | 'public' | 'joining' | 'member';

export interface UseMemberResult {
  status: MemberStatus;
  uid: string | null;
  displayName: string | null;
  join(name: string, inviteToken: string): Promise<void>;
  createInvite(): Promise<string>;
}

const LS_KEY = 'thaitor.member';

interface StoredMember {
  uid: string;
  name: string;
}

function readStored(): StoredMember | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as StoredMember) : null;
  } catch {
    return null;
  }
}

function writeStored(value: StoredMember): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(value));
  } catch {
    /* ignore — localStorage may be unavailable */
  }
}

function randomToken(length = 24): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Hard cap on how long a join may take before we surface an error and let the
 * user retry. With offline persistence `setDoc()` resolves only on server ack,
 * so a stalled round-trip would otherwise hang the UI forever. */
const JOIN_TIMEOUT_MS = 15_000;

// Hermetic e2e seam: the mocked test profile has no real Firestore membership
// to read, so membership is derived from the locally-seeded record instead of
// the live onSnapshot listener. Gated behind VITE_E2E_MOCK, which is only set by
// the hermetic test server — never in production or live (real-Firestore) runs,
// so prod behaviour is untouched.
const E2E_MOCK = import.meta.env.VITE_E2E_MOCK === '1';

export function useMember(): UseMemberResult {
  const stored = readStored();
  const [status, setStatus] = useState<MemberStatus>(
    E2E_MOCK ? (stored ? 'member' : 'public') : 'loading',
  );
  const [uid, setUid] = useState<string | null>(stored?.uid ?? null);
  const [displayName, setDisplayName] = useState<string | null>(stored?.name ?? null);
  const uidRef = useRef<string | null>(uid);
  // Resolved by the onSnapshot listener the moment members/{uid} appears (the
  // local-cache write is effectively instant), so a join can complete without
  // waiting for the slow server ack that setDoc() awaits.
  const memberConfirmRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // E2E_MOCK already resolved status/uid/displayName from the seeded record at
    // init (see above); skip the real auth + Firestore listener entirely.
    if (E2E_MOCK) return;

    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const user = await ensureSignedIn();
      if (cancelled) return;
      uidRef.current = user.uid;
      setUid(user.uid);

      // Pull once on mount (fire-and-forget, don't await)
      pullFromFirestore(user.uid).catch(() => {});

      unsub = onSnapshot(
        doc(db, 'members', user.uid),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as { name?: string };
            const name = data.name ?? null;
            setDisplayName(name);
            setStatus('member');
            if (name) writeStored({ uid: user.uid, name });
            // Membership is now visible (from the local cache, even before the
            // server acks) — let any in-flight join() resolve immediately.
            memberConfirmRef.current?.();
          } else {
            setStatus('public');
          }
        },
        () => {
          // permission-denied (or any read error) ⇒ not a member
          setStatus('public');
        },
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  async function join(name: string, inviteToken: string): Promise<void> {
    const user = await ensureSignedIn();
    uidRef.current = user.uid;
    setUid(user.uid);
    setStatus('joining');

    // The setDoc promise resolves only on server ack (offline persistence), so
    // a slow/stalled round-trip could hang forever. Treat the join as done as
    // soon as EITHER the server acks OR the onSnapshot listener sees the doc
    // (the local-cache write lands instantly). Bound the whole thing with a
    // timeout so a genuinely stuck write surfaces a retryable error.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const confirmed = new Promise<void>((resolve) => {
      memberConfirmRef.current = resolve;
    });
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Join timed out. Check your connection and try again.')),
        JOIN_TIMEOUT_MS,
      );
    });

    const write = setDoc(doc(db, 'members', user.uid), {
      name,
      inviteToken,
      joinedAt: serverTimestamp(),
    });
    // Don't let an eventual rejection after we've already resolved go unhandled.
    write.catch(() => {});

    try {
      await Promise.race([Promise.race([write, confirmed]), timedOut]);
      writeStored({ uid: user.uid, name });
      setDisplayName(name);
      setStatus('member');
    } catch (err) {
      setStatus('public');
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      memberConfirmRef.current = null;
    }
  }

  async function createInvite(): Promise<string> {
    const user = await ensureSignedIn();
    const token = randomToken(24);
    await setDoc(doc(db, 'invites', token), {
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
    return token;
  }

  return { status, uid, displayName, join, createInvite };
}
