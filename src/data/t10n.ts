// The shared t10n client (translation + TTS), used everywhere Thaitor previously
// called its own Cloudflare Worker. One module-level singleton so the audio cache
// and config are shared across screens. Holds no secrets — it forwards the
// caller's Firebase ID token to the worker (`t10n.mulenex.org`), which resolves
// the tenant from the token and gates on membership.

import { createT10nClient } from '@jaesin/t10n-client';
import { auth, ensureSignedIn } from '../firebase';

// Forward the caller's Firebase ID token. Anonymous sign-in is enough — the token
// carries the project (`aud`) the worker uses to pick the Thaitor tenant; actual
// membership is enforced server-side. Never throws; an unauthenticated caller
// just gets an unauthorized response from the worker.
async function getToken(): Promise<string | null> {
  try {
    const user = auth.currentUser ?? (await ensureSignedIn());
    return user ? await user.getIdToken() : null;
  } catch {
    return null;
  }
}

// VITE_API_BASE keeps the e2e-live / local-worker escape hatch: point the client
// at a `wrangler dev` worker or staging URL. Unset → the client's default
// (`https://t10n.mulenex.org`).
export const t10n = createT10nClient({
  getToken,
  baseUrl: import.meta.env.VITE_API_BASE || undefined,
  // The worker waits up to 30s on Gemini, and Thai translations (which also
  // generate the per-syllable / particle / RTGS aids) routinely exceed the
  // client's 10s default. Match the worker's ceiling so slow-but-valid
  // translations aren't aborted client-side.
  timeoutMs: 30_000,
});
