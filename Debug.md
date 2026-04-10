# Chrome Extension Debug Setup

## Key discovery (2026-04-10)

**Problem:** `vite-plugin-web-extension` was silently opening Chrome with a temp profile
(`C:\Users\baosh\AppData\Local\Temp\tmp-web-ext-*`) before VS Code could launch it.
This meant VS Code's `pwa-chrome` was attaching to the wrong Chrome instance — a fresh
anonymous profile with no Gmail sign-in and no real extension context.

**Fix:** Added `disableAutoLaunch: true` to `vite.config.ts` so the plugin only builds/watches
and never opens Chrome. VS Code's F5 is now the only thing that launches Chrome.

**Remaining issue (unresolved):** Chrome 127+ blocks `--remote-debugging-port=9222` when
using a real user profile. Attach mode (port 9222) does not work. Launch mode with
`pwa-chrome` opens Chrome with Profile 2 and Gmail signed in, but VS Code shows
"Unable to attach to browser." Next session: investigate why `pwa-chrome` debug pipe
fails with real profile, OR revert to `.vscode/chrome` custom profile + handle Gmail
auth through the extension's own `chrome.identity` OAuth popup (does not need Gmail
web session).

---

## How it works (current config)

- VS Code launches Chrome via `pwa-chrome` (launch mode)
- Chrome loads the extension from `dist/` and opens Gmail
- Uses real Chrome Profile 2 (`baoshenyi@gmail.com`) — Gmail signed in
- `vite-plugin-web-extension` watches/rebuilds `dist/` only — does NOT open browser

---

## Daily workflow

### 1. Close Chrome completely
```powershell
Get-Process chrome | Stop-Process -Force
```

### 2. Build the extension
```powershell
cd D:\JobFit; npm run dev
```
Wait for "Wrote manifest.json" before continuing.

### 3. Press F5 in VS Code

---

## VS Code config

### `.vscode/launch.json`
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Chrome",
      "type": "pwa-chrome",
      "request": "launch",
      "url": "https://mail.google.com",
      "webRoot": "${workspaceFolder}/src",
      "runtimeExecutable": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "userDataDir": "C:\\Users\\baosh\\AppData\\Local\\Google\\Chrome\\User Data",
      "runtimeArgs": [
        "--profile-directory=Profile 2",
        "--disable-extensions-except=${workspaceFolder}/dist",
        "--load-extension=${workspaceFolder}/dist"
      ]
    }
  ]
}
```

### `vite.config.ts` (key setting)
```ts
webExtension({
  manifest: 'manifest.json',
  watchFilePaths: ['src/**/*'],
  disableAutoLaunch: true   // prevents plugin from opening Chrome with temp profile
})
```

---

## Where to set breakpoints

| Target | How |
|---|---|
| Popup UI | Right-click extension icon → Inspect |
| Content scripts | F12 → Sources tab on target page |
| Background service worker | `chrome://extensions` → Inspect service worker |

---

## Reload extension after rebuild

Vite watch mode updates `dist/` automatically. If changes don't appear:
```
chrome://extensions → click Reload
```

---

## Known issues

### "It looks like a browser is already running from the configured userDataDir"
Your regular Chrome is open. Close it before pressing F5, or click "Debug Anyway".

### "Unable to attach to browser"
Chrome wasn't fully closed. Run `Get-Process chrome | Stop-Process -Force` then F5 again.

### Port 9222 not listening
Chrome 127+ blocks `--remote-debugging-port` with real user profiles. Attach mode won't work.
