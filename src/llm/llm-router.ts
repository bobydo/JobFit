import type { AppConfig } from '../storage/config-store';
import { ollamaChat } from './ollama-provider';
import { openaiCompatibleChat } from './openai-compatible-provider';
import { anthropicChat } from './anthropic-provider';
import { OLLAMA_MODEL, OLLAMA_BASE_URL } from '../config';

export interface LLMChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  startTime: Date;
  endTime: Date;
}

export type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string; }

export async function llmChat(config: AppConfig, messages: LLMMessage[]): Promise<LLMChatResult> {
  switch (config.mode) {
    case 'groq':
    case 'openai':
      return openaiCompatibleChat(config.mode, config.apiKey!, messages);

    case 'anthropic':
      return anthropicChat(config.apiKey!, messages);

    case 'ollama':
      return ollamaChat({
        baseUrl:  config.ollamaBaseUrl ?? OLLAMA_BASE_URL,
        model:    config.ollamaModel   ?? OLLAMA_MODEL,
        messages,
      });

    case 'jobfit-cloud':
      throw new Error('JobFit Cloud not yet implemented — use Groq or your own API key.');

    default:
      throw new Error(`Unknown LLM mode: ${config.mode}`);
  }
}
