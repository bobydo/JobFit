// ── Extension owner config ─────────────────────────────────────────────────
// Edit these before building. Do not expose secrets to end users.

/** Cloudflare Worker URL for JobFit Cloud token validation https://dash.cloudflare.com/e6f74de28b7ee985e010db5b9aa93162/home/overview*/
export const WORKER_URL = 'https://jobfit-signup.baoshenyi.workers.dev';

/** Hosted Google Drive Picker page — served by the Worker. Extension opens this in a new window. */
export const PICKER_URL = `${WORKER_URL}/picker`;

/** Google API key (restricted to Picker API) — injected at build time, used by the hosted picker page. */
export const DRIVE_API_KEY = import.meta.env.VITE_DRIVE_API_KEY ?? '';

/** Stripe Payment Link — Pro plan ($11/mo, 2 resumes, 120 analyses/day) */
export const STRIPE_PRO_URL = 'https://buy.stripe.com/YOUR_PRO_LINK';

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
// Gmail label cache (resumes/jobposts) — re-fetches after 5 min
export const GMAIL_CACHE_TTL_MS = 5 * 60 * 1000;  
// Analysis results — auto-cleared after 1 day
export const RESULTS_TTL_MS = 24 * 60 * 60 * 1000;  
// ── Job sites requiring user authentication ───────────────────────────────
// Add new sites here — everything else derives from this list automatically.
export interface AuthSiteConfig {
  displayName: string;
  signInUrl: string;       // opened when user needs to sign in
  cookieDomains: string[]; // all domains checked for auth cookies (covers regional TLDs)
  authCookies: string[];   // any of these present → signed in
}

export const AUTH_REQUIRED_DOMAINS: Record<string, AuthSiteConfig> = {
  'linkedin.com':  { displayName: 'LinkedIn',  signInUrl: 'https://www.linkedin.com/login',                    cookieDomains: ['.linkedin.com'],                    authCookies: ['li_at'] },
  'indeed.com':    { displayName: 'Indeed',    signInUrl: 'https://www.indeed.com/account/login',              cookieDomains: ['.indeed.com'],                      authCookies: ['PPID', 'SOCK'] },
  'glassdoor.com': { displayName: 'Glassdoor', signInUrl: 'https://www.glassdoor.com/profile/login_input.htm', cookieDomains: ['.glassdoor.com', '.glassdoor.ca'], authCookies: ['at'] },
};

// ── Observability — Langfuse ───────────────────────────────────────────────
// Set LANGFUSE_ENABLED = false to disable all tracing with zero overhead.
// When true, keys/host are read from chrome.storage (Settings → Observability).
export const LANGFUSE_ENABLED  = false;
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

