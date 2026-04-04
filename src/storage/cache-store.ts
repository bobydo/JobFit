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
