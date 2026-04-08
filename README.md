# JobFit

Chrome extension that matches resumes against job postings using a local LLM.

## Local Langfuse (observability)

```bash

git clone https://github.com/langfuse/langfuse.git
cd langfuse
docker compose up -d        # starts at http://localhost:3000 (or 3001 if you remapped the port)
start local docker
```
![Docker](image/README/Docker.png)

### In Langfuse (localhost:3001):
- Click + New Project → name it JobFit → Create
- Go to Settings → API Keys → Create new key pair
- Copy the Public Key (pk-lf-...) and Secret Key (sk-lf-...)

In `src/config.ts` set `LANGFUSE_ENABLED = true`, rebuild, then paste the keys into the extension under **Settings → Observability**.

Prompt logs (resume + job + generated prompt + LLM response) are sent to Langfuse when enabled. Auto-download to disk is suppressed to avoid notification spam; use the "📁 Log and Download folder" button in the Results tab to open the downloads folder.

- Run test.ts => npx vitest run --reporter=verbose

## AI Agent Building Blocks

| Building block | Examples | Use cases |
|---|---|---|
| **Models** | LLMs | Text generation, tool use, information extraction |
| | Other AI models | PDF-to-text, text-to-speech, image analysis |
| **Tools** | API | Web search, get real-time data, send email, check calendar |
| | Information retrieval | Databases, Retrieval Augmented Generation (RAG) |
| | Code execution | Basic calculator, data analysis |

## Fix log

| # | Fix | Files |
|---|-----|-------|
| 1 | Done jobs showed no date — both `✓ Done` badge and date now render together | `JobPostsTab.tsx` |
| 2 | `JobEmail.date` as `Date` caused "Invalid Date" after Chrome storage round-trip — changed to Unix ms `number` | `types.ts`, `gmail-client.ts`, `JobPostsTab.tsx`, `match-analyzer.ts` |
| 3 | Results appeared all-at-once instead of one-by-one — `setResultsData` restored inside innermost loop | `App.tsx` |
| 4 | Progress banner showed `0/1` instead of `1/6` — tracks URL count, increments inside URL loop | `App.tsx` |
| 5 | "Analyze Selected" → Results tab jump kept breaking — added comment explaining standalone window flow | `App.tsx` |
| 6 | Standalone window overlapped Chrome download panel — opens on right edge of screen; size/margin in config | `App.tsx`, `config.ts` |
| 7 | Per-pair `chrome.downloads.download()` spammed notification bubbles over Results UI — `savePromptLog` suppressed (no-op) | `prompt-logger.ts`, `App.tsx` |
| 8 | "📁 Log and Download folder" button added to Results tab toolbar | `ResultsTab.tsx` |
| 9 | Download report grouped by `jobEmailId` so only first job URL appeared — fixed to group by `jobUrl \|\| jobEmailId` | `ResultsTab.tsx` |
| 10 | Langfuse tracer missing `type: 'trace-create'` in ingestion batch body | `langfuse-tracer.ts` |
| 11 | Prompt logs note in README was stale (logs are now suppressed, not auto-downloaded) | `README.md` |
| 12 | No first-run guidance — added `settingsAcknowledged` flag; ⚙ button pulses and `👉 Start here` appears inline in header until user opens Settings once | `config-store.ts`, `App.tsx` |
