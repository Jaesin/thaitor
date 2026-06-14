import type { TranslateResponse } from '../worker/api';

const STORAGE_KEY = 'thaitor_tx_cache';
const MAX_ENTRIES = 500;

type CacheEntry = { result: TranslateResponse; ts: number };
type Cache = Record<string, CacheEntry>;

function load(): Cache {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(cache: Cache): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
}

export function getCachedTranslation(text: string): TranslateResponse | null {
  const key = text.trim().toLowerCase();
  const entry = load()[key];
  return entry ? entry.result : null;
}

export function setCachedTranslation(text: string, result: TranslateResponse): void {
  const key = text.trim().toLowerCase();
  const cache = load();
  cache[key] = { result, ts: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > MAX_ENTRIES) {
    const oldest = keys.sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0));
    oldest.slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete cache[k]);
  }
  save(cache);
}
