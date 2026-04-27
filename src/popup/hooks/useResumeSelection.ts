import { useEffect, useState } from 'react';
import { resumeStore } from '@storage/resume-store';
import type { Resume } from '../types';

export function useResumeSelection(maxResumes: number) {
  const [activeResumeIds, setActiveResumeIds] = useState<string[]>([]);
  const [resumesData,     setResumesData]     = useState<Resume[] | null>(null);
  const [storageReady,    setStorageReady]    = useState(false);

  useEffect(() => {
    chrome.storage.local.get('activeResumeIds', (stored) => {
      if (stored.activeResumeIds?.length) setActiveResumeIds(stored.activeResumeIds);
      setStorageReady(true);
    });
    resumeStore.getAll().then((stored) => { if (stored.length) setResumesData(stored); });
  }, []);

  // Prune stale IDs that no longer match any stored resume
  useEffect(() => {
    if (!storageReady || !resumesData) return;
    const valid = new Set(resumesData.map((r) => r.id));
    setActiveResumeIds((prev) => prev.filter((id) => valid.has(id)));
  }, [resumesData, storageReady]);

  // Persist selection — only after storage has been restored
  useEffect(() => {
    if (!storageReady) return;
    chrome.storage.local.set({ activeResumeIds });
  }, [activeResumeIds, storageReady]);

  function toggleResume(id: string) {
    setActiveResumeIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxResumes) return prev;
      return [...prev, id];
    });
  }

  return { activeResumeIds, setActiveResumeIds, resumesData, setResumesData, storageReady, toggleResume };
}
