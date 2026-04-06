// ── Extension owner config ─────────────────────────────────────────────────
// Edit these before building. Do not expose secrets to end users.

/** Cloudflare Worker URL for JobFit Cloud token validation */
export const WORKER_URL = 'https://YOUR_WORKER.workers.dev';

/** Stripe Payment Link — Pro plan ($11/mo, 2 resumes, 50 analyses/day) */
export const STRIPE_PRO_URL = 'https://buy.stripe.com/YOUR_PRO_LINK';

// ── Ollama defaults ────────────────────────────────────────────────────────
// Shown as placeholder values in Settings; stored in chrome.storage after first save.
export const OLLAMA_MODEL    = 'qwen3:8b';
export const OLLAMA_BASE_URL = 'http://localhost:11434';

// ── General defaults ───────────────────────────────────────────────────────
export const DEFAULT_MAX_RESUMES   = 2;   // 1–5
export const DEFAULT_MAX_JOB_POSTS = 50;  // 1–100
export const DEFAULT_STALE_JOB_DAYS = 10; // 1–90
export const DEFAULT_SAVE_FOLDER   = 'jobfit';

// ── Observability — Langfuse ───────────────────────────────────────────────
// Set LANGFUSE_ENABLED = false to disable all tracing with zero overhead.
// When true, keys/host are read from chrome.storage (Settings → Observability).
export const LANGFUSE_ENABLED  = true;
export const LANGFUSE_BASE_URL = 'http://localhost:3001';
export const LANGFUSE_SECRET_KEY="sk-lf-a8393b5d-8362-4795-b531-3d263b00a8ae"
export const LANGFUSE_PUBLIC_KEY="pk-lf-d9005f8b-0804-40db-aa61-a2a3911d17d5"

// ── Dev / test ─────────────────────────────────────────────────────────────
export const TEST_LOG_DIR     = 'src/logs';

