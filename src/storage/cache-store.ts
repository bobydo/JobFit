import { GMAIL_CACHE_TTL_MS, RESULTS_TTL_MS } from '../config';
import type { AnalysisResult } from '../popup/types';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

interface DailyUsage {
  date: string;
  count: number;
}

export class CacheStore {
  private static readonly _PROCESSED_KEY   = 'processedJobIds';
  private static readonly _RESULTS_KEY     = 'analysisResults';
  private static readonly _DAILY_USAGE_KEY = 'dailyUsage';

  async getCached<T>(key: string, ttlMs = GMAIL_CACHE_TTL_MS): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    const entry = result[key] as CacheEntry<T> | undefined;
    if (!entry || Date.now() - entry.cachedAt > ttlMs) return null;
    return entry.data;
  }

  async setCached<T>(key: string, data: T): Promise<void> {
    await chrome.storage.local.set({ [key]: { data, cachedAt: Date.now() } as CacheEntry<T> });
  }

  async getProcessedIds(): Promise<string[]> {
    const result = await chrome.storage.local.get(CacheStore._PROCESSED_KEY);
    return result[CacheStore._PROCESSED_KEY] ?? [];
  }

  async markProcessed(...ids: string[]): Promise<void> {
    const existing = await this.getProcessedIds();
    const merged = [...new Set([...existing, ...ids])];
    await chrome.storage.local.set({ [CacheStore._PROCESSED_KEY]: merged });
  }

  async getAnalysisResults(): Promise<AnalysisResult[]> {
    const result = await chrome.storage.local.get(CacheStore._RESULTS_KEY);
    const raw: Array<AnalysisResult & { analyzedAt: string }> = result[CacheStore._RESULTS_KEY] ?? [];
    if (raw.length === 0) return [];
    const newest = Math.max(...raw.map((r) => new Date(r.analyzedAt).getTime()));
    if (Date.now() - newest > RESULTS_TTL_MS) {
      await chrome.storage.local.remove(CacheStore._RESULTS_KEY);
      return [];
    }
    return raw.map((r) => ({ ...r, analyzedAt: new Date(r.analyzedAt) }));
  }

  async saveAnalysisResults(results: AnalysisResult[]): Promise<void> {
    await chrome.storage.local.set({ [CacheStore._RESULTS_KEY]: results });
  }

  async getDailyCount(): Promise<number> {
    const result = await chrome.storage.local.get(CacheStore._DAILY_USAGE_KEY);
    const usage = result[CacheStore._DAILY_USAGE_KEY] as DailyUsage | undefined;
    if (!usage || usage.date !== this._today()) return 0;
    return usage.count;
  }

  async incrementDailyCount(): Promise<number> {
    const current = await this.getDailyCount();
    const next = current + 1;
    await chrome.storage.local.set({ [CacheStore._DAILY_USAGE_KEY]: { date: this._today(), count: next } });
    return next;
  }

  private _today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

export const cacheStore = new CacheStore();

// Named exports for existing callers
export const getCached           = <T>(key: string) => cacheStore.getCached<T>(key);
export const setCached           = <T>(key: string, data: T) => cacheStore.setCached<T>(key, data);
export const getProcessedIds     = () => cacheStore.getProcessedIds();
export const markProcessed       = (...ids: string[]) => cacheStore.markProcessed(...ids);
export const getAnalysisResults  = () => cacheStore.getAnalysisResults();
export const saveAnalysisResults = (results: AnalysisResult[]) => cacheStore.saveAnalysisResults(results);
export const getDailyCount       = () => cacheStore.getDailyCount();
export const incrementDailyCount = () => cacheStore.incrementDailyCount();
