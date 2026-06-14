const CACHE_NAME = 'thaitor-audio-v1';

function makeUrl(text: string, voice: string): string {
  return `https://audio-cache.thaitor.local/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
}

export async function getCachedAudio(text: string, voice: string): Promise<string | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(makeUrl(text, voice));
    if (!res) return null;
    const data = (await res.json()) as { audioContent: string };
    return data.audioContent ?? null;
  } catch {
    return null;
  }
}

export async function setCachedAudio(text: string, voice: string, audioContent: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      makeUrl(text, voice),
      new Response(JSON.stringify({ audioContent }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  } catch {
    /* quota or unavailable */
  }
}
