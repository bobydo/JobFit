# Chrome Extension Debug Setup

## Debug

**DevTools is the recommended way.** VS Code F5 debugging is optional and complex (see Key Discovery section below).

### Popup code (e.g. `job-url-parsers.ts`, `match-analyzer.ts`, anything imported by `App.tsx`)

1. Open JobFit popup
2. Right-click anywhere in the popup → **Inspect**
3. In the DevTools window → **Sources** tab
4. Press **Ctrl+P** → type the filename (e.g. `job-url-parsers`) → select the **italic** entry
5. Click a line number to set a breakpoint

Replace step 4
you could drilling down from localhost
![1775919162816](image/Debug/1775919162816.png)

### Service worker code (e.g. `service-worker.ts`)

1. Go to `chrome://extensions`
2. Find JobFit → click **"Inspect service worker"** (opens a separate DevTools window)
3. **Sources** tab → **Ctrl+P** → type the filename → select the **italic** entry
4. Click a line number to set a breakpoint
5. Trigger the code (e.g. run an analysis from the popup) — execution will pause here

### Why each file appears twice in the Sources tree

- **Italic** = raw TypeScript served by Vite dev server (`localhost:5173`) — use this for breakpoints, line numbers match your source
- **Regular** = compiled JS bundled into the extension (`chrome-extension://...`) — line numbers won't match, avoid for breakpoints

Vite bundles your TS into `dist/` for the extension, but also serves the original `.ts` files over its local dev server so Chrome can resolve source maps. DevTools shows both.



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

## Daily workflow

### 1. Close Chrome completely
```powershell
Get-Process chrome | Stop-Process -Force
```

### 2. Build the extension
```powershell
cd D:\JobFit; npm run dev
```

## Root cause: Indeed job links silently dropped (2026-04-12)

**Problem:** Indeed application confirmation emails are `multipart/alternative` with two body parts:
- `text/plain` — contains only a "Contact Indeed" utility link, **no job link**
- `text/html` — contains the actual `apply.indeed.com?next=https://ca.indeed.com/viewjob?jk=XXX` job link

`getBodyForUrlExtraction` in `src/gmail/gmail-client.ts` was reading `text/plain` first and stopping there if it existed. The HTML part (and its job link) was never read.

**How the issue was found — reading the code:**

1. Open `src/gmail/gmail-client.ts`
2. Search for `getBodyForUrlExtraction` (around line 155)
3. Read the logic: `text/plain` is tried first; HTML is only read inside `if (!encoded)` — meaning HTML is skipped whenever a plain text part exists
4. Cross-reference with the raw email (via Gmail → ⋮ menu → "Show original") — confirmed `text/plain` has no job link, `text/html` does

**Fix:** Changed from "plain text first, HTML fallback" to "concatenate both parts":
- `src/gmail/gmail-client.ts` — `getBodyForUrlExtraction` now builds a `parts[]` array, pushes both plain and HTML decoded bodies, returns `parts.join('\n')`
- `extractCandidateUrls` already deduplicates via `new Set`, so overlap between parts is harmless

**Why this is generic:** Any `multipart/alternative` email where job links only appear in the HTML part is affected. LinkedIn alerts happened to be HTML-only (no plain text part), so they worked by accident. The fix is correct for all job email senders.

## Solve issue later
![1775919285240](image/Debug/1775919285240.png)

## Popup behavior

- **On the first click** of **“Analyze Selected”**:
  - Open the popup because:
    - Results disappear if the user clicks outside the extension
    - LLM takes time → needs a persistent UI

- **After the popup is opened**:
  - Do **NOT** open a new popup again
  - Reuse the **existing popup**
  - Keep the user inside that popup for all future actions


