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
  // General
  saveFolder: string;
  maxResumes: number;
  maxJobPosts: number;
  staleJobDays: number;
}

const DEFAULTS: AppConfig = {
  mode: 'jobfit-cloud',
  saveFolder: 'jobfit',
  maxResumes: 2,
  maxJobPosts: 50,
  staleJobDays: 10,
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
