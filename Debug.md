# Chrome Extension Debug Setup

## How it works

- VS Code launches Chrome via `pwa-chrome` (launch mode)
- Chrome loads the extension from `dist/` and opens Gmail
- Uses your real Chrome Profile 2 (`baoshenyi@gmail.com`) — already signed in
- `vite-plugin-web-extension` watches and rebuilds `dist/` on save (does NOT open browser)

---

## Daily workflow

### 1. Close Chrome completely
Chrome and VS Code cannot share the same profile simultaneously.
```powershell
Get-Process chrome | Stop-Process -Force
```

### 2. Build the extension
```powershell
cd D:\JobFit; npm run dev
```
Wait for "Wrote manifest.json" before continuing.

### 3. Press F5 in VS Code
Chrome opens with Profile 2 signed into Gmail + extension loaded.

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
