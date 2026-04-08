# JobFit Setup Checklist

## Local LLM Setup (Ollama + qwen3:8b)

1. **Download Ollama** — [https://ollama.com/download](https://ollama.com/download) → install for Windows
2. **Pull the model** — open a terminal and run:
   ```bash
   ollama pull qwen3:8b
   ```
3. **Verify it's running:**
   ```bash
   ollama list        # should show qwen3:8b
   ollama run qwen3:8b "hello"   # quick smoke test
   ```
4. Ollama serves at `http://localhost:11434` by default — no further config needed for JobFit local mode.

> `qwen3:8b` requires ~5 GB disk space and runs well on 8 GB RAM. For faster responses on weaker hardware, try `qwen3:4b` instead.

## Langfuse Setup (local observability)

1. **Download Docker Desktop** — [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) → install and launch it
2. **Clone Langfuse:**
   ```bash
   git clone https://github.com/langfuse/langfuse.git
   cd langfuse
   ```
3. **Start Langfuse:**
   ```bash
   docker compose up -d
   ```
   First run downloads ~1 GB of images. Wait ~30 seconds, then open [http://localhost:3000](http://localhost:3000) (or `3001` if you remapped the port).
4. **Create a project:**
   - Sign up / log in → **+ New Project** → name it `JobFit` → Create
5. **Get API keys:**
   - Go to **Settings → API Keys → Create new key pair**
   - Copy the **Public Key** (`pk-lf-...`) and **Secret Key** (`sk-lf-...`)
6. **Enable in JobFit:**
   - In `src/config.ts` set `LANGFUSE_ENABLED = true` → rebuild
   - Open the extension → **Settings → Observability** → paste both keys → Save

> To stop Langfuse: `docker compose down` inside the `langfuse/` folder. Data persists in Docker volumes.

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
