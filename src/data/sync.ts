import { db, auth } from '../firebase';
import { doc, setDoc, collection, getDocs, getDoc } from 'firebase/firestore';
import type { HistoryEntry, PhrasebookEntry, ProfileEntry, SRSRecord } from './store';
import { putHistoryRaw, putPhraseRaw, putProfileRaw, putSRSRaw } from './store';

function userRef(uid: string, ...path: string[]) {
  return doc(db, 'users', uid, ...path);
}

export async function syncHistory(entry: HistoryEntry): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(userRef(uid, 'history', entry.id), entry, { merge: true });
  } catch (err) {
    console.warn('syncHistory failed', err);
  }
}

export async function syncPhrase(entry: PhrasebookEntry): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(userRef(uid, 'phrasebook', entry.id), entry, { merge: true });
  } catch (err) {
    console.warn('syncPhrase failed', err);
  }
}

export async function syncProfile(entry: ProfileEntry): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(userRef(uid, 'profile', 'local'), entry, { merge: true });
  } catch (err) {
    console.warn('syncProfile failed', err);
  }
}

export async function syncSRS(record: SRSRecord): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(userRef(uid, 'srs', record.phraseId), record, { merge: true });
  } catch (err) {
    console.warn('syncSRS failed', err);
  }
}

export async function pullFromFirestore(uid: string): Promise<void> {
  try {
    await Promise.all([
      pullCollection<HistoryEntry>(uid, 'history', putHistoryRaw),
      pullCollection<PhrasebookEntry>(uid, 'phrasebook', putPhraseRaw),
      pullSRS(uid),
      pullProfile(uid),
    ]);
  } catch (e) {
    console.warn('[sync] pull failed', e);
  }
}

async function pullCollection<T>(
  uid: string,
  name: string,
  write: (doc: T) => Promise<void>,
): Promise<void> {
  const snap = await getDocs(collection(db, 'users', uid, name));
  await Promise.all(
    snap.docs.map(async (d) => {
      const remote = d.data() as T;
      write(remote); // fire-and-forget per doc; write handles conflict
    }),
  );
}

async function pullSRS(uid: string): Promise<void> {
  const snap = await getDocs(collection(db, 'users', uid, 'srs'));
  await Promise.all(
    snap.docs.map(async (d) => {
      putSRSRaw(d.data() as SRSRecord);
    }),
  );
}

async function pullProfile(uid: string): Promise<void> {
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'local'));
  if (snap.exists()) {
    const remote = snap.data() as ProfileEntry;
    putProfileRaw(remote);
  }
}
