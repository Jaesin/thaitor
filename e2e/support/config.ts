// Central place for the e2e runtime toggles, all driven by env vars so the
// default `npm run e2e` stays fully hermetic.

/** Hit real prod Firestore + Worker instead of the network mocks. */
export const LIVE = process.env.E2E_LIVE === '1' || process.env.E2E_LIVE === 'true';

/** Allow real audio to play. Default OFF — audio is stubbed so nothing is heard. */
export const SOUND = process.env.E2E_SOUND === '1' || process.env.E2E_SOUND === 'true';

/** Show the browser window (headed) instead of running headless. */
export const HEADED = process.env.E2E_HEADED === '1' || process.env.E2E_HEADED === 'true';

/** Deployed Worker the live profile points the frontend at (real Gemini/Azure). */
export const PROD_WORKER_URL = process.env.E2E_API_BASE ?? '';

/**
 * A valid, pre-existing invite token from prod (an existing member can mint one
 * in Settings). Required only for the @signup scenarios — the join rules need
 * the invite to already exist. Scenarios that need it are skipped when unset.
 */
export const INVITE_TOKEN = process.env.E2E_INVITE_TOKEN ?? '';
