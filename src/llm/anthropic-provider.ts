import type { LLMChatResult, LLMMessage } from './llm-router';
import { ANTHROPIC_DEFAULT_MODEL } from '../config';

export async function anthropicChat(
  apiKey: string,
  messages: LLMMessage[]
): Promise<LLMChatResult> {
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
  const userMessages = messages.filter((m) => m.role !== 'system');

  const startTime = new Date();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      ANTHROPIC_DEFAULT_MODEL,
      max_tokens: 1024,
      system:     systemMsg,
      messages:   userMessages,
    }),
  });
  const endTime = new Date();

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const content: string = json?.content?.[0]?.text ?? '';
  if (!content) throw new Error('Anthropic returned empty content');

  return {
    content,
    promptTokens:     json?.usage?.input_tokens  ?? 0,
    completionTokens: json?.usage?.output_tokens ?? 0,
    latencyMs: endTime.getTime() - startTime.getTime(),
    startTime,
    endTime,
  };
}
