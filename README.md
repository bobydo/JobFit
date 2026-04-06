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

Prompt logs (resume + job + generated prompt + LLM response) are always saved to `Downloads/jobfit/logs/` as JSON regardless of Langfuse.

- Run test.ts => npx vitest run --reporter=verbose
