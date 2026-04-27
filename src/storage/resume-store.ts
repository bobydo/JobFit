import type { Resume } from '../popup/types';

const STORAGE_KEY = 'uploadedResumes';

export class ResumeStore {
  async getAll(): Promise<Resume[]> {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return (stored[STORAGE_KEY] as Resume[] | undefined) ?? [];
  }

  async add(resume: Resume): Promise<Resume[]> {
    const existing = await this.getAll();
    const next = [...existing.filter((r) => r.id !== resume.id), resume];
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  }

  async remove(id: string): Promise<Resume[]> {
    const existing = await this.getAll();
    const next = existing.filter((r) => r.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  }

  async clear(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
  }
}

export const resumeStore = new ResumeStore();
