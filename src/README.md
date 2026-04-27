# JobFit — Frontend Source Guide

## What it does
Chrome extension that reads job emails from Gmail, fetches the job page, and runs LLM analysis to score how well your resume matches each job. Supports multiple LLM providers (Groq, OpenAI, Anthropic, Ollama, JobFit Pro cloud).

---

## Repo structure

```
src/
├── config.ts                         # All constants: URLs, limits, model names, feature flags
│
├── background/
│   └── service-worker.ts             # MV3 service worker — OAuth token lifecycle only
│
├── popup/
│   ├── main.tsx                      # React entry point
│   ├── popup.html                    # Extension popup HTML shell
│   ├── types.ts                      # Shared interfaces: Resume, JobEmail, AnalysisResult
│   ├── components/
│   │   ├── App.tsx                   # Root component — tab layout, settings panel
│   │   ├── Header.tsx                # Status bar: site sign-in, API status, Gmail email
│   │   ├── ResumesTab.tsx            # Upload/select resumes from Google Drive
│   │   ├── JobPostsTab.tsx           # Fetch job emails from Gmail, select for analysis
│   │   ├── ResultsTab.tsx            # Show scores, matched skills, skill gaps, download
│   │   ├── OnboardingScreen.tsx      # First-run: create Gmail labels guide
│   │   ├── SignInPrompt.tsx          # OAuth sign-in prompt
│   │   ├── shared.styles.ts          # Shared CSSProperties used across components
│   │   ├── SettingsPanel/
│   │   │   ├── SettingsPanel.tsx     # LLM mode, API keys, Pro subscription, Langfuse
│   │   │   └── ByokSettings.tsx     # BYOK key entry (Groq / OpenAI / Anthropic)
│   │   └── lessChange/
│   │       └── ScoreBadge.tsx        # Colored score pill component
│   └── hooks/
│       ├── useAppSetup.ts            # Label check, API readiness, site auth status
│       ├── useResumeSelection.ts     # Resume toggle, limit enforcement, storage sync
│       └── useAnalysis.ts            # Analysis orchestration, progress, error, results
│
├── analyzer/
│   ├── match-analyzer.ts             # MatchAnalyzer class — runs pairs, enforces quota, lead capture
│   ├── prompt-builder.ts             # PromptBuilder class — builds LLM scoring prompt
│   └── analysis-response-parser.ts  # AnalysisResponseParser — parses JSON from LLM response
│
├── llm/
│   ├── llm-provider.ts               # LLMProvider interface + LLMChatResult / LLMMessage types
│   ├── llm-provider-factory.ts       # LLMProviderFactory — picks provider from config
│   ├── llm-router.ts                 # llmChat() helper (thin wrapper over factory)
│   ├── anthropic-provider.ts         # AnthropicProvider class
│   ├── openai-compatible-provider.ts # OpenAICompatibleProvider (Groq + OpenAI, with retry)
│   ├── ollama-provider.ts            # OllamaProvider (local dev)
│   └── jobfit-cloud-provider.ts      # JobfitCloudProvider — calls worker /analyze endpoint
│
├── storage/
│   ├── config-store.ts               # ConfigStore — chrome.storage.sync (settings)
│   ├── cache-store.ts                # CacheStore — chrome.storage.local (results, daily count)
│   └── resume-store.ts               # ResumeStore — chrome.storage.local (uploaded resumes)
│
├── gmail/
│   ├── gmail-client.ts               # GmailClient — labels, messages, MIME decode
│   └── gmail-auth.ts                 # OAuth token get/remove, Drive scope consent
│
├── drive/
│   └── picker-bridge.ts              # DrivePickerBridge — window + postMessage for file picker
│
└── utils/
    ├── pdf-parser.ts                 # PdfParser — extracts text from PDF via pdfjs-dist
    ├── langfuse-tracer.ts            # LangfuseTracer — sends LLM traces to Langfuse
    ├── result-comparator.ts          # compareToBaseline() — used in tests
    ├── job_email/
    │   ├── job-page-fetcher.ts       # JobPageFetcher — static fetch + Chrome tab fallback
    │   └── job-url-parsers.ts        # JobSiteRegistry — 20+ job board URL parsers
    └── SettingsPanel/
        ├── APICall.ts                # checkApiReady() — test-calls the configured provider
        └── siteSignIn.ts             # recheckSites() — cookie-based auth detection
```

---

## High-level design

```
Gmail labels
  jobposts → JobPostsTab → JobPageFetcher → URLs → job content
  resumes  → ResumesTab  → DrivePickerBridge → PdfParser → resume text
                                ↓
                         MatchAnalyzer
                         ├── PromptBuilder      builds scoring prompt
                         ├── LLMProviderFactory picks provider from config
                         │   ├── GroqProvider / OpenAIProvider / AnthropicProvider
                         │   ├── OllamaProvider (local dev)
                         │   └── JobfitCloudProvider → Worker /analyze → GPT-4o mini
                         ├── AnalysisResponseParser  extracts score, skills, weights
                         └── CacheStore          saves results, tracks daily quota
                                ↓
                         ResultsTab
                         ├── BYOK:  score + summary + matched skills + upsell hint
                         └── Pro:   score + summary + matched skills + weights + gaps
```

---

## Key design decisions

- **OOP throughout** — all major components are classes (MatchAnalyzer, PromptBuilder, GmailClient, LangfuseTracer, JobPageFetcher, etc.)
- **Strategy + Factory** — LLMProviderFactory creates the right provider; adding a new LLM = one new class + one factory case
- **Repository pattern** — ConfigStore / CacheStore / ResumeStore wrap all chrome.storage calls
- **React custom hooks** — useAppSetup / useResumeSelection / useAnalysis separate business logic from UI
- **Daily quota** — BYOK enforced client-side (chrome.storage); Pro enforced server-side (Cloudflare KV)
- **Auto-detect Pro** — Settings calls /check-subscription with Gmail email; no token paste needed
- **Config constants** — all magic numbers live in config.ts (limits, timeouts, model names)

---

## Build

```bash
npm run build        # production build → dist/
npm run dev          # watch mode
npx vitest           # run tests
```

Load `dist/` as unpacked extension in Chrome → `chrome://extensions` → Load unpacked.
