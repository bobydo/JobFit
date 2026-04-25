import type { Resume } from '../popup/types';

const STORAGE_KEY = 'uploadedResumes';

export async function getUploadedResumes(): Promise<Resume[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as Resume[] | undefined) ?? [];
}

export async function addResume(resume: Resume): Promise<Resume[]> {
  const existing = await getUploadedResumes();
  const filtered = existing.filter((r) => r.id !== resume.id);
  const next = [...filtered, resume];
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function deleteResume(id: string): Promise<Resume[]> {
  const existing = await getUploadedResumes();
  const next = existing.filter((r) => r.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function clearResumes(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
