# Issue 1 Fix — Replace Gmail-label Resumes with Google Drive Picker

Build succeeded. All extension-side work is done.

## Summary

### Changed

- [manifest.json](manifest.json) — added `drive.file` scope, `unlimitedStorage`, `apis.google.com` + Worker host perms, `externally_connectable` for the picker page
- [src/popup/components/ResumesTab.tsx](src/popup/components/ResumesTab.tsx) — replaced Gmail fetch with **Add Resume from Drive** button + per-row Delete
- [src/popup/components/App.tsx](src/popup/components/App.tsx) — dropped `labelExists('resumes')`, swapped cache → `getUploadedResumes()`, wired `onResumeDeleted` to clear selection
- [src/popup/components/OnboardingScreen.tsx](src/popup/components/OnboardingScreen.tsx) — removed the `resumes` label block; privacy text updated
- [src/gmail/gmail-auth.ts](src/gmail/gmail-auth.ts) — added `ensureDriveScopeConsent()` one-shot to refresh the token with the new scope
- [src/config.ts](src/config.ts) — added `PICKER_URL` and `DRIVE_API_KEY`
- [vite.config.ts](vite.config.ts) — custom plugin copies `pdf.worker.min.mjs` into `dist/assets/`; added `@drive` alias (mirrored in [tsconfig.json](tsconfig.json))
- [package.json](package.json) — `pdfjs-dist` added

### New

- [src/drive/drive-client.ts](src/drive/drive-client.ts) — `downloadFile` / `getFileMetadata`
- [src/drive/picker-bridge.ts](src/drive/picker-bridge.ts) — opens hosted picker window, handles `externally_connectable` messaging, resolves `{fileId, fileName}`
- [src/utils/pdf-parser.ts](src/utils/pdf-parser.ts) — pdfjs-dist text extraction with extension-local worker
- [src/storage/resume-store.ts](src/storage/resume-store.ts) — CRUD over `chrome.storage.local['uploadedResumes']`

### Verified

- `npm run build` succeeds; `dist/assets/pdf.worker.min.mjs` is emitted; built `manifest.json` has both OAuth scopes and the Worker origin wired into `host_permissions` + `externally_connectable`
- `npm run typecheck` — only 3 pre-existing errors (match-analyzer line 192, ByokSettings unused React import); my changed files typecheck clean

### Still needed before this works end-to-end (out-of-tree)

1. Deploy the `/picker` HTML page on the Cloudflare Worker (`jobfit-signup.baoshenyi.workers.dev/picker`) — it must request the token from the extension via `chrome.runtime.sendMessage`, run `gapi.load('picker')`, post `filePicked`/`pickerCancelled` back, then close.
2. Create a Google Cloud API key restricted to the Picker API and put it in `.env` as `VITE_DRIVE_API_KEY` so the picker page can use it.
3. Enable the Google Picker API in the same GCP project as the OAuth client.

---

## Data flow — picker URL

The extension opens this URL in a new chrome window when the user clicks **Add Resume from Drive**:

```
https://jobfit-signup.baoshenyi.workers.dev/picker?extId=<chrome.runtime.id>
└────────────────┬─────────────────────────┘└──┬───┘└─────────────┬──────────────┘
        Cloudflare Worker host              path       extension's runtime ID
```

The `extId` query param is the only way the picker page (a normal webpage, no relationship to the extension) learns which extension to talk back to. The extension passes its own `chrome.runtime.id`.

### Step-by-step (what happens when user clicks "Add Resume from Drive")

- Extension opens `https://jobfit-signup.baoshenyi.workers.dev/picker?extId=<id>` in a new window
- Worker returns the picker HTML page
- Picker page asks extension for OAuth token via `chrome.runtime.sendMessage`
- Extension replies with token
- Picker page loads Google Drive file browser (PDFs only)
- User picks a file → picker sends `{fileId, fileName}` back to extension → window closes
- Extension downloads the file from Drive, parses PDF text, saves to local storage, shows in UI

---

### Failure recovery — redeploy the worker

Use this if `/picker` stops working after a code change.

**Check it's broken:**
```bash
curl -i 'https://jobfit-signup.baoshenyi.workers.dev/picker?extId=test'
# Bad: 405 Method Not Allowed or wrong HTML
# Good: 200 with <title>JobFit — Pick Resume from Drive</title>
```

**Redeploy:**
```bash
cd d:/JobFit/worker
npx wrangler deploy
```
- If network timeout → retry, or check internet/VPN
- If login expired → `npx wrangler login` first, then redeploy

**Check signup still works after redeploy:**
```bash
curl -i -X POST -H 'Content-Type: application/json' \
  -d '{"email":"smoke@test.dev"}' \
  'https://jobfit-signup.baoshenyi.workers.dev/signup'
# Good: 200 OK
```

**Check worker source:** [worker/src/](worker/src/) in this repo — `index.ts` routes, `pickup.ts` serves HTML, `signup.ts` handles email KV writes

**Cloudflare dashboard (view logs / KV / secrets):**
- https://dash.cloudflare.com → Workers & Pages → `jobfit-signup`

**Wrangler login (if expired):**
```bash
npx wrangler login
# Approves in browser → then redeploy
```
