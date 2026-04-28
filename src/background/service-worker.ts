// Service worker — OAuth token lifecycle only.
// ⚠ Do NOT add LLM calls or long-running operations here.
// MV3 service workers are suspended after ~30s — all analysis runs in the popup.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[JobFit] Extension installed.');
});

// Keep the service worker alive only long enough to handle token requests.
chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_STORAGE') {
    chrome.storage.sync.get(msg.keys, sendResponse);
    return true;
  }
  if (msg.type === 'SET_STORAGE') {
    chrome.storage.sync.set(msg.payload, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'REMOVE_STORAGE') {
    chrome.storage.sync.remove(msg.keys, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'OPEN_POPUP') {
    chrome.windows.create({
      url: chrome.runtime.getURL('src/popup/popup.html'),
      type: 'popup', width: 420, height: 680,
    }, () => sendResponse({ ok: true }));
    return true;
  }
});

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
  }
);
