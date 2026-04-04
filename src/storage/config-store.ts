export type LLMMode = 'jobfit-cloud' | 'groq' | 'anthropic' | 'openai' | 'ollama';
export type ByokProvider = 'groq' | 'anthropic' | 'openai';
export type SubscriptionPlan = 'starter' | 'pro';

export interface AppConfig {
  mode: LLMMode;
  // JobFit Cloud
  subscriptionToken?: string;
  subscriptionPlan?: SubscriptionPlan;
  // BYOK
  byokProvider?: ByokProvider;
  apiKey?: string;
  byokAcknowledged?: boolean;
  // Ollama
  ollamaModel?: string;
  // General
  saveFolder: string;
}

const DEFAULTS: AppConfig = {
  mode: 'jobfit-cloud',
  saveFolder: 'jobfit',
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
