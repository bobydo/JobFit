import type { LLMProvider, LLMChatResult, LLMMessage } from './llm-provider';
import { GROQ_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL, LLM_MAX_RETRIES, LLM_RETRY_FALLBACK_WAIT_MS } from '../config';

const BASE_URLS: Record<string, string> = {
  groq:   'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
};

const DEFAULT_MODELS: Record<string, string> = {
  groq:   GROQ_DEFAULT_MODEL,
  openai: OPENAI_DEFAULT_MODEL,
};

export class OpenAICompatibleProvider implements LLMProvider {
  private _baseUrl: string;
  private _model: string;

  constructor(provider: 'groq' | 'openai', private _apiKey: string) {
    this._baseUrl = BASE_URLS[provider];
    this._model   = DEFAULT_MODELS[provider];
  }

  async chat(messages: LLMMessage[]): Promise<LLMChatResult> {
    const startTime = new Date();

    for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
      const res = await fetch(`${this._baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this._apiKey}`,
        },
        body: JSON.stringify({ model: this._model, messages, temperature: 0 }),
      });

      if (res.status === 429) {
        if (attempt === LLM_MAX_RETRIES) throw new Error(`Rate limit — too many retries. Try again in a minute.`);
        const errText = await res.text().catch(() => '');
        const match = errText.match(/try again in ([\d.]+)s/i);
        const waitMs = match ? (parseFloat(match[1]) + 1) * 1000 : LLM_RETRY_FALLBACK_WAIT_MS;
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      const endTime = new Date();

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`LLM error ${res.status}: ${text}`);
      }

      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? '';
      if (!content) throw new Error('LLM returned empty content');

      return {
        content,
        promptTokens:     json?.usage?.prompt_tokens     ?? 0,
        completionTokens: json?.usage?.completion_tokens ?? 0,
        latencyMs: endTime.getTime() - startTime.getTime(),
        startTime,
        endTime,
      };
    }

    throw new Error(`LLM failed after ${LLM_MAX_RETRIES} retries`);
  }
}
