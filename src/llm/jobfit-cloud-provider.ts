import type { LLMProvider, LLMChatResult, LLMMessage } from './llm-provider';
import { WORKER_URL } from '../config';

export class JobfitCloudProvider implements LLMProvider {
  constructor(private _token: string) {}

  async chat(messages: LLMMessage[]): Promise<LLMChatResult> {
    const startTime = new Date();
    const res = await fetch(`${WORKER_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: this._token, messages }),
    });
    const endTime = new Date();

    if (res.status === 401) throw new Error('JobFit Pro token invalid — re-enter it in Settings → JobFit Pro.');
    if (res.status === 429) {
      const { error } = await res.json().catch(() => ({ error: '' })) as { error: string };
      throw new Error(error || 'Daily limit reached — resets at midnight UTC.');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`JobFit Pro error ${res.status}: ${text}`);
    }

    const data = await res.json() as {
      content: string;
      promptTokens: number;
      completionTokens: number;
      latencyMs: number;
    };

    return {
      content:          data.content,
      promptTokens:     data.promptTokens,
      completionTokens: data.completionTokens,
      latencyMs:        endTime.getTime() - startTime.getTime(),
      startTime,
      endTime,
    };
  }
}
