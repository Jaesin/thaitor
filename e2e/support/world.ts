import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { BASE_URL } from './server.js';

/**
 * Per-scenario world. A fresh BrowserContext + Page is created in the Before
 * hook (see hooks.ts) and attached here, so every scenario is isolated
 * (separate IndexedDB / localStorage / cache).
 */
export class ThaitorWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  live = false;
  /** URLs of every Worker /tts request the page made (access-control checks). */
  ttsRequests: string[] = [];

  constructor(options: IWorldOptions) {
    super(options);
  }

  /** Navigate to a hash route, e.g. '/translate' or '/'. */
  async goto(route = '/'): Promise<void> {
    const hash = route === '/' ? '#/' : `#${route.startsWith('/') ? route : `/${route}`}`;
    await this.page.goto(`${BASE_URL}/${hash}`, { waitUntil: 'domcontentloaded' });
  }
}

setWorldConstructor(ThaitorWorld);
