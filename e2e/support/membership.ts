import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BASE_URL } from './server.js';
import { INVITE_TOKEN } from './config.js';

/** A clearly-labelled, unique display name so any stray test data is obvious. */
export function e2eName(): string {
  return `[e2e] ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** localStorage key useMember persists the joined-member record under. */
const MEMBER_LS_KEY = 'thaitor.member';

/**
 * Seed a returning-member record before any app code runs. Paired with the
 * VITE_E2E_MOCK seam in useMember (set by the hermetic dev server), this makes
 * the scenario a legitimate member without a live Firestore doc — so the real
 * membership gate stays enforced and is simply satisfied. The gate is verified
 * against the un-seeded (non-member) state by the @anon scenario.
 */
export async function seedMembership(
  context: BrowserContext,
  name = e2eName(),
): Promise<void> {
  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* ignore — localStorage may be unavailable */
      }
    },
    [MEMBER_LS_KEY, JSON.stringify({ uid: `e2e-${Date.now().toString(36)}`, name })],
  );
}

/**
 * Drive the real join flow through the UI: open the seed invite link, enter a
 * name and submit. On success the app writes members/{uid} and redirects home.
 */
export async function joinViaSeedInvite(page: Page, name = e2eName()): Promise<void> {
  if (!INVITE_TOKEN) throw new Error('E2E_INVITE_TOKEN is required to join');
  await page.goto(`${BASE_URL}/#/join?key=${encodeURIComponent(INVITE_TOKEN)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByPlaceholder('e.g. Jaesin').fill(name);
  await page.getByRole('button', { name: /Join Thaitor|Joining/ }).first().click();
  // Successful join redirects to the home hash route.
  await expect.poll(() => new URL(page.url()).hash, { timeout: 20_000 }).toMatch(/^#\/$/);
}
