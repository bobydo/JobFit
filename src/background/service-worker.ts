// Service worker — OAuth token lifecycle only.
// ⚠ Do NOT add LLM calls or long-running operations here.
// MV3 service workers are suspended after ~30s — all analysis runs in the popup.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[JobFit] Extension installed.');
});

// Keep the service worker alive only long enough to handle token requests.
chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    if (message.type === 'GET_AUTH_TOKEN') {
      chrome.identity.getAuthToken({ interactive: message.interactive ?? true }, (token) => {
        if (chrome.runtime.lastError || !token) {
          sendResponse({ error: chrome.runtime.lastError?.message ?? 'No token returned' });
        } else {
          sendResponse({ token });
        }
      });
      return true; // keep channel open for async response
    }

    if (message.type === 'REMOVE_AUTH_TOKEN') {
      chrome.identity.removeCachedAuthToken({ token: message.token }, () => {
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message.type === 'OPEN_URL') {
      chrome.tabs.create({ url: message.url, active: true });
      sendResponse({ ok: true });
      return true;
    }
  }
);
