# JobFit Setup Checklist

## Google Cloud Console (project: JobFit)
- https://console.cloud.google.com/ → sign in → select JobFit project

- [ ] Gmail API enabled
  - Left menu: **APIs & Services → Enabled APIs** → search `Gmail API` → Enable
- [ ] OAuth client created
  - Left menu: **Google Auth Platform → Clients** → Create Client → Chrome Extension
  - Item ID = Chrome extension ID from `chrome://extensions`
- [ ] Scope added
  - Left menu: **Google Auth Platform → Data access** → Add or remove scopes
  - Manually add: `https://www.googleapis.com/auth/gmail.readonly` → Update → Save
- [ ] Test user added
  - Left menu: **Google Auth Platform → Audience** → Test users → + Add users → your Gmail

## manifest.json
- [ ] `client_id` = OAuth client ID from Google Cloud Console

## Gmail (your account)
- [ ] Label `resumes` exists — send yourself an email with resume in body, apply label
- [ ] Label `jobposts` exists — apply to job alert emails

## Build & Load or Reload ↺
```bash
npm install
npm run build
```
Chrome → `chrome://extensions` → Developer mode ON → Load unpacked → select `dist/`

## Ollama (local mode)

Chrome extensions send requests with a `chrome-extension://` origin, which Ollama blocks by default (403 error). Fix by setting the `OLLAMA_ORIGINS` environment variable:

1. Search "Environment Variables" in Start Menu → **Edit the system environment variables**
2. Under **System Variables** → **New**:
   - Name: `OLLAMA_ORIGINS`
   - Value: `*`
3. Quit Ollama from the system tray and relaunch it

> This variable only affects Ollama. It does not interfere with Groq or other API modes.

## Future: Stripe + Cloudflare Worker (JobFit Cloud mode)

> Not needed for local testing. Set up when ready to accept real subscribers.

- [ ] Create Stripe account → create Payment Link (Pro $11/mo)
- [ ] Deploy Cloudflare Worker:
  - Receives Stripe webhook on payment → generates a unique token → emails it to customer
  - Exposes `POST /validate-token` → verifies token, returns `{ plan: 'starter' | 'pro' }`
  - Stores tokens in Cloudflare KV with daily usage counters (reset at midnight UTC)
- [ ] Fill in `src/config.ts`:
  - `WORKER_URL` = your deployed Worker URL
  - `STRIPE_PRO_URL` = Pro Payment Link
- [ ] Test the token flow:
  1. Complete a test purchase on Stripe (use test mode)
  2. Receive confirmation email with token
  3. Open extension Settings → JobFit Cloud → paste token → verify "Token saved" appears
  4. Token is proof of payment — user pastes it once, extension remembers it via `chrome.storage.sync`

## Should see it after sign in
![FolderCheck](image/Setup/FolderCheck.png)