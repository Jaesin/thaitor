// Cucumber.js configuration. TypeScript step/support files are loaded through
// the `tsx` ESM loader (wired via NODE_OPTIONS in the npm scripts).
//
// Tags:
//   @tts     — actually plays audio (TTS playback).
//   @live    — needs the real prod backend (Worker / Firestore).
//   @member  — needs a real Firestore membership (joins via a seed invite).
//   @signup  — exercises the join flow (needs a seed invite token).
//
// Profiles (the npm scripts set the matching env: E2E_LIVE / E2E_SOUND):
//   default — hermetic: mocks + silence, no prod, no audio.
//   live    — everything against prod (real translate/TTS); prereq-gated
//             scenarios self-skip if their env (token) is missing.
//   tts     — only the audio-playback scenarios (run with sound).
//   member  — only the members-only Settings scenarios.
//   all     — the whole suite (no live env -> prod scenarios self-skip).

/** @type {import('@cucumber/cucumber/api').IConfiguration} */
const common = {
  // Load support first so the context/page setup Before hook is registered (and
  // therefore runs) before any tag-scoped Before hooks in the step files.
  import: ['e2e/support/**/*.ts', 'e2e/steps/**/*.ts'],
  paths: ['e2e/features/**/*.feature'],
  format: [
    'summary',
    'progress',
    ['html', 'reports/e2e/cucumber-report.html'],
    ['json', 'reports/e2e/cucumber-report.json'],
  ],
  formatOptions: { snippetInterface: 'async-await' },
};

export default {
  ...common,
  tags: 'not @tts and not @live and not @member and not @signup',
};

export const live = {
  ...common,
  tags: '@live and not @tts',
};

export const tts = {
  ...common,
  tags: '@tts',
};

export const member = {
  ...common,
  tags: '@member',
};

export const all = {
  ...common,
  // Everything except raw audio playback. Prod-only scenarios self-skip when
  // E2E_LIVE isn't set.
  tags: 'not @tts',
};
