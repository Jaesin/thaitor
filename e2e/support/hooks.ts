import {
  BeforeAll,
  AfterAll,
  Before,
  After,
  setDefaultTimeout,
  Status,
} from '@cucumber/cucumber';
import { chromium, type Browser } from '@playwright/test';
import { startServer, stopServer } from './server.js';
import { installSilence, installWorkerMocks } from './mocks.js';
import { seedMembership } from './membership.js';
import { cleanupLiveData } from './cleanup.js';
import { LIVE, SOUND, HEADED } from './config.js';
import type { ThaitorWorld } from './world.js';

/** Worker /tts URL matcher (local dev + deployed). */
const TTS_URL = /\/tts(\?|$)/;

// Live runs hit real providers + Firestore and may need a couple of retries on
// slow network, so give them more headroom.
setDefaultTimeout(LIVE ? 60_000 : 30_000);

let browser: Browser;

BeforeAll(async function () {
  await startServer();
  // E2E_HEADED shows the window; a little slowMo makes it watchable.
  browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 200 : 0 });
});

AfterAll(async function () {
  await browser?.close();
  await stopServer();
});

Before(async function (this: ThaitorWorld, scenario) {
  this.browser = browser;
  this.live = LIVE;
  this.ttsRequests = [];
  this.context = await browser.newContext({
    viewport: { width: 414, height: 896 }, // mobile-first PWA
  });

  // Audio: silenced by default; real playback only when E2E_SOUND is set.
  if (!SOUND) await installSilence(this.context);

  // Network: mocked unless we're explicitly running live against prod.
  if (!LIVE) await installWorkerMocks(this.context);

  // Membership: the member-only screens are gated (bug E4). Hermetic scenarios
  // run as a returning member by default so they exercise the real experience;
  // @anon scenarios stay non-members to assert the gate actually blocks them.
  // Live runs join through the real flow, so never seed there.
  const anon = scenario.pickle.tags.some((t) => t.name === '@anon');
  if (!LIVE && !anon) await seedMembership(this.context);

  this.page = await this.context.newPage();

  // Record every Worker /tts request so access-control scenarios can assert a
  // non-member triggers none.
  this.page.on('request', (req) => {
    if (TTS_URL.test(req.url())) this.ttsRequests.push(req.url());
  });
});

After(async function (this: ThaitorWorld, scenario) {
  // Remove any prod test data this scenario created, while the page (and its
  // auth session) is still alive.
  if (LIVE && this.page) {
    try {
      const report = await cleanupLiveData(this.page);
      await this.attach(`[cleanup] ${report}`, 'text/plain');
    } catch (err) {
      await this.attach(`[cleanup] FAILED: ${String(err)}`, 'text/plain');
    }
  }

  if (scenario.result?.status === Status.FAILED && this.page) {
    const png = await this.page.screenshot();
    await this.attach(png, 'image/png');
  }
  await this.context?.close();
});
