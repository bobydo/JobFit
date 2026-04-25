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
