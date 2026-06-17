import { Given, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { ThaitorWorld } from '../support/world.js';

// Make /tts fail for this scenario (set before navigating so the on-mount
// prefetch hits it too). A page-level route takes precedence over the
// context-level mock from installWorkerMocks.
Given('the TTS service is unavailable', async function (this: ThaitorWorld) {
  await this.page.route(/\/tts(\?|$)/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'unavailable' }),
    });
  });
});

// Replace window.speechSynthesis with a counting stub. Done AFTER navigation on
// purpose: an init-script override at document-start gets clobbered when the
// browser sets up its own speechSynthesis, but window.speechSynthesis is an own,
// configurable getter so a post-load redefine sticks. Also keeps the run silent.
Given('browser speech is tracked', async function (this: ThaitorWorld) {
  // Passed as a string, not a function: the tsx/esbuild loader rewrites named
  // arrows with a `__name` helper that isn't defined in the page, which breaks
  // page.evaluate(fn). A raw string is injected verbatim.
  await this.page.evaluate(`(() => {
    window.__ttsSpeak = 0;
    var synth = {
      speak: function (u) {
        window.__ttsSpeak = (window.__ttsSpeak || 0) + 1;
        if (u && typeof u.onend === 'function') setTimeout(function () { u.onend(); }, 0);
      },
      cancel: function () {}, pause: function () {}, resume: function () {},
      getVoices: function () { return []; },
      addEventListener: function () {}, removeEventListener: function () {},
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: function () { return synth; } });
  })()`);
});

Then('a TTS request should have been made', async function (this: ThaitorWorld) {
  await expect.poll(() => this.ttsRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
});

Then('the browser speech fallback should be used', async function (this: ThaitorWorld) {
  await expect
    .poll(() => this.page.evaluate(() => (window as { __ttsSpeak?: number }).__ttsSpeak ?? 0), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
});
