const isDev = import.meta.env.DEV;

if (isDev) {
  chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension reloaded (dev mode)");
  });
}