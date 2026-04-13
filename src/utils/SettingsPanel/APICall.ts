import type { ByokProvider, AppConfig } from '@storage/config-store';
import { WORKER_URL } from '../../config';

/**
 * Validates an API key against the provider's endpoint.
 * Returns true if the key is accepted, false if rejected.
 * Throws on network errors.
 */
export async function validateApiKey(provider: ByokProvider, key: string): Promise<boolean> {
  if (provider === 'groq' || provider === 'openai') {
    const url = provider === 'groq'
      ? 'https://api.groq.com/openai/v1/models'
      : 'https://api.openai.com/v1/models';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    return res.ok;
  }

  // Anthropic: minimal 1-token completion
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });
  return res.ok;
}

export async function checkApiReady(cfg: AppConfig): Promise<boolean> {
  try {
    const mode = cfg.mode;

    if (mode === 'groq' || mode === 'openai' || mode === 'anthropic') {
      if (!cfg.apiKey) return false;
      return await validateApiKey(mode, cfg.apiKey);
    }

    if (mode === 'jobfit-cloud') {
      if (!cfg.subscriptionToken) return false;
      const res = await fetch(`${WORKER_URL}/validate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cfg.subscriptionToken }),
      });
      return res.ok;
    }

    if (mode === 'ollama') {
      const url = cfg.ollamaBaseUrl ?? 'http://localhost:11434';
      const res = await fetch(`${url}/api/tags`);
      return res.ok;
    }

    return false;
  } catch {
    return false;
  }
}
