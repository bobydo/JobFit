const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  const entry = result[key] as CacheEntry<T> | undefined;
  if (!entry || Date.now() - entry.cachedAt > TTL_MS) return null;
  return entry.data;
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
  await chrome.storage.local.set({ [key]: entry });
}

export async function clearCached(...keys: string[]): Promise<void> {
  await chrome.storage.local.remove(keys);
}

// ── Processed job post IDs ────────────────────────────────────────────────

const PROCESSED_KEY = 'processedJobIds';

export async function getProcessedIds(): Promise<string[]> {
  const result = await chrome.storage.local.get(PROCESSED_KEY);
  return result[PROCESSED_KEY] ?? [];
}

export async function markProcessed(...ids: string[]): Promise<void> {
  const existing = await getProcessedIds();
  const merged = [...new Set([...existing, ...ids])];
  await chrome.storage.local.set({ [PROCESSED_KEY]: merged });
}

export async function clearProcessedIds(): Promise<void> {
  await chrome.storage.local.remove(PROCESSED_KEY);
}

// ── Analysis results ──────────────────────────────────────────────────────

const RESULTS_KEY = 'analysisResults';

export async function getAnalysisResults(): Promise<import('../popup/types').AnalysisResult[]> {
  const result = await chrome.storage.local.get(RESULTS_KEY);
  const raw: Array<import('../popup/types').AnalysisResult & { analyzedAt: string }> = result[RESULTS_KEY] ?? [];
  return raw.map((r) => ({ ...r, analyzedAt: new Date(r.analyzedAt) }));
}

export async function saveAnalysisResults(
  results: import('../popup/types').AnalysisResult[]
): Promise<void> {
  await chrome.storage.local.set({ [RESULTS_KEY]: results });
}

export async function clearAnalysisResults(): Promise<void> {
  await chrome.storage.local.remove(RESULTS_KEY);
}
