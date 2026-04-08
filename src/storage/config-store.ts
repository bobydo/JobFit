import { OLLAMA_MODEL, OLLAMA_BASE_URL, DEFAULT_MAX_RESUMES, DEFAULT_MAX_JOB_POSTS, DEFAULT_STALE_JOB_DAYS, DEFAULT_SAVE_FOLDER, LANGFUSE_ENABLED, LANGFUSE_BASE_URL, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, GROQ_DEFAULT_API_KEY } from '../config';
export type LLMMode = 'jobfit-cloud' | 'groq' | 'anthropic' | 'openai' | 'ollama';
export type ByokProvider = 'groq' | 'anthropic' | 'openai';
export type SubscriptionPlan = 'pro';

export interface AppConfig {
  mode: LLMMode;
  // JobFit Cloud
  subscriptionToken?: string;
  subscriptionPlan?: SubscriptionPlan;
  // BYOK
  byokProvider?: ByokProvider;
  apiKey?: string;
  byokAcknowledged?: boolean;
  // Ollama (local dev — no subscription required)
  ollamaModel?: string;
  ollamaBaseUrl?: string;
  // Observability (Langfuse)
  langfuseEnabled?: boolean;
  langfuseHost?: string;
  langfusePublicKey?: string;
  langfuseSecretKey?: string;
  // General
  saveFolder: string;
  maxResumes: number;
  maxJobPosts: number;
  staleJobDays: number;
  // Onboarding
  settingsAcknowledged?: boolean;
  emailSignupShown?: boolean;
}

const DEFAULTS: AppConfig = {
  mode: 'groq',
  apiKey: GROQ_DEFAULT_API_KEY,
  byokProvider: 'groq',
  ollamaModel: OLLAMA_MODEL,
  ollamaBaseUrl: OLLAMA_BASE_URL,
  langfuseEnabled: LANGFUSE_ENABLED,
  langfuseHost: LANGFUSE_BASE_URL,
  langfusePublicKey: LANGFUSE_PUBLIC_KEY,
  langfuseSecretKey: LANGFUSE_SECRET_KEY,
  saveFolder: DEFAULT_SAVE_FOLDER,
  maxResumes: DEFAULT_MAX_RESUMES,
  maxJobPosts: DEFAULT_MAX_JOB_POSTS,
  staleJobDays: DEFAULT_STALE_JOB_DAYS,
  settingsAcknowledged: false,
};

export async function getConfig(): Promise<AppConfig> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (items) => resolve(items as AppConfig));
  });
}

export async function saveConfig(patch: Partial<AppConfig>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(patch, resolve);
  });
}
