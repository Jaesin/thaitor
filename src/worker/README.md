# Worker

This folder is a placeholder for the **Cloudflare Worker** that will back Thaitor
(translation/audio/API proxying).

It is **not** part of this Vite build. The Worker will live as a separate
[Wrangler](https://developers.cloudflare.com/workers/wrangler/) project with its
own `wrangler.toml`, dependencies, and deploy pipeline. Nothing here is bundled
into the client app.

## Development
- Worker lives in `../worker/` (sibling to `src/`, separate Wrangler project).
- Local dev: `cd ../worker && npx wrangler dev`
- Set secrets: `npx wrangler secret put GEMINI_API_KEY` and `npx wrangler secret put AZURE_SPEECH_KEY`
- The Vite frontend proxies `/api/*` to the local worker in dev (to be wired in vite.config.ts).
