# Issue 1 Fix — Google Drive Resume Picker

## Current working state

- OAuth scope: `drive.readonly` (changed from `drive.file` which caused 404 on download)
- Picker HTML served by Cloudflare Worker at `https://jobfit-signup.baoshenyi.workers.dev/picker`
- Files download in parallel with a live progress bar
- pdfjs warnings silenced (`verbosity: 0`)
- Stale `activeResumeIds` pruned automatically on popup load

---

## Select → Download flow

1. User clicks **+ Add Resume from Drive** in the Resumes tab
2. `ensureDriveScopeConsent()` — invalidates cached token once so Chrome prompts for the new `drive.readonly` scope (flag key: `driveScopeConsented_v2`)
3. `getAuthToken(true)` — gets fresh OAuth token with `gmail.readonly` + `drive.readonly`
4. `DrivePickerBridge.pick(token)` — opens `https://jobfit-signup.baoshenyi.workers.dev/picker?extId=<id>` as a Chrome popup window
5. Picker page sends `{ type: 'requestToken' }` to extension via `chrome.runtime.sendMessage` (`externally_connectable`)
6. Extension replies with the OAuth token
7. Google Picker loads (filtered to PDFs, multi-select enabled)
8. User selects files → all files download **in parallel** via Drive API v3 (`/drive/v3/files/{id}?alt=media`)
9. Progress bar in picker window advances as each file completes; chunked base64 encoding per file
10. Picker page sends `{ type: 'filesPicked', files: [...] }` back to extension; window closes
11. Extension decodes base64 + runs `PdfParser.extractText()` in parallel for all files
12. `resumeStore.add()` saves each resume sequentially (avoids storage write races)
13. Resumes appear in UI with checkboxes; stale selection IDs pruned automatically

---

## Google Cloud Console — required setup

| What | Where |
|------|-------|
| OAuth 2.0 Client ID (Chrome extension type) | https://console.cloud.google.com → APIs & Services → Credentials |
| Google Drive API enabled | APIs & Services → Enabled APIs |
| Google Picker API enabled | APIs & Services → Enabled APIs |
| Scopes in manifest | `gmail.readonly`, `drive.readonly` |

---

## Cloudflare Worker

| | |
|-|-|
| **Base URL** | https://jobfit-signup.baoshenyi.workers.dev |
| **GET /picker** | Serves picker HTML page to extension |
| **POST /signup** | Writes user email to KV store |
| **Dashboard** | https://dash.cloudflare.com → Workers & Pages → `jobfit-signup` |
| **Source** | [worker/src/](worker/src/) — `index.ts` routes, `picker.ts` serves HTML, `signup.ts` handles KV |

---

## Rebuild + redeploy commands

```bash
# 1. Rebuild Chrome extension
cd d:/JobFit
npm run build
# Then go to chrome://extensions and click ↺ (reload) on JobFit

# 2. Deploy Cloudflare Worker
cd d:/JobFit/worker
npx wrangler deploy

# 3. If wrangler login has expired
npx wrangler login        # opens browser for approval
npx wrangler deploy

# 4. Verify picker is live
curl -i 'https://jobfit-signup.baoshenyi.workers.dev/picker?extId=test'
# Good: 200 with <title>JobFit — Pick Resume from Drive</title>

# 5. Verify signup still works
curl -i -X POST -H 'Content-Type: application/json' \
  -d '{"email":"smoke@test.dev"}' \
  'https://jobfit-signup.baoshenyi.workers.dev/signup'
# Good: 200 OK
```

---

## Failure recovery

### Picker shows "token is not defined" or 404 on download
- Check the OAuth scope in `manifest.json` is `drive.readonly` (not `drive.file`)
- Bump `DRIVE_CONSENT_FLAG` in `src/gmail/gmail-auth.ts` to force re-consent, rebuild, reload

### Checkboxes show wrong count (e.g. "2/2 selected" but all unchecked)
- Stale `activeResumeIds` in storage — the app prunes them automatically on next load
- Manual fix: chrome://extensions → JobFit → Inspect popup → **Application** → Extension Local Storage → delete `activeResumeIds`

### Worker not responding
```bash
curl -i 'https://jobfit-signup.baoshenyi.workers.dev/picker?extId=test'
# If not 200: redeploy with `cd d:/JobFit/worker && npx wrangler deploy`
```

### pdfjs warnings in chrome://extensions errors panel
- `verbosity: 0` is set in `src/utils/pdf-parser.ts` — rebuild and reload if warnings reappear
