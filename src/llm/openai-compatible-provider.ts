import type { LLMChatResult, LLMMessage } from './llm-router';
import { GROQ_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL } from '../config';

const PROVIDER_BASE_URLS: Record<string, string> = {
  groq:   'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
};

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  groq:   GROQ_DEFAULT_MODEL,
  openai: OPENAI_DEFAULT_MODEL,
};

const MAX_RETRIES = 5;

export async function openaiCompatibleChat(
  provider: 'groq' | 'openai',
  apiKey: string,
  messages: LLMMessage[]
): Promise<LLMChatResult> {
  const baseUrl = PROVIDER_BASE_URLS[provider];
  const model   = PROVIDER_DEFAULT_MODELS[provider];

  const startTime = new Date();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0 }),
    });

    if (res.status === 429) {
      if (attempt === MAX_RETRIES) throw new Error(`${provider} rate limit — too many retries. Try again in a minute.`);
      const errText = await res.text().catch(() => '');
      const match = errText.match(/try again in ([\d.]+)s/i);
      const waitMs = match ? (parseFloat(match[1]) + 1) * 1000 : 15000;
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    const endTime = new Date();

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${provider} error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error(`${provider} returned empty content`);

    return {
      content,
      promptTokens:     json?.usage?.prompt_tokens     ?? 0,
      completionTokens: json?.usage?.completion_tokens ?? 0,
      latencyMs: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime,
    };
  }

  throw new Error(`${provider} failed after ${MAX_RETRIES} retries`);
}
