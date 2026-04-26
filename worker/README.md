# JobFit Worker

Cloudflare Worker hosting two routes:

- `POST /signup` — stores email signups in the `SIGNUPS` KV namespace (existing behavior, ported from the dashboard-edited worker).
- `GET /picker` — serves the Google Drive Picker page that the JobFit Chrome extension opens when the user clicks **Add Resume from Drive**.

## Layout

```
worker/
├── wrangler.toml            # Worker config + KV binding
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts             # Route dispatcher
    ├── signup.ts            # POST /signup handler
    ├── picker.ts            # GET /picker handler
    ├── picker.html          # Google Picker page (HTML+JS)
    └── types.d.ts           # *.html → string module declaration
```

## First-time setup

> Run all commands from this `worker/` folder.

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

Opens a browser. Approve the request.

### 2. Fill in `wrangler.toml`

You need the **KV namespace ID** for `SIGNUPS`. Either:

- Read it from Cloudflare dashboard → Workers & Pages → KV → `SIGNUPS` → ID, **or**
- Run `npx wrangler kv namespace list` and copy the `id` for `SIGNUPS`.

Replace `REPLACE_WITH_SIGNUPS_KV_NAMESPACE_ID` in `wrangler.toml`.

### 3. Set up Google Cloud (one-time)

In the Google Cloud project that owns the JobFit OAuth client:

1. **APIs & Services → Library** → enable **Google Picker API**.
2. **Credentials → Create credentials → API key**.
3. Restrict the new key:
   - **Application restrictions**: HTTP referrers → `https://jobfit-signup.baoshenyi.workers.dev/*`
   - **API restrictions**: Google Picker API only.
4. Copy the key.

### 4. Set the worker secret

```bash
npx wrangler secret put DRIVE_API_KEY
```

Paste the API key when prompted.

### 5. First deploy

```bash
npx wrangler deploy
```

This replaces the dashboard-edited worker with the local source. Existing `/signup` behavior is preserved (same logic, ported into `src/signup.ts`).

## Verifying

```bash
# Picker route — should return HTML, no __DRIVE_API_KEY__ placeholder visible
curl -i 'https://jobfit-signup.baoshenyi.workers.dev/picker?extId=test'

# Existing signup route — should still accept emails
curl -i -X POST -H 'Content-Type: application/json' \
  -d '{"email":"smoke@test.dev"}' \
  https://jobfit-signup.baoshenyi.workers.dev/signup
```

End-to-end:

1. Load the JobFit extension.
2. Resumes tab → **Add Resume from Drive**.
3. Picker opens, pick a PDF, window closes.
4. Resume appears with extracted text.

## Day-to-day commands

```bash
npm run typecheck    # tsc --noEmit
npm run dev          # local worker dev server
npm run deploy       # wrangler deploy (production)
```

## Optional — auto-deploy from GitHub

Add `.github/workflows/deploy-worker.yml`:

```yaml
name: Deploy worker
on:
  push:
    branches: [main]
    paths: ['worker/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: worker
      - run: npx wrangler deploy
        working-directory: worker
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Create `CLOUDFLARE_API_TOKEN` in Cloudflare → My Profile → API Tokens (template: "Edit Cloudflare Workers"), then add it to GitHub repo secrets.
