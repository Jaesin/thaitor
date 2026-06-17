import type { BrowserContext, Page, Route } from '@playwright/test';

// A deterministic translate payload shaped like the Worker's /translate
// response (see src/worker/api.ts: TranslateResponse). Keeps the UI fully
// functional without ever calling Gemini.
const TRANSLATE_RESPONSE = {
  en: 'hello',
  rtgs: 'sawatdee khrap',
  particle: 'khrap',
  syllables: [
    { th: 'สวัส', rom: 'sa-wat', tone: 'low', cls: 'high' },
    { th: 'ดี', rom: 'dee', tone: 'mid', cls: 'mid' },
    { th: 'ครับ', rom: 'khrap', tone: 'high', cls: 'high' },
  ],
};

const TH_EN_RESPONSE = {
  th: 'สวัสดี',
  en: 'hello',
  gloss: 'a greeting',
  syllables: [
    { th: 'สวัส', rom: 'sa-wat', tone: 'low', cls: 'high' },
    { th: 'ดี', rom: 'dee', tone: 'mid', cls: 'mid' },
  ],
};

// 1x1 silent-ish MP3 frame, base64. Never actually played — audio output is
// stubbed in the page (see installSilence). This only needs to be valid base64
// so atob() in the app doesn't throw.
const FAKE_AUDIO_B64 =
  'SUQzAwAAAAAAClRYWFgAAAAAAAAA//uQxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function fulfillJson(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  });
}

/**
 * Intercept every Worker call (both the local dev URL and the deployed Worker
 * URL) so the suite never hits the network. /translate branches on the `from`
 * field the Th→En path sends.
 */
export async function installWorkerMocks(target: BrowserContext | Page): Promise<void> {
  await target.route(/\/translate(\?|$)/, async (route) => {
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
    let isThEn = false;
    try {
      const body = route.request().postDataJSON() as { from?: string } | null;
      isThEn = body?.from === 'th';
    } catch {
      /* no body */
    }
    return fulfillJson(route, isThEn ? TH_EN_RESPONSE : TRANSLATE_RESPONSE);
  });

  await target.route(/\/tts(\?|$)/, async (route) => {
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
    return fulfillJson(route, { audioContent: FAKE_AUDIO_B64 });
  });
}

/**
 * SAFETY NET — guarantees no audio ever leaves the speakers, even if a TTS
 * scenario is run by accident. Stubs HTMLAudioElement.play, the Audio
 * constructor's playback, and the whole speechSynthesis API before any app
 * code runs. The user must never be woken by the suite.
 */
export async function installSilence(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      const noop = () => {};
      // Block <audio>/new Audio() playback.
      const proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
      if (proto) {
        proto.play = function play() {
          // Fire a synthetic 'ended' so app state machines still resolve.
          setTimeout(() => this.dispatchEvent(new Event('ended')), 0);
          return Promise.resolve();
        };
        proto.pause = noop;
      }
      // Block the Web Speech synthesis API entirely.
      const synth = {
        speak: (u: { onend?: (() => void) | null }) => {
          if (u && typeof u.onend === 'function') setTimeout(() => u.onend!(), 0);
        },
        cancel: noop,
        pause: noop,
        resume: noop,
        getVoices: () => [],
        addEventListener: noop,
        removeEventListener: noop,
      };
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        get: () => synth,
      });
    } catch {
      /* defensive — never let the stub crash the page */
    }
  });
}
