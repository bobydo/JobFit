import type { LLMProvider, LLMChatResult, LLMMessage } from './llm-provider';

export class OllamaProvider implements LLMProvider {
  constructor(private _baseUrl: string, private _model: string) {}

  async chat(messages: LLMMessage[]): Promise<LLMChatResult> {
    const url = `${this._baseUrl.replace(/\/$/, '')}/api/chat`;

    const startTime = new Date();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this._model, messages, stream: false, options: { temperature: 0 } }),
    });
    const endTime = new Date();

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const content: string = json?.message?.content ?? '';
    if (!content) throw new Error('Ollama returned empty content');

    return {
      content,
      promptTokens:     json?.prompt_eval_count ?? 0,
      completionTokens: json?.eval_count        ?? 0,
      latencyMs: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this._baseUrl.replace(/\/$/, '')}/api/tags`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }
}
