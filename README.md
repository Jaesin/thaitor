# Thaitor

A Thai language learning PWA for the whole family — syllable breakdowns, tone drills, TTS pronunciation, and spaced-repetition review.

## Stack

| Layer | Tech |
|---|---|
| Framework | React 19 + TypeScript |
| Bundler | Vite 8 |
| Backend | Firebase (Auth + Firestore) |
| API Workers | Cloudflare Workers (translation / TTS) |
| Routing | react-router-dom |
| Persistence | idb (IndexedDB) + Firestore |

## Features

- **Phrase of the day** — syllable-by-syllable breakdown with tone marks and romanization
- **Travel mode** — on-the-fly translation with speaker cards, built for market scenarios
- **Learn mode** — script, tones, and phrases via SRS flashcards
- **Review deck** — spaced-repetition daily phrase reviews
- **TTS** — listen to native pronunciation (Azure Speech via Worker)
- **Translation** — powered by Gemini API via Worker, with formality/gender particle control
- **Themes** — Paper, Temple Gold, and Night Market
- **Multi-device** — anonymous Firebase auth with offline-first IndexedDB cache

## Getting started

```bash
# Install dependencies
npm install

# Run the Vite dev server
npm run dev

# Build for production
npm run build
```

### Worker (separate)

The API lives in `worker/` as a Cloudflare Worker. Run it separately — the frontend talks to it directly (no proxy needed).

```bash
# Create worker/.dev.vars with your secrets:
# AZURE_SPEECH_KEY=...
# AZURE_SPEECH_REGION=southeastasia
# GEMINI_API_KEY=...

cd worker
npm run dev:node                               # local dev server on port 5001

npx wrangler secret put GEMINI_API_KEY         # set prod secrets
npx wrangler secret put AZURE_SPEECH_KEY
npx wrangler deploy                            # prod deploy
```

In development the frontend calls `http://localhost:5001` directly; in production it calls the deployed Worker URL. Both are set in `src/worker/api.ts`.

## Deployment

- **Frontend**: deployed to Firebase Hosting at [thaitor.mulenex.org](https://thaitor.mulenex.org)
- **Worker**: deployed to Cloudflare Workers

```bash
npm run build && firebase deploy --only hosting
```

## Project structure

```
thaitor/
├── public/                # static assets (favicon)
├── src/
│   ├── auth/              # Firebase auth helpers
│   ├── kit/               # UI primitives
│   ├── screens/           # page-level components
│   ├── store/             # IndexedDB store
│   ├── themes/            # theming system (3 colour schemes)
│   ├── worker/            # API client (talks to Cloudflare Worker)
│   ├── main.tsx           # entry point
│   └── Shell.tsx          # shell / layout wrapper
├── worker/                # Cloudflare Worker (separate project)
├── wrangler.toml          # Worker config
├── firebase.json          # Firebase config
└── specs/                 # design handoff specs
```
