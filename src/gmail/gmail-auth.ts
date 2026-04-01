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
