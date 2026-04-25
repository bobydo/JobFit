// Call chrome.identity directly from the popup — no service worker message passing needed.
// Routing through the service worker caused hangs when the worker was sleeping (MV3 issue).

export function getAuthToken(interactive = true): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message ?? 'No token returned'));
      } else {
        resolve(token);
      }
    });
  });
}

export function removeAuthToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

const DRIVE_CONSENT_FLAG = 'driveScopeConsented';

// First launch after the drive.file scope was added to the manifest: invalidate any
// cached token so getAuthToken(interactive=true) triggers a fresh consent screen that
// includes the new scope. Runs at most once — the flag is persisted in local storage.
export async function ensureDriveScopeConsent(): Promise<void> {
  const stored = await chrome.storage.local.get(DRIVE_CONSENT_FLAG);
  if (stored[DRIVE_CONSENT_FLAG]) return;
  try {
    const token = await getAuthToken(false);
    await removeAuthToken(token);
  } catch {
    // no cached token — nothing to invalidate
  }
  await chrome.storage.local.set({ [DRIVE_CONSENT_FLAG]: true });
}
