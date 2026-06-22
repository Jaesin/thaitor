# `worker/` (client-side translation + TTS adapter)

> **Historical name.** This folder used to front Thaitor's *own* Cloudflare Worker.
> Thaitor now uses the shared **t10n** service via [`@jaesin/t10n-client`](https://github.com/Jaesin/t10n-client)
> (`t10n.mulenex.org`). The folder name is kept only to avoid churning ~18 imports.

## What lives here

- **`api.ts`** — a thin adapter over the shared t10n client singleton
  ([`src/data/t10n.ts`](../data/t10n.ts)). It keeps Thaitor's existing function/type
  surface (`translate`, `translateThEn`, `tts`, `Syllable`, `TranslateResponse`,
  `ThEnResponse`, `TtsResponse`) so screens and the data layer are unchanged, and maps
  the t10n response (`syllables`/`particle`/`rtgs` Thai-side aids, `audio.base64`) onto
  those types. The localStorage translation cache still wraps `translate()`.
- **`voice.ts`** — the Azure voice-name maps; the resolved `voice` string is passed
  straight to the t10n client's `fetchSpeech`/`tts`.

## The t10n service

- Translation + TTS live in the `t10n-worker` repo (a separate multi-tenant Cloudflare
  Worker; Thaitor is the `thaitor` tenant). The client forwards the caller's Firebase ID
  token; the worker resolves the tenant from the token and gates on membership.
- Override the base URL for local/staging via `VITE_API_BASE` (e.g. point at a
  `wrangler dev` t10n worker). Unset → the client default `https://t10n.mulenex.org`.

> The old top-level `worker/` Wrangler project (Thaitor's own Gemini/Azure proxy) is no
> longer used by the app and can be removed.
