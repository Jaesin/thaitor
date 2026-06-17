# Thaitor E2E suite (BDD · Cucumber · Playwright)

End-to-end UI tests written as Gherkin features, executed with Cucumber.js
driving a real Chromium via Playwright.

## Layout

```
e2e/
├── features/        # Gherkin .feature files (the specs)
├── steps/           # Step definitions (TypeScript)
└── support/
    ├── server.ts    # Boots/tears down the Vite dev server (port 5174)
    ├── world.ts     # Per-scenario world (browser context + page)
    ├── hooks.ts     # BeforeAll/Before/After lifecycle
    ├── config.ts    # Env toggles (LIVE / SOUND / invite token)
    ├── mocks.ts     # Worker network mocks + the audio silence stub
    ├── membership.ts# Join-via-seed-invite helper
    └── cleanup.ts   # Deletes test-created prod data after a live run
cucumber.mjs         # Profiles: default / live / tts / member / all
```

## Two modes

The suite runs **hermetic by default** and **live** on demand.

| | hermetic (`npm run e2e`) | live (`npm run e2e:live`) |
|---|---|---|
| Firestore / Auth | none (asserts public state) | **real prod Firestore + anon auth** |
| Translate / TTS | mocked JSON | **real prod Worker** (Gemini + Azure) |
| Audio | silenced | **audible** (`E2E_SOUND=1`) |
| Sign-up / member UI | n/a | tested + auto-cleaned |
| Secrets needed | none | a seed invite token (for sign-up) |

## Commands

```bash
npm run e2e          # hermetic: mocks + silence, no prod, no audio (default)
npm run e2e:live     # @live scenarios against PROD (real translate/TTS, sound on)
npm run e2e:tts      # @tts audio-playback scenarios (live + sound)
npm run e2e:member   # members-only Settings scenarios (live; needs token)
npm run e2e:all      # whole suite except @tts (prod scenarios self-skip w/o E2E_LIVE)
```

The dev server starts/stops automatically (port 5174; an existing one is
reused). HTML report: `reports/e2e/cucumber-report.html`.

## Env toggles

| Var | Effect |
|---|---|
| `E2E_LIVE=1` | Hit prod: skip network mocks, point the frontend at the deployed Worker (`VITE_API_BASE`), enable the cleanup seam (`VITE_E2E`). |
| `E2E_SOUND=1` | Allow **real audio** to play. Unset ⇒ playback is stubbed and silent. |
| `E2E_INVITE_TOKEN=…` | A valid prod invite token. **Required for `@signup`/`@member`** — the join rules need the invite to already exist. Scenarios self-skip when unset. |
| `E2E_API_BASE=…` | Override the Worker URL (defaults to the deployed Worker). |

### Getting a seed invite token

Sign-up can't bootstrap its own invite (creating one requires already being a
member). So an existing member mints one once: open **Settings → invite link**,
copy the `key=` value from the URL, and run:

```bash
E2E_INVITE_TOKEN=THE_TOKEN npm run e2e:live
```

The seed token is never deleted by cleanup (it was created by a different uid).

## Audio safety

Two layers keep runs silent unless you ask for sound:

1. `@tts` scenarios are excluded from every profile except `tts`.
2. Unless `E2E_SOUND=1`, `support/mocks.ts` stubs `HTMLMediaElement.play/pause`
   and the whole `speechSynthesis` API before any app code runs — so even an
   accidentally-run scenario emits nothing.

## Prod data cleanup (live runs)

Each live scenario runs in a fresh browser context with its own ephemeral
anonymous uid, so it never touches real family data. After every scenario,
`support/cleanup.ts` runs in the page (as the authenticated user) and deletes,
in order:

1. `users/{uid}/{history,phrasebook,srs,profile}` docs
2. `invites` created by this uid (the seed token is left alone)
3. `members/{uid}` — **last**, since dropping membership would block the rest

Test display names are prefixed `[e2e]` so any stray record is obvious. The
cleanup report is attached to each scenario in the HTML report.
