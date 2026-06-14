import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, ensureSignedIn } from '../firebase';

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

export function useMember(): UseMemberResult {
  const stored = readStored();
  const [status, setStatus] = useState<MemberStatus>('loading');
  const [uid, setUid] = useState<string | null>(stored?.uid ?? null);
  const [displayName, setDisplayName] = useState<string | null>(stored?.name ?? null);
  const uidRef = useRef<string | null>(uid);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const user = await ensureSignedIn();
      if (cancelled) return;
      uidRef.current = user.uid;
      setUid(user.uid);

      unsub = onSnapshot(
        doc(db, 'members', user.uid),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as { name?: string };
            const name = data.name ?? null;
            setDisplayName(name);
            setStatus('member');
            if (name) writeStored({ uid: user.uid, name });
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
    try {
      await setDoc(doc(db, 'members', user.uid), {
        name,
        inviteToken,
        joinedAt: serverTimestamp(),
      });
      writeStored({ uid: user.uid, name });
      setDisplayName(name);
      setStatus('member');
    } catch (err) {
      setStatus('public');
      throw err;
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
