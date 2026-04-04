# JobFit — Gmail Job Application Assistant (Chrome Extension)

## Context

Job seekers waste time applying to roles that don't match their skills — keyword-based job search is noisy and misleading. This Chrome extension solves that by semantically comparing actual job description content against the user's resumes, producing a match score and skill gap summary so they can decide whether to apply before wasting effort.

The extension reads two Gmail labels the user manages (`resumes`, `jobposts`), fetches job description pages directly, runs LLM match analysis (locally via Ollama, or via Groq/Anthropic/OpenAI), and shows results in the popup for download. Privacy-first — no backend required except an optional Cloudflare Worker for JobFit Cloud subscription mode. Nothing written back to Gmail.

---

## Project Structure

```
jobfit/
├── manifest.json
├── package.json / tsconfig.json / vite.config.ts
├── src/
│   ├── background/service-worker.ts      # OAuth token lifecycle only
│   ├── popup/
│   │   ├── popup.html
│   │   └── components/
│   │       ├── App.tsx
│   │       ├── OnboardingScreen.tsx       # First-run label check
│   │       ├── ResumesTab.tsx             # Shows 2 resumes from label
│   │       ├── JobPostsTab.tsx            # URLs extracted from jobposts label
│   │       ├── ResultsTab.tsx             # Match scores + download
│   │       └── SettingsPanel.tsx          # LLM toggle, API key, save folder
│   ├── gmail/
│   │   ├── gmail-auth.ts                # chrome.identity.getAuthToken wrapper
│   │   └── gmail-client.ts              # Gmail REST v1: listMessages, getMessage (readonly)
│   ├── llm/
│   │   ├── llm-provider.interface.ts    # ILLMProvider interface + LLMConfig type
│   │   ├── llm-factory.ts              # Single switching point: all 5 modes
│   │   ├── jobfit-cloud-provider.ts    # POST to Cloudflare Worker with subscriptionToken
│   │   ├── groq-provider.ts            # api.groq.com/openai/v1/chat/completions
│   │   ├── anthropic-provider.ts       # api.anthropic.com/v1/messages
│   │   ├── openai-provider.ts          # api.openai.com/v1/chat/completions
│   │   ├── ollama-provider.ts          # localhost:11434/api/generate
│   │   └── prompts.ts                  # MATCH_ANALYSIS_PROMPT template
│   ├── analyzer/
│   │   ├── resume-reader.ts            # Reads up to 2 emails from resumes label
│   │   ├── jobpost-reader.ts           # Reads emails from jobposts label, extracts URLs
│   │   └── match-analyzer.ts           # Sends resume + job description to LLM
│   ├── storage/
│   │   ├── config-store.ts             # chrome.storage.sync — settings
│   │   └── result-store.ts             # chrome.storage.local — analysis results cache
│   └── utils/
│       ├── url-extractor.ts            # Regex href + bare URL extraction from email body
│       ├── job-crawler.ts             # fetch() job URL, detect login-wall, extract text
│       └── mime-decoder.ts             # base64url Gmail MIME body decoder
```

---

## Tech Stack

- **Chrome Extension Manifest V3** — Vite + `vite-plugin-web-extension`, TypeScript, React
- **Gmail API** — REST v1 via OAuth2 (`chrome.identity.getAuthToken`)
- **Local LLM** — Ollama at `http://localhost:11434` (model: `llama3.1` or `mistral`)
- **Cloud LLM (default)** — Groq API via Cloudflare Worker (dev's key, subscription model)
- **BYOK LLM** — Groq / Anthropic / OpenAI (user's own key, called directly from popup)
- **Storage** — `chrome.storage.sync` for config, `chrome.storage.local` for results cache

---

## Gmail API & Permissions

### OAuth Scopes — minimal set

| Scope | Category | Why needed |
|---|---|---|
| `gmail.readonly` | Sensitive | Read emails in `resumes` and `jobposts` labels |

**That's it.** No `gmail.modify`, no `gmail.compose`. Results are shown in the popup and downloaded locally — nothing written back to Gmail.

**Important caveat**: Gmail OAuth scopes apply to the whole mailbox — Google cannot restrict a token to specific labels. However, the extension enforces label-scoping in code: all `listMessages` queries use `label:resumes` or `label:jobposts` filters. The app never reads inbox at large.

### manifest.json key fields

```json
{
  "manifest_version": 3,
  "permissions": ["identity", "storage", "downloads"],
  "host_permissions": [
    "https://www.googleapis.com/*",
    "https://gmail.googleapis.com/*",
    "http://localhost:11434/*",
    "https://api.anthropic.com/*",
    "<all_urls>"
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/gmail.readonly"
    ]
  },
  "background": { "service_worker": "dist/background/service-worker.js", "type": "module" }
}
```

`<all_urls>` in `host_permissions` allows the service worker to `fetch` any job posting URL without CORS issues. Google flags this in Web Store review — justification: "required to fetch individual job description pages as directed by the user."

### Google Cloud Console setup (one-time)
1. Create project → Enable Gmail API
2. OAuth 2.0 credentials → App type: "Chrome Extension" → paste extension ID
3. No redirect URI needed — `chrome.identity` handles it via extension ID
4. OAuth consent screen → **Testing** mode for dev → add your own Gmail as a test user

**Dev/testing**: No Google review needed. Users see an "unverified" warning but can proceed via *Advanced → Go to JobFit anyway*.

**For public publishing** (`gmail.readonly` = sensitive scope):
- Requires Google OAuth verification (free, ~1–2 weeks)
- Must provide: privacy policy URL, app homepage, justification for the scope
- Justification to write: *"The extension reads only emails in user-created Gmail labels named 'resumes' and 'jobposts'. It does not read inbox or any other labels. No email data is sent to external servers — all processing runs locally via Ollama or a user-supplied API key."*
- Expect 3–6 email exchanges with Google's review team

---

## Gmail Labels

Both labels are created and managed **by the user** in Gmail. The extension only reads them — no label API calls needed.

| Label | Access | How user manages it |
|---|---|---|
| `resumes` | Read | User sends email to themselves with resume pasted in body, manually applies label. Max 2. |
| `jobposts` | Read | User sets up a Gmail filter to auto-label subscribed job posting emails (e.g. from LinkedIn, Indeed) |

### First-run onboarding screen

On first load, extension queries for `label:resumes` and `label:jobposts`. If either is missing, shows setup screen:

```
Welcome to JobFit!

To get started, create these Gmail labels:

  resumes    — send yourself an email with your resume pasted
               in the body, then apply this label
  jobposts   — set up a Gmail filter to auto-label your
               subscribed job alert emails here

[Open Gmail Labels Settings →]      [I've done this — continue]
```

"Open Gmail Labels Settings" → opens `https://mail.google.com/mail/#settings/labels` in new tab.
"I've done this" → re-queries and proceeds if both labels now exist.

### Resume label format

User sends email to themselves, applies `resumes` label:
- **Subject** = resume identifier shown in popup (e.g. `"Frontend Developer 2024"`)
- **Body** = full resume pasted as plain text

**2-resume cap** (`resume-reader.ts`): query `label:resumes` sorted by date desc → take 2 most recent → if more exist, show warning: *"Only 2 resumes supported. Showing the 2 most recent."*

### Jobposts label format

User sets up a Gmail filter:
- `From: (linkedin.com OR indeed.com OR jobs-noreply OR noreply@greenhouse.io ...)` → Apply label: `jobposts`
- Or manually drags job alert emails into the label

`jobpost-reader.ts` reads these emails and extracts all URLs from the body for the user to pick from.

---

## LLM Abstraction

### Monetization: Two models side by side

#### Model A — JobFit Cloud (SaaS subscription)
Developer purchases Groq API key, charges users a monthly fee. **Must use Groq** — Haiku/Sonnet cost more than the charge at daily usage volume.

| Plan | Price | Limit | Resumes | Groq cost | Stripe fee | **Profit/user** |
|---|---|---|---|---|---|---|
| Free trial | $0 | 10 total (one-time) | 1 | ~$0.00 | — | — |
| **Starter** | **$5/month** | **30/month** | **1** | ~$0.004 | ~$0.45 | **~$4.55** |
| **Pro** | **$15/month** | **10/day** (resets daily) | **2** | ~$0.043 | ~$0.74 | **~$14.22** |

**Starter** = casual job seeker, 1 resume, ~7–8 jobs/week.
**Pro** = active job seeker, 2 resumes (e.g. engineer + manager track), daily refresh so no monthly cap anxiety.

**At 1,000 users:** 500 Starter + 500 Pro → ~$9,385/month profit.

Groq free tier (14,400 req/day) covers early-stage volume before needing a paid Groq plan.

Requires a lightweight backend (Cloudflare Worker) to hold the Groq API key server-side — never exposed to the extension. Extension sends job + resume text to your worker, worker calls Groq, returns result.

Daily limit enforced in Cloudflare Worker KV store (token → plan tier + daily count). Reset at midnight UTC.

Upgrade prompt: after Starter hits 30-analysis cap → *"Upgrade to Pro — daily refresh + 2 resumes."*

#### Model B — BYOK (Bring Your Own Key)
App is free. User enters their own API key — they pay their provider directly. No backend needed.

Ideal for privacy-conscious IT professionals who already have API keys.

---

### Settings panel — LLM Mode

```
LLM Mode
────────────────────────────────────
● JobFit Cloud  (Pro plan — included)
○ My own API key
    Provider: [Groq ▾]
    API Key:  [••••••••••••••••]  [👁]
    ℹ Get a free Groq key at console.groq.com → API Keys
    Model:    [llama-3.1-8b-instant ▾]
○ Ollama  (local, fully private)
    Model:    [llama3.1 ▾]
    ℹ Install Ollama at ollama.com, then run: ollama pull llama3.1
```

**BYOK hint copy per provider** (shown below the API Key field when provider is selected):

| Provider | Hint text |
|---|---|
| Groq | `Get a free key at console.groq.com → API Keys. Free tier covers ~14,400 req/day.` |
| Anthropic | `Get a key at console.anthropic.com → API Keys. Add credits first — no free tier.` |
| OpenAI | `Get a key at platform.openai.com → API Keys. Add credits first — no free tier.` |

**Ollama hint** (shown when Ollama is selected):
```
Make sure Ollama is running locally.
Install: ollama.com  →  then run in terminal: ollama pull llama3.1
Status: ● Connected  /  ✗ Not detected (start Ollama and try again)
```
Ollama status is checked via `GET http://localhost:11434/api/tags` — show live dot indicator.

**API key field UX notes:**
- Show/hide toggle (👁 icon) — masked by default
- On save: call `provider.validateKey()` (separate from `isAvailable()`) — makes a lightweight test call with the key (e.g. list models endpoint or minimal completion). `isAvailable()` only checks connectivity, not key validity.
  - Groq: `GET https://api.groq.com/openai/v1/models` with `Authorization: Bearer {key}`
  - Anthropic: `POST /v1/messages` with a 1-token prompt — cheapest real validation
  - OpenAI: `GET https://api.openai.com/v1/models` with `Authorization: Bearer {key}`
- If validation fails: show inline error `"Could not connect — check your key and try again"`
- Keys stored in `chrome.storage.sync` (encrypted by Chrome, never leaves your device)

**BYOK waiver** (shown once when user first selects "My own API key", and permanently as fine print below the key field):
```
⚠ Your API key is stored locally on this device and used only to contact
your chosen provider. JobFit never transmits your key to any external server.
You are responsible for keeping your key secure and for any usage charges
incurred. If you suspect your key has been compromised, revoke it immediately
from your provider's dashboard.
```
User must click **"I understand — save key"** on first use (one-time acknowledgement stored in `chrome.storage.sync`). Subsequent saves skip the modal but fine print remains visible.

---

### LLM provider table

| Mode | Provider | Model | Cost | Key needed |
|---|---|---|---|---|
| Cloud (default) | Groq (dev's key) | `llama-3.1-8b-instant` | Subscription fee | No |
| BYOK | Groq | `llama-3.1-8b-instant` | ~$0.01/month | User's key |
| BYOK | Anthropic | `claude-haiku-4-5` | ~$0.27/month | User's key |
| BYOK | OpenAI | `gpt-4o-mini` | ~$0.05/month | User's key |
| Local | Ollama | `llama3.1` | Free | None |

*(costs based on 80 analyses/month = 40 jobs × 2 resumes)*

---

### Code abstraction

```typescript
// llm-provider.interface.ts
interface ILLMProvider {
  complete(prompt: string, systemPrompt?: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

type LLMMode = 'jobfit-cloud' | 'groq' | 'anthropic' | 'openai' | 'ollama';

// llm-factory.ts — the ONLY switching point
function getLLMProvider(config: LLMConfig): ILLMProvider {
  switch (config.mode) {
    case 'jobfit-cloud': return new JobFitCloudProvider(config.subscriptionToken);
    case 'groq':         return new GroqProvider(config.apiKey, config.model);
    case 'anthropic':    return new AnthropicProvider(config.apiKey, config.model);
    case 'openai':       return new OpenAIProvider(config.apiKey, config.model);
    case 'ollama':       return new OllamaProvider(config.ollamaBaseUrl, config.model);
  }
}
```

- `JobFitCloudProvider` calls your Cloudflare Worker endpoint with a subscription token
- All user-supplied API keys stored in `chrome.storage.sync` (encrypted by Chrome)
- `match-analyzer.ts` calls only `provider.complete(prompt)` — unaware of which backend

### ⚠ MV3 Service Worker Sleep — critical constraint

MV3 service workers are **ephemeral** — Chrome suspends them after ~30s of inactivity. Long-running LLM calls (especially Ollama, which can take 30–60s) will be killed if run in the service worker.

**Rule: all LLM calls must run in the popup context, not the service worker.**

- `match-analyzer.ts`, `resume-reader.ts`, `jobpost-reader.ts` — all called from popup components
- Service worker (`service-worker.ts`) handles **only** OAuth token lifecycle (short, fast operations)
- If a background analysis queue is needed in future, use `chrome.alarms` + chunked processing, not a single long-running fetch

### Cloudflare Worker contract (JobFit Cloud mode)

The Cloudflare Worker is a thin proxy that holds the Groq API key server-side.

**Request** (extension → Worker):
```json
POST https://your-worker.workers.dev/analyze
Authorization: Bearer {subscriptionToken}
Content-Type: application/json

{
  "prompt": "...",
  "model": "llama-3.1-8b-instant"
}
```

**Response** (Worker → extension):
```json
{ "result": "..." }
```

**Error responses:**
```json
{ "error": "unauthorized" }   // 401 — bad/expired subscriptionToken
{ "error": "rate_limited" }   // 429 — daily limit exceeded for this token
{ "error": "upstream_error" } // 502 — Groq API failure
```

Worker responsibilities:
- Validate `subscriptionToken` against a KV store (token → plan tier + daily count)
- Enforce daily limits per token before calling Groq
- Never expose the Groq API key in any response
- `subscriptionToken` is issued by your subscription system when user pays; stored in `chrome.storage.sync`

---

## Core Feature: Job Description Fetch + Match Analysis

### Job description fetch (`job-crawler.ts`)

Chrome extension service workers can `fetch` any URL in `host_permissions` without CORS restrictions.

```typescript
type CrawlResult =
  | { status: 'ok'; text: string }
  | { status: 'requires_login'; url: string }
  | { status: 'error'; message: string };
```

Steps:
1. `fetch(url)` from service worker
2. If redirected to a login/signin/auth path → return `requires_login`
3. Check HTML for login-wall signals: password `<input>`, "sign in to view" text
4. If clean: extract text from `<article>`, `<main>`, or `[class*="job"]` elements; fallback to `<body>`
5. Strip `<nav>`, `<footer>`, `<header>` before extraction
6. Return cleaned plain text

Per-URL status shown in Job Posts tab:
- `[Fetch]` — not yet fetched
- `⏳ Fetching...` — in progress
- `✓ Ready — [Analyze]` — text extracted, ready
- `🔒 Requires login` — user must open manually

### Match analysis (`match-analyzer.ts`)

User clicks "Analyze" on a fetched job URL. Runs against both resumes.

LLM prompt (`MATCH_ANALYSIS_PROMPT` in `prompts.ts`):
```
Resume A (title: {resumeA_subject}):
{resumeA_text}

Resume B (title: {resumeB_subject}):   ← omitted if only 1 resume
{resumeB_text}

Job Description:
{job_description_text}

Return a JSON array only. No markdown, no explanation, no code fences. Raw JSON only.
[
  {
    "company": "...",
    "role": "...",
    "resume_title": "...",
    "match_score": 0-100,
    "matched_skills": [...],
    "skill_gaps": [...],
    "recommendation": "Apply" | "Consider" | "Skip"
  }
]
One object per resume. If only 1 resume provided, return array with 1 object.
```

Result stored in `result-store.ts` keyed by job URL.

---

## Output

### Popup Results tab

```
[Google — Software Engineer]
─────────────────────────────
Resume A — Frontend Developer 2024
  Score: 78/100  ✓ Apply
  Matched: React, TypeScript, Node.js
  Gaps: Kubernetes, Go

Resume B — Full Stack Engineer
  Score: 52/100  ✗ Skip
  Matched: React, Node.js
  Gaps: Kubernetes, Go, ML Ops, 5yr exp required

[Download HTML]
```

### Download format

Filename: `yyyy-mm-dd-hhmmss-[resume-email-subject].html`
```
2024-03-15-091500-frontend-developer-2024.html
2024-03-15-091500-full-stack-engineer.html
```

- One HTML file **per resume** — 2 files per analysis run sharing the same timestamp
- Resume subject sanitized: lowercase, spaces → hyphens, max 40 chars
- HTML includes: clickable job URL, match score, matched skills, skill gaps, recommendation

### Save location

`chrome.downloads.download({ filename: '{subfolder}/...' })` — saves into user's `Downloads` directory.

- Default subfolder: `jobfit`
- Configurable in Settings (e.g. rename to `job-search-2024`)
- Stored in `config-store.ts`
- Chrome creates the subfolder automatically

---

## Popup UI Layout

```
[JobFit]                    [⚙ Settings]
─────────────────────────────────────────────
[Resumes] [Job Posts] [Results]
─────────────────────────────────────────────
<scrollable tab content>
─────────────────────────────────────────────
[Refresh]         LLM: ● Ollama (local)
```

- **Resumes tab**: up to 2 resumes listed by email subject, click to set as active
- **Job Posts tab**: emails from `jobposts` label, URLs listed per email with Fetch/Analyze buttons
- **Results tab**: completed analyses with Download HTML button
- **Settings**: LLM mode toggle, Ollama model, API key (masked), save folder name, Ollama status dot

---

## Dev Stages

| Stage | Goal | Milestone |
|---|---|---|
| 1 | Scaffold + OAuth + Gmail read | Read `resumes` and `jobposts` labels from extension |
| 2 | Onboarding screen + label check | Setup flow works; missing labels detected |
| 3 | Resume reader + URL extractor | Both resumes shown in popup; URLs listed per job email |
| 4 | Job crawler | Fetch job URLs; login-wall detection works |
| 5 | LLM abstraction + Ollama | `ILLMProvider` interface + factory + Ollama provider; match analysis runs in popup; results shown |
| 6 | Download HTML output | Files saved to correct folder with correct names |
| 7 | BYOK providers + Settings UI | Groq, Anthropic, OpenAI providers; Settings panel with per-provider hints, key validation (`validateKey()`), waiver modal; mode toggle works |
| 8 | JobFit Cloud mode | Cloudflare Worker deployed; `JobFitCloudProvider` calls worker with `subscriptionToken`; rate limit errors surfaced in UI |
| 9 | Error handling + polish | Ollama status dot; empty states; loading spinners; JSON parse guard for LLM markdown wrapping |

---

## Critical Files

- `manifest.json` — permissions, OAuth2, host_permissions for job URL fetching
- `src/llm/llm-provider.interface.ts` — abstraction contract; everything else depends on it
- `src/gmail/gmail-client.ts` — all Gmail REST reads; `listMessages` with label filters
- `src/utils/job-crawler.ts` — job description fetch + login-wall detection
- `src/analyzer/match-analyzer.ts` — LLM prompt + result parsing

---

## Product 2 — JobFit Talent (Web App)

A recruiter-facing talent marketplace. The Chrome extension acts as the user acquisition funnel into this platform.

### How users flow in

After a match analysis in the extension, show a CTA in the Results tab:
```
Want recruiters to find you?
Upload your resume to JobFit Talent — free.
[Upload Resume →]
```
Clicking opens the JobFit Talent web app in a new tab.

### Who uses it

| User | What they do | Cost |
|---|---|---|
| Job seekers | Create profile, upload resume, set job preferences, opt in to recruiter visibility | Free |
| Recruiters | Search/filter candidates by skills, location, experience — pay to unlock contact details | Paid |

### Revenue model (recruiter-facing)
- Pay-per-unlock: $5–15 per candidate contact revealed
- Monthly subscription: $99–299/month for unlimited search + unlocks
- 1,000 recruiters × $150/month = $150,000 MRR

### Data collected (legally clean — no Gmail API involved)
- **Email** — collected at signup via your own auth system. Use for billing, product updates, usage alerts, re-engagement.
- **Resume** — voluntarily uploaded directly by the user to your web app. Explicit consent. No Gmail API policy applies.
- **Job title / preferences** — entered by user on their profile.

BYOK and Ollama users (no Cloud subscription) can still create a Talent profile via optional onboarding — email signup must be opt-in, not required.

### Privacy policy must disclose
- What is collected (email, resume, job preferences)
- Who sees it (recruiters who pay to unlock)
- How to request deletion (GDPR Art. 17 / CCPA)
- How it is stored (encrypted at rest and in transit)

---

## YoutubeAnalyzer Integration — Skill Gap Learning

YoutubeAnalyzer is a separate project that indexes high-quality YouTube tutorials mapped to roadmap.sh skills. JobFit's LLM analysis already outputs `skill_gaps: [...]` — these map directly to YoutubeAnalyzer's search API.

### Integration point

After match analysis, JobFit calls the YoutubeAnalyzer API with the identified skill gaps and surfaces recommended videos inline.

```
match-analyzer.ts produces:
  skill_gaps: ["Kubernetes", "Go", "ML Ops"]

→ GET https://youtubeanalyzer-api/videos?skills=Kubernetes,Go,ML+Ops
→ returns top 2–3 videos per skill gap (ranked by relevance_score)
→ shown in Results tab under each gap
```

### Updated Results tab UI

```
Resume A — Frontend Developer 2024
  Score: 78/100  ✓ Apply
  Matched: React, TypeScript, Node.js
  Gaps: Kubernetes, Go
    📺 Kubernetes for Beginners — TechWorld (relevance: 92)
    📺 Go in 100 Seconds — Fireship (relevance: 87)
    [Show more →]
```

### Where it appears across both products

| Product | Integration point |
|---|---|
| Chrome Extension | Results tab — "Learn these skills" section beneath each skill gap list |
| JobFit Talent (web app) | Candidate profile page — recommended videos based on skill gaps vs target roles |

### ⚠ Prerequisite — fix YoutubeAnalyzer skill search first

From YoutubeAnalyzer project: the skill-to-video search gap is **currently unresolved**. Searching by skill name (e.g. "Kubernetes") does not reliably match LLM-extracted `topics_covered` on videos because no `skill_id` FK exists on the videos table yet.

**Do not integrate until this is fixed.** Sequence:
1. Add `skill_id` FK to YoutubeAnalyzer `videos` table (next planned task in that project)
2. Re-ingest existing videos with skill vocabulary passed to `extract_topics()`
3. Then wire JobFit Results tab → YoutubeAnalyzer API

### New file needed in JobFit

```
src/services/
  youtube-recommender.ts   # GET YoutubeAnalyzer API with skill_gaps[], return VideoResult[]
```

This is a thin client — no logic, just a fetch wrapper. Called from `ResultsTab.tsx` after analysis completes.

---

## Publishing Reference

### Process 1 — Chrome Web Store (the extension itself)

**Do NOT email anyone.** Everything is done through the Chrome Web Store Developer Dashboard.

Steps:
1. Build the extension: `npm run build` → produces `dist/` folder
2. Zip the `dist/` folder → `jobfit.zip`
3. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Pay **$5 one-time** developer registration fee (Google account required)
5. Click "New Item" → upload `jobfit.zip`
6. Fill in the store listing: name, description, screenshots, category
7. Add a **Privacy Policy URL** (required — must explain what Gmail data you access and why)
8. Submit for review → Google reviews in **1–3 business days** (up to 1 week for new accounts)
9. Extension goes live after approval

Chrome Web Store review checks: no malware, no policy violations, manifest matches what the extension actually does. They do NOT review your OAuth scopes — that is a separate process.

---

### Process 2 — Google OAuth Verification (Gmail API permission)

**Also done through a dashboard, not by emailing the Gmail team.**

This removes the "unverified app" warning users see on the OAuth consent screen. Required for public publishing.

Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com) → your project → APIs & Services → OAuth consent screen
2. Click **"Prepare for verification"**
3. Fill in:
   - App homepage URL
   - Privacy policy URL (same one as Chrome Web Store)
   - Authorized domains
   - Justification for `gmail.readonly` scope — write clearly:
     *"JobFit reads only emails in two Gmail labels ('resumes' and 'jobposts') that the user creates themselves. It never reads inbox or any other label. When using Ollama or a user-supplied API key (BYOK mode), no email content leaves the user's device. When using JobFit Cloud mode, resume and job description text is sent to a Cloudflare Worker proxy which forwards it to Groq for analysis — this is disclosed to users in the Settings panel before they enable Cloud mode."*
4. Submit → Google sends confirmation email
5. Expect **3–6 follow-up emails** asking clarifying questions (same as YouTube API quota increase process)
6. Typical timeline: **1–3 weeks**

**Order matters — do Chrome Web Store review FIRST, then OAuth verification**, because Google OAuth review asks for your published app's homepage URL.

---

### Process 3 — Can users grant label-only read permission?

**No.** Gmail OAuth scopes are all-or-nothing — `gmail.readonly` grants read access to the entire mailbox, not just specific labels. Google does not offer a label-scoped OAuth permission.

What protects user privacy is not the OAuth scope but **your code**:
- Every `listMessages` call in `gmail-client.ts` uses `label:resumes` or `label:jobposts` query filter
- The extension never queries inbox, sent, or any other label
- This is what you explain in the OAuth verification justification above

Users grant `gmail.readonly` via the Google consent popup when they first open the extension. They see exactly what the app is requesting. Your OAuth consent screen description must clearly state the label-only access.

---

### Summary — what to do and when

| Step | When | Where | Contact needed? |
|---|---|---|---|
| Build + test | During dev | Your machine (Testing mode) | No |
| Chrome Web Store review | When ready to publish | [Web Store Dashboard](https://chrome.google.com/webstore/devconsole) | No — form only |
| Google OAuth verification | After Web Store is live | [Cloud Console](https://console.cloud.google.com) | No — form + email Q&A |
| User grants permission | On first extension open | Google consent popup in Chrome | No — automatic |

---

## Verification

1. Load unpacked extension → OAuth consent popup appears → token granted
2. Open popup with no Gmail labels → onboarding screen shown
3. Create `resumes` + `jobposts` labels in Gmail → click "I've done this" → main UI loads
4. Send self-email with resume, apply `resumes` label → appears in Resumes tab
5. Apply `jobposts` label to a job alert email → appears in Job Posts tab with extracted URLs
6. Click "Fetch" on a job URL → text extracted; click "Fetch" on a login-walled URL → shows 🔒
7. Click "Analyze" → results shown in Results tab
8. Click "Download HTML" → 2 files saved to `Downloads/jobfit/` with correct filenames
9. Switch LLM mode to Anthropic → enter API key → re-run analysis → same result format

---

## Release Strategy

| Phase | When | Action |
|---|---|---|
| Dev testing | Now → Stage 4 | Add testers manually to Google Cloud → Test users (max 100). Share `dist/` zip + load unpacked instructions. |
| Beta | After Stage 5 (LLM analysis working) | Upload to Chrome Web Store ($5 one-time fee). Review is fast — 1–3 days. Real users can install with one click. |
| Public launch | After Chrome Web Store approved | Submit Google OAuth verification to remove "unverified" warning. Do this AFTER Web Store is live — Google asks for your published app URL. |

**Don't submit OAuth verification early** since it's slow (1–3 weeks, multiple emails). Build first, publish to Web Store, then verify.
