import type { Page } from '@playwright/test';

/**
 * Delete everything the current test created in prod Firestore, acting as the
 * page's own authenticated user (so Firestore rules are satisfied). Best-effort
 * and defensive: a half-finished scenario must still clean up what it can.
 *
 * Order matters — `members/{uid}` is deleted LAST, because removing it drops
 * membership and would block the other deletes (which require isMember()).
 *
 * Returns a short report so the After hook can surface what was removed.
 */
export async function cleanupLiveData(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const handle = (window as unknown as { __thaitorE2E?: any }).__thaitorE2E;
    if (!handle) return 'no e2e handle (app not in E2E mode)';
    const { auth, db, fs } = handle;
    const { doc, deleteDoc, collection, getDocs, query, where } = fs;
    const uid: string | undefined = auth.currentUser?.uid;
    if (!uid) return 'no signed-in user — nothing to clean';

    const removed: string[] = [];

    // 1. Per-user subcollections.
    for (const name of ['history', 'phrasebook', 'srs', 'profile']) {
      try {
        const snap = await getDocs(collection(db, 'users', uid, name));
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
          removed.push(`users/${uid}/${name}/${d.id}`);
        }
      } catch {
        /* not a member / nothing there */
      }
    }

    // 2. Invites this user minted during the test (never the seed token —
    //    that was created by a different uid).
    try {
      const snap = await getDocs(query(collection(db, 'invites'), where('createdBy', '==', uid)));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
        removed.push(`invites/${d.id}`);
      }
    } catch {
      /* ignore */
    }

    // 3. Membership doc — LAST.
    try {
      await deleteDoc(doc(db, 'members', uid));
      removed.push(`members/${uid}`);
    } catch {
      /* never became a member */
    }

    return removed.length ? `cleaned ${removed.length}: ${removed.join(', ')}` : 'nothing to clean';
  });
}
