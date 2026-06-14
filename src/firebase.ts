import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, type User } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// The Firebase web config is PUBLIC — commit it. Security lives in the Firestore
// rules + the Worker's token verification, not in config secrecy.
// TODO: fill from Firebase console → Project settings → Your apps
const firebaseConfig = {
  apiKey: 'AIzaSyB61dRHijmuO_lyodOLiVwrH6djROBjvYo',
  authDomain: 'thaitor.firebaseapp.com',
  projectId: 'thaitor',
  storageBucket: 'thaitor.firebasestorage.app',
  messagingSenderId: '744012760585',
  appId: '1:744012760585:web:d54801c10d74440d331ad8',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/** Resolve the current anonymous user, signing in if there isn't one yet. */
export async function ensureSignedIn(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}
