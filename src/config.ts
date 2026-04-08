// ── Extension owner config ─────────────────────────────────────────────────
// Edit these before building. Do not expose secrets to end users.

/** Cloudflare Worker URL for JobFit Cloud token validation */
export const WORKER_URL = 'https://YOUR_WORKER.workers.dev';

/** Stripe Payment Link — Pro plan ($11/mo, 2 resumes, 120 analyses/day) */
export const STRIPE_PRO_URL = 'https://buy.stripe.com/YOUR_PRO_LINK';

/** Google Form — user account registration / waitlist sign-up */
export const SIGNUP_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd0Ni9nc7xpe54ejSmynQEwW2Y9OfBqJJAjvHzCOp9R_ReiVw/viewform?usp=sf_link';

// ── LLM model defaults ────────────────────────────────────────────────────
export const OLLAMA_MODEL        = 'qwen3:8b';
export const OLLAMA_BASE_URL     = 'http://localhost:11434';
export const GROQ_DEFAULT_MODEL      = 'llama-3.1-8b-instant';
// https://console.groq.com/keys — create a free account to get an API key, then set it in extension Settings → BYOK
// For testing without an API key, the extension will fall back to a shared key with very limited capacity — expect delays and possible failures.
export const GROQ_DEFAULT_API_KEY    = import.meta.env.VITE_GROQ_DEFAULT_API_KEY ?? '';
export const OPENAI_DEFAULT_MODEL    = 'gpt-4o-mini';
export const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

// ── General defaults ───────────────────────────────────────────────────────
export const DEFAULT_MAX_RESUMES   = 2;   // 1–5
export const DEFAULT_MAX_JOB_POSTS = 60;  // 1–100
export const DEFAULT_STALE_JOB_DAYS = 10; // 1–90
export const DEFAULT_SAVE_FOLDER   = 'jobfit';

// ── Observability — Langfuse ───────────────────────────────────────────────
// Set LANGFUSE_ENABLED = false to disable all tracing with zero overhead.
// When true, keys/host are read from chrome.storage (Settings → Observability).
export const LANGFUSE_ENABLED  = true;
export const LANGFUSE_BASE_URL = 'http://localhost:3001';
export const LANGFUSE_SECRET_KEY = import.meta.env.VITE_LANGFUSE_SECRET_KEY ?? '';
export const LANGFUSE_PUBLIC_KEY = import.meta.env.VITE_LANGFUSE_PUBLIC_KEY ?? '';

// ── Analysis popup window ─────────────────────────────────────────────────
export const ANALYSIS_POPUP_WIDTH  = 540;
export const ANALYSIS_POPUP_HEIGHT = 620;
export const ANALYSIS_POPUP_MARGIN = 16; // gap from screen edge (px)

// ── Daily analysis limit ──────────────────────────────────────────────────
// Derived — adjust DEFAULT_MAX_JOB_POSTS to scale this automatically
export const DAILY_ANALYSIS_LIMIT = DEFAULT_MAX_RESUMES * DEFAULT_MAX_JOB_POSTS; // 2 × 60 = 120

// ── Dev / test ─────────────────────────────────────────────────────────────
export const DEV_MODE     = false; // set true before dev builds — shows Ollama + Langfuse in Settings
export const TEST_LOG_DIR = 'src/logs';

