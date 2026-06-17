import { Before, Given, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { BASE_URL } from '../support/server.js';
import { LIVE, INVITE_TOKEN } from '../support/config.js';
import { joinViaSeedInvite, e2eName } from '../support/membership.js';
import type { ThaitorWorld } from '../support/world.js';

// --- Skip guards -----------------------------------------------------------
// These keep prod-dependent scenarios from running (or failing) when their
// prerequisites aren't present.

Before({ tags: '@live' }, function () {
  if (!LIVE) return 'skipped' as const;
});

Before({ tags: '@signup' }, function () {
  if (!LIVE || !INVITE_TOKEN) return 'skipped' as const;
});

// For already-a-member scenarios (e.g. the full Settings UI): establish a real
// membership first by joining through the UI with the seed invite.
Before({ tags: '@member' }, async function (this: ThaitorWorld) {
  if (!LIVE || !INVITE_TOKEN) return 'skipped' as const;
  await joinViaSeedInvite(this.page);
});

// --- Sign-up steps ---------------------------------------------------------

Given('I open the seed invite link', async function (this: ThaitorWorld) {
  await this.page.goto(`${BASE_URL}/#/join?key=${encodeURIComponent(INVITE_TOKEN)}`, {
    waitUntil: 'domcontentloaded',
  });
});

Given('I enter a unique test name', async function (this: ThaitorWorld) {
  await this.page.getByPlaceholder('e.g. Jaesin').fill(e2eName());
});

Then('I should be signed in as a member', async function (this: ThaitorWorld) {
  // Join redirects home; the members-only Settings UI then renders.
  await expect.poll(() => new URL(this.page.url()).hash).toMatch(/^#\/$/);
  await this.goto('/settings');
  await expect(this.page.getByText('Profiles').first()).toBeVisible({ timeout: 15_000 });
});
